package com.supplylink.audit.repository;

import com.supplylink.store.JsonbHelper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.security.SecureRandom;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Repository
public class AuditRepository {

    private final JdbcTemplate jdbc;

    @Autowired
    public AuditRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public void insert(String actorId, String actorName, String action, String detail) {
        int sort = nextSort();
        jdbc.update("""
            INSERT INTO audit_events(id, sort_order, actor_id, actor_name, action, detail, occurred_at, extra)
            VALUES (?,?,?,?,?,?,?,'{}'::jsonb)
        """, uid("evt"), sort, actorId, actorName, action, detail, Timestamp.from(Instant.now()));
    }

    public List<Map<String, Object>> findRecent() {
        return jdbc.queryForList(
                "SELECT * FROM audit_events ORDER BY sort_order DESC LIMIT 80")
                .stream().map(this::mapRow).toList();
    }

    private int nextSort() {
        Integer n = jdbc.queryForObject("SELECT COALESCE(MAX(sort_order),-1)+1 FROM audit_events", Integer.class);
        return n != null ? n : 0;
    }

    private Map<String, Object> mapRow(Map<String, Object> row) {
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("id",     row.get("id"));
        r.put("actor",  row.get("actor_id"));
        r.put("name",   row.get("actor_name"));
        r.put("action", row.get("action"));
        r.put("detail", row.get("detail"));
        r.put("at",     JsonbHelper.isoTs(row.get("occurred_at")));
        return r;
    }

    static String uid(String prefix) {
        byte[] b = new byte[5];
        new SecureRandom().nextBytes(b);
        return prefix + "-" + HexFormat.of().formatHex(b);
    }
}
