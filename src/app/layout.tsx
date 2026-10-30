import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import { UtmCapture } from "@/components/utm-capture";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "Eventos ACIESC",
    template: "%s · Eventos ACIESC",
  },
  description:
    "Cursos, palestras, workshops e eventos da ACIESC — Associação de Corretores e Imobiliárias do Estado de Santa Catarina.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${poppins.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <UtmCapture />
        {children}
      </body>
    </html>
  );
}
