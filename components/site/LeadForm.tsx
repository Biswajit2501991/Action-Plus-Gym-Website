"use client";

import { useEffect, useState, useTransition } from "react";
import { X } from "lucide-react";
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
  const [memberNote, setMemberNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState(defaultSource);

  function closeMemberNote() {
    setMemberNote(null);
  }

  useEffect(() => {
    if (!memberNote) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMemberNote(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [memberNote]);

  function onSubmit(formData: FormData) {
    setMessage(null);
    setMemberNote(null);
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
      } else if ("alreadyMember" in result) {
        // Existing member — nothing saved; show popup note only.
        setMemberNote(result.note);
      } else {
        setError(result.error);
      }
    });
  }

  const alreadyMemberPopup = memberNote ? (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-black/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="already-member-title"
      onClick={closeMemberNote}
    >
      <div
        className="relative w-full max-w-md rounded-3xl border border-gold/35 bg-charcoal p-6 shadow-2xl md:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={closeMemberNote}
          className="absolute right-3 top-3 rounded-full border border-white/15 bg-black/40 p-2 text-white/80 transition hover:border-gold/40 hover:text-gold"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
        <p className="pr-10 text-xs font-semibold uppercase tracking-[0.25em] text-gold">
          Membership
        </p>
        <h3
          id="already-member-title"
          className="mt-2 font-display text-2xl text-white"
        >
          Already a member
        </h3>
        <p className="mt-3 text-sm leading-relaxed text-white/85">{memberNote}</p>
      </div>
    </div>
  ) : null;

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

  if (embedded) {
    return (
      <>
        {form}
        {alreadyMemberPopup}
      </>
    );
  }

  return (
    <>
      <section id="join" className="section-pad">
        <div className="container-site">
          <SectionHeading eyebrow="Join" title={title} subtitle={subtitle} />
          {form}
        </div>
      </section>
      {alreadyMemberPopup}
    </>
  );
}
