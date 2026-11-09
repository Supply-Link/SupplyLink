package com.supplylink.product.service;

import com.supplylink.audit.repository.AuditRepository;
import com.supplylink.common.BusinessException;
import com.supplylink.product.PharmacyHelper;
import com.supplylink.product.repository.BatchRepository;
import com.supplylink.product.repository.ProductRepository;
import com.supplylink.store.DatabaseStore;
import com.supplylink.store.JsonbHelper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.util.*;

import static com.supplylink.auth.service.AuthService.*;

@Service
public class ProductService {

    private final DatabaseStore     store;
    private final ProductRepository products;
    private final BatchRepository   batches;
    private final AuditRepository   audit;
    private final com.supplylink.user.repository.UserRepository users;
    private final com.supplylink.inventory.service.InventoryService inventory;

    @Autowired
    public ProductService(DatabaseStore store, ProductRepository products,
                          BatchRepository batches, AuditRepository audit,
                          com.supplylink.user.repository.UserRepository users,
                          com.supplylink.inventory.service.InventoryService inventory) {
        this.store = store; this.products = products;
        this.batches = batches; this.audit = audit;
        this.users = users; this.inventory = inventory;
    }

    @Transactional(readOnly = true)
    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> getProductsForUser(Map<String, Object> user) {
        String role = (String) user.get("role");
        List<Map<String, Object>> list = switch (role) {
            case "admin" -> products.findAll();
            case "distributor" -> products.findByDistributor((String) user.get("id"));
            default -> products.findActive();
        };
        List<String> ids = list.stream().filter(p -> p.get("batches") != null)
                .map(p -> (String) p.get("id")).toList();
        if (!ids.isEmpty()) {
            Map<String, List<Map<String, Object>>> batchMap = batches.findByProductIds(ids);
            for (Map<String, Object> p : list) {
                if (p.get("batches") != null)
                    ((List<Map<String, Object>>) p.get("batches")).addAll(
                            batchMap.getOrDefault((String) p.get("id"), Collections.emptyList()));
            }
        }
        // Derived fields clients rely on: per-batch status and the sellable stock summary.
        for (Map<String, Object> p : list) {
            if (p.get("batches") instanceof List<?> bl) {
                List<Map<String, Object>> pb = (List<Map<String, Object>>) bl;
                for (Map<String, Object> b : pb) b.put("status", PharmacyHelper.batchStatus(b));
                p.putAll(PharmacyHelper.stockSummary(p, pb));
            }
        }
        // Purchase prices are cost data: only admins and distributors may see them.
        if (!"admin".equals(role) && !"distributor".equals(role)) {
            for (Map<String, Object> p : list) {
                if (p.get("batches") instanceof List<?> bl)
                    for (Object b : bl)
                        if (b instanceof Map<?, ?> bm) bm.remove("purchase_price");
            }
        }
        return list;
    }

    private static final java.util.regex.Pattern HSN_RE = java.util.regex.Pattern.compile("[0-9]{4}|[0-9]{6}|[0-9]{8}");

    private static long whole(Object v, String name, long min, long max) {
        require(v instanceof Integer || v instanceof Long || v instanceof Short,
                name + " must be an integer between " + min + " and " + max + ".");
        long n = ((Number) v).longValue();
        require(n >= min && n <= max, name + " must be an integer between " + min + " and " + max + ".");
        return n;
    }

    private static void requireStaff(Map<String, Object> actor) {
        require("admin".equals(actor.get("role")) || "distributor".equals(actor.get("role")),
                "Your role cannot perform this action.", 403);
    }

    /** Validated tax/compliance fields shared by create and update; only keys present in the body are read. */
    private static void taxFields(Map<String, Object> body, Map<String, Object> out) {
        if (body.containsKey("manufacturer"))
            out.put("manufacturer", text(body.get("manufacturer"), "Manufacturer", 150));
        if (body.containsKey("storage_conditions"))
            out.put("storage_conditions", text(body.get("storage_conditions"), "Storage conditions", 300));
        if (body.containsKey("hsn_code")) {
            Object code = body.get("hsn_code");
            require(code instanceof String c && HSN_RE.matcher(c).matches(), "HSN must contain 4, 6, or 8 digits.");
            out.put("hsn_code", code);
        }
        if (body.containsKey("gst_rate_bps"))
            out.put("gst_rate_bps", whole(body.get("gst_rate_bps"), "GST rate (basis points)", 0, 4000));
    }

    @Transactional
    @SuppressWarnings("unchecked")
    public Map<String, Object> createProduct(Map<String, Object> actor, Map<String, Object> body) {
        store.acquireAdvisoryLock();
        requireStaff(actor);
        Object ownerId = "admin".equals(actor.get("role")) ? body.get("distributor_id") : actor.get("id");
        require(ownerId instanceof String, "Select an active distributor.");
        Map<String, Object> owner = users.findById((String) ownerId)
                .orElseThrow(() -> new BusinessException("Record not found.", 404));
        require("distributor".equals(owner.get("role")) && Boolean.TRUE.equals(owner.get("active")),
                "Select an active distributor.");
        String sku = text(body.get("sku"), "SKU", 40);
        require(!products.existsBySkuLower(sku), "SKU already exists.", 409);

        Map<String, Object> p = new LinkedHashMap<>();
        p.put("id",             uid("p"));
        p.put("distributor_id", ownerId);
        p.put("sku",            sku);
        p.put("name",           text(body.get("name"), "Product name", 100));
        p.put("brand",          text(body.get("brand"), "Brand", 100));
        p.put("category",       text(body.get("category"), "Category", 100));
        p.put("unit",           text(body.get("unit"), "Unit", 100));
        p.put("price",          whole(body.get("price"), "Price", 1, 100_000_000L));
        p.put("reorder",        whole(body.getOrDefault("reorder", 20), "Reorder level", 0, 100_000_000L));
        for (String f : new String[]{"generic_name", "strength", "dosage_form"})
            p.put(f, text(body.get(f), f.replace('_', ' '), 100));
        p.put("art", Map.of("Capsules", "capsules", "Cream", "tube", "MDI inhaler", "inhaler",
                "Powder", "sachet", "Topical solution", "bottle").getOrDefault(p.get("dosage_form"), "tablets"));
        p.put("color", "#e5eee6");
        taxFields(body, p);
        require(p.get("manufacturer") != null && p.get("hsn_code") != null && p.get("gst_rate_bps") != null,
                "Manufacturer, HSN, and GST rate are required.");
        p.put("has_batches", true);
        Object opening = body.get("opening_batch");
        if (opening == null)
            require(whole(body.getOrDefault("stock", 0), "Stock", 0, 100_000_000L) == 0,
                    "Receive opening stock with batch ID, manufacturing date, expiry, and MRP.");
        else require(opening instanceof Map, "Invalid opening batch.");

        products.insert(p, products.nextSortOrder());
        if (opening != null) {
            Map<String, Object> batch = new LinkedHashMap<>((Map<String, Object>) opening);
            batch.put("product_id", p.get("id"));
            inventory.addBatch(actor, batch);
        }
        audit.insert((String) actor.get("id"), (String) actor.get("name"), "Product saved", sku);
        return loadProduct((String) p.get("id"));
    }

    @Transactional
    @SuppressWarnings("unchecked")
    public Map<String, Object> updateProduct(Map<String, Object> actor, Map<String, Object> body) {
        store.acquireAdvisoryLock();
        requireStaff(actor);
        Object id = body.get("id");
        require(id instanceof String, "Record not found.", 404);
        Map<String, Object> p = products.findById((String) id)
                .orElseThrow(() -> new BusinessException("Record not found.", 404));
        require("admin".equals(actor.get("role")) || actor.get("id").equals(p.get("distributor_id")),
                "Product access denied.", 403);
        Map<String, Object> changes = new LinkedHashMap<>();
        for (String f : new String[]{"name", "brand", "category", "unit", "generic_name", "strength", "dosage_form"})
            if (body.containsKey(f)) changes.put(f, text(body.get(f), f, 100));
        taxFields(body, changes);
        if (body.containsKey("price")) changes.put("price", whole(body.get("price"), "Price", 1, 100_000_000L));
        Object reorder = body.containsKey("reorder") ? body.get("reorder") : body.get("reorder_level");
        if (reorder != null) changes.put("reorder", whole(reorder, "Reorder level", 0, 100_000_000L));
        if (body.containsKey("active")) {
            require(body.get("active") instanceof Boolean, "Active must be true or false.");
            changes.put("active", body.get("active"));
        }
        products.updateFields((String) id,
                (String) changes.get("name"), (String) changes.get("brand"), (String) changes.get("category"),
                (String) changes.get("unit"), (String) changes.get("generic_name"), (String) changes.get("strength"),
                (String) changes.get("dosage_form"), (String) changes.get("manufacturer"),
                (String) changes.get("hsn_code"), changes.get("gst_rate_bps"),
                (String) changes.get("storage_conditions"), changes.get("price"), changes.get("reorder"),
                changes.get("active"));
        audit.insert((String) actor.get("id"), (String) actor.get("name"), "Product saved", (String) p.get("sku"));
        return loadProduct((String) id);
    }

    /** One product with its batches, per-batch status and stock summary (cost data stays for staff only). */
    @SuppressWarnings("unchecked")
    private Map<String, Object> loadProduct(String id) {
        Map<String, Object> p = products.findById(id).orElseThrow();
        if (p.get("batches") instanceof List<?> bl) {
            List<Map<String, Object>> pb = (List<Map<String, Object>>) bl;
            pb.addAll(batches.findByProductId(id));
            for (Map<String, Object> b : pb) b.put("status", PharmacyHelper.batchStatus(b));
            p.putAll(PharmacyHelper.stockSummary(p, pb));
        }
        return p;
    }

    private static String uid(String prefix) {
        byte[] b = new byte[5]; new SecureRandom().nextBytes(b);
        return prefix + "-" + HexFormat.of().formatHex(b);
    }
}
