package com.supplylink.order.service;

import com.supplylink.audit.repository.AuditRepository;
import com.supplylink.common.BusinessException;
import com.supplylink.notification.repository.NotificationRepository;
import com.supplylink.order.repository.*;
import com.supplylink.payment.repository.PaymentRepository;
import com.supplylink.pricing.repository.PricingRepository;
import com.supplylink.product.PharmacyHelper;
import com.supplylink.product.repository.BatchRepository;
import com.supplylink.product.repository.ProductRepository;
import com.supplylink.store.DatabaseStore;
import com.supplylink.store.JsonbHelper;
import com.supplylink.user.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.util.*;
import java.util.stream.Collectors;

import static com.supplylink.auth.service.AuthService.*;

@Service
public class OrderService {

    private final DatabaseStore               store;
    private final OrderRepository             orders;
    private final OrderLineRepository         lines;
    private final OrderBatchAllocationRepository allocations;
    private final OrderHistoryRepository      history;
    private final OrderPartyRepository        parties;
    private final TrackingRepository          tracking;
    private final ProductRepository           products;
    private final BatchRepository             batches;
    private final PricingRepository           pricing;
    private final UserRepository              users;
    private final PaymentRepository           payments;
    private final NotificationRepository      notifications;
    private final AuditRepository             audit;

    @Autowired
    public OrderService(DatabaseStore store, OrderRepository orders, OrderLineRepository lines,
                        OrderBatchAllocationRepository allocations, OrderHistoryRepository history,
                        OrderPartyRepository parties, TrackingRepository tracking,
                        ProductRepository products, BatchRepository batches,
                        PricingRepository pricing, UserRepository users,
                        PaymentRepository payments, NotificationRepository notifications,
                        AuditRepository audit) {
        this.store = store; this.orders = orders; this.lines = lines;
        this.allocations = allocations; this.history = history; this.parties = parties;
        this.tracking = tracking; this.products = products; this.batches = batches;
        this.pricing = pricing; this.users = users; this.payments = payments;
        this.notifications = notifications; this.audit = audit;
    }

    // ── Quote ───────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public Map<String, Object> quote(Map<String, Object> user, Map<String, Object> body) {
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> requestLines =
                (List<Map<String, Object>>) body.getOrDefault("lines", Collections.emptyList());
        require(!requestLines.isEmpty(), "Order must have at least one line.");
        String buyerState = (String) user.getOrDefault("state_code", "29");
        Map<String, Object> pricingConfig = pricing.find();
        int bulkMin = JsonbHelper.toInt(pricingConfig.getOrDefault("bulk_min", 0));
        int bulkDiscBps = JsonbHelper.toInt(pricingConfig.getOrDefault("bulk_discount_bps", 0));

        // Identify distributor (assume first product's distributor)
        Map<String, Object> firstProduct = products.findById(text(
                requestLines.get(0).get("product_id"), "Product ID", 50))
                .orElseThrow(() -> new BusinessException("Product not found.", 404));
        String supplierStateCode = "29"; // default Karnataka
        if (firstProduct.get("distributor_id") instanceof String distId) {
            Map<String, Object> dist = users.findById(distId).orElse(null);
            if (dist != null && dist.get("state_code") instanceof String sc) supplierStateCode = sc;
        }
        boolean isUT = PharmacyHelper.UT_CODES.contains(buyerState);
        String taxType = buyerState.equals(supplierStateCode) ? "cgst_sgst_utgst" : "igst";

        List<Map<String, Object>> quotedLines = new ArrayList<>();
        long subtotal = 0, discountTotal = 0;

        for (Map<String, Object> req : requestLines) {
            String productId = text(req.get("product_id"), "Product ID", 50);
            Map<String, Object> product = products.findById(productId)
                    .orElseThrow(() -> new BusinessException("Product not found.", 404));
            int qty = JsonbHelper.toInt(req.get("quantity"));
            require(qty > 0, "Quantity must be positive.");
            long unitPrice = JsonbHelper.toLong(product.get("unit_price"));
            int taxRateBps = JsonbHelper.toInt(product.getOrDefault("tax_rate_bps", 500));
            long lineGross = unitPrice * qty;
            long discount = lineGross >= bulkMin && bulkMin > 0
                    ? Math.round(lineGross * bulkDiscBps / 10000.0) : 0;
            long taxable = lineGross - discount;
            long tax = Math.round(taxable * taxRateBps / 10000.0);
            long lineTotal = taxable + tax;

            Map<String, Object> taxBreakdown = computeTax(taxable, taxRateBps, taxType, isUT, buyerState);

            Map<String, Object> ql = new LinkedHashMap<>();
            ql.put("product_id",   productId);
            ql.put("product_name", product.get("name"));
            ql.put("sku",          product.get("sku"));
            ql.put("unit",         product.get("unit"));
            ql.put("quantity",     qty);
            ql.put("unit_price",   unitPrice);
            ql.put("tax_rate_bps", taxRateBps);
            ql.put("gross",        lineGross);
            ql.put("discount",     discount);
            ql.put("taxable",      taxable);
            ql.putAll(taxBreakdown);
            ql.put("tax",          tax);
            ql.put("total",        lineTotal);

            if (Boolean.TRUE.equals(product.get("has_batches"))) {
                List<Map<String, Object>> productBatches = batches.findByProductId(productId);
                List<Map<String, Object>> allocBatches = fefoAllocate(productBatches, qty);
                ql.put("batch_allocations", allocBatches);
            }

            quotedLines.add(ql);
            subtotal += lineGross;
            discountTotal += discount;
        }

        long taxableTotal = subtotal - discountTotal;
        long totalTax = quotedLines.stream().mapToLong(l -> JsonbHelper.toLong(l.getOrDefault("tax",0))).sum();
        Map<String, Object> taxBreakdownTotal = computeTax(taxableTotal,
                quotedLines.isEmpty() ? 500 : JsonbHelper.toInt(quotedLines.get(0).getOrDefault("tax_rate_bps",500)),
                taxType, isUT, buyerState);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("tax_type",           taxType);
        result.put("supply_state_code",  buyerState);
        result.put("supplier_state_code",supplierStateCode);
        result.put("subtotal",           subtotal);
        result.put("discount",           discountTotal);
        result.put("taxable",            taxableTotal);
        result.putAll(taxBreakdownTotal);
        result.put("tax",                totalTax);
        result.put("total",              taxableTotal + totalTax);
        result.put("lines",              quotedLines);
        return result;
    }

    // ── Create Order ────────────────────────────────────────────────────────

    @Transactional
    public Map<String, Object> createOrder(Map<String, Object> user, Map<String, Object> body) {
        store.acquireAdvisoryLock();
        require("retailer".equals(user.get("role")), "Only retailers can place orders.", 403);
        String requestKey = text(body.get("request_key"), "Request key", 100);
        var existing = orders.findByRetailerAndKey((String) user.get("id"), requestKey);
        if (existing.isPresent()) return buildFullOrder(existing.get());

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> requestLines =
                (List<Map<String, Object>>) body.getOrDefault("lines", Collections.emptyList());
        require(!requestLines.isEmpty(), "Order must have at least one line.");
        Map<String, Object> quoteResult = quote(user, body);

        // Find distributor
        String productId0 = text(requestLines.get(0).get("product_id"), "Product ID", 50);
        Map<String, Object> prod0 = products.findById(productId0).orElseThrow();
        String distributorId = (String) prod0.get("distributor_id");
        Map<String, Object> distributor = distributorId != null
                ? users.findById(distributorId).orElse(null) : null;
        require(distributor != null, "No distributor found for this product.");

        // Credit check
        long total = JsonbHelper.toLong(quoteResult.get("total"));
        long creditLimit = JsonbHelper.toLong(user.getOrDefault("credit_limit", 0));
        long creditUsed  = JsonbHelper.toLong(user.getOrDefault("credit_used",  0));
        String paymentMethod = (String) body.getOrDefault("payment_method", "credit");
        if ("credit".equals(paymentMethod))
            require(creditUsed + total <= creditLimit,
                    "Insufficient trade credit. Available: ₹" + (creditLimit - creditUsed) / 100.0);

        long orderNum = orders.countAll() + 1;
        Map<String, Object> order = new LinkedHashMap<>();
        order.put("id",                   uid("ord"));
        order.put("number",               orderNum);
        order.put("retailer_id",          user.get("id"));
        order.put("retailer_name",        user.get("business"));
        order.put("distributor_id",       distributorId);
        order.put("address",              user.get("address"));
        order.put("payment_method",       paymentMethod);
        order.put("status",               "pending");
        order.put("request_key",          requestKey);
        order.put("supply_state_code",    quoteResult.get("supply_state_code"));
        order.put("supplier_state_code",  quoteResult.get("supplier_state_code"));
        order.put("tax_type",             quoteResult.get("tax_type"));
        order.put("subtotal",             quoteResult.get("subtotal"));
        order.put("discount",             quoteResult.get("discount"));
        order.put("taxable",              quoteResult.get("taxable"));
        order.put("cgst",   quoteResult.getOrDefault("cgst",   0L));
        order.put("sgst",   quoteResult.getOrDefault("sgst",   0L));
        order.put("utgst",  quoteResult.getOrDefault("utgst",  0L));
        order.put("igst",   quoteResult.getOrDefault("igst",   0L));
        order.put("tax",    quoteResult.get("tax"));
        order.put("total",  total);

        int sortOrder = orders.nextSortOrder();
        orders.insert(order, sortOrder);

        // Insert lines and batch allocations
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> quotedLines = (List<Map<String, Object>>) quoteResult.get("lines");
        lines.insertAll((String) order.get("id"), quotedLines);
        allocations.insertAll((String) order.get("id"), quotedLines);

        // Deduct stock (batch-tracked)
        for (Map<String, Object> ql : quotedLines) {
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> allocBatches =
                    (List<Map<String, Object>>) ql.getOrDefault("batch_allocations", Collections.emptyList());
            for (Map<String, Object> ab : allocBatches) {
                String batchId = (String) ab.get("batch_id");
                int used = JsonbHelper.toInt(ab.get("quantity"));
                if (batchId != null) batches.adjustStock(batchId, -used);
            }
            if (allocBatches.isEmpty()) {
                int qty = JsonbHelper.toInt(ql.get("quantity"));
                products.adjustStock((String) ql.get("product_id"), -qty);
            }
        }

        // Record initial history
        history.insert((String) order.get("id"), "pending", (String) user.get("name"));
        // Parties snapshot
        parties.insertBoth((String) order.get("id"),
                UserRepository.businessSnapshot(distributor),
                UserRepository.businessSnapshot(user));

        // Increase credit_used for credit orders
        if ("credit".equals(paymentMethod)) {
            long currentUsed = JsonbHelper.toLong(user.getOrDefault("credit_used", 0));
            updateCreditUsed((String) user.get("id"), currentUsed + total);
        }

        // Notify distributor
        notifications.insert(distributorId, "New order received",
                "Order #" + orderNum + " from " + user.get("business"));
        audit.insert((String) user.get("id"), (String) user.get("name"),
                "Order placed", "Order #" + orderNum);

        return buildFullOrder(orders.findById((String) order.get("id")).orElseThrow());
    }

    // ── Update Order ────────────────────────────────────────────────────────

    @Transactional
    public Map<String, Object> updateOrder(Map<String, Object> actor, Map<String, Object> body) {
        store.acquireAdvisoryLock();
        String orderId = text(body.get("order_id"), "Order ID", 50);
        Map<String, Object> order = orders.findById(orderId)
                .orElseThrow(() -> new BusinessException("Order not found.", 404));
        String newStatus = text(body.get("status"), "Status", 30);
        String role = (String) actor.get("role");
        String currentStatus = (String) order.get("status");
        validateTransition(role, currentStatus, newStatus, actor, order);

        if ("dispatched".equals(newStatus) && body.get("driver_id") instanceof String driverId) {
            orders.updateStatusAndDriver(orderId, newStatus, driverId);
        } else {
            orders.updateStatus(orderId, newStatus);
        }
        history.insert(orderId, newStatus, (String) actor.get("name"));

        // On delivery confirm or cancellation, reduce credit_used
        if ("delivered".equals(newStatus) || "cancelled".equals(newStatus)) {
            String retailerId = (String) order.get("retailer_id");
            if ("credit".equals(order.get("payment_method"))) {
                users.findById(retailerId).ifPresent(r -> {
                    long used  = JsonbHelper.toLong(r.getOrDefault("credit_used", 0));
                    long total2 = JsonbHelper.toLong(order.get("total"));
                    updateCreditUsed(retailerId, Math.max(0, used - total2));
                });
            }
        }
        // Notify retailer on status change
        String retailerId = (String) order.get("retailer_id");
        notifications.insert(retailerId, "Order status updated",
                "Order #" + order.get("number") + " is now " + newStatus);
        audit.insert((String) actor.get("id"), (String) actor.get("name"),
                "Order updated", "Order #" + order.get("number") + " → " + newStatus);
        return buildFullOrder(orders.findById(orderId).orElseThrow());
    }

    // ── Proof of delivery ───────────────────────────────────────────────────

    @Transactional
    public Map<String, Object> captureProofOfDelivery(Map<String, Object> actor, Map<String, Object> body) {
        store.acquireAdvisoryLock();
        require("delivery".equals(actor.get("role")) || "admin".equals(actor.get("role")),
                "Your role cannot perform this action.", 403);
        String orderId = text(body.get("order_id"), "Order ID", 50);
        Map<String, Object> order = orders.findById(orderId)
                .orElseThrow(() -> new BusinessException("Order not found.", 404));
        require("dispatched".equals(order.get("status")), "Order must be in dispatched state.");
        Map<String, Object> extra = new LinkedHashMap<>();
        extra.put("proof_of_delivery", Map.of(
                "captured_by", actor.get("name"),
                "captured_at", java.time.Instant.now().toString(),
                "notes",       body.getOrDefault("notes", "")));
        orders.updateExtra(orderId, extra);
        orders.updateStatus(orderId, "delivered");
        history.insert(orderId, "delivered", (String) actor.get("name"));
        notifications.insert((String) order.get("retailer_id"), "Order delivered",
                "Order #" + order.get("number") + " has been delivered.");
        audit.insert((String) actor.get("id"), (String) actor.get("name"),
                "Delivery confirmed", "Order #" + order.get("number"));
        return buildFullOrder(orders.findById(orderId).orElseThrow());
    }

    // ── Return request ──────────────────────────────────────────────────────

    @Transactional
    public Map<String, Object> manageReturn(Map<String, Object> actor, Map<String, Object> body) {
        store.acquireAdvisoryLock();
        String orderId = text(body.get("order_id"), "Order ID", 50);
        Map<String, Object> order = orders.findById(orderId)
                .orElseThrow(() -> new BusinessException("Order not found.", 404));
        String role = (String) actor.get("role");
        String action = (String) body.getOrDefault("action", "request");
        Map<String, Object> extra = new LinkedHashMap<>();
        if ("request".equals(action)) {
            require("retailer".equals(role) && actor.get("id").equals(order.get("retailer_id")),
                    "Only the ordering retailer can request a return.", 403);
            require("delivered".equals(order.get("status")), "Returns are only allowed for delivered orders.");
            extra.put("return_request", Map.of(
                    "requested_by", actor.get("name"),
                    "requested_at", java.time.Instant.now().toString(),
                    "reason",       body.getOrDefault("reason", ""),
                    "status",       "pending"));
        } else if ("approve".equals(action) || "reject".equals(action)) {
            require("admin".equals(role) || "distributor".equals(role),
                    "Your role cannot perform this action.", 403);
            extra.put("return_request", Map.of(
                    "decision",    action,
                    "decided_by",  actor.get("name"),
                    "decided_at",  java.time.Instant.now().toString(),
                    "status",      action.equals("approve") ? "approved" : "rejected"));
            if ("approve".equals(action)) orders.updateStatus(orderId, "returned");
        } else require(false, "Invalid action.");
        orders.updateExtra(orderId, extra);
        return buildFullOrder(orders.findById(orderId).orElseThrow());
    }

    // ── Tracking ─────────────────────────────────────────────────────────

    @Transactional
    public Map<String, Object> addTrackingPoint(Map<String, Object> actor, Map<String, Object> body) {
        store.acquireAdvisoryLock();
        require("delivery".equals(actor.get("role")) || "admin".equals(actor.get("role")),
                "Your role cannot perform this action.", 403);
        String orderId = text(body.get("order_id"), "Order ID", 50);
        require(orders.findById(orderId).isPresent(), "Order not found.", 404);
        double lat = ((Number) body.get("latitude")).doubleValue();
        double lon = ((Number) body.get("longitude")).doubleValue();
        tracking.insert(orderId, lat, lon);
        return Map.of("ok", true);
    }

    // ── Get Orders for user ───────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getOrdersForUser(Map<String, Object> user) {
        String role = (String) user.get("role");
        List<Map<String, Object>> orderList = switch (role) {
            case "admin"       -> orders.findAll();
            case "distributor" -> orders.findByDistributorId((String) user.get("id"));
            case "retailer"    -> orders.findByRetailerId((String) user.get("id"));
            case "delivery"    -> orders.findByDriverId((String) user.get("id"));
            default            -> Collections.emptyList();
        };
        if (orderList.isEmpty()) return orderList;
        List<String> ids = orderList.stream().map(o -> (String) o.get("id")).toList();
        Map<String, List<Map<String, Object>>> linesMap   = lines.findByOrderIds(ids);
        Map<String, List<Map<String, Object>>> histMap    = history.findByOrderIds(ids);
        Map<String, List<Map<String, Object>>> trackMap   = tracking.findByOrderIds(ids);
        for (Map<String, Object> o : orderList) {
            String id = (String) o.get("id");
            ((List<Map<String, Object>>) o.get("lines")).addAll(linesMap.getOrDefault(id, Collections.emptyList()));
            ((List<Map<String, Object>>) o.get("history")).addAll(histMap.getOrDefault(id, Collections.emptyList()));
            ((List<Map<String, Object>>) o.get("tracking")).addAll(trackMap.getOrDefault(id, Collections.emptyList()));
        }
        return orderList;
    }

    // ── Build a single full order ──────────────────────────────────────────

    public Map<String, Object> buildFullOrder(Map<String, Object> order) {
        String id = (String) order.get("id");
        ((List<?>) order.get("lines")).clear();
        ((List<?>) order.get("history")).clear();
        ((List<?>) order.get("tracking")).clear();
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> linesData   = lines.findByOrderId(id);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> histData    = history.findByOrderId(id);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> trackData   = tracking.findByOrderId(id);
        ((List<Map<String, Object>>) order.get("lines")).addAll(linesData);
        ((List<Map<String, Object>>) order.get("history")).addAll(histData);
        ((List<Map<String, Object>>) order.get("tracking")).addAll(trackData);
        return order;
    }

    // ── FEFO allocation ────────────────────────────────────────────────────

    private List<Map<String, Object>> fefoAllocate(List<Map<String, Object>> productBatches, int qty) {
        String today = PharmacyHelper.today().toString();
        List<Map<String, Object>> available = productBatches.stream()
                .filter(b -> !Boolean.TRUE.equals(b.get("quarantined")))
                .filter(b -> {
                    Object exp = b.get("expiry_date");
                    if (exp == null) return false;
                    String expStr = exp.toString();
                    return expStr.compareTo(today) > 0;
                })
                .filter(b -> JsonbHelper.toInt(b.getOrDefault("stock", 0)) > 0)
                .sorted(Comparator.comparing(b -> b.get("expiry_date").toString()))
                .toList();
        List<Map<String, Object>> result = new ArrayList<>();
        int remaining = qty;
        for (Map<String, Object> b : available) {
            if (remaining <= 0) break;
            int stock = JsonbHelper.toInt(b.getOrDefault("stock", 0));
            int used  = Math.min(stock, remaining);
            Map<String, Object> alloc = new LinkedHashMap<>();
            alloc.put("batch_id",     b.get("id"));
            alloc.put("batch_number", b.get("batch_number"));
            alloc.put("expiry_date",  b.get("expiry_date"));
            alloc.put("quantity",     used);
            result.add(alloc);
            remaining -= used;
        }
        return result;
    }

    // ── Tax calculation ────────────────────────────────────────────────────

    private Map<String, Object> computeTax(long taxable, int taxRateBps, String taxType,
                                           boolean isUT, String buyerState) {
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("cgst", 0L); r.put("sgst", 0L); r.put("utgst", 0L); r.put("igst", 0L);
        if ("igst".equals(taxType)) {
            r.put("igst", Math.round(taxable * taxRateBps / 10000.0));
        } else {
            long halfTax = Math.round(taxable * taxRateBps / 20000.0);
            r.put("cgst", halfTax);
            if (isUT) r.put("utgst", halfTax);
            else      r.put("sgst",  halfTax);
        }
        return r;
    }

    private void validateTransition(String role, String from, String to,
                                    Map<String, Object> actor, Map<String, Object> order) {
        Map<String, List<String>> allowed = Map.of(
                "admin",       List.of("pending","confirmed","dispatched","delivered","cancelled","returned"),
                "distributor", List.of("pending","confirmed","dispatched","cancelled"),
                "delivery",    List.of("dispatched","delivered"),
                "retailer",    List.of("cancelled")
        );
        require(allowed.getOrDefault(role, Collections.emptyList()).contains(to),
                "Your role cannot set this status.", 403);
        Map<String, List<String>> transitions = Map.of(
                "pending",    List.of("confirmed","cancelled"),
                "confirmed",  List.of("dispatched","cancelled"),
                "dispatched", List.of("delivered","cancelled"),
                "delivered",  List.of("returned")
        );
        require(transitions.getOrDefault(from, Collections.emptyList()).contains(to),
                "Invalid status transition: " + from + " → " + to);
    }

    private void updateCreditUsed(String userId, long used) {
        users.updateCreditUsed(userId, used);
    }

    private static String uid(String prefix) {
        byte[] b = new byte[5]; new SecureRandom().nextBytes(b);
        return prefix + "-" + HexFormat.of().formatHex(b);
    }

}

