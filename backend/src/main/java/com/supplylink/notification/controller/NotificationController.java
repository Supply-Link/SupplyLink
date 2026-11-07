package com.supplylink.notification.controller;

import com.supplylink.auth.service.AuthService;
import com.supplylink.common.BaseController;
import com.supplylink.notification.service.NotificationService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
public class NotificationController extends BaseController {

    private final AuthService         authService;
    private final NotificationService notificationService;

    @Autowired
    public NotificationController(AuthService authService, NotificationService notificationService) {
        this.authService = authService;
        this.notificationService = notificationService;
    }

    @PostMapping("/api/notifications/read")
    public ResponseEntity<?> markRead(@RequestBody(required = false) Map<String, Object> body,
                                      HttpServletRequest request) {
        checkSameOrigin(request);
        Map<String, Object> resolved = authService.resolveSession(sessionToken(request));
        @SuppressWarnings("unchecked")
        Map<String, Object> user = (Map<String, Object>) resolved.get("user");
        return ResponseEntity.ok(notificationService.markAllRead((String) user.get("id")));
    }
}
