package com.supplylink.order.controller;

import com.supplylink.auth.service.AuthService;
import com.supplylink.common.BaseController;
import com.supplylink.order.service.OrderService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
public class OrderController extends BaseController {

    private final AuthService  authService;
    private final OrderService orderService;

    @Autowired
    public OrderController(AuthService authService, OrderService orderService) {
        this.authService = authService;
        this.orderService = orderService;
    }

    @GetMapping("/api/state")
    public ResponseEntity<?> state(HttpServletRequest request) {
        Map<String, Object> resolved = authService.resolveSession(sessionToken(request));
        @SuppressWarnings("unchecked")
        Map<String, Object> user = (Map<String, Object>) resolved.get("user");
        return ResponseEntity.ok(Map.of("orders", orderService.getOrdersForUser(user)));
    }

    @PostMapping("/api/quote")
    public ResponseEntity<?> quote(@RequestBody Map<String, Object> body, HttpServletRequest request) {
        checkSameOrigin(request);
        Map<String, Object> resolved = authService.resolveSession(sessionToken(request));
        @SuppressWarnings("unchecked")
        Map<String, Object> user = (Map<String, Object>) resolved.get("user");
        return ResponseEntity.ok(orderService.quote(user, body));
    }

    @PostMapping("/api/orders")
    public ResponseEntity<?> createOrder(@RequestBody Map<String, Object> body,
                                         HttpServletRequest request) {
        checkSameOrigin(request);
        Map<String, Object> resolved = authService.resolveSession(sessionToken(request));
        @SuppressWarnings("unchecked")
        Map<String, Object> user = (Map<String, Object>) resolved.get("user");
        return ResponseEntity.ok(orderService.createOrder(user, body));
    }

    @PostMapping("/api/orders/{id}")
    public ResponseEntity<?> updateOrder(@PathVariable String id,
                                         @RequestBody Map<String, Object> body,
                                         HttpServletRequest request) {
        checkSameOrigin(request);
        Map<String, Object> resolved = authService.resolveSession(sessionToken(request));
        @SuppressWarnings("unchecked")
        Map<String, Object> actor = (Map<String, Object>) resolved.get("user");
        body = new java.util.LinkedHashMap<>(body);
        body.put("order_id", id);
        return ResponseEntity.ok(orderService.updateOrder(actor, body));
    }

    @PostMapping("/api/proof-of-delivery")
    public ResponseEntity<?> proofOfDelivery(@RequestBody Map<String, Object> body,
                                             HttpServletRequest request) {
        checkSameOrigin(request);
        Map<String, Object> resolved = authService.resolveSession(sessionToken(request));
        @SuppressWarnings("unchecked")
        Map<String, Object> actor = (Map<String, Object>) resolved.get("user");
        return ResponseEntity.ok(orderService.captureProofOfDelivery(actor, body));
    }

    @PostMapping("/api/returns")
    public ResponseEntity<?> returns(@RequestBody Map<String, Object> body,
                                     HttpServletRequest request) {
        checkSameOrigin(request);
        Map<String, Object> resolved = authService.resolveSession(sessionToken(request));
        @SuppressWarnings("unchecked")
        Map<String, Object> actor = (Map<String, Object>) resolved.get("user");
        return ResponseEntity.ok(orderService.manageReturn(actor, body));
    }

    @PostMapping("/api/tracking")
    public ResponseEntity<?> tracking(@RequestBody Map<String, Object> body,
                                      HttpServletRequest request) {
        checkSameOrigin(request);
        Map<String, Object> resolved = authService.resolveSession(sessionToken(request));
        @SuppressWarnings("unchecked")
        Map<String, Object> actor = (Map<String, Object>) resolved.get("user");
        return ResponseEntity.ok(orderService.addTrackingPoint(actor, body));
    }
}
