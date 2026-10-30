import type { Metadata } from "next";
import { Suspense } from "react";
import { EventEditor } from "./event-editor";

export const metadata: Metadata = { title: "Evento" };

export default function Page() {
  return (
    <Suspense>
      <EventEditor />
    </Suspense>
  );
}
