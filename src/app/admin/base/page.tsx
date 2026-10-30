import type { Metadata } from "next";
import { Suspense } from "react";
import { Base } from "./base";

export const metadata: Metadata = { title: "Base ACIESC" };

export default function Page() {
  return (
    <Suspense>
      <Base />
    </Suspense>
  );
}
