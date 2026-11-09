package com.supplylink.product.repository;

import com.supplylink.store.JsonbHelper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.security.SecureRandom;
import java.sql.Date;
import java.util.*;

@Repository
public class BatchRepository {

    private final JdbcTemplate jdbc;

    @Autowired
    public BatchRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public List<Map<String, Object>> findByProductId(String productId) {
        return jdbc.queryForList(
                "SELECT * FROM batches WHERE product_id = ? ORDER BY sort_order", productId)
                .stream().map(this::mapRow).toList();
    }

    public Map<String, List<Map<String, Object>>> findByProductIds(List<String> productIds) {
        if (productIds.isEmpty()) return Collections.emptyMap();
        String placeholders = String.join(",", Collections.nCopies(productIds.size(), "?"));
        Map<String, List<Map<String, Object>>> grouped = new LinkedHashMap<>();
        jdbc.queryForList(
                "SELECT * FROM batches WHERE product_id IN (" + placeholders + ") ORDER BY product_id, sort_order",
                productIds.toArray())
                .forEach(row -> grouped
                        .computeIfAbsent((String) row.get("product_id"), k -> new ArrayList<>())
                        .add(mapRow(row)));
        return grouped;
    }

    public Optional<Map<String, Object>> findById(String batchId) {
        var rows = jdbc.queryForList("SELECT * FROM batches WHERE id = ?", batchId);
        return rows.isEmpty() ? Optional.empty() : Optional.of(mapRow(rows.get(0)));
    }

    public boolean existsByProductAndBatchNumber(String productId, String batchNumber) {
        Integer n = jdbc.queryForObject(
                "SELECT COUNT(*) FROM batches WHERE product_id=? AND LOWER(batch_number)=LOWER(?)",
                Integer.class, productId, batchNumber);
        return n != null && n > 0;
    }

    public int nextSortOrder(String productId) {
        Integer n = jdbc.queryForObject(
                "SELECT COALESCE(MAX(sort_order),-1)+1 FROM batches WHERE product_id=?",
                Integer.class, productId);
        return n != null ? n : 0;
    }

    public void insert(Map<String, Object> batch, String productId, int sortOrder) {
        jdbc.update("""
            INSERT INTO batches(id, product_id, sort_order, batch_number,
                manufacturing_date, expiry_date, stock, mrp, purchase_price,
                quarantined, is_demo, extra)
            VALUES (?,?,?,?,?,?,?,?,?,?,false,'{}'::jsonb)
        """,
                batch.get("id"), productId, sortOrder, batch.get("batch_number"),
                Date.valueOf((String) batch.get("manufacturing_date")),
                Date.valueOf((String) batch.get("expiry_date")),
                JsonbHelper.toLong(batch.get("stock")),
                JsonbHelper.toLong(batch.get("mrp")),
                JsonbHelper.toLong(batch.getOrDefault("purchase_price", 0)),
                Boolean.TRUE.equals(batch.get("quarantined")));
    }

    public void updateStock(String batchId, long newStock) {
        jdbc.update("UPDATE batches SET stock=? WHERE id=?", newStock, batchId);
    }

    public void updateQuarantine(String batchId, boolean quarantined) {
        jdbc.update("UPDATE batches SET quarantined=? WHERE id=?", quarantined, batchId);
    }

    public void adjustStock(String batchId, long delta) {
        jdbc.update("UPDATE batches SET stock = stock + ? WHERE id=?", delta, batchId);
    }

    private Map<String, Object> mapRow(Map<String, Object> row) {
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("id",                row.get("id"));
        r.put("batch_number",      row.get("batch_number"));
        r.put("manufacturing_date",JsonbHelper.isoTs(row.get("manufacturing_date")));
        r.put("expiry_date",       JsonbHelper.isoTs(row.get("expiry_date")));
        r.put("stock",             JsonbHelper.toLong(row.get("stock")));
        r.put("mrp",               JsonbHelper.toLong(row.get("mrp")));
        r.put("purchase_price",    JsonbHelper.toLong(row.getOrDefault("purchase_price", 0)));
        r.put("quarantined",       row.get("quarantined"));
        if (Boolean.TRUE.equals(row.get("is_demo"))) r.put("demo", true);
        return r;
    }

    static String uid(String prefix) {
        byte[] b = new byte[5];
        new SecureRandom().nextBytes(b);
        return prefix + "-" + HexFormat.of().formatHex(b);
    }
}
