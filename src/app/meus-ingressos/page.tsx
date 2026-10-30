import type { Metadata } from "next";
import { PublicPage } from "@/components/public-page";
import { MyTickets } from "./my-tickets";

export const metadata: Metadata = { title: "Meus ingressos", robots: { index: false } };

export default function Page() {
  return (
    <PublicPage title="Meus ingressos" wide>
      <MyTickets />
    </PublicPage>
  );
}
