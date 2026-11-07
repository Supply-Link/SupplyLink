package com.supplylink.product.service;

import com.supplylink.audit.repository.AuditRepository;
import com.supplylink.common.BusinessException;
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

    @Autowired
    public ProductService(DatabaseStore store, ProductRepository products,
                          BatchRepository batches, AuditRepository audit) {
        this.store = store; this.products = products;
        this.batches = batches; this.audit = audit;
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
        return list;
    }

    @Transactional
    public Map<String, Object> createProduct(Map<String, Object> actor, Map<String, Object> body) {
        store.acquireAdvisoryLock();
        require("admin".equals(actor.get("role")) || "distributor".equals(actor.get("role")),
                "Your role cannot perform this action.", 403);
        String name = text(body.get("name"), "Product name", 200);
        String sku = text(body.get("sku"), "SKU", 80);
        require(!products.existsBySkuLower(sku), "A product with this SKU already exists.", 409);
        boolean hasBatches = Boolean.TRUE.equals(body.get("has_batches"));
        Map<String, Object> p = new LinkedHashMap<>();
        p.put("id",           uid("prd"));
        p.put("name",         name);
        p.put("sku",          sku);
        p.put("category",     body.getOrDefault("category", ""));
        p.put("unit",         body.getOrDefault("unit", "unit"));
        p.put("price",        JsonbHelper.toLong(body.getOrDefault("price", 0)));
        p.put("gst_rate_bps", JsonbHelper.toInt(body.getOrDefault("gst_rate_bps", 500)));
        p.put("reorder",      JsonbHelper.toInt(body.getOrDefault("reorder_level", 0)));
        p.put("has_batches",  hasBatches);
        p.put("active",       true);
        String ownerId = "distributor".equals(actor.get("role")) ? (String) actor.get("id") : null;
        p.put("distributor_id", ownerId);
        p.put("brand",             body.getOrDefault("brand", ""));
        p.put("generic_name",      body.getOrDefault("generic_name", ""));
        p.put("strength",          body.getOrDefault("strength", ""));
        p.put("dosage_form",       body.getOrDefault("dosage_form", ""));
        p.put("manufacturer",      body.getOrDefault("manufacturer", ""));
        p.put("hsn_code",          body.getOrDefault("hsn_code", ""));
        p.put("storage_conditions",body.getOrDefault("storage_conditions", ""));
        p.put("art",               body.getOrDefault("artwork", "tablets"));
        p.put("color",             body.getOrDefault("color", "#e5eee6"));
        products.insert(p, products.nextSortOrder());
        audit.insert((String) actor.get("id"), (String) actor.get("name"),
                "Product created", name);
        if (hasBatches) p.put("batches", new ArrayList<>());
        return p;
    }

    @Transactional
    public Map<String, Object> updateProduct(Map<String, Object> actor, Map<String, Object> body) {
        store.acquireAdvisoryLock();
        require("admin".equals(actor.get("role")) || "distributor".equals(actor.get("role")),
                "Your role cannot perform this action.", 403);
        String id = text(body.get("id"), "Product ID", 50);
        Map<String, Object> p = products.findById(id)
                .orElseThrow(() -> new BusinessException("Product not found.", 404));
        require("admin".equals(actor.get("role")) || actor.get("id").equals(p.get("distributor_id")),
                "You do not own this product.", 403);
        products.updateFields(
                id,
                body.get("name")               instanceof String s ? s : null,
                body.get("brand")              instanceof String s ? s : null,
                body.get("category")           instanceof String s ? s : null,
                body.get("unit")               instanceof String s ? s : null,
                body.get("generic_name")       instanceof String s ? s : null,
                body.get("strength")           instanceof String s ? s : null,
                body.get("dosage_form")        instanceof String s ? s : null,
                body.get("manufacturer")       instanceof String s ? s : null,
                body.get("hsn_code")           instanceof String s ? s : null,
                body.get("gst_rate_bps"),
                body.get("storage_conditions") instanceof String s ? s : null,
                body.get("price"),
                body.get("reorder_level"),
                body.get("active")
        );
        audit.insert((String) actor.get("id"), (String) actor.get("name"),
                "Product updated", (String) p.get("name"));
        return products.findById(id).orElseThrow();
    }

    private static String uid(String prefix) {
        byte[] b = new byte[5]; new SecureRandom().nextBytes(b);
        return prefix + "-" + HexFormat.of().formatHex(b);
    }
}
