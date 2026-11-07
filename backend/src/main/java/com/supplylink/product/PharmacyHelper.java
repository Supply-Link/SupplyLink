package com.supplylink.product;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

public final class PharmacyHelper {

    public static final Set<String> STATE_CODES = Set.of(
            "01","02","03","04","05","06","07","08","09","10","11","12",
            "13","14","15","16","17","18","19","20","21","22","23","24",
            "26","27","29","30","31","32","33","34","35","36","37","38");

    public static final Set<String> UT_CODES = Set.of("04","26","31","35","38");

    private PharmacyHelper() {}

    public static LocalDate today() {
        return LocalDate.now(ZoneId.of("Asia/Kolkata"));
    }

    public static String batchStatus(Map<String, Object> batch) {
        LocalDate expiry = LocalDate.parse((String) batch.get("expiry_date"));
        LocalDate on = today();
        if (expiry.isBefore(on)) return "expired";
        if (Boolean.TRUE.equals(batch.get("quarantined"))) return "quarantined";
        long stock = ((Number) batch.getOrDefault("stock", 0)).longValue();
        if (stock == 0) return "exhausted";
        if (!expiry.isAfter(on.plusDays(90))) return "near_expiry";
        return "available";
    }

    public static Map<String, Object> stockSummary(Map<String, Object> product,
                                                    List<Map<String, Object>> batches) {
        if (batches == null) {
            long s = ((Number) product.getOrDefault("stock", 0)).longValue();
            return Map.of("stock", s, "total_stock", s, "expired_stock", 0L,
                    "near_expiry_stock", 0L, "quarantined_stock", 0L, "next_expiry", null);
        }
        long valid = 0, total = 0, expired = 0, nearExpiry = 0, quarantined = 0;
        String nextExpiry = null;
        for (Map<String, Object> b : batches) {
            long bStock = ((Number) b.getOrDefault("stock", 0)).longValue();
            total += bStock;
            String status = batchStatus(b);
            switch (status) {
                case "available", "near_expiry" -> {
                    valid += bStock;
                    if ("near_expiry".equals(status)) nearExpiry += bStock;
                    String exp = (String) b.get("expiry_date");
                    if (nextExpiry == null || exp.compareTo(nextExpiry) < 0) nextExpiry = exp;
                }
                case "expired"     -> expired += bStock;
                case "quarantined" -> quarantined += bStock;
            }
        }
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("stock",             valid);
        r.put("total_stock",       total);
        r.put("expired_stock",     expired);
        r.put("near_expiry_stock", nearExpiry);
        r.put("quarantined_stock", quarantined);
        r.put("next_expiry",       nextExpiry);
        return r;
    }
}
