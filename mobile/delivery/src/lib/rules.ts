import type { OrderStatus } from './types';

const SERVER_PATTERN =
  /^(https?):\/\/([A-Za-z0-9.-]+|\[[0-9A-Fa-f:.]+\])(?::(\d{1,5}))?\/?$/;

/** Normalises a server origin. Release builds accept only HTTPS. */
export function normaliseServer(input: string, allowHttp: boolean): string {
  const match = SERVER_PATTERN.exec(input.trim());
  const scheme = match?.[1].toLowerCase();
  const port = match?.[3] ? Number(match[3]) : undefined;
  if (
    !match ||
    !(scheme === 'https' || (allowHttp && scheme === 'http')) ||
    (port !== undefined && (port < 1 || port > 65535))
  ) {
    throw new Error(
      allowHttp
        ? 'Use an http:// or https:// server URL, without a path.'
        : 'Use an HTTPS server URL, without a path.',
    );
  }
  return `${scheme}://${match[2].toLowerCase()}${port !== undefined ? `:${port}` : ''}`;
}

const rupees = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
});

export function money(paise: number | undefined): string {
  return rupees.format((paise ?? 0) / 100);
}

export function percent(basisPoints: number | undefined): string {
  return `${(basisPoints ?? 0) / 100}%`;
}

export function cancellable(status: string, paymentStatus: string): boolean {
  return (status === 'placed' || status === 'confirmed') && paymentStatus !== 'paid';
}

export const STAGE_LABELS: Record<OrderStatus, string> = {
  placed: 'Placed',
  confirmed: 'Confirmed',
  packed: 'Packed',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export function stageLabel(status: string): string {
  return STAGE_LABELS[status as OrderStatus] ?? status;
}

export function isActive(status: string): boolean {
  return status !== 'delivered' && status !== 'cancelled';
}

export function coordinate(value: string, limit: number): number {
  const text = value.trim();
  const n = text === '' ? NaN : Number(text);
  if (Number.isNaN(n)) throw new Error('Enter valid coordinates.');
  if (!Number.isFinite(n) || Math.abs(n) > limit) {
    throw new Error('Coordinates are outside the valid range.');
  }
  return n;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const IST_OFFSET_MS = 330 * 60 * 1000;

/** Python emits microseconds; Hermes only reliably parses up to milliseconds. */
export function parseIso(value: string | null | undefined): number {
  return value ? Date.parse(value.replace(/(\.\d{3})\d+/, '$1')) : NaN;
}

/** India has no daylight saving, so IST is always UTC+05:30. */
export function dateTime(value: string | undefined): string {
  const ms = parseIso(value);
  if (Number.isNaN(ms)) return value ?? '';
  const d = new Date(ms + IST_OFFSET_MS);
  const hours = d.getUTCHours();
  const minutes = String(d.getUTCMinutes()).padStart(2, '0');
  const suffix = hours < 12 ? 'AM' : 'PM';
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${hours % 12 || 12}:${minutes} ${suffix} IST`;
}

export function licenceRemainingMs(serverTime?: string, expiresAt?: string | null): number {
  const now = parseIso(serverTime);
  const end = parseIso(expiresAt);
  if (Number.isNaN(now) || Number.isNaN(end)) return 0;
  return Math.max(0, end - now);
}
