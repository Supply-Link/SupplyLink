package com.supplylink.notification.service;

import com.supplylink.notification.repository.NotificationRepository;
import com.supplylink.store.DatabaseStore;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

@Service
public class NotificationService {

    private final DatabaseStore           store;
    private final NotificationRepository  notifications;

    @Autowired
    public NotificationService(DatabaseStore store, NotificationRepository notifications) {
        this.store = store; this.notifications = notifications;
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getForUser(String userId) {
        return notifications.findByUserId(userId);
    }

    @Transactional(readOnly = true)
    public long countUnread(String userId) {
        return notifications.countUnread(userId);
    }

    @Transactional
    public Map<String, Object> markAllRead(String userId) {
        store.acquireAdvisoryLock();
        notifications.markAllRead(userId);
        return Map.of("ok", true);
    }
}
