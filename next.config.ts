import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse depende de um binário nativo (@napi-rs/canvas) — precisa ficar
  // de fora do bundle webpack e ser rastreado como pacote externo pela
  // função serverless da Vercel, senão falha em runtime mesmo com build ok.
  serverExternalPackages: ["pdf-parse", "@napi-rs/canvas"],
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },
};

export default nextConfig;
