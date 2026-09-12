import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse depende de um binário nativo (@napi-rs/canvas), e pdfkit
  // (usado por @react-pdf/renderer) carrega as fontes padrão (.afm/.cjs) via
  // caminho calculado em runtime — o rastreamento de arquivos do Next não
  // detecta isso e a função serverless da Vercel falha com "Cannot find
  // module .../pdfkit/js/standard-fonts/Helvetica.cjs". Declarar como pacote
  // externo faz a Vercel incluir o diretório inteiro em vez de rastrear.
  serverExternalPackages: ["pdf-parse", "@napi-rs/canvas", "pdfkit", "@react-pdf/renderer"],
  // serverExternalPackages não é suficiente: o rastreamento de arquivos da
  // Vercel (NFT) analisa estaticamente os requires e não enxerga o require
  // com caminho calculado que o pdfkit usa para carregar as fontes padrão.
  // Força a inclusão explícita desses arquivos nas rotas de PDF.
  outputFileTracingIncludes: {
    "/api/pdf/**/*": ["./node_modules/pdfkit/js/standard-fonts/**"],
  },
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
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https://*.supabase.co",
              "font-src 'self' data:",
              "connect-src 'self' https://*.supabase.co https://api.stripe.com",
              "frame-src https://js.stripe.com https://checkout.stripe.com",
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
