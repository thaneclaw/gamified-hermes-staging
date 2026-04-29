/**
 * Producer-only auth gate.
 *
 * Lightweight password protection on `/producer`. NOT a security model —
 * the password is shipped in the client bundle so anyone with devtools
 * can read it. The goal is to deter casual visitors from finding the
 * producer panel through guessing or accidental URL sharing, not to
 * stop a determined attacker. The producer panel mutates broadcast
 * state (roster, calibration, reset) so we want at least a soft gate.
 *
 * Storage: `localStorage` (NOT `sessionStorage` and NOT cookies). OBS
 * Custom Browser Docks retain `localStorage` across sessions, so once
 * the user types the password into the dock once, subsequent OBS
 * launches stay authenticated. `sessionStorage` would force a re-login
 * every time OBS reopens; cookies could be evicted by strict-same-site
 * defaults. neither fits the show-day workflow.
 *
 * `/play` and `/overlay` are intentionally NOT gated — guests need
 * frictionless URLs and the overlay has to load inside an OBS browser
 * source without prompting for input.
 */

/**
 * Producer password. Generated once for v1.2; rotate by editing this
 * constant and redeploying. The user is expected to save this in their
 * password manager — it does not appear anywhere else in the repo.
 */
export const PRODUCER_PASSWORD = "Hx7K-2mNqR8vL4pZ-9wE3tYbC6sUjA" as const;

/** localStorage key the wrapper checks on mount and writes on success. */
export const PRODUCER_AUTH_STORAGE_KEY = "gamified.auth.v1";

/**
 * Returns true if the local browser has previously stored the correct
 * auth token. We compare against the live PRODUCER_PASSWORD constant so
 * rotating the password automatically invalidates everyone's cache.
 */
export function isProducerAuthenticated(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return (
      window.localStorage.getItem(PRODUCER_AUTH_STORAGE_KEY) ===
      PRODUCER_PASSWORD
    );
  } catch {
    return false;
  }
}

/** Persists the token after a successful password entry. */
export function persistProducerAuth(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      PRODUCER_AUTH_STORAGE_KEY,
      PRODUCER_PASSWORD,
    );
  } catch {
    // ignore quota / disabled storage
  }
}
