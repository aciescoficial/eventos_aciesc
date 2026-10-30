import type { Metadata } from "next";
import { Suspense } from "react";
import { EventPanel } from "./event-panel";

export const metadata: Metadata = { title: "Evento" };

export default function Page() {
  return (
    <Suspense>
      <EventPanel />
    </Suspense>
  );
}
