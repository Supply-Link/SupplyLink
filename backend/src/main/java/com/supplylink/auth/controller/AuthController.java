package com.supplylink.auth.controller;

import com.supplylink.auth.service.AuthService;
import com.supplylink.common.BaseController;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
public class AuthController extends BaseController {

    private final AuthService authService;

    @Autowired
    public AuthController(AuthService authService) { this.authService = authService; }

    @GetMapping("/api/health")
    public ResponseEntity<Map<String, Object>> health() {
        return ResponseEntity.ok(authService.health());
    }

    @GetMapping("/api/license")
    public ResponseEntity<Map<String, Object>> license() {
        return ResponseEntity.ok(authService.license());
    }

    @GetMapping("/api/me")
    public ResponseEntity<Map<String, Object>> me(HttpServletRequest request) {
        return ResponseEntity.ok(authService.me(sessionToken(request)));
    }

    @PostMapping("/api/login")
    public ResponseEntity<Map<String, Object>> login(@RequestBody Map<String, Object> body,
                                                      HttpServletRequest request) {
        checkSameOrigin(request);
        Map<String, Object> result = authService.login(body, request.getRemoteAddr());
        String token = (String) result.remove("_session_token");
        HttpHeaders headers = new HttpHeaders();
        if (token != null) headers.add(HttpHeaders.SET_COOKIE, sessionCookie(token, false));
        return ResponseEntity.ok().headers(headers).body(result);
    }

    @PostMapping("/api/logout")
    public ResponseEntity<Map<String, Object>> logout(HttpServletRequest request) {
        checkSameOrigin(request);
        Map<String, Object> result = authService.logout(sessionToken(request));
        result.remove("_clear_cookie");
        HttpHeaders headers = new HttpHeaders();
        headers.add(HttpHeaders.SET_COOKIE, sessionCookie(null, true));
        return ResponseEntity.ok().headers(headers).body(result);
    }

    @PostMapping("/api/register")
    public ResponseEntity<Map<String, Object>> register(@RequestBody Map<String, Object> body,
                                                         HttpServletRequest request) {
        checkSameOrigin(request);
        return ResponseEntity.ok(authService.register(body, request.getRemoteAddr()));
    }
}
