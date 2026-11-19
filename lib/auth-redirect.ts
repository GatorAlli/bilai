// Where to send someone after they sign in. The destination travels in the
// `next` query parameter of /auth, so it is user-controlled input: only
// same-site paths are accepted, never another origin (open-redirect guard).

export const DEFAULT_AFTER_LOGIN = "/find_a_cat";

// Returns `value` when it is a same-site path ("/find_a_cat/3?x=1"), else
// `fallback`. Rejects "//evil.com", "/\evil.com", full URLs, control
// characters, and /auth itself (it would loop back to the login page).
export function safeNext(
  value: string | string[] | null | undefined,
  fallback: string = DEFAULT_AFTER_LOGIN,
): string {
  const path = Array.isArray(value) ? value[0] : value;
  if (!path || path.length > 500) return fallback;
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) {
    return fallback;
  }
  if (/[\u0000-\u001f\u007f]/.test(path)) return fallback;
  if (
    path === "/auth" ||
    path.startsWith("/auth?") ||
    path.startsWith("/auth/")
  ) {
    return fallback;
  }
  return path;
}

// "/auth?next=%2Ffind_a_cat%2F3" — the login page that returns to `path`.
export function loginUrl(path: string): string {
  const next = safeNext(path, "");
  return next ? `/auth?next=${encodeURIComponent(next)}` : "/auth";
}
