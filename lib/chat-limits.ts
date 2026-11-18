// Chat limits, shared by the browser composer, the server actions and the
// Ably webhook. The browser checks are a convenience: someone with a valid
// Ably token can publish directly, so the webhook re-checks what it stores.

export const CHAT_MESSAGE_MAX_LENGTH = 2000;

// Minimum gap between two sends from the same composer.
export const CHAT_SEND_COOLDOWN_MS = 1000;

// New conversations one user may start per hour (from cat pages). Stops one
// account from messaging every listing at once.
export const MAX_NEW_THREADS_PER_HOUR = 20;
