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
        require("admin".equals(actor.get("role")), "Your role cannot perform this action.", 403);
        Object min = body.get("bulk_min"), bps = body.get("bulk_discount_bps");
        require(min instanceof Integer || min instanceof Long, "Bulk minimum must be an integer between 1 and 10000.");
        require(bps instanceof Integer || bps instanceof Long, "Discount basis points must be an integer between 0 and 9000.");
        int bulkMin = ((Number) min).intValue();
        int bulkDiscountBps = ((Number) bps).intValue();
        require(bulkMin >= 1 && bulkMin <= 10000, "Bulk minimum must be an integer between 1 and 10000.");
        require(bulkDiscountBps >= 0 && bulkDiscountBps <= 9000, "Discount basis points must be an integer between 0 and 9000.");
        pricing.upsert(bulkMin, bulkDiscountBps);
        audit.insert((String) actor.get("id"), (String) actor.get("name"),
                "Pricing updated", "bulk_min=" + bulkMin + " discount_bps=" + bulkDiscountBps);
        return pricing.find();
    }
}
