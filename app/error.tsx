"use client";

export default function Error({
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
      <button
        type="button"
        onClick={() => reset()}
        className="rounded-full gold-gradient px-5 py-3 text-sm font-semibold text-black"
      >
        Try again
      </button>
    </div>
  );
}
