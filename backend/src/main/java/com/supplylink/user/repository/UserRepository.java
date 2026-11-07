package com.supplylink.user.repository;

import com.supplylink.store.JsonbHelper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Repository
public class UserRepository {

    private final JdbcTemplate jdbc;
    private final JsonbHelper jsonb;

    @Autowired
    public UserRepository(JdbcTemplate jdbc, JsonbHelper jsonb) {
        this.jdbc = jdbc;
        this.jsonb = jsonb;
    }

    public List<Map<String, Object>> findAll() {
        return jdbc.queryForList("SELECT * FROM users ORDER BY sort_order")
                .stream().map(this::mapRow).toList();
    }

    public Optional<Map<String, Object>> findById(String id) {
        var rows = jdbc.queryForList("SELECT * FROM users WHERE id = ?", id);
        return rows.isEmpty() ? Optional.empty() : Optional.of(mapRow(rows.get(0)));
    }

    public Optional<Map<String, Object>> findByEmailLower(String email) {
        var rows = jdbc.queryForList("SELECT * FROM users WHERE LOWER(email) = LOWER(?)", email);
        return rows.isEmpty() ? Optional.empty() : Optional.of(mapRow(rows.get(0)));
    }

    public boolean existsByEmailLower(String email) {
        Integer n = jdbc.queryForObject(
                "SELECT COUNT(*) FROM users WHERE LOWER(email) = LOWER(?)", Integer.class, email);
        return n != null && n > 0;
    }

    public int nextSortOrder() {
        Integer n = jdbc.queryForObject("SELECT COALESCE(MAX(sort_order),-1)+1 FROM users", Integer.class);
        return n != null ? n : 0;
    }

    public void insert(Map<String, Object> u, int sortOrder) {
        jdbc.update("""
            INSERT INTO users(id, sort_order, name, business, role, email, password_hash,
                active, approval_status, requested_role, registered_at, credit_limit, credit_used,
                address, state_code, gstin, legal_name, drug_license, extra)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'{}'::jsonb)
        """,
                u.get("id"), sortOrder, u.get("name"), u.get("business"), u.get("role"),
                u.get("email"), u.get("password"),
                Boolean.TRUE.equals(u.get("active")),
                u.getOrDefault("approval_status", "pending"),
                u.get("requested_role"),
                u.get("registered_at") != null ? Timestamp.from(Instant.now()) : null,
                u.get("credit_limit"), u.getOrDefault("credit_used", 0L),
                u.get("address"), u.get("state_code"),
                u.getOrDefault("gstin", ""),
                u.getOrDefault("legal_name", u.get("business")),
                u.getOrDefault("drug_license", ""));
    }

    public void updateCreditLimit(String userId, long creditLimit) {
        jdbc.update("UPDATE users SET credit_limit=? WHERE id=?", creditLimit, userId);
    }

    public void updateCreditUsed(String userId, long creditUsed) {
        jdbc.update("UPDATE users SET credit_used=? WHERE id=?", creditUsed, userId);
    }

    public void updateActiveStatus(String userId, boolean active) {
        jdbc.update("UPDATE users SET active=? WHERE id=?", active, userId);
    }

    public void updateApproval(String userId, String role, boolean active, String approvalStatus, String reviewedBy) {
        jdbc.update("""
            UPDATE users SET role=?, active=?, approval_status=?,
                reviewed_by=?, reviewed_at=?
            WHERE id=?
        """, role, active, approvalStatus, reviewedBy, Timestamp.from(Instant.now()), userId);
    }

    public void updateRejection(String userId, String reviewReason, String reviewedBy) {
        jdbc.update("""
            UPDATE users SET active=false, approval_status='rejected',
                review_reason=?, reviewed_by=?, reviewed_at=?
            WHERE id=?
        """, reviewReason, reviewedBy, Timestamp.from(Instant.now()), userId);
    }

    public void updateBusinessProfile(String userId, String business, String legalName,
                                       String address, String stateCode, String gstin,
                                       String drugLicense) {
        jdbc.update("""
            UPDATE users SET business=?, legal_name=?, address=?, state_code=?, gstin=?, drug_license=?
            WHERE id=?
        """, business, legalName, address, stateCode, gstin, drugLicense, userId);
    }

    public void updateAdminCreatedUser(String userId, String name, String business,
                                        String role, String email, String passwordHash) {
        jdbc.update("""
            UPDATE users SET name=?, business=?, role=?, email=?, password_hash=? WHERE id=?
        """, name, business, role, email, passwordHash, userId);
    }

    public Map<String, Object> mapRow(Map<String, Object> row) {
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("id",              row.get("id"));
        r.put("name",            row.get("name"));
        r.put("business",        row.get("business"));
        r.put("role",            row.get("role"));
        r.put("email",           row.get("email"));
        r.put("password",        row.get("password_hash"));
        r.put("active",          row.get("active"));
        r.put("approval_status", row.get("approval_status"));
        if (row.get("requested_role") != null)  r.put("requested_role",  row.get("requested_role"));
        if (row.get("registered_at") != null)   r.put("registered_at",   JsonbHelper.isoTs(row.get("registered_at")));
        if (row.get("reviewed_by")   != null)   r.put("reviewed_by",     row.get("reviewed_by"));
        if (row.get("reviewed_at")   != null)   r.put("reviewed_at",     JsonbHelper.isoTs(row.get("reviewed_at")));
        if (row.get("review_reason") != null)   r.put("review_reason",   row.get("review_reason"));
        if (row.get("credit_limit")  != null)   r.put("credit_limit",    JsonbHelper.toLong(row.get("credit_limit")));
        if (row.get("credit_used")   != null)   r.put("credit_used",     JsonbHelper.toLong(row.get("credit_used")));
        if (row.get("address")       != null)   r.put("address",         row.get("address"));
        if (row.get("state_code")    != null)   r.put("state_code",      row.get("state_code"));
        if (row.get("gstin")         != null)   r.put("gstin",           row.get("gstin"));
        if (row.get("legal_name")    != null)   r.put("legal_name",      row.get("legal_name"));
        if (row.get("drug_license")  != null)   r.put("drug_license",    row.get("drug_license"));
        r.putAll(jsonb.parse(row.get("extra")));
        return r;
    }

    public static Map<String, Object> safeUser(Map<String, Object> user) {
        Map<String, Object> r = new LinkedHashMap<>(user);
        r.remove("password");
        return r;
    }

    public static Map<String, Object> businessSnapshot(Map<String, Object> user) {
        Map<String, Object> r = new LinkedHashMap<>();
        for (String k : new String[]{"id", "business", "legal_name", "address", "gstin", "state_code", "drug_license"})
            r.put(k, user.getOrDefault(k, ""));
        return r;
    }
}
