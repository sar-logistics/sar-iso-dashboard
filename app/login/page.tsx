"use client";
import { signIn } from "next-auth/react";

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-surface-muted px-4">
      <div className="card w-full max-w-md text-center">
        <div className="flex justify-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-sales flex items-center justify-center">
            <span className="text-2xl font-bold text-sales-text">S</span>
          </div>
        </div>
        <h1 className="text-2xl font-semibold text-ink-primary">
          SAR ISO Tank Dashboard
        </h1>
        <p className="mt-2 text-sm text-ink-secondary">
          Sign in with your authorised SAR Google account.
        </p>
        <button
          onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
          className="mt-8 w-full inline-flex items-center justify-center gap-3 rounded-xl border border-surface-border bg-white px-4 py-3 text-sm font-medium text-ink-primary hover:bg-surface-muted transition"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
            <path fill="#4285F4" d="M22.5 12.27c0-.79-.07-1.54-.2-2.27H12v4.5h5.92c-.26 1.36-1.04 2.51-2.21 3.28v2.73h3.57c2.08-1.92 3.22-4.74 3.22-8.24z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.99 7.28-2.69l-3.57-2.73c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.28-1.93-6.14-4.52H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.86 14.12A6.97 6.97 0 0 1 5.5 12c0-.74.13-1.45.36-2.12V7.04H2.18A11 11 0 0 0 1 12c0 1.78.42 3.46 1.18 4.96l3.68-2.84z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.07.56 4.21 1.64l3.16-3.16C17.45 2.04 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.04l3.68 2.84C6.72 7.31 9.14 5.38 12 5.38z"/>
          </svg>
          Continue with Google
        </button>
        <p className="mt-6 text-xs text-ink-tertiary">
          Access is restricted. Contact admin if you need to be added.
        </p>
      </div>
    </main>
  );
}
