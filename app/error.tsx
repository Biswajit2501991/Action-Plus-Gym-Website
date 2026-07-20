"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="font-display text-3xl text-gold">Something went wrong</p>
      <p className="max-w-md text-sm text-muted">
        The page hit a temporary server error. Try again — your content is safe.
      </p>
      {error?.digest ? (
        <p className="text-[10px] text-muted/70">Ref: {error.digest}</p>
      ) : null}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-full gold-gradient px-5 py-3 text-sm font-semibold text-black"
        >
          Try again
        </button>
        <a
          href="/"
          className="rounded-full border border-white/15 px-5 py-3 text-sm text-white/80 hover:border-gold/40 hover:text-gold"
        >
          Go home
        </a>
      </div>
    </div>
  );
}
