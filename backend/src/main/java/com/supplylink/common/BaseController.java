package com.supplylink.common;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;

import java.net.URI;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

public abstract class BaseController {

    @Value("${app.cors-origins:}")
    private String corsOriginsRaw;

    @Value("${app.cookie-secure:false}")
    private boolean cookieSecure;

    protected String sessionToken(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) return null;
        return Arrays.stream(cookies)
                .filter(c -> "supplylink_session".equals(c.getName()))
                .map(Cookie::getValue)
                .findFirst().orElse(null);
    }

    protected void checkSameOrigin(HttpServletRequest request) {
        Set<String> allowed = allowedOrigins();
        String origin = request.getHeader("Origin");
        if (origin != null) {
            try {
                URI parsed = URI.create(origin);
                String scheme = parsed.getScheme();
                if (!"http".equals(scheme) && !"https".equals(scheme))
                    throw new BusinessException("Cross-origin request rejected.", 403);
                int port = parsed.getPort();
                String netloc = parsed.getHost() + (port > 0 ? ":" + port : "");
                if (netloc.isEmpty())
                    throw new BusinessException("Cross-origin request rejected.", 403);
                String normalized = origin.endsWith("/") ? origin.substring(0, origin.length() - 1) : origin;
                if (allowed.contains(normalized)) return;
                if (!netloc.equals(request.getHeader("Host")))
                    throw new BusinessException("Cross-origin request rejected.", 403);
            } catch (IllegalArgumentException e) {
                throw new BusinessException("Cross-origin request rejected.", 403);
            }
        }
        if ("cross-site".equals(request.getHeader("Sec-Fetch-Site")))
            throw new BusinessException("Cross-site request rejected.", 403);
    }

    protected String sessionCookie(String token, boolean clear) {
        String maxAge = clear ? "0" : "43200";
        String extra = !allowedOrigins().isEmpty()
                ? "; Secure; SameSite=None; Partitioned"
                : "; SameSite=Strict" + (cookieSecure ? "; Secure" : "");
        return "supplylink_session=" + token + "; HttpOnly" + extra + "; Path=/; Max-Age=" + maxAge;
    }

    protected Set<String> allowedOrigins() {
        Set<String> result = new HashSet<>();
        if (corsOriginsRaw != null) {
            for (String s : corsOriginsRaw.split(",")) {
                String t = s.strip().replaceAll("/$", "");
                if (!t.isEmpty()) result.add(t);
            }
        }
        return result;
    }
}
