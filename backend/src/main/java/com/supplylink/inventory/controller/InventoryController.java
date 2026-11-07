package com.supplylink.inventory.controller;

import com.supplylink.auth.service.AuthService;
import com.supplylink.common.BaseController;
import com.supplylink.inventory.service.InventoryService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
public class InventoryController extends BaseController {

    private final AuthService      authService;
    private final InventoryService inventoryService;

    @Autowired
    public InventoryController(AuthService authService, InventoryService inventoryService) {
        this.authService = authService;
        this.inventoryService = inventoryService;
    }

    @PostMapping("/api/batches")
    public ResponseEntity<?> addBatch(@RequestBody Map<String, Object> body,
                                      HttpServletRequest request) {
        checkSameOrigin(request);
        Map<String, Object> resolved = authService.resolveSession(sessionToken(request));
        @SuppressWarnings("unchecked")
        Map<String, Object> actor = (Map<String, Object>) resolved.get("user");
        return ResponseEntity.ok(inventoryService.addBatch(actor, body));
    }

    @PostMapping("/api/batches/quarantine")
    public ResponseEntity<?> quarantineBatch(@RequestBody Map<String, Object> body,
                                             HttpServletRequest request) {
        checkSameOrigin(request);
        Map<String, Object> resolved = authService.resolveSession(sessionToken(request));
        @SuppressWarnings("unchecked")
        Map<String, Object> actor = (Map<String, Object>) resolved.get("user");
        return ResponseEntity.ok(inventoryService.quarantineBatch(actor, body));
    }

    @PostMapping("/api/inventory")
    public ResponseEntity<?> adjustStock(@RequestBody Map<String, Object> body,
                                         HttpServletRequest request) {
        checkSameOrigin(request);
        Map<String, Object> resolved = authService.resolveSession(sessionToken(request));
        @SuppressWarnings("unchecked")
        Map<String, Object> actor = (Map<String, Object>) resolved.get("user");
        return ResponseEntity.ok(inventoryService.adjustStock(actor, body));
    }
}
