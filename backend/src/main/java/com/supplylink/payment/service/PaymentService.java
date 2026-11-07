package com.supplylink.payment.service;

import com.supplylink.audit.repository.AuditRepository;
import com.supplylink.common.BusinessException;
import com.supplylink.notification.repository.NotificationRepository;
import com.supplylink.order.repository.OrderRepository;
import com.supplylink.payment.repository.PaymentRepository;
import com.supplylink.store.DatabaseStore;
import com.supplylink.store.JsonbHelper;
import com.supplylink.user.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static com.supplylink.auth.service.AuthService.*;

@Service
public class PaymentService {

    private final DatabaseStore          store;
    private final PaymentRepository      payments;
    private final OrderRepository        orders;
    private final UserRepository         users;
    private final NotificationRepository notifications;
    private final AuditRepository        audit;

    @Autowired
    public PaymentService(DatabaseStore store, PaymentRepository payments, OrderRepository orders,
                          UserRepository users, NotificationRepository notifications, AuditRepository audit) {
        this.store = store; this.payments = payments; this.orders = orders;
        this.users = users; this.notifications = notifications; this.audit = audit;
    }

    @Transactional
    public Map<String, Object> recordPayment(Map<String, Object> actor, Map<String, Object> body) {
        store.acquireAdvisoryLock();
        require("admin".equals(actor.get("role")) || "distributor".equals(actor.get("role")),
                "Your role cannot perform this action.", 403);
        String requestKey = text(body.get("request_key"), "Request key", 100);
        var existing = payments.findByActorAndKey((String) actor.get("id"), requestKey);
        if (existing.isPresent()) return existing.get();
        String orderId = text(body.get("order_id"), "Order ID", 50);
        Map<String, Object> order = orders.findById(orderId)
                .orElseThrow(() -> new BusinessException("Order not found.", 404));
        String status = (String) order.get("status");
        require(!"cancelled".equals(status) && !"draft".equals(status),
                "Payment cannot be recorded for this order.");
        long amount = JsonbHelper.toLong(body.get("amount"));
        require(amount > 0, "Amount must be positive.");
        String reference = body.getOrDefault("reference", "") instanceof String s ? s.strip() : "";
        Map<String, Object> payment = new LinkedHashMap<>();
        payment.put("id",           uid("pay"));
        payment.put("order_id",     orderId);
        payment.put("order_number", order.get("number"));
        payment.put("amount",       amount);
        payment.put("reference",    reference);
        payment.put("actor_id",     actor.get("id"));
        payment.put("request_key",  requestKey);
        payments.insert(payment);
        long total = JsonbHelper.toLong(order.getOrDefault("total", 0));
        long paid  = payments.findByOrderIds(List.of(orderId)).stream()
                .mapToLong(p -> JsonbHelper.toLong(p.getOrDefault("amount", 0))).sum();
        if (paid >= total) orders.updatePaymentStatus(orderId, "paid");
        users.findById((String) order.get("retailer_id")).ifPresent(r ->
                notifications.insert((String) r.get("id"), "Payment received",
                        "₹" + amount / 100.0 + " recorded for order #" + order.get("number")));
        audit.insert((String) actor.get("id"), (String) actor.get("name"),
                "Payment recorded", "₹" + amount / 100.0 + " for order #" + order.get("number"));
        return payment;
    }

    private static String uid(String prefix) {
        byte[] b = new byte[5]; new SecureRandom().nextBytes(b);
        return prefix + "-" + HexFormat.of().formatHex(b);
    }
}
