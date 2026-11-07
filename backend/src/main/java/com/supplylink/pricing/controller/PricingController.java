package com.supplylink.pricing.controller;

import com.supplylink.auth.service.AuthService;
import com.supplylink.common.BaseController;
import com.supplylink.pricing.service.PricingService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
public class PricingController extends BaseController {

    private final AuthService    authService;
    private final PricingService pricingService;

    @Autowired
    public PricingController(AuthService authService, PricingService pricingService) {
        this.authService = authService;
        this.pricingService = pricingService;
    }

    @PostMapping("/api/pricing")
    public ResponseEntity<?> updatePricing(@RequestBody Map<String, Object> body,
                                           HttpServletRequest request) {
        checkSameOrigin(request);
        Map<String, Object> resolved = authService.resolveSession(sessionToken(request));
        @SuppressWarnings("unchecked")
        Map<String, Object> actor = (Map<String, Object>) resolved.get("user");
        return ResponseEntity.ok(pricingService.updatePricing(actor, body));
    }
}
