package com.supplylink.order.repository;

import com.supplylink.store.JsonbHelper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;

@Repository
public class OrderHistoryRepository {

    private final JdbcTemplate jdbc;

    @Autowired
    public OrderHistoryRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public List<Map<String, Object>> findByOrderId(String orderId) {
        return jdbc.queryForList(
                "SELECT * FROM order_history WHERE order_id=? ORDER BY event_number", orderId)
                .stream().map(this::mapRow).toList();
    }

    public Map<String, List<Map<String, Object>>> findByOrderIds(List<String> orderIds) {
        if (orderIds.isEmpty()) return Collections.emptyMap();
        String ph = String.join(",", Collections.nCopies(orderIds.size(), "?"));
        Map<String, List<Map<String, Object>>> result = new LinkedHashMap<>();
        jdbc.queryForList(
                "SELECT * FROM order_history WHERE order_id IN (" + ph + ") ORDER BY order_id, event_number",
                orderIds.toArray())
                .forEach(row -> result
                        .computeIfAbsent((String) row.get("order_id"), k -> new ArrayList<>())
                        .add(mapRow(row)));
        return result;
    }

    public void insert(String orderId, String status, String actorName) {
        int next = nextEventNumber(orderId);
        jdbc.update("""
            INSERT INTO order_history(order_id, event_number, status, occurred_at, actor_name, extra)
            VALUES (?,?,?,?,?,'{}'::jsonb)
        """, orderId, next, status, Timestamp.from(Instant.now()), actorName);
    }

    private int nextEventNumber(String orderId) {
        Integer n = jdbc.queryForObject(
                "SELECT COALESCE(MAX(event_number),-1)+1 FROM order_history WHERE order_id=?",
                Integer.class, orderId);
        return n != null ? n : 0;
    }

    private Map<String, Object> mapRow(Map<String, Object> row) {
        return Map.of(
                "status", row.get("status"),
                "at",     JsonbHelper.isoTs(row.get("occurred_at")),
                "by",     row.get("actor_name"));
    }
}
