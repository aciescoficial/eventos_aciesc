import type { Metadata } from "next";
import { PublicPage } from "@/components/public-page";
import { Presence } from "./presence";

export const metadata: Metadata = { title: "Confirmar presença", robots: { index: false } };

export default function Page() {
  return (
    <PublicPage title="Confirmar presença">
      <Presence />
    </PublicPage>
  );
}
