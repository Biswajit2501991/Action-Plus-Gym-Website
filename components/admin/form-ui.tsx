import { cn } from "@/lib/utils";

export function AdminPageHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-6">
      <h1 className="font-display text-3xl text-white">{title}</h1>
      {description ? (
        <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p>
      ) : null}
    </div>
  );
}

export function Field({
  label,
  hint,
  className,
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("block text-sm", className)}>
      <span className="mb-1.5 block font-medium text-white/80">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

export const inputClass =
  "w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none ring-gold/30 placeholder:text-white/30 focus:ring";

export function TextInput(
  props: React.InputHTMLAttributes<HTMLInputElement>,
) {
  return <input {...props} className={cn(inputClass, props.className)} />;
}

export function TextTextarea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement>,
) {
  return <textarea {...props} className={cn(inputClass, props.className)} />;
}

export function TextSelect(
  props: React.SelectHTMLAttributes<HTMLSelectElement>,
) {
  return <select {...props} className={cn(inputClass, props.className)} />;
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-black/30 px-3 py-3">
      <div>
        <p className="text-sm font-medium text-white">{label}</p>
        {hint ? <p className="text-xs text-muted">{hint}</p> : null}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-8 w-14 shrink-0 rounded-full transition",
          checked ? "bg-gold" : "bg-white/15",
        )}
        aria-pressed={checked}
      >
        <span
          className={cn(
            "absolute top-1 h-6 w-6 rounded-full bg-black transition",
            checked ? "left-7" : "left-1",
          )}
        />
      </button>
    </div>
  );
}

export function SaveBar({
  pending,
  message,
  label = "Save changes",
}: {
  pending: boolean;
  message: string | null;
  label?: string;
}) {
  return (
    <div className="sticky bottom-4 z-10 flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-black/80 px-4 py-3 backdrop-blur">
      <button
        type="submit"
        disabled={pending}
        className="rounded-full gold-gradient px-5 py-3 text-sm font-semibold text-black disabled:opacity-60"
      >
        {pending ? "Saving…" : label}
      </button>
      {message ? <p className="text-sm text-emerald-300">{message}</p> : null}
    </div>
  );
}

export function ItemCard({
  title,
  index,
  onRemove,
  onMoveUp,
  onMoveDown,
  children,
}: {
  title: string;
  index: number;
  onRemove: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-charcoal/40 p-4 md:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-gold">
          {title} #{index + 1}
        </p>
        <div className="flex flex-wrap gap-2">
          {onMoveUp ? (
            <button
              type="button"
              onClick={onMoveUp}
              className="rounded-full border border-white/15 px-3 py-1 text-xs text-white/70 hover:border-gold hover:text-gold"
            >
              Move up
            </button>
          ) : null}
          {onMoveDown ? (
            <button
              type="button"
              onClick={onMoveDown}
              className="rounded-full border border-white/15 px-3 py-1 text-xs text-white/70 hover:border-gold hover:text-gold"
            >
              Move down
            </button>
          ) : null}
          <button
            type="button"
            onClick={onRemove}
            className="rounded-full border border-red-400/30 px-3 py-1 text-xs text-red-300 hover:bg-red-500/10"
          >
            Remove
          </button>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">{children}</div>
    </div>
  );
}
