package com.supplylink.auth.repository;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;

@Repository
public class SessionRepository {

    private final JdbcTemplate jdbc;

    @Autowired
    public SessionRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public Optional<Map<String, Object>> findValidByHash(String tokenHash) {
        var rows = jdbc.queryForList(
                "SELECT * FROM sessions WHERE token_hash = ? AND expires_at > NOW()", tokenHash);
        return rows.isEmpty() ? Optional.empty() : Optional.of(mapRow(rows.get(0)));
    }

    public void insert(String tokenHash, String userId, String csrfToken) {
        jdbc.update(
                "INSERT INTO sessions(token_hash, user_id, csrf_token, expires_at) VALUES (?,?,?,?)",
                tokenHash, userId, csrfToken, Timestamp.from(Instant.now().plusSeconds(43200)));
    }

    public void deleteByTokenHash(String tokenHash) {
        jdbc.update("DELETE FROM sessions WHERE token_hash = ?", tokenHash);
    }

    public void deleteByUserId(String userId) {
        jdbc.update("DELETE FROM sessions WHERE user_id = ?", userId);
    }

    public void deleteExpired() {
        jdbc.update("DELETE FROM sessions WHERE expires_at <= NOW()");
    }

    private static Map<String, Object> mapRow(Map<String, Object> row) {
        return Map.of(
                "token_hash", row.get("token_hash"),
                "user_id",    row.get("user_id"),
                "csrf",       row.get("csrf_token"),
                "expires",    ((Timestamp) row.get("expires_at")).toInstant().getEpochSecond()
        );
    }
}
