export const PHONE_ERROR =
  "Enter a valid Bangladesh mobile number, like 01712345678 or +8801712345678.";

export const PHONE_TAKEN_ERROR =
  "An account with this phone number already exists.";

/**
 * Accepts 01712345678, +8801712345678, 8801712345678
 * (spaces, dashes and brackets are ignored).
 * Returns the canonical form 8801712345678, or null if it is not a
 * valid Bangladesh mobile number (01[3-9] + 8 digits).
 */
export function normalizeBdPhone(input: string): string | null {
  const digits = input.trim().replace(/[\s\-()]/g, "").replace(/^\+/, "");

  let national: string;
  if (digits.startsWith("880")) national = digits.slice(3);
  else if (digits.startsWith("0")) national = digits.slice(1);
  else return null;

  return /^1[3-9]\d{8}$/.test(national) ? `880${national}` : null;
}
