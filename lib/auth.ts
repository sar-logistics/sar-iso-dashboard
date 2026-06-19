import { AuthOptions, getServerSession } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { isAllowed } from "@/lib/allowedUsers";

export const authOptions: AuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  callbacks: {
    async signIn({ user }) {
      const email = (user?.email || "").toLowerCase();
      if (!email) return false;
      // Two-layer allowlist check:
      //  1) ALLOWED_EMAILS env var (always allowed, lockout-proof)
      //  2) allowedUsers MongoDB collection (added via admin panel)
      // If Mongo is unreachable, isAllowed() falls back to env-only.
      return await isAllowed(email);
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        (session.user as any).id = token.sub;
      }
      return session;
    },
  },
};

export const auth = () => getServerSession(authOptions);
