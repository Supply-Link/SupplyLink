package com.supplylink.store;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.postgresql.util.PGobject;
import org.springframework.stereotype.Component;

import java.sql.Timestamp;
import java.util.Collections;
import java.util.Map;

@Component
public class JsonbHelper {
    private static final ObjectMapper MAPPER = new ObjectMapper();

    @SuppressWarnings("unchecked")
    public Map<String, Object> parse(Object raw) {
        if (raw == null) return Collections.emptyMap();
        try {
            String json = raw instanceof PGobject pg ? pg.getValue() : raw.toString();
            if (json == null || json.isBlank() || "null".equals(json)) return Collections.emptyMap();
            return MAPPER.readValue(json, Map.class);
        } catch (Exception e) {
            return Collections.emptyMap();
        }
    }

    public PGobject toJsonb(Object value) {
        try {
            PGobject obj = new PGobject();
            obj.setType("jsonb");
            obj.setValue(value == null ? "{}" : MAPPER.writeValueAsString(value));
            return obj;
        } catch (Exception e) {
            throw new RuntimeException("JSONB conversion failed", e);
        }
    }

    public PGobject emptyJsonb() {
        return toJsonb(Collections.emptyMap());
    }

    public static String isoTs(Object v) {
        if (v == null) return null;
        if (v instanceof Timestamp ts) return ts.toInstant().toString();
        if (v instanceof java.sql.Date d) return d.toLocalDate().toString();
        return v.toString();
    }

    public static long toLong(Object v) {
        if (v instanceof Number n) return n.longValue();
        return 0L;
    }

    public static int toInt(Object v) {
        if (v instanceof Number n) return n.intValue();
        return 0;
    }
}
