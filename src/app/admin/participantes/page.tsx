import type { Metadata } from "next";
import { Suspense } from "react";
import { Participants } from "./participants";

export const metadata: Metadata = { title: "Participantes" };

export default function Page() {
  return (
    <Suspense>
      <Participants />
    </Suspense>
  );
}
