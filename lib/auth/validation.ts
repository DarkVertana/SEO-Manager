// Shared validation rules for auth forms — used by both client and server.

export const PASSWORD_RULES = {
  minLength: 10,
  needsUppercase: true,
  needsLowercase: true,
  needsNumber: true,
  needsSymbol: true,
};

export type PasswordCheck = {
  ok: boolean;
  checks: {
    length: boolean;
    uppercase: boolean;
    lowercase: boolean;
    number: boolean;
    symbol: boolean;
  };
  message: string | null;
};

export function checkPassword(password: string): PasswordCheck {
  const checks = {
    length: password.length >= PASSWORD_RULES.minLength,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    symbol: /[^A-Za-z0-9]/.test(password),
  };
  const ok = Object.values(checks).every(Boolean);
  return {
    ok,
    checks,
    message: ok
      ? null
      : "Your password needs at least 10 characters and must include an uppercase letter, a lowercase letter, a number, and a symbol.",
  };
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
