package com.supplylink.page.service;

import com.supplylink.audit.repository.AuditRepository;
import com.supplylink.notification.repository.NotificationRepository;
import com.supplylink.order.repository.*;
import com.supplylink.order.service.OrderService;
import com.supplylink.payment.repository.PaymentRepository;
import com.supplylink.pricing.repository.PricingRepository;
import com.supplylink.pricing.service.PricingService;
import com.supplylink.product.PharmacyHelper;
import com.supplylink.product.repository.BatchRepository;
import com.supplylink.product.repository.ProductRepository;
import com.supplylink.product.service.ProductService;
import com.supplylink.store.JsonbHelper;
import com.supplylink.user.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

import static com.supplylink.auth.service.AuthService.require;

@Service
public class PageService {

    private final UserRepository         users;
    private final ProductRepository      products;
    private final BatchRepository        batches;
    private final OrderRepository        orders;
    private final OrderLineRepository    lines;
    private final OrderHistoryRepository history;
    private final TrackingRepository     tracking;
    private final PaymentRepository      payments;
    private final PricingRepository      pricing;
    private final AuditRepository        audit;
    private final NotificationRepository notifications;
    private final OrderService           orderService;
    private final ProductService         productService;
    private final PricingService         pricingService;

    @Autowired
    public PageService(UserRepository users, ProductRepository products, BatchRepository batches,
                       OrderRepository orders, OrderLineRepository lines,
                       OrderHistoryRepository history, TrackingRepository tracking,
                       PaymentRepository payments, PricingRepository pricing,
                       AuditRepository audit, NotificationRepository notifications,
                       OrderService orderService, ProductService productService,
                       PricingService pricingService) {
        this.users = users; this.products = products; this.batches = batches;
        this.orders = orders; this.lines = lines; this.history = history;
        this.tracking = tracking; this.payments = payments; this.pricing = pricing;
        this.audit = audit; this.notifications = notifications;
        this.orderService = orderService; this.productService = productService;
        this.pricingService = pricingService;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> shell(Map<String, Object> user, Map<String, Object> session) {
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("user",    UserRepository.safeUser(user));
        r.put("csrf",    session.get("csrf"));
        r.put("license", Map.of("status","valid","usable",true,"type","community"));
        return r;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> dashboard(Map<String, Object> user) {
        String role = (String) user.get("role");
        List<Map<String, Object>> userOrders = orderService.getOrdersForUser(user);
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("role", role);
        r.put("order_count", userOrders.size());
        r.put("pending_count", userOrders.stream().filter(o -> "pending".equals(o.get("status"))).count());
        r.put("delivered_count", userOrders.stream().filter(o -> "delivered".equals(o.get("status"))).count());
        long revenue = userOrders.stream()
                .filter(o -> List.of("delivered","confirmed","dispatched").contains(o.get("status")))
                .mapToLong(o -> JsonbHelper.toLong(o.getOrDefault("total", 0))).sum();
        r.put("revenue", revenue);
        if ("retailer".equals(role)) {
            r.put("credit_limit", user.getOrDefault("credit_limit", 0));
            r.put("credit_used",  user.getOrDefault("credit_used",  0));
        }
        if ("admin".equals(role)) {
            r.put("user_count",    users.findAll().size());
            r.put("product_count", products.findAll().size());
        }
        return r;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> catalog(Map<String, Object> user) {
        List<Map<String, Object>> productList = productService.getProductsForUser(user);
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("products", productList);
        r.put("pricing",  pricingService.getPricing());
        return r;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> ordersPage(Map<String, Object> user) {
        return Map.of("orders", orderService.getOrdersForUser(user));
    }

    @Transactional(readOnly = true)
    public Map<String, Object> deliveries(Map<String, Object> user) {
        require("delivery".equals(user.get("role")) || "admin".equals(user.get("role")),
                "Your role cannot access this page.", 403);
        return Map.of("orders", orderService.getOrdersForUser(user));
    }

    @Transactional(readOnly = true)
    public Map<String, Object> paymentsPage(Map<String, Object> user) {
        String role = (String) user.get("role");
        List<Map<String, Object>> all = payments.findAll();
        List<Map<String, Object>> filtered = switch (role) {
            case "admin"       -> all;
            case "distributor" -> {
                List<String> distOrderIds = orders.findByDistributorId((String) user.get("id"))
                        .stream().map(o -> (String) o.get("id")).toList();
                yield all.stream().filter(p -> distOrderIds.contains(p.get("order_id"))).toList();
            }
            case "retailer" -> {
                List<String> retailerOrderIds = orders.findByRetailerId((String) user.get("id"))
                        .stream().map(o -> (String) o.get("id")).toList();
                yield all.stream().filter(p -> retailerOrderIds.contains(p.get("order_id"))).toList();
            }
            default -> Collections.emptyList();
        };
        return Map.of("payments", filtered);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> credit(Map<String, Object> user) {
        require("retailer".equals(user.get("role")) || "admin".equals(user.get("role")),
                "Your role cannot access this page.", 403);
        List<Map<String, Object>> target;
        if ("admin".equals(user.get("role"))) {
            target = users.findAll().stream()
                    .filter(u -> "retailer".equals(u.get("role")) && Boolean.TRUE.equals(u.get("active")))
                    .map(u -> {
                        Map<String, Object> r = new LinkedHashMap<>(UserRepository.safeUser(u));
                        r.put("credit_limit", u.getOrDefault("credit_limit", 0));
                        r.put("credit_used",  u.getOrDefault("credit_used",  0));
                        return r;
                    }).toList();
        } else {
            target = List.of(Map.of(
                    "credit_limit", user.getOrDefault("credit_limit", 0),
                    "credit_used",  user.getOrDefault("credit_used",  0)));
        }
        return Map.of("credit", target);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> inventory(Map<String, Object> user) {
        require(!"retailer".equals(user.get("role")), "Your role cannot access this page.", 403);
        List<Map<String, Object>> productList = productService.getProductsForUser(user);
        List<Map<String, Object>> enriched = productList.stream().map(p -> {
            Map<String, Object> m = new LinkedHashMap<>(p);
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> batchList = (List<Map<String, Object>>) p.getOrDefault("batches", Collections.emptyList());
            m.putAll(PharmacyHelper.stockSummary(p, batchList));
            return m;
        }).toList();
        return Map.of("products", enriched);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> people(Map<String, Object> user) {
        require("admin".equals(user.get("role")), "Your role cannot access this page.", 403);
        List<Map<String, Object>> all = users.findAll().stream()
                .map(UserRepository::safeUser).toList();
        return Map.of("users", all);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> pricingPage(Map<String, Object> user) {
        require("admin".equals(user.get("role")) || "distributor".equals(user.get("role")),
                "Your role cannot access this page.", 403);
        return Map.of("pricing", pricingService.getPricing());
    }

    @Transactional(readOnly = true)
    public Map<String, Object> activity(Map<String, Object> user) {
        require("admin".equals(user.get("role")), "Your role cannot access this page.", 403);
        return Map.of("events", audit.findRecent());
    }

    @Transactional(readOnly = true)
    public Map<String, Object> business(Map<String, Object> user) {
        return Map.of("user", UserRepository.safeUser(user));
    }

    @Transactional(readOnly = true)
    public Map<String, Object> directory(Map<String, Object> user) {
        List<Map<String, Object>> all = users.findAll().stream()
                .filter(u -> Boolean.TRUE.equals(u.get("active"))
                        && List.of("distributor","retailer").contains(u.get("role")))
                .map(UserRepository::businessSnapshot)
                .toList();
        return Map.of("directory", all);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> notificationsPage(Map<String, Object> user) {
        return Map.of(
                "notifications", notifications.findByUserId((String) user.get("id")),
                "unread_count",  notifications.countUnread((String) user.get("id")));
    }
}
