package com.supplylink.business.service;

import com.supplylink.audit.repository.AuditRepository;
import com.supplylink.auth.service.AuthService;
import com.supplylink.product.PharmacyHelper;
import com.supplylink.store.DatabaseStore;
import com.supplylink.user.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.regex.Pattern;

import static com.supplylink.auth.service.AuthService.*;

@Service
public class BusinessService {

    private final DatabaseStore  store;
    private final UserRepository users;
    private final AuditRepository audit;
    private static final Pattern GSTIN_RE =
            Pattern.compile("[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]");

    @Autowired
    public BusinessService(DatabaseStore store, UserRepository users, AuditRepository audit) {
        this.store = store; this.users = users; this.audit = audit;
    }

    @Transactional
    public Map<String, Object> updateBusiness(Map<String, Object> actor, Map<String, Object> body) {
        store.acquireAdvisoryLock();
        require("admin".equals(actor.get("role")) || "retailer".equals(actor.get("role"))
                        || "distributor".equals(actor.get("role")),
                "Your role cannot perform this action.", 403);
        Object requested = body.getOrDefault("user_id", actor.get("id"));
        require(requested instanceof String, "Record not found.", 404);
        Map<String, Object> target = users.findById((String) requested)
                .orElseThrow(() -> new com.supplylink.common.BusinessException("Record not found.", 404));
        require("admin".equals(actor.get("role")) || target.get("id").equals(actor.get("id")),
                "You cannot edit another business.", 403);
        require("retailer".equals(target.get("role")) || "distributor".equals(target.get("role"))
                        || "admin".equals(target.get("role")),
                "This account has no business tax profile.");
        Object code = body.get("state_code");
        require(code instanceof String c && PharmacyHelper.STATE_CODES.contains(c),
                "Select a valid Indian state / territory code.");
        String stateCode = (String) code;
        Object rawGstin = body.getOrDefault("gstin", "");
        require(rawGstin instanceof String, "Invalid GSTIN.");
        String gstin = ((String) rawGstin).strip().toUpperCase();
        require(gstin.isEmpty() || (GSTIN_RE.matcher(gstin).matches() && gstin.startsWith(stateCode)),
                "GSTIN must have a valid 15-character format and match the state code.");
        String legalName = text(body.get("legal_name"), "Legal business name", 150);
        String address   = text(body.get("address"), "Business address", 500);
        Object rawLicense = body.getOrDefault("drug_license", "");
        require(rawLicense instanceof String l && l.length() <= 100,
                "Drug licence number must be at most 100 characters.");
        String license = ((String) rawLicense).strip();
        users.updateBusinessProfile((String) target.get("id"), (String) target.get("business"),
                legalName, address, stateCode, gstin, license);
        audit.insert((String) actor.get("id"), (String) actor.get("name"),
                "Business tax profile updated", (String) target.get("business"));
        return UserRepository.businessSnapshot(users.findById((String) target.get("id")).orElseThrow());
    }
}
