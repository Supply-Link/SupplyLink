package com.supplylink.notification.repository;

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
public class NotificationRepository {

    private final JdbcTemplate jdbc;

    @Autowired
    public NotificationRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public List<Map<String, Object>> findByUserId(String userId) {
        return jdbc.queryForList(
                "SELECT * FROM notifications WHERE user_id = ? ORDER BY sort_order DESC", userId)
                .stream().map(this::mapRow).toList();
    }

    public int countUnread(String userId) {
        Integer n = jdbc.queryForObject(
                "SELECT COUNT(*) FROM notifications WHERE user_id = ? AND is_read = false",
                Integer.class, userId);
        return n != null ? n : 0;
    }

    public void insert(String userId, String title, String body) {
        int sort = nextSort();
        jdbc.update("""
            INSERT INTO notifications(id, sort_order, user_id, title, body, created_at, is_read, extra)
            VALUES (?,?,?,?,?,?,false,'{}'::jsonb)
        """, uid("note"), sort, userId, title, body, Timestamp.from(Instant.now()));
    }

    public void markAllRead(String userId) {
        jdbc.update("UPDATE notifications SET is_read = true WHERE user_id = ?", userId);
    }

    private int nextSort() {
        Integer n = jdbc.queryForObject("SELECT COALESCE(MAX(sort_order),-1)+1 FROM notifications", Integer.class);
        return n != null ? n : 0;
    }

    private Map<String, Object> mapRow(Map<String, Object> row) {
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("id",      row.get("id"));
        r.put("user_id", row.get("user_id"));
        r.put("title",   row.get("title"));
        r.put("body",    row.get("body"));
        r.put("at",      JsonbHelper.isoTs(row.get("created_at")));
        r.put("read",    row.get("is_read"));
        return r;
    }

    static String uid(String prefix) {
        byte[] b = new byte[5];
        new SecureRandom().nextBytes(b);
        return prefix + "-" + HexFormat.of().formatHex(b);
    }
}
