package com.supplylink.store;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import jakarta.annotation.PostConstruct;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.Date;
import java.sql.Statement;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Map;

@Component
public class DatabaseStore {
    private static final Logger log = LoggerFactory.getLogger(DatabaseStore.class);
    public static final long LOCK_ID = 0x535550504C494E4BL;

    private final JdbcTemplate jdbc;
    private final JsonbHelper jsonb;
    private final TransactionTemplate tx;

    @Autowired
    public DatabaseStore(JdbcTemplate jdbc, JsonbHelper jsonb, PlatformTransactionManager txMgr) {
        this.jdbc = jdbc;
        this.jsonb = jsonb;
        this.tx = new TransactionTemplate(txMgr);
    }

    @PostConstruct
    public void initialize() {
        tx.execute(status -> {
            try (InputStream schemaIs = new ClassPathResource("db/schema.sql").getInputStream();
                 Connection conn = jdbc.getDataSource().getConnection();
                 Statement stmt  = conn.createStatement()) {
                String sql = new String(schemaIs.readAllBytes(), StandardCharsets.UTF_8);
                stmt.execute(sql);
            } catch (Exception e) {
                throw new RuntimeException("Schema init failed", e);
            }
            jdbc.execute("SELECT pg_advisory_xact_lock(" + LOCK_ID + ")");
            Integer count = jdbc.queryForObject("SELECT COUNT(*) FROM users", Integer.class);
            if (count != null && count == 0) {
                log.info("Database empty — seeding with demo data");
                seed();
                log.info("Seed complete");
            }
            return null;
        });
    }

    public void acquireAdvisoryLock() {
        jdbc.execute("SELECT pg_advisory_xact_lock(" + LOCK_ID + ")");
    }

    /**
     * Every medicine is batch-tracked. Demo products get one sample batch holding their opening stock;
     * other products with opening stock keep it as "unallocated" until batches are received.
     */
    private static void addDefaultBatches(Map<String, Object> p) {
        if (p.containsKey("batches") || p.get("generic_name") == null) return;
        List<Map<String, Object>> list = new java.util.ArrayList<>();
        long stock = JsonbHelper.toLong(p.getOrDefault("stock", 0));
        if (Boolean.TRUE.equals(p.get("demo"))) {
            long price = JsonbHelper.toLong(p.get("price"));
            java.time.LocalDate today = com.supplylink.product.PharmacyHelper.today();
            Map<String, Object> b = new java.util.LinkedHashMap<>();
            b.put("id", "batch-demo-" + p.get("id"));
            b.put("batch_number", "DEMO-" + String.valueOf(p.get("sku")).replace("MED-", "") + "-01");
            b.put("manufacturing_date", today.minusDays(90).toString());
            b.put("expiry_date", today.plusDays("med04".equals(p.get("id")) ? 60 : 540).toString());
            b.put("stock", stock);
            b.put("mrp", price * 3 / 2);
            b.put("purchase_price", price * 4 / 5);
            b.put("quarantined", false);
            b.put("demo", true);
            list.add(b);
        } else if (stock > 0) {
            p.put("unallocated_stock", stock);
        }
        p.put("batches", list);
    }

    @SuppressWarnings("unchecked")
    private void seed() {
        try (InputStream is = getClass().getResourceAsStream("/db/seed.json")) {
            Map<String, Object> data = new ObjectMapper().readValue(is, Map.class);

            jdbc.update("INSERT INTO app_metadata(id, data_version, created_at) VALUES (1, ?, NOW())",
                    data.getOrDefault("version", 3));

            Map<String, Object> pricing = (Map<String, Object>) data.get("pricing");
            jdbc.update("INSERT INTO pricing(id, bulk_min, bulk_discount_bps) VALUES (1, ?, ?)",
                    pricing.get("bulk_min"), pricing.get("bulk_discount_bps"));

            List<Map<String, Object>> users = (List<Map<String, Object>>) data.get("users");
            for (int i = 0; i < users.size(); i++) {
                Map<String, Object> u = users.get(i);
                jdbc.update("""
                    INSERT INTO users(id, sort_order, name, business, role, email, password_hash,
                        active, approval_status, requested_role, credit_limit, credit_used,
                        address, state_code, gstin, legal_name, drug_license, extra)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'{}'::jsonb)
                """,
                        u.get("id"), i, u.get("name"), u.get("business"), u.get("role"),
                        u.get("email"), u.get("password"),
                        Boolean.TRUE.equals(u.get("active")),
                        u.getOrDefault("approval_status", "approved"),
                        u.get("requested_role"),
                        u.get("credit_limit"), u.getOrDefault("credit_used", 0),
                        u.get("address"), u.get("state_code"),
                        u.getOrDefault("gstin", ""),
                        u.getOrDefault("legal_name", u.get("business")),
                        u.getOrDefault("drug_license", ""));
            }

            List<Map<String, Object>> products = (List<Map<String, Object>>) data.get("products");
            for (int i = 0; i < products.size(); i++) {
                Map<String, Object> p = products.get(i);
                addDefaultBatches(p);
                boolean hasBatches = p.containsKey("batches");
                boolean hasUnallocated = p.containsKey("unallocated_stock");
                jdbc.update("""
                    INSERT INTO products(id, sort_order, distributor_id, name, generic_name,
                        strength, dosage_form, brand, category, sku, unit, price, stock,
                        unallocated_stock, has_unallocated_stock, reorder_level, artwork, color,
                        active, is_demo, manufacturer, hsn_code, gst_rate_bps,
                        storage_conditions, has_batches, extra)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'{}'::jsonb)
                """,
                        p.get("id"), i, p.get("distributor_id"), p.get("name"),
                        p.get("generic_name"), p.get("strength"), p.get("dosage_form"),
                        p.get("brand"), p.get("category"), p.get("sku"), p.get("unit"),
                        JsonbHelper.toLong(p.get("price")),
                        JsonbHelper.toLong(p.getOrDefault("stock", 0)),
                        JsonbHelper.toLong(p.getOrDefault("unallocated_stock", 0)),
                        hasUnallocated,
                        JsonbHelper.toLong(p.getOrDefault("reorder", 0)),
                        p.get("art"), p.getOrDefault("color", "#e5eee6"),
                        !Boolean.FALSE.equals(p.getOrDefault("active", true)),
                        Boolean.TRUE.equals(p.get("demo")),
                        p.get("manufacturer"), p.get("hsn_code"), p.get("gst_rate_bps"),
                        p.get("storage_conditions"), hasBatches);

                if (hasBatches) {
                    List<Map<String, Object>> batches = (List<Map<String, Object>>) p.get("batches");
                    for (int j = 0; j < batches.size(); j++) {
                        Map<String, Object> b = batches.get(j);
                        jdbc.update("""
                            INSERT INTO batches(id, product_id, sort_order, batch_number,
                                manufacturing_date, expiry_date, stock, mrp, purchase_price,
                                quarantined, is_demo, extra)
                            VALUES (?,?,?,?,?,?,?,?,?,?,?,'{}'::jsonb)
                        """,
                                b.get("id"), p.get("id"), j, b.get("batch_number"),
                                Date.valueOf((String) b.get("manufacturing_date")),
                                Date.valueOf((String) b.get("expiry_date")),
                                JsonbHelper.toLong(b.getOrDefault("stock", 0)),
                                JsonbHelper.toLong(b.get("mrp")),
                                JsonbHelper.toLong(b.getOrDefault("purchase_price", 0)),
                                Boolean.TRUE.equals(b.get("quarantined")),
                                Boolean.TRUE.equals(b.get("demo")));
                    }
                }
            }
        } catch (Exception e) {
            throw new RuntimeException("Seeding failed", e);
        }
    }
}
