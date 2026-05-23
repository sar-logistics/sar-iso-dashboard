export { default } from "next-auth/middleware";

export const config = {
  // Protect everything except login, auth endpoints, and the cron endpoint
  matcher: [
    "/dashboard/:path*",
    "/api/sync/:path*",
  ],
};
