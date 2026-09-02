import type { Metadata } from "next";

import { AdminShell } from "@/components/admin/AdminShell";
import { APP_NAME } from "@/lib/app-meta";

export const metadata: Metadata = {
  title: `${APP_NAME} · Administration`,
};

export default function AdminPage() {
  return <AdminShell />;
}
