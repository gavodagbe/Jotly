"use client";

import type { ReactNode } from "react";

type MobileMoreScreenProps = {
  isFrench: boolean;
  displayName: string;
  email: string | null;
  isBusy?: boolean;
  onOpenProfile: () => void;
  onOpenProjectPlanning: () => void;
  onLogout: () => void;
};

function Row({ label, hint, onClick, href, tone = "default", disabled }: {
  label: string;
  hint?: string;
  onClick?: () => void;
  href?: string;
  tone?: "default" | "danger";
  disabled?: boolean;
}) {
  const className = `flex min-h-14 w-full items-center justify-between gap-3 px-4 py-3 text-left text-[15px] font-medium transition-colors active:bg-surface-soft ${
    tone === "danger" ? "text-rose-600" : "text-foreground"
  }`;
  const content: ReactNode = (
    <>
      <span className="flex flex-col">
        {label}
        {hint && <span className="text-xs font-normal text-muted">{hint}</span>}
      </span>
      {tone === "default" && <span aria-hidden className="text-muted">›</span>}
    </>
  );
  return href ? (
    <a href={href} className={className}>{content}</a>
  ) : (
    <button type="button" className={className} onClick={onClick} disabled={disabled}>{content}</button>
  );
}

/** "More" tab on mobile: account, secondary tools and logout (the Gaming Track section follows it). */
export function MobileMoreScreen({ isFrench, displayName, email, isBusy, onOpenProfile, onOpenProjectPlanning, onLogout }: MobileMoreScreenProps) {
  const initials = displayName.slice(0, 2).toUpperCase();
  return (
    <section data-screen="more" data-screen-bare className="flex flex-col gap-4 lg:hidden">
      <div className="flex items-center gap-3 rounded-xl bg-surface p-4 shadow-sm">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-accent-soft text-base font-semibold text-accent">{initials}</div>
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-foreground">{displayName}</p>
          {email && <p className="truncate text-sm text-muted">{email}</p>}
        </div>
      </div>

      <div className="divide-y divide-line overflow-hidden rounded-xl bg-surface shadow-sm">
        <Row label={isFrench ? "Profil et préférences" : "Profile & preferences"} hint={isFrench ? "Nom, langue, fuseau, Google Calendar" : "Name, language, time zone, Google Calendar"} onClick={onOpenProfile} disabled={isBusy} />
        <Row label={isFrench ? "Planification des projets" : "Project planning"} onClick={onOpenProjectPlanning} disabled={isBusy} />
        <Row label={isFrench ? "Administration" : "Administration"} href="/admin" />
      </div>

      <div className="overflow-hidden rounded-xl bg-surface shadow-sm">
        <Row label={isFrench ? "Se déconnecter" : "Log out"} tone="danger" onClick={onLogout} disabled={isBusy} />
      </div>
    </section>
  );
}
