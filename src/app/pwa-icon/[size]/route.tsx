import { ImageResponse } from "next/og";

/** Ícone do app gerado em runtime — evita manter binários no repositório. */
export async function GET(_request: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size: sizeParam } = await params;
  const size = sizeParam === "512" ? 512 : 192;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1f4b3f",
          color: "#ffffff",
          fontSize: size * 0.5,
          fontWeight: 700,
        }}
      >
        P
      </div>
    ),
    {
      width: size,
      height: size,
      headers: { "Cache-Control": "public, max-age=31536000, immutable" },
    }
  );
}
