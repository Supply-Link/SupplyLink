package com.supplylink.product.controller;

import com.supplylink.auth.service.AuthService;
import com.supplylink.common.BaseController;
import com.supplylink.product.service.ProductService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
public class ProductController extends BaseController {

    private final AuthService    authService;
    private final ProductService productService;

    @Autowired
    public ProductController(AuthService authService, ProductService productService) {
        this.authService = authService;
        this.productService = productService;
    }

    @PostMapping("/api/products")
    public ResponseEntity<?> products(@RequestBody Map<String, Object> body,
                                      HttpServletRequest request) {
        checkSameOrigin(request);
        Map<String, Object> resolved = authService.resolveSession(sessionToken(request));
        @SuppressWarnings("unchecked")
        Map<String, Object> actor = (Map<String, Object>) resolved.get("user");
        String action = (String) body.getOrDefault("action", "create");
        return switch (action) {
            case "update" -> ResponseEntity.ok(productService.updateProduct(actor, body));
            default       -> ResponseEntity.ok(productService.createProduct(actor, body));
        };
    }
}
