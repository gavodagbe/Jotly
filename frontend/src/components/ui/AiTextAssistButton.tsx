"use client";

type UserLocale = "en" | "fr";

type AiTextAssistButtonProps = {
  locale: UserLocale;
  onClick: () => void;
  isLoading: boolean;
  disabled?: boolean;
  variant?: "inline" | "toolbar";
};

export function AiTextAssistButton({
  locale,
  onClick,
  isLoading,
  disabled = false,
  variant = "inline",
}: AiTextAssistButtonProps) {
  const isFrench = locale === "fr";
  const title = isFrench ? "Reformuler avec l'IA" : "Rewrite with AI";
  const className =
    variant === "toolbar"
      ? "inline-flex h-7 items-center justify-center gap-1 rounded-md border border-line bg-surface-soft px-2 text-[11px] font-semibold text-muted transition-colors hover:bg-surface hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
      : "inline-flex h-7 items-center justify-center gap-1 rounded-md border border-line bg-surface-soft px-2 text-[11px] font-semibold text-muted transition-colors hover:bg-surface hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <button
      type="button"
      className={className}
      onClick={onClick}
      disabled={disabled || isLoading}
      aria-label={title}
      title={title}
    >
      {isLoading ? (
        <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 3a9 9 0 1 0 9 9" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3.5 w-3.5">
          <path d="M10 2l1.8 4.7L16.5 8l-4.7 1.3L10 14l-1.8-4.7L3.5 8l4.7-1.3L10 2z" strokeLinejoin="round" />
          <path d="M15.5 12.5l.8 2 .8-2 2-.8-2-.8-.8-2-.8 2-2 .8 2 .8z" strokeLinejoin="round" />
        </svg>
      )}
      <span>AI</span>
    </button>
  );
}
