package com.supplylink.order.service;

import com.supplylink.audit.repository.AuditRepository;
import com.supplylink.common.BusinessException;
import com.supplylink.notification.repository.NotificationRepository;
import com.supplylink.order.repository.*;
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
import java.time.Instant;
import java.time.LocalDate;
import java.util.*;

import static com.supplylink.auth.service.AuthService.require;
import static com.supplylink.auth.service.AuthService.text;

/**
 * Order lifecycle: quote, place, status changes, proof of delivery, returns and tracking.
 * Statuses and money rules follow the original portal contract: placed → confirmed → packed →
 * out_for_delivery → delivered (or cancelled), with GST computed per line in paise.
 */
@Service
public class OrderService {

    private static final Map<String, String> NEXT_STATUS = Map.of(
            "placed", "confirmed",
            "confirmed", "packed",
            "packed", "out_for_delivery",
            "out_for_delivery", "delivered");

    private final DatabaseStore                  store;
    private final OrderRepository                orders;
    private final OrderLineRepository            lines;
    private final OrderBatchAllocationRepository allocations;
    private final OrderHistoryRepository         history;
    private final OrderPartyRepository           parties;
    private final TrackingRepository             tracking;
    private final ProductRepository              products;
    private final BatchRepository                batches;
    private final PricingRepository              pricing;
    private final UserRepository                 users;
    private final NotificationRepository         notifications;
    private final AuditRepository                audit;

    @Autowired
    public OrderService(DatabaseStore store, OrderRepository orders, OrderLineRepository lines,
                        OrderBatchAllocationRepository allocations, OrderHistoryRepository history,
                        OrderPartyRepository parties, TrackingRepository tracking,
                        ProductRepository products, BatchRepository batches,
                        PricingRepository pricing, UserRepository users,
                        NotificationRepository notifications, AuditRepository audit) {
        this.store = store; this.orders = orders; this.lines = lines;
        this.allocations = allocations; this.history = history; this.parties = parties;
        this.tracking = tracking; this.products = products; this.batches = batches;
        this.pricing = pricing; this.users = users;
        this.notifications = notifications; this.audit = audit;
    }

    // ── Validation helpers ──────────────────────────────────────────────────

    private static long integer(Object v, String name, long min, long max) {
        boolean whole = v instanceof Integer || v instanceof Long || v instanceof Short
                || (v instanceof Double d && d == Math.rint(d) && !d.isInfinite());
        require(whole && ((Number) v).longValue() >= min && ((Number) v).longValue() <= max,
                name + " must be an integer between " + min + " and " + max + ".");
        return ((Number) v).longValue();
    }

    private static String stateCode(Object v) {
        require(v instanceof String s && PharmacyHelper.STATE_CODES.contains(s),
                "Select a valid Indian state / territory code.");
        return (String) v;
    }

    private static String idempotencyKey(Object v) {
        require(v instanceof String s && s.length() >= 8 && s.length() <= 120,
                "An idempotency key is required.");
        return (String) v;
    }

    private static String uid(String prefix) {
        byte[] b = new byte[5];
        new SecureRandom().nextBytes(b);
        return prefix + "-" + HexFormat.of().formatHex(b);
    }

    private static String nowIso() { return Instant.now().toString(); }

    private static boolean roleIn(Map<String, Object> user, String... roles) {
        return Arrays.asList(roles).contains(user.get("role"));
    }

    private static void requireRole(Map<String, Object> user, String... roles) {
        require(roleIn(user, roles), "Your role cannot perform this action.", 403);
    }

    // ── Access ──────────────────────────────────────────────────────────────

    private static boolean canSee(Map<String, Object> user, Map<String, Object> order) {
        String id = (String) user.get("id");
        return switch ((String) user.get("role")) {
            case "admin"       -> true;
            case "retailer"    -> id.equals(order.get("retailer_id"));
            case "distributor" -> id.equals(order.get("distributor_id"));
            case "delivery"    -> id.equals(order.get("driver_id"));
            default            -> false;
        };
    }

    /** Loads an order the user is allowed to see (404 when missing, 403 when not theirs). */
    public Map<String, Object> getAccessibleOrder(Map<String, Object> user, Object orderId) {
        require(orderId instanceof String, "Record not found.", 404);
        Map<String, Object> order = orders.findById((String) orderId)
                .orElseThrow(() -> new BusinessException("Record not found.", 404));
        require(canSee(user, order), "You cannot access this order.", 403);
        return order;
    }

    // ── Stock helpers ───────────────────────────────────────────────────────

    /** Recomputes a product's sellable stock from its batches (expired and quarantined excluded). */
    private void syncStock(String productId) {
        List<Map<String, Object>> productBatches = batches.findByProductId(productId);
        long valid = 0;
        for (Map<String, Object> b : productBatches) {
            String status = PharmacyHelper.batchStatus(b);
            if ("available".equals(status) || "near_expiry".equals(status))
                valid += JsonbHelper.toLong(b.get("stock"));
        }
        products.setStock(productId, valid);
    }

    // ── Quote ───────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public Map<String, Object> quote(Map<String, Object> user, Map<String, Object> body) {
        requireRole(user, "retailer");
        return compute(body.get("items"), body.getOrDefault("supply_state_code",
                user.getOrDefault("state_code", "29")));
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> compute(Object itemsObj, Object supplyStateCode) {
        require(itemsObj instanceof List<?> l && !l.isEmpty() && l.size() <= 100,
                "Add between 1 and 100 products.");
        List<Object> items = (List<Object>) itemsObj;
        String destination = stateCode(supplyStateCode);
        Map<String, Object> pricingConfig = pricing.find();
        int bulkMin = JsonbHelper.toInt(pricingConfig.get("bulk_min"));
        int bulkBps = JsonbHelper.toInt(pricingConfig.get("bulk_discount_bps"));

        List<Map<String, Object>> quoted = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        String distributorId = null;
        Map<String, Object> supplier = null;
        boolean ut = PharmacyHelper.UT_CODES.contains(destination);

        for (Object raw : items) {
            require(raw instanceof Map, "Invalid order line.");
            Map<String, Object> item = (Map<String, Object>) raw;
            Object pid = item.get("product_id");
            require(pid instanceof String, "Record not found.", 404);
            Map<String, Object> p = products.findById((String) pid)
                    .orElseThrow(() -> new BusinessException("Record not found.", 404));
            require(Boolean.TRUE.equals(p.get("active")), "This medicine is unavailable.");
            require(seen.add((String) pid), "Combine duplicate medicines into one line.");
            long quantity = integer(item.get("quantity"), "Quantity", 1, 10000);

            List<Map<String, Object>> productBatches = new ArrayList<>(batches.findByProductId((String) pid));
            long sellable = 0;
            for (Map<String, Object> b : productBatches) {
                String status = PharmacyHelper.batchStatus(b);
                if ("available".equals(status) || "near_expiry".equals(status))
                    sellable += JsonbHelper.toLong(b.get("stock"));
            }
            require(quantity <= sellable,
                    p.get("name") + " has only " + sellable + " unexpired packs available.", 409);
            require(p.get("hsn_code") instanceof String h && !h.isEmpty() && p.get("gst_rate_bps") != null,
                    "Configure HSN and GST for " + p.get("name") + " before ordering.", 409);

            if (distributorId == null) {
                distributorId = (String) p.get("distributor_id");
                supplier = users.findById(distributorId)
                        .orElseThrow(() -> new BusinessException("Record not found.", 404));
                require(Boolean.TRUE.equals(supplier.get("active")), "This distributor is inactive.", 409);
                stateCode(supplier.get("state_code"));
            }
            require(distributorId.equals(p.get("distributor_id")),
                    "Place a separate order for each distributor.");

            long price = JsonbHelper.toLong(p.get("price"));
            int rate = JsonbHelper.toInt(p.get("gst_rate_bps"));
            long discountBps = quantity >= bulkMin ? bulkBps : 0;
            long subtotal = price * quantity;
            long reduction = subtotal * discountBps / 10000;
            long taxable = subtotal - reduction;
            boolean intra = destination.equals(supplier.get("state_code"));
            long cgst  = intra ? (taxable * rate + 10000) / 20000 : 0;
            long utgst = intra && ut ? cgst : 0;
            long sgst  = intra && utgst == 0 ? cgst : 0;
            long igst  = intra ? 0 : (taxable * rate + 5000) / 10000;

            productBatches.sort(Comparator
                    .comparing((Map<String, Object> b) -> String.valueOf(b.get("expiry_date")))
                    .thenComparing(b -> String.valueOf(b.get("manufacturing_date")))
                    .thenComparing(b -> String.valueOf(b.get("id"))));
            long remaining = quantity;
            List<Map<String, Object>> allocs = new ArrayList<>();
            for (Map<String, Object> b : productBatches) {
                String status = PharmacyHelper.batchStatus(b);
                if (!"available".equals(status) && !"near_expiry".equals(status)) continue;
                long take = Math.min(remaining, JsonbHelper.toLong(b.get("stock")));
                if (take > 0) {
                    require(price * (10000L + rate) <= JsonbHelper.toLong(b.get("mrp")) * 10000L,
                            "Selling price including GST exceeds MRP for batch " + b.get("batch_number") + ".", 409);
                    Map<String, Object> a = new LinkedHashMap<>();
                    a.put("batch_id",           b.get("id"));
                    a.put("batch_number",       b.get("batch_number"));
                    a.put("manufacturing_date", b.get("manufacturing_date"));
                    a.put("expiry_date",        b.get("expiry_date"));
                    a.put("mrp",                JsonbHelper.toLong(b.get("mrp")));
                    a.put("quantity",           take);
                    allocs.add(a);
                    remaining -= take;
                }
                if (remaining == 0) break;
            }
            require(remaining == 0, "Receive batch stock before ordering this medicine.", 409);

            long tax = cgst + sgst + utgst + igst;
            Map<String, Object> line = new LinkedHashMap<>();
            line.put("product_id",   pid);
            line.put("name",         p.get("name"));
            line.put("unit",         p.get("unit"));
            line.put("manufacturer", p.get("manufacturer") == null ? "" : p.get("manufacturer"));
            line.put("quantity",     quantity);
            line.put("unit_price",   price);
            line.put("subtotal",     subtotal);
            line.put("discount",     reduction);
            line.put("taxable",      taxable);
            line.put("hsn_code",     p.get("hsn_code"));
            line.put("gst_rate_bps", rate);
            line.put("cgst",  cgst);
            line.put("sgst",  sgst);
            line.put("utgst", utgst);
            line.put("igst",  igst);
            line.put("tax",   tax);
            line.put("total", taxable + tax);
            line.put("batches", allocs);
            quoted.add(line);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        for (String field : new String[]{"subtotal", "discount", "taxable", "cgst", "sgst", "utgst", "igst", "tax", "total"}) {
            long sum = 0;
            for (Map<String, Object> l : quoted) sum += JsonbHelper.toLong(l.get(field));
            result.put(field, sum);
        }
        String supplierState = (String) supplier.get("state_code");
        result.put("lines",               quoted);
        result.put("distributor_id",      distributorId);
        result.put("supply_state_code",   destination);
        result.put("supplier_state_code", supplierState);
        result.put("tax_type", supplierState.equals(destination) ? (ut ? "CGST + UTGST" : "CGST + SGST") : "IGST");
        return result;
    }

    // ── Create order ────────────────────────────────────────────────────────

    @Transactional
    @SuppressWarnings("unchecked")
    public Map<String, Object> createOrder(Map<String, Object> user, Map<String, Object> body) {
        store.acquireAdvisoryLock();
        requireRole(user, "retailer");
        String key = idempotencyKey(body.get("request_key"));
        var existing = orders.findByRetailerAndKey((String) user.get("id"), key);
        if (existing.isPresent()) return buildFullOrder(existing.get());

        Map<String, Object> calc = compute(body.get("items"),
                body.getOrDefault("supply_state_code", user.getOrDefault("state_code", "29")));
        long total = JsonbHelper.toLong(calc.get("total"));
        if (body.containsKey("expected_total"))
            require(body.get("expected_total") instanceof Number n && n.longValue() == total,
                    "The order total has changed. Reopen your basket to review current prices and GST.", 409);
        String address = text(body.getOrDefault("address", user.get("address")), "Delivery address", 500);
        Object method = body.getOrDefault("payment_method", "cod");
        require("cod".equals(method) || "credit".equals(method), "Choose cash on delivery or trade credit.");

        // Re-read the buyer inside the lock so credit checks use the freshest balance.
        Map<String, Object> buyer = users.findById((String) user.get("id")).orElse(user);
        if ("credit".equals(method)) {
            long limit = JsonbHelper.toLong(buyer.get("credit_limit"));
            long used  = JsonbHelper.toLong(buyer.get("credit_used"));
            require(total <= limit - used, "Insufficient trade credit.", 409);
            users.updateCreditUsed((String) buyer.get("id"), used + total);
        }

        List<Map<String, Object>> quotedLines = (List<Map<String, Object>>) calc.get("lines");
        for (Map<String, Object> line : quotedLines) {
            for (Map<String, Object> a : (List<Map<String, Object>>) line.get("batches"))
                batches.adjustStock((String) a.get("batch_id"), -JsonbHelper.toLong(a.get("quantity")));
            syncStock((String) line.get("product_id"));
        }

        String distributorId = (String) calc.get("distributor_id");
        Map<String, Object> distributor = users.findById(distributorId).orElseThrow();
        String orderId = uid("ord");
        Map<String, Object> order = new LinkedHashMap<>();
        order.put("id",                  orderId);
        order.put("number",              String.format("SL-%05d", orders.countAll() + 1001));
        order.put("retailer_id",         buyer.get("id"));
        order.put("retailer_name",       buyer.get("business"));
        order.put("distributor_id",      distributorId);
        order.put("driver_id",           null);
        order.put("address",             address);
        order.put("payment_method",      method);
        order.put("status",              "placed");
        order.put("request_key",         key);
        order.put("supply_state_code",   calc.get("supply_state_code"));
        order.put("supplier_state_code", calc.get("supplier_state_code"));
        order.put("tax_type",            calc.get("tax_type"));
        for (String f : new String[]{"subtotal", "discount", "taxable", "cgst", "sgst", "utgst", "igst", "tax", "total"})
            order.put(f, calc.get(f));
        orders.insert(order, orders.nextSortOrder());
        lines.insertAll(orderId, quotedLines);
        allocations.insertAll(orderId, quotedLines);
        history.insert(orderId, "placed", (String) buyer.get("name"));
        parties.insertBoth(orderId, UserRepository.businessSnapshot(distributor),
                UserRepository.businessSnapshot(buyer));

        notifications.insert(distributorId, "New order " + order.get("number"),
                buyer.get("business") + " placed an order.");
        audit.insert((String) buyer.get("id"), (String) buyer.get("name"), "Order placed",
                (String) order.get("number"));
        return buildFullOrder(orders.findById(orderId).orElseThrow());
    }

    // ── Update order (cancel / advance status) ──────────────────────────────

    @Transactional
    public Map<String, Object> updateOrder(Map<String, Object> actor, Map<String, Object> body) {
        store.acquireAdvisoryLock();
        Map<String, Object> order = getAccessibleOrder(actor, body.get("order_id"));
        Object target = body.get("status");
        require(target instanceof String, "Invalid order status transition.", 409);
        String to = (String) target;
        String current = (String) order.get("status");
        String orderId = (String) order.get("id");

        if ("cancelled".equals(to)) {
            requireRole(actor, "admin", "retailer", "distributor");
            require("placed".equals(current) || "confirmed".equals(current)
                            || ("packed".equals(current) && roleIn(actor, "admin", "distributor")),
                    "This order can no longer be cancelled by your role.", 409);
            require("unpaid".equals(order.get("payment_status")),
                    "Paid orders require a refund workflow and cannot be cancelled here.", 409);
            restoreStock(orderId);
            if ("credit".equals(order.get("payment_method")))
                users.findById((String) order.get("retailer_id")).ifPresent(r -> users.updateCreditUsed(
                        (String) r.get("id"),
                        Math.max(0, JsonbHelper.toLong(r.get("credit_used")) - JsonbHelper.toLong(order.get("total")))));
            orders.updateStatus(orderId, "cancelled");
        } else {
            require(to.equals(NEXT_STATUS.get(current)), "Invalid order status transition.", 409);
            if ("delivered".equals(to)) requireRole(actor, "admin", "delivery");
            else requireRole(actor, "admin", "distributor");
            String driverId = null;
            if ("confirmed".equals(to) || "packed".equals(to) || "out_for_delivery".equals(to))
                checkReservedBatches(orderId);
            if ("out_for_delivery".equals(to)) {
                Object d = body.get("driver_id");
                require(d instanceof String, "Record not found.", 404);
                Map<String, Object> driver = users.findById((String) d)
                        .orElseThrow(() -> new BusinessException("Record not found.", 404));
                require("delivery".equals(driver.get("role")) && Boolean.TRUE.equals(driver.get("active")),
                        "Select an active delivery partner.");
                driverId = (String) driver.get("id");
                notifications.insert(driverId, "Delivery assigned", order.get("number") + " is ready for pickup.");
            }
            if (driverId != null) orders.updateStatusAndDriver(orderId, to, driverId);
            else orders.updateStatus(orderId, to);
        }
        history.insert(orderId, to, (String) actor.get("name"));
        notifications.insert((String) order.get("retailer_id"), order.get("number") + " updated",
                "Your order is " + to.replace('_', ' ') + ".");
        String pretty = to.replace('_', ' ');
        audit.insert((String) actor.get("id"), (String) actor.get("name"), "Order " + pretty,
                (String) order.get("number"));
        return buildFullOrder(orders.findById(orderId).orElseThrow());
    }

    private void restoreStock(String orderId) {
        List<Map<String, Object>> orderLines = lines.findByOrderId(orderId);
        Map<Integer, List<Map<String, Object>>> byLine = new HashMap<>();
        for (Map<String, Object> a : allocations.findByOrderId(orderId))
            byLine.computeIfAbsent(JsonbHelper.toInt(a.get("_line_number")), k -> new ArrayList<>()).add(a);
        for (Map<String, Object> line : orderLines) {
            String productId = (String) line.get("product_id");
            List<Map<String, Object>> allocs = byLine.getOrDefault(JsonbHelper.toInt(line.get("_line_number")), List.of());
            if (!allocs.isEmpty()) {
                for (Map<String, Object> a : allocs)
                    batches.adjustStock((String) a.get("batch_id"), JsonbHelper.toLong(a.get("quantity")));
                syncStock(productId);
            } else {
                products.addUnallocated(productId, JsonbHelper.toLong(line.get("quantity")));
                syncStock(productId);
            }
        }
    }

    private void checkReservedBatches(String orderId) {
        LocalDate today = PharmacyHelper.today();
        for (Map<String, Object> a : allocations.findByOrderId(orderId)) {
            Object bid = a.get("batch_id");
            String number = String.valueOf(a.get("batch_number"));
            Object exp = a.get("expiry_date");
            require(exp == null || !LocalDate.parse(exp.toString()).isBefore(today),
                    "Reserved batch " + number + " has expired. Cancel and replace this order.", 409);
            if (bid instanceof String id) {
                batches.findById(id).ifPresent(b -> {
                    require(!"expired".equals(PharmacyHelper.batchStatus(b)),
                            "Reserved batch " + number + " has expired.", 409);
                    require(!Boolean.TRUE.equals(b.get("quarantined")),
                            "Reserved batch " + number + " is quarantined.", 409);
                });
            }
        }
    }

    // ── Proof of delivery ───────────────────────────────────────────────────

    @Transactional
    @SuppressWarnings("unchecked")
    public Map<String, Object> captureProofOfDelivery(Map<String, Object> actor, Map<String, Object> body) {
        store.acquireAdvisoryLock();
        requireRole(actor, "delivery");
        Map<String, Object> order = getAccessibleOrder(actor, body.get("order_id"));
        String key = idempotencyKey(body.get("request_key"));
        Object existing = order.get("proof_of_delivery");
        if (existing instanceof Map<?, ?> proof) {
            require(key.equals(proof.get("request_key")), "Proof of delivery is already recorded.", 409);
            return (Map<String, Object>) existing;
        }
        require("out_for_delivery".equals(order.get("status")), "Proof requires an active delivery.", 409);
        String recipient = text(body.get("recipient_name"), "Recipient name", 100);
        Object strokes = body.get("signature");
        require(strokes instanceof List<?> sl && !sl.isEmpty() && sl.size() <= 20, "Draw a recipient signature.");
        int points = 0;
        for (Object stroke : (List<?>) strokes) {
            require(stroke instanceof List<?> st && st.size() >= 2 && st.size() <= 200, "Signature stroke is invalid.");
            for (Object pt : (List<?>) stroke) {
                require(pt instanceof List<?> xy && xy.size() == 2
                                && xy.get(0) instanceof Integer && xy.get(1) instanceof Integer
                                && ((Integer) xy.get(0)) >= 0 && ((Integer) xy.get(0)) <= 1000
                                && ((Integer) xy.get(1)) >= 0 && ((Integer) xy.get(1)) <= 1000,
                        "Signature coordinates are invalid.");
                points++;
            }
        }
        require(points >= 4 && points <= 1500, "Draw a complete recipient signature.");

        Map<String, Object> proof = new LinkedHashMap<>();
        proof.put("recipient_name", recipient);
        proof.put("signature",      strokes);
        proof.put("captured_at",    nowIso());
        proof.put("captured_by",    actor.get("id"));
        proof.put("request_key",    key);
        orders.mergeExtra((String) order.get("id"), Map.of("proof_of_delivery", proof));

        Map<String, Object> change = new LinkedHashMap<>();
        change.put("order_id", order.get("id"));
        change.put("status", "delivered");
        updateOrder(actor, change);
        audit.insert((String) actor.get("id"), (String) actor.get("name"),
                "Proof of delivery recorded", (String) order.get("number"));
        return proof;
    }

    // ── Returns ─────────────────────────────────────────────────────────────

    @Transactional
    @SuppressWarnings("unchecked")
    public Map<String, Object> manageReturn(Map<String, Object> actor, Map<String, Object> body) {
        store.acquireAdvisoryLock();
        Map<String, Object> order = getAccessibleOrder(actor, body.get("order_id"));
        String orderId = (String) order.get("id");
        Object action = body.get("action");
        if ("request".equals(action)) {
            requireRole(actor, "retailer");
            require("delivered".equals(order.get("status")), "Request a return after delivery.", 409);
            String key = idempotencyKey(body.get("request_key"));
            Object existing = order.get("return_request");
            if (existing instanceof Map<?, ?> rr) {
                require(key.equals(rr.get("request_key")), "A return request already exists for this order.", 409);
                return (Map<String, Object>) existing;
            }
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("id",           uid("ret"));
            result.put("order_id",     orderId);
            result.put("status",       "requested");
            result.put("reason",       text(body.get("reason"), "Return reason", 500));
            result.put("requested_at", nowIso());
            result.put("requested_by", actor.get("id"));
            result.put("request_key",  key);
            orders.mergeExtra(orderId, Map.of("return_request", result));
            notifications.insert((String) order.get("distributor_id"), "Return requested",
                    order.get("number") + ": review the retailer request.");
            audit.insert((String) actor.get("id"), (String) actor.get("name"), "Return requested",
                    (String) order.get("number"));
            return result;
        }
        require("approve".equals(action) || "reject".equals(action), "Choose a valid return action.");
        requireRole(actor, "admin", "distributor");
        Object current = order.get("return_request");
        require(current instanceof Map, "No return request exists.", 404);
        Map<String, Object> result = new LinkedHashMap<>((Map<String, Object>) current);
        require("requested".equals(result.get("status")), "This return request is already reviewed.", 409);
        result.put("status",      "approve".equals(action) ? "approved" : "rejected");
        result.put("review_note", text(body.get("review_note"), "Review note", 500));
        result.put("reviewed_at", nowIso());
        result.put("reviewed_by", actor.get("id"));
        orders.mergeExtra(orderId, Map.of("return_request", result));
        notifications.insert((String) order.get("retailer_id"), "Return request " + result.get("status"),
                order.get("number") + ": " + result.get("review_note"));
        audit.insert((String) actor.get("id"), (String) actor.get("name"),
                "Return request " + result.get("status"), (String) order.get("number"));
        return result;
    }

    // ── Tracking ────────────────────────────────────────────────────────────

    @Transactional
    public Map<String, Object> addTrackingPoint(Map<String, Object> actor, Map<String, Object> body) {
        store.acquireAdvisoryLock();
        requireRole(actor, "delivery");
        Map<String, Object> order = getAccessibleOrder(actor, body.get("order_id"));
        require("out_for_delivery".equals(order.get("status")),
                "Location updates require an active delivery.", 409);
        Object lat = body.get("latitude"), lng = body.get("longitude");
        require(lat instanceof Number a && lng instanceof Number b
                        && a.doubleValue() >= -90 && a.doubleValue() <= 90
                        && b.doubleValue() >= -180 && b.doubleValue() <= 180,
                "Invalid coordinates.");
        tracking.insert((String) order.get("id"), ((Number) lat).doubleValue(), ((Number) lng).doubleValue());
        Map<String, Object> point = new LinkedHashMap<>();
        point.put("latitude",  lat);
        point.put("longitude", lng);
        point.put("at",        nowIso());
        return point;
    }

    // ── Reads ───────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getOrdersForUser(Map<String, Object> user) {
        String role = (String) user.get("role");
        List<Map<String, Object>> list = switch (role) {
            case "admin"       -> orders.findAll();
            case "distributor" -> orders.findByDistributorId((String) user.get("id"));
            case "retailer"    -> orders.findByRetailerId((String) user.get("id"));
            case "delivery"    -> orders.findByDriverId((String) user.get("id"));
            default            -> Collections.emptyList();
        };
        return hydrate(list);
    }

    public Map<String, Object> buildFullOrder(Map<String, Object> order) {
        hydrate(List.of(order));
        return order;
    }

    /** Fills lines (with their batch allocations), history, tracking and the supplier/buyer snapshots. */
    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> hydrate(List<Map<String, Object>> orderList) {
        if (orderList.isEmpty()) return orderList;
        List<String> ids = orderList.stream().map(o -> (String) o.get("id")).toList();
        Map<String, List<Map<String, Object>>> lineMap  = lines.findByOrderIds(ids);
        Map<String, List<Map<String, Object>>> allocMap = allocations.findByOrderIds(ids);
        Map<String, List<Map<String, Object>>> histMap  = history.findByOrderIds(ids);
        Map<String, List<Map<String, Object>>> trackMap = tracking.findByOrderIds(ids);
        Map<String, Map<String, Map<String, Object>>> partyMap = parties.findByOrderIds(ids);
        for (Map<String, Object> o : orderList) {
            String id = (String) o.get("id");
            List<Map<String, Object>> orderLines = new ArrayList<>();
            List<Map<String, Object>> orderAllocs = allocMap.getOrDefault(id, List.of());
            for (Map<String, Object> line : lineMap.getOrDefault(id, List.of())) {
                int ln = JsonbHelper.toInt(line.remove("_line_number"));
                List<Map<String, Object>> mine = new ArrayList<>();
                for (Map<String, Object> a : orderAllocs) {
                    if (JsonbHelper.toInt(a.get("_line_number")) == ln) {
                        Map<String, Object> copy = new LinkedHashMap<>(a);
                        copy.remove("_line_number");
                        mine.add(copy);
                    }
                }
                line.put("batches", mine);
                orderLines.add(line);
            }
            o.put("lines",    orderLines);
            o.put("history",  new ArrayList<>(histMap.getOrDefault(id, List.of())));
            o.put("tracking", new ArrayList<>(trackMap.getOrDefault(id, List.of())));
            Map<String, Map<String, Object>> ps = partyMap.getOrDefault(id, Map.of());
            if (ps.get("supplier") != null) o.put("supplier", ps.get("supplier"));
            if (ps.get("buyer")    != null) o.put("buyer",    ps.get("buyer"));
        }
        return orderList;
    }
}
