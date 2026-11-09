package com.supplylink.inventory.service;

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
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static com.supplylink.auth.service.AuthService.require;
import static com.supplylink.auth.service.AuthService.text;

/** Batch receipts, stock adjustments and quarantine, following the original batch rules. */
@Service
public class InventoryService {

    private final DatabaseStore     store;
    private final ProductRepository products;
    private final BatchRepository   batches;
    private final AuditRepository   audit;

    @Autowired
    public InventoryService(DatabaseStore store, ProductRepository products,
                            BatchRepository batches, AuditRepository audit) {
        this.store = store; this.products = products; this.batches = batches; this.audit = audit;
    }

    private static void requireStaff(Map<String, Object> actor) {
        require("admin".equals(actor.get("role")) || "distributor".equals(actor.get("role")),
                "Your role cannot perform this action.", 403);
    }

    private Map<String, Object> ownedProduct(Map<String, Object> actor, Object productId) {
        require(productId instanceof String, "Record not found.", 404);
        Map<String, Object> product = products.findById((String) productId)
                .orElseThrow(() -> new BusinessException("Record not found.", 404));
        require("admin".equals(actor.get("role")) || actor.get("id").equals(product.get("distributor_id")),
                "This medicine belongs to another distributor.", 403);
        return product;
    }

    private static long integer(Object v, String name, long min, long max) {
        boolean whole = v instanceof Integer || v instanceof Long || v instanceof Short;
        require(whole && ((Number) v).longValue() >= min && ((Number) v).longValue() <= max,
                name + " must be an integer between " + min + " and " + max + ".");
        return ((Number) v).longValue();
    }

    private static LocalDate date(Object v, String name) {
        require(v instanceof String, name + " is required (YYYY-MM-DD).");
        try {
            LocalDate parsed = LocalDate.parse((String) v);
            require(parsed.toString().equals(v), name + " must use YYYY-MM-DD.");
            return parsed;
        } catch (DateTimeParseException e) {
            throw new BusinessException(name + " must be a valid date (YYYY-MM-DD).", 400);
        }
    }

    /** Sellable stock = unexpired, non-quarantined batch stock. */
    private void syncStock(String productId) {
        long valid = 0;
        for (Map<String, Object> b : batches.findByProductId(productId)) {
            String status = PharmacyHelper.batchStatus(b);
            if ("available".equals(status) || "near_expiry".equals(status))
                valid += JsonbHelper.toLong(b.get("stock"));
        }
        products.setStock(productId, valid);
    }

    @Transactional
    public Map<String, Object> addBatch(Map<String, Object> actor, Map<String, Object> body) {
        store.acquireAdvisoryLock();
        requireStaff(actor);
        Map<String, Object> product = ownedProduct(actor, body.get("product_id"));
        String productId = (String) product.get("id");

        String number = text(body.get("batch_number"), "Batch ID / lot number", 60);
        require(!batches.existsByProductAndBatchNumber(productId, number),
                "Batch ID already exists for this medicine.", 409);
        LocalDate manufactured = date(body.get("manufacturing_date"), "Manufacturing date");
        LocalDate expires = date(body.get("expiry_date"), "Expiry date");
        require(!manufactured.isAfter(PharmacyHelper.today()), "Manufacturing date cannot be in the future.");
        require(expires.isAfter(manufactured), "Expiry date must be after the manufacturing date.");
        long mrp = integer(body.get("mrp"), "MRP including GST", 1, 100_000_000L);
        long cost = integer(body.getOrDefault("purchase_price", 0), "Purchase price excluding GST", 0, 100_000_000L);
        require(cost <= mrp, "Purchase price cannot exceed MRP.");
        require(product.get("gst_rate_bps") != null, "Configure the medicine GST rate first.");
        long rate = JsonbHelper.toLong(product.get("gst_rate_bps"));
        require(JsonbHelper.toLong(product.get("price")) * (10000 + rate) <= mrp * 10000,
                "MRP must cover the selling price including GST.");
        long stock = integer(body.get("stock"), "Opening batch stock", 0, 100_000_000L);

        if ("unallocated".equals(body.get("source"))) {
            long pending = JsonbHelper.toLong(product.get("unallocated_stock"));
            require(stock <= pending, "Quantity exceeds the historical stock awaiting batch details.", 409);
            products.setUnallocated(productId, pending - stock);
        }

        Map<String, Object> batch = new LinkedHashMap<>();
        batch.put("id",                 uid("batch"));
        batch.put("batch_number",       number);
        batch.put("manufacturing_date", manufactured.toString());
        batch.put("expiry_date",        expires.toString());
        batch.put("stock",              stock);
        batch.put("mrp",                mrp);
        batch.put("purchase_price",     cost);
        batch.put("quarantined",        false);
        batches.insert(batch, productId, batches.nextSortOrder(productId));
        products.markBatchTracked(productId);
        syncStock(productId);
        audit.insert((String) actor.get("id"), (String) actor.get("name"), "Batch received",
                product.get("sku") + ": " + number);
        return batch;
    }

    /** POST /api/inventory: adjust one batch's stock by a signed amount with a reason. */
    @Transactional
    public Map<String, Object> adjustStock(Map<String, Object> actor, Map<String, Object> body) {
        store.acquireAdvisoryLock();
        requireStaff(actor);
        Map<String, Object> product = ownedProduct(actor, body.get("product_id"));
        Map<String, Object> batch = findBatch(product, body.get("batch_id"));
        String reason = text(body.get("reason"), "Adjustment reason", 300);
        long change = integer(body.get("change"), "Stock adjustment", -100000, 100000);
        long stock = JsonbHelper.toLong(batch.get("stock"));
        require(stock + change >= 0, "Available batch stock cannot fall below zero.", 409);
        batches.adjustStock((String) batch.get("id"), change);
        syncStock((String) product.get("id"));
        audit.insert((String) actor.get("id"), (String) actor.get("name"), "Batch stock adjusted",
                product.get("sku") + " / " + batch.get("batch_number") + ": "
                        + (change >= 0 ? "+" : "") + change + " (" + reason + ")");
        return batches.findById((String) batch.get("id")).orElseThrow();
    }

    @Transactional
    public Map<String, Object> quarantineBatch(Map<String, Object> actor, Map<String, Object> body) {
        store.acquireAdvisoryLock();
        requireStaff(actor);
        Map<String, Object> product = ownedProduct(actor, body.get("product_id"));
        Map<String, Object> batch = findBatch(product, body.get("batch_id"));
        String reason = text(body.get("reason"), "Adjustment reason", 300);
        require(body.get("quarantined") instanceof Boolean, "Quarantine must be true or false.");
        batches.updateQuarantine((String) batch.get("id"), (Boolean) body.get("quarantined"));
        syncStock((String) product.get("id"));
        audit.insert((String) actor.get("id"), (String) actor.get("name"), "Batch quarantine updated",
                batch.get("batch_number") + ": " + reason);
        return batches.findById((String) batch.get("id")).orElseThrow();
    }

    private Map<String, Object> findBatch(Map<String, Object> product, Object batchId) {
        require(batchId instanceof String, "Record not found.", 404);
        List<Map<String, Object>> mine = batches.findByProductId((String) product.get("id"));
        return mine.stream().filter(b -> batchId.equals(b.get("id"))).findFirst()
                .orElseThrow(() -> new BusinessException("Record not found.", 404));
    }

    private static String uid(String prefix) {
        byte[] b = new byte[5];
        new SecureRandom().nextBytes(b);
        return prefix + "-" + HexFormat.of().formatHex(b);
    }
}
