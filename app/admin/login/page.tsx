"use client";

import { useState, useTransition } from "react";
import { loginAction } from "@/lib/actions/admin";

export default function AdminLoginPage() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4"
      style={{ background: "#080808", color: "#f5f5f5" }}
    >
      <form
        className="w-full max-w-md space-y-4 rounded-3xl border p-8"
        style={{
          borderColor: "rgba(201,162,39,0.25)",
          background: "#1a1a1a",
        }}
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
          <p
            className="text-xs uppercase tracking-[0.25em]"
            style={{ color: "#c9a227" }}
          >
            Admin
          </p>
          <h1 className="mt-2 font-display text-3xl text-white">
            Action Plus Website
          </h1>
          <p className="mt-2 text-sm" style={{ color: "#a3a3a3" }}>
            Sign in with your Gym Manager staff credentials.
          </p>
        </div>
        <input
          name="login"
          required
          placeholder="Username"
          autoComplete="username"
          className="w-full rounded-2xl border px-4 py-3 text-sm text-white outline-none"
          style={{
            borderColor: "rgba(255,255,255,0.12)",
            background: "rgba(0,0,0,0.45)",
          }}
        />
        <input
          name="password"
          type="password"
          required
          placeholder="Password"
          autoComplete="current-password"
          className="w-full rounded-2xl border px-4 py-3 text-sm text-white outline-none"
          style={{
            borderColor: "rgba(255,255,255,0.12)",
            background: "rgba(0,0,0,0.45)",
          }}
        />
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-full py-3 text-sm font-semibold text-black disabled:opacity-60"
          style={{
            background: "linear-gradient(135deg, #e0c15a 0%, #c9a227 45%, #8a7018 100%)",
          }}
        >
          {pending ? "Signing in..." : "Sign in"}
        </button>
        {error ? (
          <p className="text-sm" style={{ color: "#fca5a5" }}>
            {error}
          </p>
        ) : null}
      </form>
    </div>
  );
}
