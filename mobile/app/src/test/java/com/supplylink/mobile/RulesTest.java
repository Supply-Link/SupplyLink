package com.supplylink.mobile;

import static org.junit.Assert.*;

import org.junit.Test;

public class RulesTest {
  @Test
  public void releaseRequiresHttps() {
    assertEquals("https://pharmacy.example", Rules.server(" https://pharmacy.example/ ", false));
    reject("http://pharmacy.example", false);
  }

  @Test
  public void rejectsCredentialsPathsAndQueries() {
    for (String s :
        new String[] {
          "https://user:pass@host",
          "https://host/api",
          "https://host?key=x",
          "https://host#x",
          "file:///tmp",
          "host",
          "https://"
        }) reject(s, true);
  }

  @Test
  public void debugAllowsLocalBackend() {
    assertEquals("http://10.0.2.2:8000", Rules.server("http://10.0.2.2:8000/", true));
  }

  private void reject(String s, boolean debug) {
    try {
      Rules.server(s, debug);
      fail(s);
    } catch (IllegalArgumentException expected) {
    }
  }

  @Test
  public void cancellationMatchesServerStages() {
    assertTrue(Rules.cancellable("placed", "unpaid"));
    assertTrue(Rules.cancellable("confirmed", "unpaid"));
    for (String s : new String[] {"packed", "out_for_delivery", "delivered", "cancelled"})
      assertFalse(Rules.cancellable(s, "unpaid"));
    assertFalse(Rules.cancellable("placed", "paid"));
  }

  @Test
  public void moneyUsesPaise() {
    assertTrue(Rules.money(12345).contains("123.45"));
    assertTrue(Rules.money(1).contains("0.01"));
  }

  @Test
  public void coordinatesRejectNonFiniteAndOutOfRange() {
    assertEquals(-90, Rules.coordinate("-90", 90), 0);
    assertEquals(180, Rules.coordinate("180", 180), 0);
    for (String s : new String[] {"NaN", "Infinity", "-Infinity", "91", "-91", "abc", ""}) {
      try {
        Rules.coordinate(s, 90);
        fail(s);
      } catch (IllegalArgumentException expected) {
      }
    }
  }
}
