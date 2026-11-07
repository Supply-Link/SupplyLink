package com.supplylink.auth.service;

import com.supplylink.auth.repository.SessionRepository;
import com.supplylink.audit.repository.AuditRepository;
import com.supplylink.common.BusinessException;
import com.supplylink.notification.repository.NotificationRepository;
import com.supplylink.seed.PasswordService;
import com.supplylink.store.DatabaseStore;
import com.supplylink.user.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;

@Service
public class AuthService {

    private final DatabaseStore       store;
    private final SessionRepository   sessions;
    private final UserRepository      users;
    private final NotificationRepository notifications;
    private final AuditRepository     audit;
    private final LicenseService      licenseService;
    private final Map<String, List<Long>> attempts = new ConcurrentHashMap<>();
    private static final Pattern EMAIL_RE = Pattern.compile("[^\\s@]+@[^\\s@]+\\.[^\\s@]+");
    private static final Pattern GSTIN_RE = Pattern.compile("[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]");

    @Autowired
    public AuthService(DatabaseStore store, SessionRepository sessions, UserRepository users,
                       NotificationRepository notifications, AuditRepository audit,
                       LicenseService licenseService) {
        this.store = store; this.sessions = sessions; this.users = users;
        this.notifications = notifications; this.audit = audit;
        this.licenseService = licenseService;
    }

    public Map<String, Object> health() {
        return Map.of("status", "ok", "storage", "postgresql-relational");
    }

    public Map<String, Object> license() {
        return licenseService.status();
    }

    @Transactional(readOnly = true)
    public Map<String, Object> me(String token) {
        if (token == null || token.isBlank()) return Map.of("user", null);
        try {
            Map<String, Object> resolved = resolveSession(token);
            @SuppressWarnings("unchecked")
            Map<String, Object> user    = (Map<String, Object>) resolved.get("user");
            @SuppressWarnings("unchecked")
            Map<String, Object> session = (Map<String, Object>) resolved.get("session");
            return authResponse(user, session);
        } catch (BusinessException ex) {
            if (ex.getStatus() == 401) return Map.of("user", null);
            throw ex;
        }
    }

    @Transactional
    public Map<String, Object> login(Map<String, Object> body, String ip) {
        store.acquireAdvisoryLock();
        rateLimit(ip);
        String email    = (String) body.get("email");
        String password = (String) body.get("password");
        require(email instanceof String && password instanceof String && password.length() <= 128,
                "Email and password are required.");
        Map<String, Object> user = users.findByEmailLower(email.strip())
                .filter(u -> Boolean.TRUE.equals(u.get("active"))
                         && "approved".equals(u.getOrDefault("approval_status","approved"))
                         && PasswordService.verify(password, (String) u.get("password")))
                .orElse(null);
        require(user != null, "Email or password is incorrect.", 401);
        sessions.deleteExpired();
        String token     = generateToken();
        String tokenHash = sha256(token);
        String csrf      = generateCsrf();
        sessions.insert(tokenHash, (String) user.get("id"), csrf);
        Map<String, Object> session = Map.of("token_hash", tokenHash, "csrf", csrf,
                "user_id", user.get("id"));
        Map<String, Object> result = new LinkedHashMap<>(authResponse(user, session));
        result.put("_session_token", token);
        return result;
    }

    @Transactional
    public Map<String, Object> logout(String token) {
        if (token != null && !token.isBlank()) {
            store.acquireAdvisoryLock();
            sessions.deleteByTokenHash(sha256(token));
        }
        return Map.of("ok", true, "_clear_cookie", true);
    }

    @Transactional
    public Map<String, Object> register(Map<String, Object> body, String ip) {
        store.acquireAdvisoryLock();
        rateLimit(ip);
        String requested = (String) body.get("role");
        require("retailer".equals(requested) || "distributor".equals(requested) || "delivery".equals(requested),
                "Registration is available for retailers, distributors, and delivery partners.");
        String email = text(body.get("email"), "Email", 150).toLowerCase();
        require(EMAIL_RE.matcher(email).matches(), "Enter a valid email address.");
        require(!users.existsByEmailLower(email), "An account or registration already exists for this email.", 409);
        String password = text(body.get("password"), "Password", 128);
        require(password.length() >= 10, "Password must contain at least 10 characters.");
        String stateCode = (String) body.get("state_code");
        require(com.supplylink.product.PharmacyHelper.STATE_CODES.contains(stateCode),
                "Select a valid Indian state / territory code.");
        String gstin = body.getOrDefault("gstin", "") instanceof String s ? s.strip().toUpperCase() : "";
        require(gstin.isEmpty() || (GSTIN_RE.matcher(gstin).matches() && gstin.startsWith(stateCode)),
                "GSTIN format must match your state code.");
        String license = body.getOrDefault("drug_license", "") instanceof String s2 ? s2.strip() : "";
        require(license.length() <= 100, "Invalid drug licence number.");
        Map<String, Object> u = new LinkedHashMap<>();
        u.put("id",              uid("usr"));
        u.put("name",            text(body.get("name"),     "Full name",                   100));
        u.put("business",        text(body.get("business"), "Business / team",             100));
        u.put("email",           email);
        u.put("password",        PasswordService.hash(password));
        u.put("role",            requested);
        u.put("requested_role",  requested);
        u.put("active",          false);
        u.put("approval_status", "pending");
        u.put("registered_at",   Instant.now().toString());
        u.put("address",         text(body.get("address"), "Business / service address",   500));
        u.put("state_code",      stateCode);
        u.put("gstin",           gstin);
        u.put("legal_name",      u.get("business"));
        u.put("drug_license",    license);
        if ("retailer".equals(requested)) { u.put("credit_limit", 0L); u.put("credit_used", 0L); }
        users.insert(u, users.nextSortOrder());
        audit.insert((String) u.get("id"), (String) u.get("name"),
                "Registration submitted", requested + " access requested");
        users.findAll().stream()
                .filter(a -> "admin".equals(a.get("role")) && Boolean.TRUE.equals(a.get("active")))
                .forEach(a -> notifications.insert((String) a.get("id"), "New access request",
                        u.get("name") + " requested " + requested + " access."));
        return Map.of("ok", true,
                "message", "Registration submitted. An administrator must approve your access before you can sign in.");
    }

    public Map<String, Object> resolveSession(String token) {
        require(token != null && !token.isBlank(), "Please sign in.", 401);
        Map<String, Object> session = sessions.findValidByHash(sha256(token)).orElse(null);
        require(session != null, "Your session has expired. Please sign in.", 401);
        Map<String, Object> user = users.findById((String) session.get("user_id"))
                .filter(u -> Boolean.TRUE.equals(u.get("active"))
                         && "approved".equals(u.getOrDefault("approval_status","approved")))
                .orElse(null);
        require(user != null, "Account is unavailable.", 401);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("session", session);
        result.put("user",    user);
        return result;
    }

    private Map<String, Object> authResponse(Map<String, Object> user, Map<String, Object> session) {
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("user",    UserRepository.safeUser(user));
        r.put("csrf",    session.get("csrf"));
        r.put("license", license());
        return r;
    }

    private void rateLimit(String ip) {
        long now = Instant.now().getEpochSecond();
        List<Long> recent = new ArrayList<>(
                attempts.getOrDefault(ip, Collections.emptyList()).stream()
                        .filter(t -> t > now - 60).toList());
        require(recent.size() < 15, "Too many sign-in attempts. Try again in a minute.", 429);
        recent.add(now);
        attempts.put(ip, recent);
    }

    public static void require(boolean condition, String message) { require(condition, message, 400); }
    public static void require(boolean condition, String message, int status) {
        if (!condition) throw new BusinessException(message, status);
    }

    public static String text(Object v, String name, int limit) {
        require(v instanceof String s && !s.strip().isEmpty() && s.strip().length() <= limit,
                name + " is required (maximum " + limit + " characters).");
        return ((String) v).strip();
    }

    static String uid(String prefix) {
        byte[] b = new byte[5];
        new SecureRandom().nextBytes(b);
        return prefix + "-" + HexFormat.of().formatHex(b);
    }

    public static String sha256(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] d = md.digest(input.getBytes());
            StringBuilder sb = new StringBuilder(64);
            for (byte by : d) sb.append(String.format("%02x", by));
            return sb.toString();
        } catch (Exception e) { throw new RuntimeException(e); }
    }

    private static String generateToken() {
        byte[] b = new byte[32]; new SecureRandom().nextBytes(b);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(b);
    }

    private static String generateCsrf() {
        byte[] b = new byte[18]; new SecureRandom().nextBytes(b);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(b);
    }
}
