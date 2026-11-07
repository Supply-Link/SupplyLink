package com.supplylink.pricing.repository;

import com.supplylink.store.JsonbHelper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.Map;

@Repository
public class PricingRepository {

    private final JdbcTemplate jdbc;

    @Autowired
    public PricingRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public Map<String, Object> find() {
        var rows = jdbc.queryForList("SELECT * FROM pricing WHERE id=1");
        if (rows.isEmpty()) return Map.of("bulk_min", 50, "bulk_discount_bps", 500);
        Map<String, Object> row = rows.get(0);
        return Map.of(
                "bulk_min",          JsonbHelper.toInt(row.get("bulk_min")),
                "bulk_discount_bps", JsonbHelper.toInt(row.get("bulk_discount_bps")));
    }

    public void upsert(int bulkMin, int bulkDiscountBps) {
        jdbc.update("""
            INSERT INTO pricing(id, bulk_min, bulk_discount_bps) VALUES (1,?,?)
            ON CONFLICT (id) DO UPDATE SET bulk_min=EXCLUDED.bulk_min,
                bulk_discount_bps=EXCLUDED.bulk_discount_bps
        """, bulkMin, bulkDiscountBps);
    }
}
