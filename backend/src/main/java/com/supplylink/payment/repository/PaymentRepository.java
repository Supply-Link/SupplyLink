package com.supplylink.payment.repository;

import com.supplylink.store.JsonbHelper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;

@Repository
public class PaymentRepository {

    private final JdbcTemplate jdbc;

    @Autowired
    public PaymentRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public Optional<Map<String, Object>> findByActorAndKey(String actorId, String requestKey) {
        var rows = jdbc.queryForList(
                "SELECT * FROM payments WHERE actor_id=? AND request_key=?", actorId, requestKey);
        return rows.isEmpty() ? Optional.empty() : Optional.of(mapRow(rows.get(0)));
    }

    public Optional<Map<String, Object>> findByOrderId(String orderId) {
        var rows = jdbc.queryForList("SELECT * FROM payments WHERE order_id=?", orderId);
        return rows.isEmpty() ? Optional.empty() : Optional.of(mapRow(rows.get(0)));
    }

    public List<Map<String, Object>> findByOrderIds(List<String> orderIds) {
        if (orderIds.isEmpty()) return Collections.emptyList();
        String ph = String.join(",", Collections.nCopies(orderIds.size(), "?"));
        return jdbc.queryForList("SELECT * FROM payments WHERE order_id IN (" + ph + ")", orderIds.toArray())
                .stream().map(this::mapRow).toList();
    }

    public List<Map<String, Object>> findAll() {
        return jdbc.queryForList("SELECT * FROM payments ORDER BY sort_order")
                .stream().map(this::mapRow).toList();
    }

    public void insert(Map<String, Object> payment) {
        int sort = nextSort();
        jdbc.update("""
            INSERT INTO payments(id, sort_order, order_id, order_number, amount, reference,
                actor_id, request_key, recorded_at, mode, extra)
            VALUES (?,?,?,?,?,?,?,?,?,?,'{}'::jsonb)
        """,
                payment.get("id"), sort, payment.get("order_id"), payment.get("order_number"),
                JsonbHelper.toLong(payment.get("amount")), payment.get("reference"),
                payment.get("actor_id"), payment.get("request_key"),
                Timestamp.from(Instant.now()), "manual");
    }

    private int nextSort() {
        Integer n = jdbc.queryForObject("SELECT COALESCE(MAX(sort_order),-1)+1 FROM payments", Integer.class);
        return n != null ? n : 0;
    }

    private Map<String, Object> mapRow(Map<String, Object> row) {
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("id",           row.get("id"));
        r.put("order_id",     row.get("order_id"));
        r.put("order_number", row.get("order_number"));
        r.put("amount",       JsonbHelper.toLong(row.get("amount")));
        r.put("reference",    row.get("reference"));
        r.put("actor_id",     row.get("actor_id"));
        r.put("request_key",  row.get("request_key"));
        r.put("at",           JsonbHelper.isoTs(row.get("recorded_at")));
        r.put("mode",         row.get("mode"));
        return r;
    }
}
