export function CollapseChevronIcon({ isCollapsed }: { isCollapsed: boolean }) {
  return isCollapsed ? (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4">
      <path
        d="M5.75 7.75L10 12.25L14.25 7.75"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.75"
      />
    </svg>
  ) : (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4">
      <path
        d="M5.75 12.25L10 7.75L14.25 12.25"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.75"
      />
    </svg>
  );
}

export function DragHandleIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4">
      <circle cx="7" cy="6" r="1.1" fill="currentColor" />
      <circle cx="13" cy="6" r="1.1" fill="currentColor" />
      <circle cx="7" cy="10" r="1.1" fill="currentColor" />
      <circle cx="13" cy="10" r="1.1" fill="currentColor" />
      <circle cx="7" cy="14" r="1.1" fill="currentColor" />
      <circle cx="13" cy="14" r="1.1" fill="currentColor" />
    </svg>
  );
}

export function ArrowLeftIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d="M11.75 4.75L6.5 10L11.75 15.25" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 10h8" strokeLinecap="round" />
    </svg>
  );
}

export function ArrowRightIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d="M8.25 4.75L13.5 10L8.25 15.25" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 10h8" strokeLinecap="round" />
    </svg>
  );
}

export function CalendarIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.75">
      <rect x="3.5" y="4.5" width="13" height="12" rx="2.2" />
      <path d="M6.5 3v3M13.5 3v3M3.5 8.25h13" strokeLinecap="round" />
      <circle cx="10" cy="11.75" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function CopyIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.75">
      <rect x="6.2" y="6" width="9" height="10" rx="1.8" />
      <path d="M4.8 13V5.8A1.8 1.8 0 016.6 4h6.9" strokeLinecap="round" />
    </svg>
  );
}

export function SearchIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.75">
      <circle cx="8.75" cy="8.75" r="4.75" />
      <path d="M12.25 12.25L16 16" strokeLinecap="round" />
    </svg>
  );
}

export function BellIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M10 3.5a3.2 3.2 0 00-3.2 3.2v1.1c0 .8-.2 1.6-.6 2.3l-.8 1.5a1 1 0 00.9 1.5h7.4a1 1 0 00.9-1.5l-.8-1.5a4.7 4.7 0 01-.6-2.3V6.7A3.2 3.2 0 0010 3.5z" />
      <path d="M8.2 15a1.9 1.9 0 003.6 0" strokeLinecap="round" />
    </svg>
  );
}

export function PlusIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d="M10 4.5v11M4.5 10h11" strokeLinecap="round" />
    </svg>
  );
}

export function SaveIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M4.5 4.5h9.5l1.5 1.5v9.5H4.5z" />
      <path d="M7 4.5v4h6v-4M7 15h6" strokeLinecap="round" />
    </svg>
  );
}

export function LightningIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d="M10.75 2.5 5.5 10h3.25l-.75 7.5 6-8h-3.25l.75-7Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PencilIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M4.75 13.75l-.5 2 2-.5 8-8-1.5-1.5z" strokeLinejoin="round" />
      <path d="M11.75 5.75l1.5 1.5M13 4.5l1.5 1.5" strokeLinecap="round" />
    </svg>
  );
}

export function TrashIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M4.75 6h10.5M8 6V4.8h4V6M6.5 6l.7 9h5.6l.7-9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8.7 8.2v5.3M11.3 8.2v5.3" strokeLinecap="round" />
    </svg>
  );
}

export function CloseIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d="M5.25 5.25l9.5 9.5M14.75 5.25l-9.5 9.5" strokeLinecap="round" />
    </svg>
  );
}

export function SendIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3.5 10l13-6-3.9 12L9.8 11z" strokeLinejoin="round" />
      <path d="M9.8 11L16.5 4" strokeLinecap="round" />
    </svg>
  );
}

export function ChatIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M4 4.8h12v8.4H9.2L6 15.8v-2.6H4z" strokeLinejoin="round" />
      <path d="M7 8.3h6M7 10.8h4.5" strokeLinecap="round" />
    </svg>
  );
}

export function TimeZoneIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.75">
      <circle cx="10" cy="10" r="6.5" />
      <path d="M10 6.2v4.1l2.6 1.6" strokeLinecap="round" />
    </svg>
  );
}

export function LayoutToggleIcon({ collapsed }: { collapsed: boolean }) {
  return collapsed ? (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 6h12M4 10h12M4 14h12" strokeLinecap="round" />
      <path d="M8 4l2 2 2-2M8 16l2-2 2 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ) : (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 6h12M4 10h12M4 14h12" strokeLinecap="round" />
      <path d="M8 7l2-2 2 2M8 13l2 2 2-2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ProfileGlyph({ isLoggedIn }: { isLoggedIn: boolean }) {
  if (isLoggedIn) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9">
        <circle cx="12" cy="8" r="3.2" />
        <path d="M5 19c1.2-3.1 3.8-4.7 7-4.7s5.8 1.6 7 4.7" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d="M11 5H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4" />
      <path d="M13 8l4 4-4 4" />
      <path d="M7 12h10" />
    </svg>
  );
}
