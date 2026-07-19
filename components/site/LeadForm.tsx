"use client";

import { useState, useTransition } from "react";
import { submitLead } from "@/lib/actions/leads";
import { Button } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/SectionHeading";

export function LeadForm({
  defaultSource = "website",
  title = "Start your membership",
  subtitle = "Leave your details and our team will contact you shortly.",
  interestPlan,
  embedded = false,
}: {
  defaultSource?: "website" | "website_trial" | "website_contact";
  title?: string;
  subtitle?: string;
  interestPlan?: string;
  /** Side-by-side layouts (e.g. Contact page) — no outer section padding. */
  embedded?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState(defaultSource);

  function onSubmit(formData: FormData) {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await submitLead({
        fullName: String(formData.get("fullName") || ""),
        mobile: String(formData.get("mobile") || ""),
        email: String(formData.get("email") || ""),
        message: String(formData.get("message") || ""),
        interestPlan: interestPlan || String(formData.get("interestPlan") || ""),
        source,
        website: String(formData.get("website") || ""),
      });
      if (result.ok) {
        setMessage("Thank you — we will be in touch shortly.");
        (document.getElementById("lead-form") as HTMLFormElement | null)?.reset();
      } else {
        setError(result.error);
      }
    });
  }

  const form = (
    <form
      id="lead-form"
      action={onSubmit}
      className={
        embedded
          ? "flex h-full flex-col space-y-4"
          : "mx-auto max-w-xl space-y-4 rounded-3xl border border-white/10 bg-charcoal/60 p-6 md:p-8"
      }
    >
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["website", "Join Now"],
            ["website_trial", "Free Trial"],
            ["website_contact", "Contact"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setSource(value)}
            className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wider ${
              source === value
                ? "gold-gradient text-black"
                : "border border-white/15 text-white/70"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <input
        name="fullName"
        required
        placeholder="Full Name"
        className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm outline-none ring-gold/40 focus:ring"
      />
      <input
        name="mobile"
        required
        placeholder="Mobile Number"
        className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm outline-none ring-gold/40 focus:ring"
      />
      <input
        name="email"
        type="email"
        placeholder="Email Address"
        className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm outline-none ring-gold/40 focus:ring"
      />
      {source === "website_contact" ? (
        <textarea
          name="message"
          rows={4}
          placeholder="How can we help?"
          className="min-h-[7rem] w-full flex-1 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm outline-none ring-gold/40 focus:ring"
        />
      ) : (
        <div className="hidden flex-1 md:block" aria-hidden />
      )}
      <input
        name="website"
        tabIndex={-1}
        autoComplete="off"
        className="hidden"
        aria-hidden
      />
      <div className="mt-auto space-y-3 pt-2">
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Sending..." : "Submit"}
        </Button>
        {message ? <p className="text-sm text-emerald-300">{message}</p> : null}
        {error ? <p className="text-sm text-red-300">{error}</p> : null}
      </div>
    </form>
  );

  if (embedded) return form;

  return (
    <section id="join" className="section-pad">
      <div className="container-site">
        <SectionHeading eyebrow="Join" title={title} subtitle={subtitle} />
        {form}
      </div>
    </section>
  );
}
