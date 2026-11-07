package com.supplylink.common;

import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.LinkedHashMap;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {
    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<Map<String, Object>> handleBusiness(BusinessException ex) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", ex.getMessage());
        if (ex.getLicenseStatus() != null) {
            body.put("code", "SOFTWARE_LICENSE_BLOCKED");
            body.put("license", ex.getLicenseStatus());
        }
        return ResponseEntity.status(ex.getStatus()).body(body);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleUnexpected(Exception ex, HttpServletRequest request) {
        log.error("Unexpected API failure on {} {}", request.getMethod(), request.getRequestURI(), ex);
        String message = "GET".equals(request.getMethod())
                ? "Could not read data. Check the server log."
                : "Could not save changes. No changes were committed.";
        return ResponseEntity.status(500).body(Map.of("error", message));
    }
}
