import type { Metadata } from "next";
import { PublicPage } from "@/components/public-page";
import { WaitlistOffer } from "./waitlist-offer";

export const metadata: Metadata = { title: "Lista de espera", robots: { index: false } };

export default function Page() {
  return (
    <PublicPage title="Lista de espera">
      <WaitlistOffer />
    </PublicPage>
  );
}
