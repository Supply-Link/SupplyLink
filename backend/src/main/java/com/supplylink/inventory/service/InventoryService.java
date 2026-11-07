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
import java.util.*;

import static com.supplylink.auth.service.AuthService.*;

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

    @Transactional
    public Map<String, Object> addBatch(Map<String, Object> actor, Map<String, Object> body) {
        store.acquireAdvisoryLock();
        require("admin".equals(actor.get("role")) || "distributor".equals(actor.get("role")),
                "Your role cannot perform this action.", 403);
        String productId = text(body.get("product_id"), "Product ID", 50);
        Map<String, Object> product = products.findById(productId)
                .orElseThrow(() -> new BusinessException("Product not found.", 404));
        require(Boolean.TRUE.equals(product.get("has_batches")), "This product does not use batch tracking.");
        require("admin".equals(actor.get("role")) || actor.get("id").equals(product.get("distributor_id")),
                "You do not own this product.", 403);
        String batchNumber = text(body.get("batch_number"), "Batch number", 80);
        require(!batches.existsByProductAndBatchNumber(productId, batchNumber),
                "Batch number already exists for this product.", 409);
        String expiry = text(body.get("expiry_date"), "Expiry date", 10);
        Map<String, Object> b = new LinkedHashMap<>();
        b.put("id",           uid("bat"));
        b.put("product_id",   productId);
        b.put("batch_number", batchNumber);
        b.put("expiry_date",  expiry);
        b.put("quantity",     JsonbHelper.toInt(body.getOrDefault("quantity", 0)));
        b.put("stock",        JsonbHelper.toInt(body.getOrDefault("quantity", 0)));
        b.put("quarantined",  false);
        b.put("art",          body.getOrDefault("artwork", ""));
        int sortOrder = batches.nextSortOrder(productId);
        batches.insert(b, productId, sortOrder);
        int added = JsonbHelper.toInt(b.get("quantity"));
        products.adjustStock(productId, added);
        audit.insert((String) actor.get("id"), (String) actor.get("name"),
                "Batch added", batchNumber + " → " + product.get("name"));
        return b;
    }

    @Transactional
    public Map<String, Object> adjustStock(Map<String, Object> actor, Map<String, Object> body) {
        store.acquireAdvisoryLock();
        require("admin".equals(actor.get("role")) || "distributor".equals(actor.get("role")),
                "Your role cannot perform this action.", 403);
        String productId = text(body.get("product_id"), "Product ID", 50);
        Map<String, Object> product = products.findById(productId)
                .orElseThrow(() -> new BusinessException("Product not found.", 404));
        require("admin".equals(actor.get("role")) || actor.get("id").equals(product.get("distributor_id")),
                "You do not own this product.", 403);
        require(!Boolean.TRUE.equals(product.get("has_batches")),
                "Use batch operations to adjust stock for batch-tracked products.");
        int delta = JsonbHelper.toInt(body.get("delta"));
        int currentStock = JsonbHelper.toInt(product.getOrDefault("stock", 0));
        require(currentStock + delta >= 0, "Stock cannot go below zero.");
        products.adjustStock(productId, delta);
        audit.insert((String) actor.get("id"), (String) actor.get("name"),
                "Stock adjusted", product.get("name") + " by " + delta);
        return products.findById(productId).orElseThrow();
    }

    @Transactional
    public Map<String, Object> quarantineBatch(Map<String, Object> actor, Map<String, Object> body) {
        store.acquireAdvisoryLock();
        require("admin".equals(actor.get("role")) || "distributor".equals(actor.get("role")),
                "Your role cannot perform this action.", 403);
        String batchId = text(body.get("batch_id"), "Batch ID", 50);
        Map<String, Object> batch = batches.findById(batchId)
                .orElseThrow(() -> new BusinessException("Batch not found.", 404));
        Map<String, Object> product = products.findById((String) batch.get("product_id"))
                .orElseThrow(() -> new BusinessException("Product not found.", 404));
        require("admin".equals(actor.get("role")) || actor.get("id").equals(product.get("distributor_id")),
                "You do not own this product.", 403);
        boolean quarantine = Boolean.TRUE.equals(body.getOrDefault("quarantined", true));
        batches.updateQuarantine(batchId, quarantine);
        audit.insert((String) actor.get("id"), (String) actor.get("name"),
                quarantine ? "Batch quarantined" : "Batch released",
                (String) batch.get("batch_number"));
        return batches.findById(batchId).orElseThrow();
    }

    private static String uid(String prefix) {
        byte[] b = new byte[5]; new SecureRandom().nextBytes(b);
        return prefix + "-" + HexFormat.of().formatHex(b);
    }
}
