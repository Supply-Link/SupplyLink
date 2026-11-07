package com.supplylink.order.repository;

import com.supplylink.store.JsonbHelper;
import org.postgresql.util.PGobject;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.security.SecureRandom;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;

@Repository
public class OrderRepository {

    private final JdbcTemplate jdbc;
    private final JsonbHelper jsonb;

    @Autowired
    public OrderRepository(JdbcTemplate jdbc, JsonbHelper jsonb) {
        this.jdbc = jdbc;
        this.jsonb = jsonb;
    }

    public Optional<Map<String, Object>> findById(String orderId) {
        var rows = jdbc.queryForList("SELECT * FROM orders WHERE id=?", orderId);
        return rows.isEmpty() ? Optional.empty() : Optional.of(mapRow(rows.get(0)));
    }

    public List<Map<String, Object>> findAll() {
        return jdbc.queryForList("SELECT * FROM orders ORDER BY sort_order")
                .stream().map(this::mapRow).toList();
    }

    public List<Map<String, Object>> findByRetailerId(String id) {
        return jdbc.queryForList("SELECT * FROM orders WHERE retailer_id=? ORDER BY created_at DESC", id)
                .stream().map(this::mapRow).toList();
    }

    public List<Map<String, Object>> findByDistributorId(String id) {
        return jdbc.queryForList("SELECT * FROM orders WHERE distributor_id=? ORDER BY created_at DESC", id)
                .stream().map(this::mapRow).toList();
    }

    public List<Map<String, Object>> findByDriverId(String id) {
        return jdbc.queryForList("SELECT * FROM orders WHERE driver_id=? ORDER BY created_at DESC", id)
                .stream().map(this::mapRow).toList();
    }

    public Optional<Map<String, Object>> findByRetailerAndKey(String retailerId, String key) {
        var rows = jdbc.queryForList(
                "SELECT * FROM orders WHERE retailer_id=? AND request_key=?", retailerId, key);
        return rows.isEmpty() ? Optional.empty() : Optional.of(mapRow(rows.get(0)));
    }

    public long countAll() {
        Long n = jdbc.queryForObject("SELECT COUNT(*) FROM orders", Long.class);
        return n != null ? n : 0L;
    }

    public int nextSortOrder() {
        Integer n = jdbc.queryForObject("SELECT COALESCE(MAX(sort_order),-1)+1 FROM orders", Integer.class);
        return n != null ? n : 0;
    }

    public void insert(Map<String, Object> order, int sortOrder) {
        jdbc.update("""
            INSERT INTO orders(id, sort_order, number, retailer_id, retailer_name,
                distributor_id, driver_id, address, payment_method, payment_status,
                status, created_at, request_key, supply_state_code, supplier_state_code,
                tax_type, subtotal, discount, taxable, cgst, sgst, utgst, igst, tax, total, extra)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'{}'::jsonb)
        """,
                order.get("id"), sortOrder, order.get("number"),
                order.get("retailer_id"), order.get("retailer_name"),
                order.get("distributor_id"), order.get("driver_id"),
                order.get("address"), order.get("payment_method"), "unpaid",
                order.get("status"), Timestamp.from(Instant.now()),
                order.get("request_key"), order.get("supply_state_code"),
                order.get("supplier_state_code"), order.get("tax_type"),
                JsonbHelper.toLong(order.getOrDefault("subtotal", 0)),
                JsonbHelper.toLong(order.getOrDefault("discount", 0)),
                JsonbHelper.toLong(order.getOrDefault("taxable", 0)),
                JsonbHelper.toLong(order.getOrDefault("cgst", 0)),
                JsonbHelper.toLong(order.getOrDefault("sgst", 0)),
                JsonbHelper.toLong(order.getOrDefault("utgst", 0)),
                JsonbHelper.toLong(order.getOrDefault("igst", 0)),
                JsonbHelper.toLong(order.getOrDefault("tax", 0)),
                JsonbHelper.toLong(order.get("total")));
    }

    public void updateStatus(String orderId, String status) {
        jdbc.update("UPDATE orders SET status=? WHERE id=?", status, orderId);
    }

    public void updateStatusAndDriver(String orderId, String status, String driverId) {
        jdbc.update("UPDATE orders SET status=?, driver_id=? WHERE id=?", status, driverId, orderId);
    }

    public void updatePaymentStatus(String orderId, String paymentStatus) {
        jdbc.update("UPDATE orders SET payment_status=? WHERE id=?", paymentStatus, orderId);
    }

    public void updateExtra(String orderId, Map<String, Object> extra) {
        jdbc.update("UPDATE orders SET extra=? WHERE id=?", jsonb.toJsonb(extra), orderId);
    }

    public Map<String, Object> mapRow(Map<String, Object> row) {
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("id",     row.get("id"));
        r.put("status", row.get("status"));
        r.put("total",  JsonbHelper.toLong(row.get("total")));
        if (row.get("number")            != null) r.put("number",             row.get("number"));
        if (row.get("retailer_id")       != null) r.put("retailer_id",        row.get("retailer_id"));
        if (row.get("retailer_name")     != null) r.put("retailer_name",      row.get("retailer_name"));
        if (row.get("distributor_id")    != null) r.put("distributor_id",     row.get("distributor_id"));
        r.put("driver_id", row.get("driver_id"));
        if (row.get("address")           != null) r.put("address",            row.get("address"));
        if (row.get("payment_method")    != null) r.put("payment_method",     row.get("payment_method"));
        if (row.get("payment_status")    != null) r.put("payment_status",     row.get("payment_status"));
        if (row.get("created_at")        != null) r.put("created_at",         JsonbHelper.isoTs(row.get("created_at")));
        if (row.get("request_key")       != null) r.put("request_key",        row.get("request_key"));
        if (row.get("supply_state_code") != null) r.put("supply_state_code",  row.get("supply_state_code"));
        if (row.get("supplier_state_code")!=null) r.put("supplier_state_code",row.get("supplier_state_code"));
        if (row.get("tax_type")          != null) r.put("tax_type",           row.get("tax_type"));
        if (row.get("subtotal")          != null) r.put("subtotal",           JsonbHelper.toLong(row.get("subtotal")));
        if (row.get("discount")          != null) r.put("discount",           JsonbHelper.toLong(row.get("discount")));
        if (row.get("taxable")           != null) r.put("taxable",            JsonbHelper.toLong(row.get("taxable")));
        if (row.get("cgst")              != null) r.put("cgst",               JsonbHelper.toLong(row.get("cgst")));
        if (row.get("sgst")              != null) r.put("sgst",               JsonbHelper.toLong(row.get("sgst")));
        if (row.get("utgst")             != null) r.put("utgst",              JsonbHelper.toLong(row.get("utgst")));
        if (row.get("igst")              != null) r.put("igst",               JsonbHelper.toLong(row.get("igst")));
        if (row.get("tax")               != null) r.put("tax",                JsonbHelper.toLong(row.get("tax")));
        // Extra JSONB fields (proof_of_delivery, return_request, etc.)
        Map<String, Object> extra = jsonb.parse(row.get("extra"));
        r.putAll(extra);
        r.put("lines",    new ArrayList<>());
        r.put("history",  new ArrayList<>());
        r.put("tracking", new ArrayList<>());
        return r;
    }

    static String uid(String prefix) {
        byte[] b = new byte[5];
        new SecureRandom().nextBytes(b);
        return prefix + "-" + HexFormat.of().formatHex(b);
    }
}
