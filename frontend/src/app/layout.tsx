import type { Metadata } from "next";
import { APP_NAME } from "@/lib/app-meta";
import "./globals.css";

export const metadata: Metadata = {
  title: APP_NAME,
  description: "Date-driven daily task dashboard.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
