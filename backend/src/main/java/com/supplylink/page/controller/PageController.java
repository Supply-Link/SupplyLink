package com.supplylink.page.controller;

import com.supplylink.auth.service.AuthService;
import com.supplylink.common.BaseController;
import com.supplylink.page.service.PageService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
public class PageController extends BaseController {

    private final AuthService authService;
    private final PageService pageService;

    @Autowired
    public PageController(AuthService authService, PageService pageService) {
        this.authService = authService;
        this.pageService = pageService;
    }

    @GetMapping("/api/shell")
    public ResponseEntity<?> shell(HttpServletRequest request) {
        Map<String, Object> resolved = authService.resolveSession(sessionToken(request));
        @SuppressWarnings("unchecked")
        Map<String, Object> user    = (Map<String, Object>) resolved.get("user");
        @SuppressWarnings("unchecked")
        Map<String, Object> session = (Map<String, Object>) resolved.get("session");
        return ResponseEntity.ok(pageService.shell(user, session));
    }

    @GetMapping("/api/dashboard")
    public ResponseEntity<?> dashboard(HttpServletRequest request) {
        Map<String, Object> resolved = authService.resolveSession(sessionToken(request));
        @SuppressWarnings("unchecked")
        Map<String, Object> user = (Map<String, Object>) resolved.get("user");
        return ResponseEntity.ok(pageService.dashboard(user));
    }

    @GetMapping("/api/catalog")
    public ResponseEntity<?> catalog(HttpServletRequest request) {
        Map<String, Object> resolved = authService.resolveSession(sessionToken(request));
        @SuppressWarnings("unchecked")
        Map<String, Object> user = (Map<String, Object>) resolved.get("user");
        return ResponseEntity.ok(pageService.catalog(user));
    }

    @GetMapping("/api/orders")
    public ResponseEntity<?> orders(HttpServletRequest request) {
        Map<String, Object> resolved = authService.resolveSession(sessionToken(request));
        @SuppressWarnings("unchecked")
        Map<String, Object> user = (Map<String, Object>) resolved.get("user");
        return ResponseEntity.ok(pageService.ordersPage(user));
    }

    @GetMapping("/api/deliveries")
    public ResponseEntity<?> deliveries(HttpServletRequest request) {
        Map<String, Object> resolved = authService.resolveSession(sessionToken(request));
        @SuppressWarnings("unchecked")
        Map<String, Object> user = (Map<String, Object>) resolved.get("user");
        return ResponseEntity.ok(pageService.deliveries(user));
    }

    @GetMapping("/api/payments")
    public ResponseEntity<?> payments(HttpServletRequest request) {
        Map<String, Object> resolved = authService.resolveSession(sessionToken(request));
        @SuppressWarnings("unchecked")
        Map<String, Object> user = (Map<String, Object>) resolved.get("user");
        return ResponseEntity.ok(pageService.paymentsPage(user));
    }

    @GetMapping("/api/credit")
    public ResponseEntity<?> credit(HttpServletRequest request) {
        Map<String, Object> resolved = authService.resolveSession(sessionToken(request));
        @SuppressWarnings("unchecked")
        Map<String, Object> user = (Map<String, Object>) resolved.get("user");
        return ResponseEntity.ok(pageService.credit(user));
    }

    @GetMapping("/api/inventory")
    public ResponseEntity<?> inventory(HttpServletRequest request) {
        Map<String, Object> resolved = authService.resolveSession(sessionToken(request));
        @SuppressWarnings("unchecked")
        Map<String, Object> user = (Map<String, Object>) resolved.get("user");
        return ResponseEntity.ok(pageService.inventory(user));
    }

    @GetMapping("/api/people")
    public ResponseEntity<?> people(HttpServletRequest request) {
        Map<String, Object> resolved = authService.resolveSession(sessionToken(request));
        @SuppressWarnings("unchecked")
        Map<String, Object> user = (Map<String, Object>) resolved.get("user");
        return ResponseEntity.ok(pageService.people(user));
    }

    @GetMapping("/api/pricing")
    public ResponseEntity<?> pricing(HttpServletRequest request) {
        Map<String, Object> resolved = authService.resolveSession(sessionToken(request));
        @SuppressWarnings("unchecked")
        Map<String, Object> user = (Map<String, Object>) resolved.get("user");
        return ResponseEntity.ok(pageService.pricingPage(user));
    }

    @GetMapping("/api/activity")
    public ResponseEntity<?> activity(HttpServletRequest request) {
        Map<String, Object> resolved = authService.resolveSession(sessionToken(request));
        @SuppressWarnings("unchecked")
        Map<String, Object> user = (Map<String, Object>) resolved.get("user");
        return ResponseEntity.ok(pageService.activity(user));
    }

    @GetMapping("/api/business")
    public ResponseEntity<?> business(HttpServletRequest request) {
        Map<String, Object> resolved = authService.resolveSession(sessionToken(request));
        @SuppressWarnings("unchecked")
        Map<String, Object> user = (Map<String, Object>) resolved.get("user");
        return ResponseEntity.ok(pageService.business(user));
    }

    @GetMapping("/api/directory")
    public ResponseEntity<?> directory(HttpServletRequest request) {
        Map<String, Object> resolved = authService.resolveSession(sessionToken(request));
        @SuppressWarnings("unchecked")
        Map<String, Object> user = (Map<String, Object>) resolved.get("user");
        return ResponseEntity.ok(pageService.directory(user));
    }

    @GetMapping("/api/notifications")
    public ResponseEntity<?> notifications(HttpServletRequest request) {
        Map<String, Object> resolved = authService.resolveSession(sessionToken(request));
        @SuppressWarnings("unchecked")
        Map<String, Object> user = (Map<String, Object>) resolved.get("user");
        return ResponseEntity.ok(pageService.notificationsPage(user));
    }
}
