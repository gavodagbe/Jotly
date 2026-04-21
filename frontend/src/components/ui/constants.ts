export const controlButtonClass =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-transparent bg-transparent px-3.5 py-2 text-sm font-medium text-foreground/80 transition-all duration-200 hover:border-line hover:bg-surface-soft hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25 disabled:cursor-not-allowed disabled:opacity-50";

export const primaryButtonClass =
  "inline-flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-b from-accent to-accent-strong px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:shadow-md hover:brightness-110 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-50";

export const dangerButtonClass =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-sm font-semibold text-red-600 transition-all duration-200 hover:border-red-300 hover:bg-red-100 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200 disabled:cursor-not-allowed disabled:opacity-50";

export const textFieldClass =
  "mt-1 w-full rounded-lg border border-line bg-surface px-3 py-3 text-sm text-foreground outline-none transition-all duration-200 placeholder:text-muted/60 focus:border-accent focus:ring-2 focus:ring-accent/15 focus:shadow-sm disabled:cursor-not-allowed disabled:opacity-50";

export const boardFilterFieldClass = `${textFieldClass} h-11 py-0`;

export const sectionHeaderClass = "text-base font-semibold text-foreground pl-3 border-l-[3px] border-accent";

export const iconButtonClass =
  "inline-flex h-8 min-w-8 items-center justify-center rounded-lg text-muted transition-all duration-200 hover:bg-surface-soft hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25 disabled:cursor-not-allowed disabled:opacity-50";

export const controlIconButtonClass = `${controlButtonClass} h-9 w-9 px-0`;
