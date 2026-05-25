/**
 * Customer Portal — browser-side token storage.
 *
 * The token is the customer's stable identifier for the /book page. Stored
 * in localStorage so it persists across sessions on the same device. No PII
 * lives here — just an opaque token. The token alone is read-permission to
 * the customer's portal data via the get_customer_portal_by_token RPC.
 */

const KEY = "dc_customer_token";
// Separate flag for "this device has linked the booking customer to a real
// account." Email-match heuristics fail when the booking customer record
// has an empty email — this flag captures intent directly. Set on signup,
// signin, or first /portal load; cleared on sign-out.
const ACCOUNT_KEY = "dc_customer_account_linked";

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

export function hasCustomerAccountLink(): boolean {
  try {
    return window.localStorage.getItem(ACCOUNT_KEY) === "true";
  } catch {
    return false;
  }
}

export function markCustomerAccountLinked(): void {
  try {
    window.localStorage.setItem(ACCOUNT_KEY, "true");
  } catch {
    // no-op
  }
}

export function clearCustomerAccountLink(): void {
  try {
    window.localStorage.removeItem(ACCOUNT_KEY);
  } catch {
    // no-op
  }
}
