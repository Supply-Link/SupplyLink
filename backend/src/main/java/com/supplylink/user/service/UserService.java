package com.supplylink.user.service;

import com.supplylink.audit.repository.AuditRepository;
import com.supplylink.auth.repository.SessionRepository;
import com.supplylink.auth.service.AuthService;
import com.supplylink.common.BusinessException;
import com.supplylink.notification.repository.NotificationRepository;
import com.supplylink.seed.PasswordService;
import com.supplylink.store.DatabaseStore;
import com.supplylink.user.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.util.*;

import static com.supplylink.auth.service.AuthService.*;
import static com.supplylink.user.repository.UserRepository.safeUser;

@Service
public class UserService {

    private final DatabaseStore    store;
    private final UserRepository   users;
    private final SessionRepository sessions;
    private final NotificationRepository notifications;
    private final AuditRepository  audit;

    @Autowired
    public UserService(DatabaseStore store, UserRepository users, SessionRepository sessions,
                       NotificationRepository notifications, AuditRepository audit) {
        this.store = store; this.users = users; this.sessions = sessions;
        this.notifications = notifications; this.audit = audit;
    }

    @Transactional
    public Map<String, Object> manageUser(Map<String, Object> actor, Map<String, Object> body) {
        store.acquireAdvisoryLock();
        require("admin".equals(actor.get("role")), "Your role cannot perform this action.", 403);
        if (body.get("id") != null) {
            Map<String, Object> u = users.findById((String) body.get("id"))
                    .orElseThrow(() -> new BusinessException("Record not found.", 404));
            if (body.containsKey("credit_limit")) {
                require("retailer".equals(u.get("role")), "Only retailers have trade credit.");
                long limit = integer(body.get("credit_limit"), "Credit limit");
                long used = u.get("credit_used") instanceof Number n ? n.longValue() : 0L;
                require(limit >= used, "Credit limit cannot be below outstanding credit.");
                users.updateCreditLimit((String) u.get("id"), limit);
                u = users.findById((String) u.get("id")).orElseThrow();
            }
            if (body.containsKey("active")) {
                require(!u.get("id").equals(actor.get("id")), "You cannot deactivate your own account.");
                require(body.get("active") instanceof Boolean, "Active must be true or false.");
                boolean active = Boolean.TRUE.equals(body.get("active"));
                require(!active || "approved".equals(u.getOrDefault("approval_status", "approved")),
                        "Approve this registration before enabling access.", 409);
                users.updateActiveStatus((String) u.get("id"), active);
                if (!active) sessions.deleteByUserId((String) u.get("id"));
                u = users.findById((String) u.get("id")).orElseThrow();
            }
            audit.insert((String) actor.get("id"), (String) actor.get("name"),
                    "Account updated", (String) u.get("email"));
            return safeUser(u);
        }
        // Create new user
        String role = (String) body.get("role");
        require(List.of("admin","retailer","distributor","delivery").contains(role), "Invalid role.");
        String email = text(body.get("email"), "Email", 150).toLowerCase();
        require(email.contains("@") && !users.existsByEmailLower(email), "Email is invalid or already in use.");
        String password = text(body.get("password"), "Password", 128);
        require(password.length() >= 10, "Password must contain at least 10 characters.");
        Map<String, Object> u = new LinkedHashMap<>();
        u.put("id",              uid("usr"));
        u.put("name",            text(body.get("name"),     "Name",     100));
        u.put("business",        text(body.get("business"), "Business", 100));
        u.put("role",            role);
        u.put("email",           email);
        u.put("password",        PasswordService.hash(password));
        u.put("active",          true);
        u.put("approval_status", "approved");
        if ("retailer".equals(role)) {
            u.put("credit_limit", integer(body.getOrDefault("credit_limit", 0), "Credit limit"));
            u.put("credit_used",  0L);
            u.put("address",      text(body.get("address"), "Address", 500));
        }
        if (List.of("admin","retailer","distributor").contains(role)) {
            u.put("gstin",      ""); u.put("state_code", "29");
            u.put("legal_name", u.get("business")); u.put("drug_license", "");
        }
        users.insert(u, users.nextSortOrder());
        audit.insert((String) actor.get("id"), (String) actor.get("name"),
                "Account updated", (String) u.get("email"));
        return safeUser(u);
    }

    @Transactional
    public Map<String, Object> approveRegistration(Map<String, Object> actor, Map<String, Object> body) {
        store.acquireAdvisoryLock();
        require("admin".equals(actor.get("role")), "Your role cannot perform this action.", 403);
        Map<String, Object> target = users.findById((String) body.get("user_id"))
                .orElseThrow(() -> new BusinessException("Record not found.", 404));
        require(List.of("pending","rejected").contains(target.get("approval_status")),
                "This account has already been reviewed.", 409);
        String assigned = body.getOrDefault("role", target.get("requested_role")) instanceof String s ? s
                : (String) target.get("requested_role");
        require(List.of("admin","retailer","distributor","delivery").contains(assigned),
                "Select a valid access role.");
        users.updateApproval((String) target.get("id"), assigned, true, "approved", (String) actor.get("id"));
        if ("retailer".equals(assigned) && target.get("credit_limit") == null)
            users.updateCreditLimit((String) target.get("id"), 0L);
        notifications.insert((String) target.get("id"), "Your access is approved",
                "Your " + assigned + " workspace is ready.");
        audit.insert((String) actor.get("id"), (String) actor.get("name"),
                "Registration approved", (String) target.get("email"));
        return safeUser(users.findById((String) target.get("id")).orElseThrow());
    }

    @Transactional
    public Map<String, Object> rejectRegistration(Map<String, Object> actor, Map<String, Object> body) {
        store.acquireAdvisoryLock();
        require("admin".equals(actor.get("role")), "Your role cannot perform this action.", 403);
        Map<String, Object> target = users.findById((String) body.get("user_id"))
                .orElseThrow(() -> new BusinessException("Record not found.", 404));
        require(List.of("pending","rejected").contains(target.get("approval_status")),
                "This account has already been reviewed.", 409);
        String reason = text(body.get("reason"), "Reason", 300);
        users.updateRejection((String) target.get("id"), reason, (String) actor.get("id"));
        audit.insert((String) actor.get("id"), (String) actor.get("name"),
                "Registration rejected", (String) target.get("email"));
        return safeUser(users.findById((String) target.get("id")).orElseThrow());
    }

    private static long integer(Object v, String name) {
        require(v instanceof Number n && n.longValue() >= 0 && n.longValue() <= 100_000_000L,
                name + " must be an integer between 0 and 100000000.");
        return ((Number) v).longValue();
    }

    private static String uid(String prefix) {
        byte[] b = new byte[5]; new SecureRandom().nextBytes(b);
        return prefix + "-" + HexFormat.of().formatHex(b);
    }
}
