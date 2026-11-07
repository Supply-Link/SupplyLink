package com.supplylink.order.repository;

import com.supplylink.store.JsonbHelper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;

@Repository
public class TrackingRepository {

    private final JdbcTemplate jdbc;

    @Autowired
    public TrackingRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public List<Map<String, Object>> findByOrderId(String orderId) {
        return jdbc.queryForList(
                "SELECT * FROM tracking_points WHERE order_id=? ORDER BY point_number", orderId)
                .stream().map(this::mapRow).toList();
    }

    public Map<String, List<Map<String, Object>>> findByOrderIds(List<String> orderIds) {
        if (orderIds.isEmpty()) return Collections.emptyMap();
        String ph = String.join(",", Collections.nCopies(orderIds.size(), "?"));
        Map<String, List<Map<String, Object>>> result = new LinkedHashMap<>();
        jdbc.queryForList(
                "SELECT * FROM tracking_points WHERE order_id IN (" + ph + ") ORDER BY order_id, point_number",
                orderIds.toArray())
                .forEach(row -> result
                        .computeIfAbsent((String) row.get("order_id"), k -> new ArrayList<>())
                        .add(mapRow(row)));
        return result;
    }

    public void insert(String orderId, double latitude, double longitude) {
        int next = nextPointNumber(orderId);
        jdbc.update("""
            INSERT INTO tracking_points(order_id, point_number, latitude, longitude, recorded_at, extra)
            VALUES (?,?,?,?,?,'{}'::jsonb)
        """, orderId, next, latitude, longitude, Timestamp.from(Instant.now()));
        trimToHundred(orderId);
    }

    private int nextPointNumber(String orderId) {
        Integer n = jdbc.queryForObject(
                "SELECT COALESCE(MAX(point_number),-1)+1 FROM tracking_points WHERE order_id=?",
                Integer.class, orderId);
        return n != null ? n : 0;
    }

    private void trimToHundred(String orderId) {
        Integer count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM tracking_points WHERE order_id=?", Integer.class, orderId);
        if (count != null && count > 100) {
            jdbc.update("""
                DELETE FROM tracking_points WHERE order_id=? AND point_number=(
                    SELECT MIN(point_number) FROM tracking_points WHERE order_id=?)
            """, orderId, orderId);
        }
    }

    private Map<String, Object> mapRow(Map<String, Object> row) {
        return Map.of(
                "latitude",  row.get("latitude"),
                "longitude", row.get("longitude"),
                "at",        JsonbHelper.isoTs(row.get("recorded_at")));
    }
}
