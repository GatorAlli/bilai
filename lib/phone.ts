export const PHONE_ERROR = "Invalid Bangladeshi phone number";

export function normalizeBdPhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  const match = digits.match(/^(?:880|0)?(1[3-9]\d{8})$/);
  return match ? `+880${match[1]}` : null;
}