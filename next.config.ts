import type { NextConfig } from "next";

// Site 100% estático (pasta out/) hospedado na KingHost sem Node.
// Toda lógica de servidor fica no Supabase (RLS, funções Postgres, Edge Functions).
const nextConfig: NextConfig = {
  output: "export",
  // /admin → /admin/index.html: o Apache serve sem regras de rewrite.
  trailingSlash: true,
  images: { unoptimized: true },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
