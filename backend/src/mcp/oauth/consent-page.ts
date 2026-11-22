function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Security headers for server-rendered OAuth pages (no framing, no scripts). */
export const OAUTH_PAGE_HEADERS = {
  "content-type": "text/html; charset=utf-8",
  "cache-control": "no-store",
  "x-frame-options": "DENY",
  "referrer-policy": "no-referrer",
  // No form-action directive: browsers would block the 302 back to the client after submit.
  "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'",
} as const;

const STYLE = `
  :root { color-scheme: light dark; --bg:#f6f5f2; --card:#fff; --text:#1d1d1b; --muted:#66645e; --accent:#2f5d50; --line:#e2e0da; }
  @media (prefers-color-scheme: dark) { :root { --bg:#151514; --card:#1f1f1d; --text:#f1efe9; --muted:#a3a09a; --accent:#7fb8a6; --line:#33322f; } }
  * { box-sizing: border-box; }
  body { margin:0; min-height:100vh; display:grid; place-items:center; padding:16px; background:var(--bg); color:var(--text);
         font: 16px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  main { width:100%; max-width:420px; background:var(--card); border:1px solid var(--line); border-radius:14px; padding:28px 24px; }
  h1 { font-size:20px; margin:0 0 12px; }
  p { margin:0 0 12px; color:var(--muted); }
  strong { color:var(--text); }
  ul { margin:0 0 20px; padding-left:20px; color:var(--muted); }
  .actions { display:flex; gap:12px; }
  button { flex:1; font:inherit; padding:12px; border-radius:10px; cursor:pointer; border:1px solid var(--line); background:transparent; color:var(--text); }
  button.primary { background:var(--accent); border-color:var(--accent); color:#fff; }
`;

function page(title: string, body: string): string {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(
    title
  )}</title><style>${STYLE}</style></head><body><main>${body}</main></body></html>`;
}

export function renderConsentPage(input: {
  clientLabel: string;
  email: string;
  requestState: string;
  csrfToken: string;
  action: string;
}): string {
  return page(
    "Autoriser l'accès à Jotly",
    `<h1>Autoriser l'accès à Jotly ?</h1>
     <p><strong>${escapeHtml(input.clientLabel)}</strong> demande à agir dans Jotly pour le compte
     <strong>${escapeHtml(input.email)}</strong>.</p>
     <ul>
       <li>lire la journée : tâches, affirmation, bilan, alertes, rappels ;</li>
       <li>créer et modifier des tâches, des rappels et l'affirmation.</li>
     </ul>
     <p>Aucune suppression n'est possible par ce moyen.</p>
     <form method="post" action="${escapeHtml(input.action)}">
       <input type="hidden" name="state" value="${escapeHtml(input.requestState)}">
       <input type="hidden" name="csrf" value="${escapeHtml(input.csrfToken)}">
       <div class="actions">
         <button type="submit" name="decision" value="deny">Refuser</button>
         <button type="submit" name="decision" value="allow" class="primary">Autoriser</button>
       </div>
     </form>`
  );
}

export function renderErrorPage(title: string, message: string): string {
  return page(title, `<h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p>`);
}
