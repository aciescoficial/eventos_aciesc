import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Door } from "./door";

export const metadata: Metadata = { title: "Portaria", manifest: "/manifest.webmanifest" };
export const viewport: Viewport = { themeColor: "#07211B" };

export default function Page() {
  return (
    <Suspense>
      <Door />
    </Suspense>
  );
}
