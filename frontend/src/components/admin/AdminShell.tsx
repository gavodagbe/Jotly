"use client";

import { useCallback, useEffect, useState } from "react";

import { ArrowLeftIcon } from "@/components/ui/icons";
import { readAdminAuthToken } from "@/features/admin/crud-client";
import { adminResources, findAdminResource } from "@/features/admin/resources";
import { pickLabel, type AdminLocale } from "@/features/admin/types";

type Session = { token: string; locale: AdminLocale };

function readHashKey(): string | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash.replace(/^#/, "").trim();
  return hash.length > 0 ? hash : null;
}

export function AdminShell() {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "denied">("loading");
  const [activeKey, setActiveKey] = useState<string | null>(readHashKey());

  const goToApp = useCallback(() => {
    window.location.href = "/";
  }, []);

  useEffect(() => {
    const token = readAdminAuthToken();
    if (!token) {
      goToApp();
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/backend-api/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (!response.ok) {
          if (!cancelled) {
            setStatus("denied");
            goToApp();
          }
          return;
        }
        const payload = (await response.json().catch(() => null)) as
          | { data?: { user?: { preferredLocale?: string } } }
          | null;
        if (cancelled) return;
        const rawLocale = payload?.data?.user?.preferredLocale;
        setSession({ token, locale: rawLocale === "fr" ? "fr" : "en" });
        setStatus("ready");
      } catch {
        if (!cancelled) {
          setStatus("denied");
          goToApp();
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [goToApp]);

  useEffect(() => {
    const onHashChange = () => setActiveKey(readHashKey());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  if (status !== "ready" || !session) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-sm text-muted">
        {status === "denied" ? "Redirecting…" : "Loading…"}
      </div>
    );
  }

  const { locale } = session;
  const isFrench = locale === "fr";
  const active = findAdminResource(activeKey);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <div>
            <h1 className="text-lg font-semibold">{isFrench ? "Administration" : "Administration"}</h1>
            <p className="text-sm text-muted">
              {isFrench ? "Gérer les données de référence de Jotly" : "Manage Jotly reference data"}
            </p>
          </div>
          <button
            type="button"
            onClick={goToApp}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-foreground/80 transition-colors hover:border-accent/40 hover:text-foreground"
          >
            <ArrowLeftIcon />
            {isFrench ? "Retour au tableau de bord" : "Back to dashboard"}
          </button>
        </div>
      </header>

      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8 lg:flex-row">
        <nav className="shrink-0 lg:w-56">
          <ul className="flex gap-1 lg:flex-col">
            {adminResources.map((resource) => {
              const isActive = resource.key === active.key;
              return (
                <li key={resource.key}>
                  <a
                    href={`#${resource.key}`}
                    className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                      isActive
                        ? "bg-accent-soft font-semibold text-accent"
                        : "text-foreground/75 hover:bg-surface-soft hover:text-foreground"
                    }`}
                  >
                    {pickLabel(locale, resource.labelEn, resource.labelFr)}
                    <span className="mt-0.5 block text-xs font-normal text-muted">
                      {pickLabel(locale, resource.descriptionEn, resource.descriptionFr)}
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>

        <main className="min-w-0 flex-1">
          <active.Component token={session.token} locale={locale} />
        </main>
      </div>
    </div>
  );
}
