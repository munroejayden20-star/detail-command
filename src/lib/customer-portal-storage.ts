/**
 * Customer Portal — browser-side token storage.
 *
 * The token is the customer's stable identifier for the /book page. Stored
 * in localStorage so it persists across sessions on the same device. No PII
 * lives here — just an opaque token. The token alone is read-permission to
 * the customer's portal data via the get_customer_portal_by_token RPC.
 */

const KEY = "dc_customer_token";

export function getCustomerToken(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function saveCustomerToken(token: string): void {
  if (!token || token.length < 16) return;
  try {
    window.localStorage.setItem(KEY, token);
  } catch {
    // localStorage unavailable (private mode / disabled) — silently no-op.
  }
}

export function clearCustomerToken(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // no-op
  }
}
