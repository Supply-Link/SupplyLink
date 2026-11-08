package com.supplylink.auth.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyFactory;
import java.security.PublicKey;
import java.security.Signature;
import java.security.spec.X509EncodedKeySpec;
import java.time.*;
import java.util.*;

import com.fasterxml.jackson.databind.ObjectMapper;

@Service
public class LicenseService {

    private static final Logger log = LoggerFactory.getLogger(LicenseService.class);
    private static final ZoneId INDIA = ZoneId.of("Asia/Kolkata");

    @Value("${app.license-file:.secrets/software-license.json}")
    private String licenseFilePath;

    @Value("${app.public-key-file:config/license-public.pem}")
    private String publicKeyFilePath;

    public Map<String, Object> status() {
        try {
            Path licFile = Path.of(licenseFilePath);
            Path pubFile = Path.of(publicKeyFilePath);
            if (!Files.exists(licFile)) return unconfigured();

            byte[] raw    = Files.readAllBytes(licFile);
            byte[] pubPem = Files.readAllBytes(pubFile);

            @SuppressWarnings("unchecked")
            Map<String, Object> envelope = new ObjectMapper().readValue(raw, Map.class);
            @SuppressWarnings("unchecked")
            Map<String, Object> payload  = (Map<String, Object>) envelope.get("payload");

            if (payload == null || !Integer.valueOf(1).equals(payload.get("version"))
                    || !"supplylink".equals(payload.get("product"))
                    || !"Asia/Kolkata".equals(payload.get("timezone")))
                return invalid();

            String canonical = canonical(payload);
            String sigB64    = (String) envelope.get("signature");
            byte[] sigBytes  = Base64.getMimeDecoder().decode(sigB64);

            PublicKey pubKey  = loadPublicKey(pubPem);
            Signature verifier = Signature.getInstance("SHA256withRSA");
            verifier.initVerify(pubKey);
            verifier.update(canonical.getBytes(StandardCharsets.UTF_8));
            if (!verifier.verify(sigBytes)) return invalid();

            String expiresOn = (String) payload.get("expires_on");
            LocalDate expiry  = LocalDate.parse(expiresOn);
            ZonedDateTime cutoff = expiry.plusDays(1).atStartOfDay(INDIA);
            boolean usable = ZonedDateTime.now(INDIA).isBefore(cutoff);

            Map<String, Object> r = new LinkedHashMap<>();
            r.put("status",     usable ? "active" : "expired");
            r.put("usable",     usable);
            r.put("type",       "licensed");
            r.put("expires_on", expiresOn);
            r.put("expires_at", cutoff.minusSeconds(1).toOffsetDateTime().toString());
            r.put("timezone",   "Asia/Kolkata");
            r.put("server_time", Instant.now().toString());
            r.put("customer",   payload.getOrDefault("customer", ""));
            return r;

        } catch (Exception e) {
            log.debug("License check failed: {}", e.getMessage());
            return invalid();
        }
    }

    private static String canonical(Map<String, Object> payload) throws Exception {
        TreeMap<String, Object> sorted = new TreeMap<>(payload);
        return new ObjectMapper().writeValueAsString(sorted)
                .replaceAll(": ", ":").replaceAll(", ", ",");
    }

    private static PublicKey loadPublicKey(byte[] pemBytes) throws Exception {
        String pem = new String(pemBytes, StandardCharsets.UTF_8)
                .replace("-----BEGIN PUBLIC KEY-----", "")
                .replace("-----END PUBLIC KEY-----", "")
                .replaceAll("\\s", "");
        byte[] der = Base64.getDecoder().decode(pem);
        return KeyFactory.getInstance("RSA").generatePublic(new X509EncodedKeySpec(der));
    }

    private static Map<String, Object> unconfigured() {
        return unusable("unconfigured");
    }

    private static Map<String, Object> invalid() {
        return unusable("invalid");
    }

    private static Map<String, Object> unusable(String status) {
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("status", status);
        r.put("usable", false);
        r.put("type", "none");
        r.put("expires_on", null);
        r.put("expires_at", null);
        r.put("timezone", "Asia/Kolkata");
        r.put("server_time", Instant.now().toString());
        return r;
    }
}
