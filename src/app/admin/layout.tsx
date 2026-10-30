import type { Metadata } from "next";

export const metadata: Metadata = { title: { default: "Painel", template: "%s · Painel ACIESC" }, robots: { index: false } };

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return <div className="flex min-h-full flex-1 flex-col bg-bg">{children}</div>;
}
