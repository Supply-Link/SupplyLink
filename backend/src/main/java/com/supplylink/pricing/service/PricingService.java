package com.supplylink.pricing.service;

import com.supplylink.audit.repository.AuditRepository;
import com.supplylink.common.BusinessException;
import com.supplylink.pricing.repository.PricingRepository;
import com.supplylink.store.DatabaseStore;
import com.supplylink.store.JsonbHelper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

import static com.supplylink.auth.service.AuthService.require;

@Service
public class PricingService {

    private final DatabaseStore       store;
    private final PricingRepository   pricing;
    private final AuditRepository     audit;

    @Autowired
    public PricingService(DatabaseStore store, PricingRepository pricing, AuditRepository audit) {
        this.store = store; this.pricing = pricing; this.audit = audit;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getPricing() {
        return pricing.find();
    }

    @Transactional
    public Map<String, Object> updatePricing(Map<String, Object> actor, Map<String, Object> body) {
        store.acquireAdvisoryLock();
        require("admin".equals(actor.get("role")) || "distributor".equals(actor.get("role")),
                "Your role cannot perform this action.", 403);
        require(body.containsKey("bulk_min") && body.containsKey("bulk_discount_bps"),
                "bulk_min and bulk_discount_bps are required.");
        int bulkMin         = JsonbHelper.toInt(body.get("bulk_min"));
        int bulkDiscountBps = JsonbHelper.toInt(body.get("bulk_discount_bps"));
        require(bulkMin >= 0, "bulk_min must be non-negative.");
        require(bulkDiscountBps >= 0 && bulkDiscountBps <= 10000, "bulk_discount_bps must be 0–10000.");
        pricing.upsert(bulkMin, bulkDiscountBps);
        audit.insert((String) actor.get("id"), (String) actor.get("name"),
                "Pricing updated", "bulk_min=" + bulkMin + " discount_bps=" + bulkDiscountBps);
        return pricing.find();
    }
}
