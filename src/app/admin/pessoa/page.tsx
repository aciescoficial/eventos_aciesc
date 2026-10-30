import type { Metadata } from "next";
import { Suspense } from "react";
import { Person } from "./person";

export const metadata: Metadata = { title: "Ficha da pessoa" };

export default function Page() {
  return (
    <Suspense>
      <Person />
    </Suspense>
  );
}
