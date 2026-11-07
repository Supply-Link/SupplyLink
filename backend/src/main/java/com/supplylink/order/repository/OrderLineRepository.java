package com.supplylink.order.repository;

import com.supplylink.store.JsonbHelper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.*;

@Repository
public class OrderLineRepository {

    private final JdbcTemplate jdbc;

    @Autowired
    public OrderLineRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public List<Map<String, Object>> findByOrderId(String orderId) {
        return jdbc.queryForList(
                "SELECT * FROM order_lines WHERE order_id=? ORDER BY line_number", orderId)
                .stream().map(r -> mapRow(r, orderId)).toList();
    }

    public Map<String, List<Map<String, Object>>> findByOrderIds(List<String> orderIds) {
        if (orderIds.isEmpty()) return Collections.emptyMap();
        String ph = String.join(",", Collections.nCopies(orderIds.size(), "?"));
        Map<String, List<Map<String, Object>>> result = new LinkedHashMap<>();
        jdbc.queryForList(
                "SELECT * FROM order_lines WHERE order_id IN (" + ph + ") ORDER BY order_id, line_number",
                orderIds.toArray())
                .forEach(row -> {
                    String oid = (String) row.get("order_id");
                    result.computeIfAbsent(oid, k -> new ArrayList<>()).add(mapRow(row, oid));
                });
        return result;
    }

    public void insertAll(String orderId, List<Map<String, Object>> lines) {
        for (int i = 0; i < lines.size(); i++) {
            Map<String, Object> line = lines.get(i);
            jdbc.update("""
                INSERT INTO order_lines(order_id, line_number, product_id, name, unit, manufacturer,
                    quantity, unit_price, subtotal, discount, taxable, hsn_code, gst_rate_bps,
                    cgst, sgst, utgst, igst, tax, total, extra)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'{}'::jsonb)
            """,
                    orderId, i,
                    line.get("product_id"), line.get("name"), line.get("unit"),
                    line.get("manufacturer"), JsonbHelper.toLong(line.get("quantity")),
                    JsonbHelper.toLong(line.getOrDefault("unit_price", 0)),
                    JsonbHelper.toLong(line.getOrDefault("subtotal", 0)),
                    JsonbHelper.toLong(line.getOrDefault("discount", 0)),
                    JsonbHelper.toLong(line.getOrDefault("taxable", 0)),
                    line.get("hsn_code"), line.get("gst_rate_bps"),
                    JsonbHelper.toLong(line.getOrDefault("cgst", 0)),
                    JsonbHelper.toLong(line.getOrDefault("sgst", 0)),
                    JsonbHelper.toLong(line.getOrDefault("utgst", 0)),
                    JsonbHelper.toLong(line.getOrDefault("igst", 0)),
                    JsonbHelper.toLong(line.getOrDefault("tax", 0)),
                    JsonbHelper.toLong(line.getOrDefault("total", 0)));
        }
    }

    private Map<String, Object> mapRow(Map<String, Object> row, String orderId) {
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("product_id",  row.get("product_id"));
        r.put("name",        row.get("name"));
        r.put("unit",        row.get("unit"));
        r.put("manufacturer",row.get("manufacturer"));
        r.put("quantity",    JsonbHelper.toLong(row.get("quantity")));
        r.put("unit_price",  JsonbHelper.toLong(row.getOrDefault("unit_price", 0)));
        r.put("subtotal",    JsonbHelper.toLong(row.getOrDefault("subtotal", 0)));
        r.put("discount",    JsonbHelper.toLong(row.getOrDefault("discount", 0)));
        r.put("taxable",     JsonbHelper.toLong(row.getOrDefault("taxable", 0)));
        r.put("hsn_code",    row.get("hsn_code"));
        r.put("gst_rate_bps",JsonbHelper.toInt(row.getOrDefault("gst_rate_bps", 0)));
        r.put("cgst",        JsonbHelper.toLong(row.getOrDefault("cgst", 0)));
        r.put("sgst",        JsonbHelper.toLong(row.getOrDefault("sgst", 0)));
        r.put("utgst",       JsonbHelper.toLong(row.getOrDefault("utgst", 0)));
        r.put("igst",        JsonbHelper.toLong(row.getOrDefault("igst", 0)));
        r.put("tax",         JsonbHelper.toLong(row.getOrDefault("tax", 0)));
        r.put("total",       JsonbHelper.toLong(row.getOrDefault("total", 0)));
        r.put("batches",     new ArrayList<>());
        r.put("_line_number", JsonbHelper.toInt(row.get("line_number")));
        return r;
    }
}
