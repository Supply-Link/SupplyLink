// Unit tests for rules — server URL normalisation, money formatting,
// IST dates, coordinate validation, status helpers, and licence expiry.

import {
  cancellable,
  coordinate,
  dateTime,
  licenceRemainingMs,
  money,
  normaliseServer,
  percent,
  stageLabel,
} from '../rules';

describe('normaliseServer', () => {
  it('accepts an HTTPS origin and strips a trailing slash', () => {
    expect(normaliseServer(' https://SupplyLink.example.com/ ', false)).toBe('https://supplylink.example.com');
    expect(normaliseServer('https://10.0.0.5:8443', false)).toBe('https://10.0.0.5:8443');
  });

  it('allows HTTP only in development builds', () => {
    expect(normaliseServer('http://10.0.2.2:8000', true)).toBe('http://10.0.2.2:8000');
    expect(() => normaliseServer('http://10.0.2.2:8000', false)).toThrow('Use an HTTPS server URL, without a path.');
  });

  it.each([
    'https://example.com/api',
    'https://user:pw@example.com',
    'https://example.com?x=1',
    'https://example.com#top',
    'ftp://example.com',
    'example.com',
    'https://example.com:70000',
    '',
  ])('rejects %p', (input) => {
    expect(() => normaliseServer(input, true)).toThrow();
  });
});

describe('formatting', () => {
  it('formats paise as Indian rupees', () => {
    expect(money(123456789)).toBe('₹12,34,567.89');
    expect(money(undefined)).toBe('₹0.00');
  });

  it('formats GST basis points', () => {
    expect(percent(500)).toBe('5%');
    expect(percent(1250)).toBe('12.5%');
  });

  it('renders timestamps in India time', () => {
    expect(dateTime('2026-10-24T18:45:00Z')).toBe('25 Oct 2026, 12:15 AM IST');
    expect(dateTime('2026-01-05T06:30:00.654321+00:00')).toBe('5 Jan 2026, 12:00 PM IST');
    expect(dateTime('not a date')).toBe('not a date');
  });

  it('labels order stages', () => {
    expect(stageLabel('out_for_delivery')).toBe('Out for delivery');
    expect(stageLabel('unknown')).toBe('unknown');
  });
});

describe('order rules', () => {
  it('allows cancellation only for unpaid placed or confirmed orders', () => {
    expect(cancellable('placed', 'unpaid')).toBe(true);
    expect(cancellable('confirmed', 'unpaid')).toBe(true);
    expect(cancellable('confirmed', 'paid')).toBe(false);
    expect(cancellable('packed', 'unpaid')).toBe(false);
    expect(cancellable('delivered', 'unpaid')).toBe(false);
  });

  it('validates coordinates', () => {
    expect(coordinate(' 12.9716 ', 90)).toBeCloseTo(12.9716);
    expect(coordinate('-180', 180)).toBe(-180);
    expect(() => coordinate('', 90)).toThrow('Enter valid coordinates.');
    expect(() => coordinate('abc', 90)).toThrow('Enter valid coordinates.');
    expect(() => coordinate('90.1', 90)).toThrow('outside the valid range');
    expect(() => coordinate('Infinity', 180)).toThrow('outside the valid range');
  });
});

describe('licenceRemainingMs', () => {
  it('measures time left using server time, including Python microsecond timestamps', () => {
    expect(licenceRemainingMs('2026-12-31T18:29:00.123456+00:00', '2027-01-01T00:00:00+05:30')).toBe(59_877);
  });

  it('treats missing or past expiry as no time left', () => {
    expect(licenceRemainingMs('2027-01-01T00:00:00Z', '2026-12-31T23:59:59+05:30')).toBe(0);
    expect(licenceRemainingMs(undefined, '2026-12-31')).toBe(0);
    expect(licenceRemainingMs('2026-01-01T00:00:00Z', null)).toBe(0);
  });
});
