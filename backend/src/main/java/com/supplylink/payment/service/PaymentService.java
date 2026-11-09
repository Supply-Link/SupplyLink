package com.supplylink.payment.service;

import com.supplylink.audit.repository.AuditRepository;
import com.supplylink.common.BusinessException;
import com.supplylink.notification.repository.NotificationRepository;
import com.supplylink.order.repository.OrderRepository;
import com.supplylink.order.service.OrderService;
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
import java.util.Map;

import static com.supplylink.auth.service.AuthService.require;
import static com.supplylink.auth.service.AuthService.text;

@Service
public class PaymentService {

    private final DatabaseStore          store;
    private final PaymentRepository      payments;
    private final OrderRepository        orders;
    private final OrderService           orderService;
    private final UserRepository         users;
    private final NotificationRepository notifications;
    private final AuditRepository        audit;

    @Autowired
    public PaymentService(DatabaseStore store, PaymentRepository payments, OrderRepository orders,
                          OrderService orderService, UserRepository users,
                          NotificationRepository notifications, AuditRepository audit) {
        this.store = store; this.payments = payments; this.orders = orders;
        this.orderService = orderService; this.users = users;
        this.notifications = notifications; this.audit = audit;
    }

    /** Records the full offline collection for a delivered order (admin, distributor or delivery partner). */
    @Transactional
    public Map<String, Object> recordPayment(Map<String, Object> actor, Map<String, Object> body) {
        store.acquireAdvisoryLock();
        String role = (String) actor.get("role");
        require("admin".equals(role) || "distributor".equals(role) || "delivery".equals(role),
                "Your role cannot perform this action.", 403);
        Map<String, Object> order = orderService.getAccessibleOrder(actor, body.get("order_id"));
        Object k = body.get("request_key");
        require(k instanceof String s && s.length() >= 8 && s.length() <= 120, "An idempotency key is required.");
        String requestKey = (String) k;

        var existing = payments.findByActorAndKey((String) actor.get("id"), requestKey);
        if (existing.isPresent()) {
            require(order.get("id").equals(existing.get().get("order_id")),
                    "Payment key was already used for another order.", 409);
            return existing.get();
        }
        require(!"cancelled".equals(order.get("status")), "Cannot pay a cancelled order.", 409);
        require(!"paid".equals(order.get("payment_status")), "This order is already paid.", 409);
        require("delivered".equals(order.get("status")), "Record collection after delivery.", 409);

        Object a = body.get("amount");
        require(a instanceof Integer || a instanceof Long, "Amount must be an integer between 1 and 100000000000000.");
        long amount = ((Number) a).longValue();
        require(amount >= 1 && amount <= 100_000_000_000_000L,
                "Amount must be an integer between 1 and 100000000000000.");
        require(amount == JsonbHelper.toLong(order.get("total")), "Record the full outstanding order amount.");
        String reference = text(body.get("reference"), "Receipt reference", 100);

        String orderId = (String) order.get("id");
        Map<String, Object> payment = new LinkedHashMap<>();
        payment.put("id",           uid("pay"));
        payment.put("order_id",     orderId);
        payment.put("order_number", order.get("number"));
        payment.put("amount",       amount);
        payment.put("reference",    reference);
        payment.put("actor_id",     actor.get("id"));
        payment.put("request_key",  requestKey);
        payments.insert(payment);
        orders.updatePaymentStatus(orderId, "paid");

        Map<String, Object> retailer = users.findById((String) order.get("retailer_id"))
                .orElseThrow(() -> new BusinessException("Record not found.", 404));
        if ("credit".equals(order.get("payment_method")))
            users.updateCreditUsed((String) retailer.get("id"),
                    Math.max(0, JsonbHelper.toLong(retailer.get("credit_used")) - amount));
        notifications.insert((String) retailer.get("id"), "Payment recorded",
                order.get("number") + ": your offline payment has been recorded.");
        audit.insert((String) actor.get("id"), (String) actor.get("name"), "Payment recorded",
                (String) order.get("number"));
        return payments.findByActorAndKey((String) actor.get("id"), requestKey).orElse(payment);
    }

    private static String uid(String prefix) {
        byte[] b = new byte[5];
        new SecureRandom().nextBytes(b);
        return prefix + "-" + HexFormat.of().formatHex(b);
    }
}
