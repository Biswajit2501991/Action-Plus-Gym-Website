import Link from "next/link";
import { cn } from "@/lib/utils";

type Props = {
  href?: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
  type?: "button" | "submit";
  onClick?: () => void;
  disabled?: boolean;
};

export function Button({
  href,
  children,
  variant = "primary",
  className,
  type = "button",
  onClick,
  disabled,
}: Props) {
  const styles = cn(
    "inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold tracking-wide transition duration-300",
    variant === "primary" &&
      "gold-gradient text-black shadow-[0_10px_40px_rgba(201,162,39,0.25)] hover:brightness-110",
    variant === "secondary" &&
      "border border-gold/40 bg-transparent text-gold hover:bg-gold/10",
    variant === "ghost" && "text-white/80 hover:text-gold",
    disabled && "pointer-events-none opacity-50",
    className,
  );

  if (href) {
    const external = /^https?:\/\//i.test(href);
    if (external) {
      return (
        <a
          href={href}
          className={styles}
          target="_blank"
          rel="noopener noreferrer"
        >
          {children}
        </a>
      );
    }
    return (
      <Link href={href} className={styles}>
        {children}
      </Link>
    );
  }

  return (
    <button type={type} className={styles} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}
