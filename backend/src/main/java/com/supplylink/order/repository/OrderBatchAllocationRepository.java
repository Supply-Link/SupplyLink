package com.supplylink.order.repository;

import com.supplylink.store.JsonbHelper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.Date;
import java.util.*;

@Repository
public class OrderBatchAllocationRepository {

    private final JdbcTemplate jdbc;

    @Autowired
    public OrderBatchAllocationRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public List<Map<String, Object>> findByOrderId(String orderId) {
        return jdbc.queryForList("""
                SELECT * FROM order_batch_allocations
                WHERE order_id=? ORDER BY line_number, allocation_number
                """, orderId)
                .stream().map(this::mapRow).toList();
    }

    public Map<String, List<Map<String, Object>>> findByOrderIds(List<String> orderIds) {
        if (orderIds.isEmpty()) return Collections.emptyMap();
        String ph = String.join(",", Collections.nCopies(orderIds.size(), "?"));
        Map<String, List<Map<String, Object>>> result = new LinkedHashMap<>();
        jdbc.queryForList("""
                SELECT * FROM order_batch_allocations WHERE order_id IN (""" + ph + """
                ) ORDER BY order_id, line_number, allocation_number""",
                orderIds.toArray())
                .forEach(row -> result
                        .computeIfAbsent((String) row.get("order_id"), k -> new ArrayList<>())
                        .add(mapRow(row)));
        return result;
    }

    public void insertAll(String orderId, List<Map<String, Object>> lines) {
        for (int lineIdx = 0; lineIdx < lines.size(); lineIdx++) {
            Map<String, Object> line = lines.get(lineIdx);
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> batches = (List<Map<String, Object>>) line.getOrDefault("batches", List.of());
            for (int allocIdx = 0; allocIdx < batches.size(); allocIdx++) {
                Map<String, Object> alloc = batches.get(allocIdx);
                jdbc.update("""
                    INSERT INTO order_batch_allocations(order_id, line_number, allocation_number,
                        batch_id, batch_number, manufacturing_date, expiry_date, mrp, quantity, extra)
                    VALUES (?,?,?,?,?,?,?,?,?,'{}'::jsonb)
                """,
                        orderId, lineIdx, allocIdx,
                        alloc.get("batch_id"), alloc.get("batch_number"),
                        alloc.get("manufacturing_date") != null
                                ? Date.valueOf((String) alloc.get("manufacturing_date")) : null,
                        alloc.get("expiry_date") != null
                                ? Date.valueOf((String) alloc.get("expiry_date")) : null,
                        JsonbHelper.toLong(alloc.getOrDefault("mrp", 0)),
                        JsonbHelper.toLong(alloc.get("quantity")));
            }
        }
    }

    private Map<String, Object> mapRow(Map<String, Object> row) {
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("batch_id",          row.get("batch_id"));
        r.put("batch_number",      row.get("batch_number"));
        r.put("manufacturing_date",JsonbHelper.isoTs(row.get("manufacturing_date")));
        r.put("expiry_date",       JsonbHelper.isoTs(row.get("expiry_date")));
        r.put("mrp",               JsonbHelper.toLong(row.getOrDefault("mrp", 0)));
        r.put("quantity",          JsonbHelper.toLong(row.get("quantity")));
        r.put("_line_number",      JsonbHelper.toInt(row.get("line_number")));
        return r;
    }
}
