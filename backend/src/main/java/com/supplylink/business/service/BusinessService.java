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
        String business  = text(body.get("business"),  "Business name",    100);
        String legalName = text(body.get("legal_name"), "Legal name",       100);
        String address   = text(body.get("address"),   "Address",           500);
        String stateCode = (String) body.get("state_code");
        require(PharmacyHelper.STATE_CODES.contains(stateCode), "Select a valid state code.");
        String gstin = body.getOrDefault("gstin", "") instanceof String s ? s.strip().toUpperCase() : "";
        require(gstin.isEmpty() || (GSTIN_RE.matcher(gstin).matches() && gstin.startsWith(stateCode)),
                "GSTIN format must match your state code.");
        String license = body.getOrDefault("drug_license", "") instanceof String s2 ? s2.strip() : "";
        require(license.length() <= 100, "Invalid drug licence number.");
        users.updateBusinessProfile((String) actor.get("id"), business, legalName, address,
                stateCode, gstin, license);
        audit.insert((String) actor.get("id"), (String) actor.get("name"),
                "Business profile updated", business);
        return UserRepository.safeUser(users.findById((String) actor.get("id")).orElseThrow());
    }
}
