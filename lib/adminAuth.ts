// Simple allowlist gate for internal admin pages/routes — no separate roles
// table, just a comma-separated list of emails permitted to see/act on them.
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  const allowed = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)
  return allowed.includes(email.toLowerCase())
}
