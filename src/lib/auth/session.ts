export const SESSION_COOKIE = "session";

export function hasValidSession(value: string | undefined): boolean {
  return Boolean(value && value.length > 0);
}

export function actorEmailFromSession(value: string | undefined): string {
  if (value && value.includes("@")) return value;
  return process.env.ADMIN_EMAIL ?? "admin";
}
