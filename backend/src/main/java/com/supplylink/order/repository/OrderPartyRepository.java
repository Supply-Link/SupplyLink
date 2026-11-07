package com.supplylink.order.repository;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.*;

@Repository
public class OrderPartyRepository {

    private final JdbcTemplate jdbc;

    @Autowired
    public OrderPartyRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public Map<String, Map<String, Object>> findByOrderId(String orderId) {
        Map<String, Map<String, Object>> parties = new LinkedHashMap<>();
        jdbc.queryForList("SELECT * FROM order_parties WHERE order_id=?", orderId)
                .forEach(row -> parties.put((String) row.get("party_type"), mapRow(row)));
        return parties;
    }

    public Map<String, Map<String, Map<String, Object>>> findByOrderIds(List<String> orderIds) {
        if (orderIds.isEmpty()) return Collections.emptyMap();
        String ph = String.join(",", Collections.nCopies(orderIds.size(), "?"));
        Map<String, Map<String, Map<String, Object>>> result = new LinkedHashMap<>();
        jdbc.queryForList("SELECT * FROM order_parties WHERE order_id IN (" + ph + ")", orderIds.toArray())
                .forEach(row -> result
                        .computeIfAbsent((String) row.get("order_id"), k -> new LinkedHashMap<>())
                        .put((String) row.get("party_type"), mapRow(row)));
        return result;
    }

    public void insertBoth(String orderId, Map<String, Object> supplier, Map<String, Object> buyer) {
        insertParty(orderId, "supplier", supplier);
        insertParty(orderId, "buyer", buyer);
    }

    private void insertParty(String orderId, String partyType, Map<String, Object> party) {
        jdbc.update("""
            INSERT INTO order_parties(order_id, party_type, user_id, business, legal_name,
                address, gstin, state_code, drug_license, extra)
            VALUES (?,?,?,?,?,?,?,?,?,'{}'::jsonb)
        """,
                orderId, partyType,
                party.getOrDefault("id", party.get("user_id")),
                party.get("business"), party.get("legal_name"),
                party.get("address"), party.get("gstin"),
                party.get("state_code"), party.get("drug_license"));
    }

    private Map<String, Object> mapRow(Map<String, Object> row) {
        Map<String, Object> r = new LinkedHashMap<>();
        if (row.get("user_id") != null) r.put("id", row.get("user_id"));
        if (row.get("business")     != null) r.put("business",     row.get("business"));
        if (row.get("legal_name")   != null) r.put("legal_name",   row.get("legal_name"));
        if (row.get("address")      != null) r.put("address",      row.get("address"));
        if (row.get("gstin")        != null) r.put("gstin",        row.get("gstin"));
        if (row.get("state_code")   != null) r.put("state_code",   row.get("state_code"));
        if (row.get("drug_license") != null) r.put("drug_license", row.get("drug_license"));
        return r;
    }
}
