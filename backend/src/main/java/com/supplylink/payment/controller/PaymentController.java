package com.supplylink.payment.controller;

import com.supplylink.auth.service.AuthService;
import com.supplylink.common.BaseController;
import com.supplylink.payment.service.PaymentService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
public class PaymentController extends BaseController {

    private final AuthService    authService;
    private final PaymentService paymentService;

    @Autowired
    public PaymentController(AuthService authService, PaymentService paymentService) {
        this.authService = authService;
        this.paymentService = paymentService;
    }

    @PostMapping("/api/payments")
    public ResponseEntity<?> recordPayment(@RequestBody Map<String, Object> body,
                                           HttpServletRequest request) {
        checkSameOrigin(request);
        Map<String, Object> resolved = authService.resolveSession(sessionToken(request));
        @SuppressWarnings("unchecked")
        Map<String, Object> actor = (Map<String, Object>) resolved.get("user");
        return ResponseEntity.ok(paymentService.recordPayment(actor, body));
    }
}
