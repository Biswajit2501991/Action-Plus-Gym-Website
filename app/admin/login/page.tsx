"use client";

import { useState, useTransition } from "react";
import { loginAction } from "@/lib/actions/admin";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

export default function AdminLoginPage() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="admin-shell relative flex min-h-screen items-center justify-center px-4">
      <div className="absolute right-4 top-4 md:right-6 md:top-6">
        <ThemeToggle />
      </div>
      <form
        className="w-full max-w-md space-y-4 rounded-3xl border border-white/10 bg-charcoal p-8"
        action={(fd) => {
          setError(null);
          startTransition(async () => {
            const res = await loginAction(fd);
            // Successful login redirects (throws NEXT_REDIRECT); only handle failures here
            if (res && !res.ok) setError(res.error);
          });
        }}
      >
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-gold">Admin</p>
          <h1 className="mt-2 font-display text-3xl text-white">
            Action Plus Website
          </h1>
          <p className="mt-2 text-sm text-muted">
            Sign in with your Gym Manager staff credentials.
          </p>
        </div>
        <input
          name="login"
          required
          placeholder="Username"
          autoComplete="username"
          className="w-full rounded-2xl border border-white/15 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:ring-1 focus:ring-gold/40"
        />
        <input
          name="password"
          type="password"
          required
          placeholder="Password"
          autoComplete="current-password"
          className="w-full rounded-2xl border border-white/15 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:ring-1 focus:ring-gold/40"
        />
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-full gold-gradient py-3 text-sm font-semibold text-black disabled:opacity-60"
        >
          {pending ? "Signing in..." : "Sign in"}
        </button>
        {error ? <p className="text-sm text-red-300">{error}</p> : null}
      </form>
    </div>
  );
}
