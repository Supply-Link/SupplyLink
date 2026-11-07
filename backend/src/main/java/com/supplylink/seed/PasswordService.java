package com.supplylink.seed;

import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.HexFormat;

public final class PasswordService {
    private static final int ITERATIONS = 240000;
    private static final int KEY_BITS   = 256;

    private PasswordService() {}

    public static String hash(String password) {
        byte[] salt = new byte[16];
        new SecureRandom().nextBytes(salt);
        return hash(password, HexFormat.of().formatHex(salt));
    }

    public static String hash(String password, String saltHex) {
        try {
            byte[] salt = HexFormat.of().parseHex(saltHex);
            PBEKeySpec spec = new PBEKeySpec(password.toCharArray(), salt, ITERATIONS, KEY_BITS);
            byte[] digest = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
                    .generateSecret(spec).getEncoded();
            return saltHex + ":" + HexFormat.of().formatHex(digest);
        } catch (Exception e) {
            throw new RuntimeException("Password hashing failed", e);
        }
    }

    public static boolean verify(String password, String stored) {
        if (stored == null || !stored.contains(":")) return false;
        String salt = stored.split(":")[0];
        return MessageDigest.isEqual(hash(password, salt).getBytes(), stored.getBytes());
    }
}
