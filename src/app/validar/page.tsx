import type { Metadata } from "next";
import { PublicPage } from "@/components/public-page";
import { Validate } from "./validate";

export const metadata: Metadata = { title: "Validar certificado", description: "Confira a autenticidade de um certificado ACIESC." };

export default function Page() {
  return (
    <PublicPage title="Validar certificado">
      <Validate />
    </PublicPage>
  );
}
