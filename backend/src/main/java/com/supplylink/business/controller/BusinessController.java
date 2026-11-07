package com.supplylink.business.controller;

import com.supplylink.auth.service.AuthService;
import com.supplylink.business.service.BusinessService;
import com.supplylink.common.BaseController;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
public class BusinessController extends BaseController {

    private final AuthService     authService;
    private final BusinessService businessService;

    @Autowired
    public BusinessController(AuthService authService, BusinessService businessService) {
        this.authService = authService;
        this.businessService = businessService;
    }

    @PostMapping("/api/business")
    public ResponseEntity<?> updateBusiness(@RequestBody Map<String, Object> body,
                                            HttpServletRequest request) {
        checkSameOrigin(request);
        Map<String, Object> resolved = authService.resolveSession(sessionToken(request));
        @SuppressWarnings("unchecked")
        Map<String, Object> actor = (Map<String, Object>) resolved.get("user");
        return ResponseEntity.ok(businessService.updateBusiness(actor, body));
    }
}
