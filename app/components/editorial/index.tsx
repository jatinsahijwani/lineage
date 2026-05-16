"use client";

/**
 * Editorial primitives for Lineage.
 *
 * Hairline-first, type-led, copper-accented. Built specifically to NOT look
 * like another shadcn/v0 dashboard. Use these everywhere on app pages and
 * the landing.
 */

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Chapter — heading + chapter mark used at the top of an app page or section.
// ─────────────────────────────────────────────────────────────────────────────

interface ChapterProps {
  number: string; // "01", "02", "iii", "appendix"
  eyebrow?: string; // mono caps label above the title
  title: ReactNode; // accepts italic <em> spans for emphasis
  lede?: ReactNode; // optional 1-2 line subtitle
  marginalia?: ReactNode; // small column on the right (status, meta)
  className?: string;
}

export function Chapter({
  number,
  eyebrow,
  title,
  lede,
  marginalia,
  className,
}: ChapterProps) {
  return (
    <header
      className={cn(
        "grid grid-cols-12 gap-x-6 gap-y-6 border-t border-rule pt-10 lg:pt-16",
        className,
      )}
    >
      <div className="col-span-12 flex items-baseline gap-4 lg:col-span-1">
        <span className="chapter-mark">§{number}</span>
      </div>
      <div className="col-span-12 lg:col-span-7 xl:col-span-8">
        {eyebrow && <div className="label mb-4">{eyebrow}</div>}
        <h1
          className="display text-[clamp(2.5rem,6vw,5rem)] text-paper"
          style={{ fontVariationSettings: '"opsz" 144, "SOFT" 100' }}
        >
          {title}
        </h1>
        {lede && (
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-paper-dim sm:text-lg">
            {lede}
          </p>
        )}
      </div>
      {marginalia && (
        <aside className="col-span-12 lg:col-span-3 lg:col-start-10 lg:pt-2">
          {marginalia}
        </aside>
      )}
    </header>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section — collapsible-shaped block with an eyebrow and rule.
// ─────────────────────────────────────────────────────────────────────────────

interface SectionProps {
  eyebrow?: string;
  title?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Section({ eyebrow, title, children, className }: SectionProps) {
  return (
    <section className={cn("border-t border-rule py-12 lg:py-16", className)}>
      {(eyebrow || title) && (
        <div className="mb-8 grid grid-cols-12 gap-6">
          {eyebrow && (
            <div className="col-span-12 lg:col-span-3">
              <span className="label">{eyebrow}</span>
            </div>
          )}
          {title && (
            <h2
              className="col-span-12 display text-[clamp(1.75rem,3.6vw,2.75rem)] text-paper lg:col-span-9"
              style={{ fontVariationSettings: '"opsz" 96' }}
            >
              {title}
            </h2>
          )}
        </div>
      )}
      {children}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Button — three variants. Copper PRIMARY, ghost SECONDARY, text GHOST.
// ─────────────────────────────────────────────────────────────────────────────

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const BUTTON_BASE =
  "group relative inline-flex items-center justify-center gap-2 font-mono uppercase tracking-[0.18em] transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-40";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "border border-copper bg-copper text-ink hover:bg-copper-bright hover:border-copper-bright",
  secondary:
    "border border-rule text-paper hover:border-copper hover:text-copper-bright",
  ghost: "text-paper-dim hover:text-paper",
  danger:
    "border border-rust/40 bg-rust/10 text-rust hover:bg-rust/20 hover:border-rust",
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-[10px]",
  md: "px-5 py-2.5 text-[11px]",
  lg: "px-7 py-3.5 text-xs",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = "primary", size = "md", className, children, loading, disabled, ...rest },
    ref,
  ) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        BUTTON_BASE,
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className,
      )}
      {...rest}
    >
      {loading && (
        <span
          aria-hidden
          className="inline-block h-3 w-3 animate-spin border border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  ),
);
Button.displayName = "Button";

// ─────────────────────────────────────────────────────────────────────────────
// LinkButton — Next link with editorial button styling
// ─────────────────────────────────────────────────────────────────────────────

interface LinkButtonProps {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: ReactNode;
  external?: boolean;
}

export function LinkButton({
  href,
  variant = "secondary",
  size = "md",
  className,
  children,
  external,
}: LinkButtonProps) {
  const classes = cn(
    BUTTON_BASE,
    BUTTON_VARIANTS[variant],
    BUTTON_SIZES[size],
    className,
  );
  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={classes}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={classes}>
      {children}
    </Link>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Card — editorial container. Hairline frame, no rounding, optional eyebrow.
// ─────────────────────────────────────────────────────────────────────────────

interface CardProps {
  eyebrow?: string;
  title?: ReactNode;
  meta?: ReactNode;
  children: ReactNode;
  className?: string;
  accent?: boolean; // copper top-rule
}

export function Card({
  eyebrow,
  title,
  meta,
  children,
  className,
  accent,
}: CardProps) {
  return (
    <div
      className={cn(
        "editorial-card relative p-6 lg:p-8",
        accent && "border-t-copper",
        className,
      )}
    >
      {(eyebrow || meta) && (
        <div className="mb-5 flex items-center justify-between">
          {eyebrow && <span className="label">{eyebrow}</span>}
          {meta && <span className="label text-paper-faint">{meta}</span>}
        </div>
      )}
      {title && (
        <h3
          className="mb-4 display text-2xl text-paper lg:text-3xl"
          style={{ fontVariationSettings: '"opsz" 72' }}
        >
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Field — input/textarea wrapper. Bottom rule only. Mono input.
// ─────────────────────────────────────────────────────────────────────────────

interface FieldProps {
  label: string;
  hint?: ReactNode;
  meta?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Field({ label, hint, meta, children, className }: FieldProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-baseline justify-between">
        <span className="label">{label}</span>
        {meta && <span className="label text-paper-faint">{meta}</span>}
      </div>
      {children}
      {hint && (
        <p className="font-mono text-[11px] leading-relaxed text-paper-faint">
          {hint}
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Badge — small mono caps, hairline frame, optional copper tint
// ─────────────────────────────────────────────────────────────────────────────

interface BadgeProps {
  children: ReactNode;
  tone?: "default" | "copper" | "rust" | "moss";
  className?: string;
}

export function Badge({ children, tone = "default", className }: BadgeProps) {
  const toneClasses: Record<NonNullable<BadgeProps["tone"]>, string> = {
    default: "border-rule text-paper-dim",
    copper: "border-copper/40 text-copper bg-copper/5",
    rust: "border-rust/40 text-rust bg-rust/5",
    moss: "border-moss/40 text-moss bg-moss/5",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.2em]",
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Stat — big tabular number with mono label and optional unit
// ─────────────────────────────────────────────────────────────────────────────

interface StatProps {
  label: string;
  value: ReactNode;
  unit?: string;
  hint?: ReactNode;
  className?: string;
}

export function Stat({ label, value, unit, hint, className }: StatProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <span className="label">{label}</span>
      <div className="flex items-baseline gap-2">
        <span
          className="display-upright tabular text-4xl text-paper lg:text-5xl"
          style={{ fontVariationSettings: '"opsz" 144' }}
        >
          {value}
        </span>
        {unit && (
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-paper-faint">
            {unit}
          </span>
        )}
      </div>
      {hint && (
        <p className="font-mono text-[11px] leading-relaxed text-paper-faint">
          {hint}
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Ornament — decorative section break with italic asterism
// ─────────────────────────────────────────────────────────────────────────────

export function Ornament({ children = "❦" }: { children?: ReactNode }) {
  return (
    <div className="ornament my-12" aria-hidden>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Marginalia — small mono notes set in a column beside body text
// ─────────────────────────────────────────────────────────────────────────────

type MarginaliaProps = React.HTMLAttributes<HTMLElement> & {
  children: ReactNode;
};

export function Marginalia({
  children,
  className,
  ...rest
}: MarginaliaProps) {
  return (
    <aside
      className={cn(
        "border-l border-rule pl-5 text-[0.95rem] leading-[1.65] text-paper-dim [&_p]:my-0",
        className,
      )}
      {...rest}
    >
      {children}
    </aside>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PageWrap — outer container, sets the editorial max-width and gutters
// ─────────────────────────────────────────────────────────────────────────────

export function PageWrap({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[1400px] px-6 lg:px-10",
        className,
      )}
    >
      {children}
    </div>
  );
}
