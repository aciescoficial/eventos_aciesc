import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin/", "/checkout/", "/pedido/", "/meus-ingressos/", "/presenca/", "/lista-espera/", "/certificado/"] },
    sitemap: `${site}/sitemap.xml`,
  };
}
