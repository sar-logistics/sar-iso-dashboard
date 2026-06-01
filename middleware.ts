export { default } from "next-auth/middleware";

export const config = {
  // Only the dashboard pages need middleware-level session protection.
  // /api/sync/* routes authenticate themselves (Bearer CRON_SECRET for cron,
  // or session for manual triggers) — including them here would block cron.
  // /api/cron/* and /api/debug/* are also self-authenticating.
  matcher: ["/dashboard/:path*"],
};
