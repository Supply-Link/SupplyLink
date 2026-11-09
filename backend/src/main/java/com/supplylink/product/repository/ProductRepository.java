package com.supplylink.product.repository;

import com.supplylink.store.JsonbHelper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.security.SecureRandom;
import java.util.*;

@Repository
public class ProductRepository {

    private final JdbcTemplate jdbc;
    private final JsonbHelper jsonb;

    @Autowired
    public ProductRepository(JdbcTemplate jdbc, JsonbHelper jsonb) {
        this.jdbc = jdbc;
        this.jsonb = jsonb;
    }

    public List<Map<String, Object>> findAll() {
        return jdbc.queryForList("SELECT * FROM products ORDER BY sort_order")
                .stream().map(this::mapRow).toList();
    }

    public List<Map<String, Object>> findByDistributor(String distributorId) {
        return jdbc.queryForList(
                "SELECT * FROM products WHERE distributor_id=? ORDER BY sort_order", distributorId)
                .stream().map(this::mapRow).toList();
    }

    public List<Map<String, Object>> findActive() {
        return jdbc.queryForList(
                "SELECT * FROM products WHERE active=true ORDER BY sort_order")
                .stream().map(this::mapRow).toList();
    }

    public Optional<Map<String, Object>> findById(String id) {
        var rows = jdbc.queryForList("SELECT * FROM products WHERE id=?", id);
        return rows.isEmpty() ? Optional.empty() : Optional.of(mapRow(rows.get(0)));
    }

    public boolean existsBySkuLower(String sku) {
        Integer n = jdbc.queryForObject(
                "SELECT COUNT(*) FROM products WHERE LOWER(sku)=LOWER(?)", Integer.class, sku);
        return n != null && n > 0;
    }

    public int nextSortOrder() {
        Integer n = jdbc.queryForObject("SELECT COALESCE(MAX(sort_order),-1)+1 FROM products", Integer.class);
        return n != null ? n : 0;
    }

    public void insert(Map<String, Object> p, int sortOrder) {
        jdbc.update("""
            INSERT INTO products(id, sort_order, distributor_id, name, generic_name,
                strength, dosage_form, brand, category, sku, unit, price, stock,
                unallocated_stock, has_unallocated_stock, reorder_level, artwork, color,
                active, is_demo, manufacturer, hsn_code, gst_rate_bps,
                storage_conditions, has_batches, extra)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,false,?,?,?,?,?,'{}'::jsonb)
        """,
                p.get("id"), sortOrder, p.get("distributor_id"), p.get("name"),
                p.get("generic_name"), p.get("strength"), p.get("dosage_form"),
                p.get("brand"), p.get("category"), p.get("sku"), p.get("unit"),
                JsonbHelper.toLong(p.get("price")), 0L, 0L, false,
                JsonbHelper.toLong(p.getOrDefault("reorder", 0)),
                p.getOrDefault("art", "tablets"), p.getOrDefault("color", "#e5eee6"),
                true,
                p.get("manufacturer"), p.get("hsn_code"), p.get("gst_rate_bps"),
                p.get("storage_conditions"), Boolean.TRUE.equals(p.get("has_batches")));
    }

    public void updateFields(String id, String name, String brand, String category,
                              String unit, String genericName, String strength,
                              String dosageForm, String manufacturer, String hsnCode,
                              Object gstRateBps, String storageConditions,
                              Object price, Object reorderLevel, Object active) {
        jdbc.update("""
            UPDATE products SET name=COALESCE(?,name), brand=COALESCE(?,brand),
                category=COALESCE(?,category), unit=COALESCE(?,unit),
                generic_name=COALESCE(?,generic_name), strength=COALESCE(?,strength),
                dosage_form=COALESCE(?,dosage_form), manufacturer=COALESCE(?,manufacturer),
                hsn_code=COALESCE(?,hsn_code), gst_rate_bps=COALESCE(?,gst_rate_bps),
                storage_conditions=COALESCE(?,storage_conditions),
                price=COALESCE(?,price), reorder_level=COALESCE(?,reorder_level),
                active=COALESCE(?,active)
            WHERE id=?
        """, name, brand, category, unit, genericName, strength, dosageForm,
                manufacturer, hsnCode, gstRateBps, storageConditions,
                price, reorderLevel, active, id);
    }

    public void updateStock(String id, long stock, long unallocatedStock, boolean hasUnallocated) {
        jdbc.update("UPDATE products SET stock=?, unallocated_stock=?, has_unallocated_stock=? WHERE id=?",
                stock, unallocatedStock, hasUnallocated, id);
    }

    public void setUnallocated(String id, long quantity) {
        jdbc.update("UPDATE products SET unallocated_stock=?, has_unallocated_stock=true WHERE id=?", quantity, id);
    }

    public void markBatchTracked(String id) {
        jdbc.update("UPDATE products SET has_batches=true WHERE id=?", id);
    }

    public void setStock(String id, long stock) {
        jdbc.update("UPDATE products SET stock=? WHERE id=?", stock, id);
    }

    public void addUnallocated(String id, long quantity) {
        jdbc.update("UPDATE products SET unallocated_stock = unallocated_stock + ?, has_unallocated_stock = true WHERE id=?",
                quantity, id);
    }

    public void adjustStock(String id, long delta) {
        jdbc.update("UPDATE products SET stock = GREATEST(0, stock + ?) WHERE id=?", delta, id);
    }

    public Map<String, Object> mapRow(Map<String, Object> row) {
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("id",            row.get("id"));
        r.put("name",          row.get("name"));
        r.put("brand",         row.get("brand"));
        r.put("category",      row.get("category"));
        r.put("sku",           row.get("sku"));
        r.put("unit",          row.get("unit"));
        r.put("price",         JsonbHelper.toLong(row.get("price")));
        r.put("stock",         JsonbHelper.toLong(row.get("stock")));
        r.put("reorder",       JsonbHelper.toLong(row.get("reorder_level")));
        r.put("art",           row.get("artwork"));
        r.put("color",         row.get("color"));
        r.put("active",        row.get("active"));
        r.put("distributor_id",row.get("distributor_id"));
        if (row.get("generic_name")       != null) r.put("generic_name",       row.get("generic_name"));
        if (row.get("strength")           != null) r.put("strength",           row.get("strength"));
        if (row.get("dosage_form")        != null) r.put("dosage_form",        row.get("dosage_form"));
        if (row.get("reference_url")      != null) r.put("reference_url",      row.get("reference_url"));
        if (row.get("manufacturer")       != null) r.put("manufacturer",       row.get("manufacturer"));
        if (row.get("hsn_code")           != null) r.put("hsn_code",           row.get("hsn_code"));
        if (row.get("gst_rate_bps")       != null) r.put("gst_rate_bps",       JsonbHelper.toInt(row.get("gst_rate_bps")));
        if (row.get("storage_conditions") != null) r.put("storage_conditions", row.get("storage_conditions"));
        if (Boolean.TRUE.equals(row.get("is_demo"))) r.put("demo", true);
        if (Boolean.TRUE.equals(row.get("has_unallocated_stock")))
            r.put("unallocated_stock", JsonbHelper.toLong(row.get("unallocated_stock")));
        if (Boolean.TRUE.equals(row.get("has_batches"))) r.put("batches", new ArrayList<>());
        return r;
    }

    static String uid(String prefix) {
        byte[] b = new byte[5];
        new SecureRandom().nextBytes(b);
        return prefix + "-" + HexFormat.of().formatHex(b);
    }
}
