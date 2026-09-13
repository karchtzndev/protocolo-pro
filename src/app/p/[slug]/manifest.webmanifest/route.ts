import { createServiceRoleClient } from "@/lib/supabase/server";

/**
 * Manifest por paciente: cada link tem seu próprio `start_url`, então o app
 * instalado abre direto no portal daquele paciente (e não numa home genérica).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = createServiceRoleClient();

  const { data: link } = await supabase
    .from("patient_links")
    .select("patient:patients(nutritionist:nutritionists(clinic_name, full_name, brand_primary_color))")
    .eq("slug", slug)
    .maybeSingle<{
      patient: { nutritionist: { clinic_name: string | null; full_name: string; brand_primary_color: string } };
    }>();

  const nutritionist = link?.patient?.nutritionist;
  const name = nutritionist?.clinic_name ?? nutritionist?.full_name ?? "Protocolo.Pro";

  return Response.json(
    {
      name: `${name} — Meu protocolo`,
      short_name: name.slice(0, 12),
      description: "Seu protocolo alimentar, suplementação e diário de refeições.",
      start_url: `/p/${slug}`,
      scope: `/p/${slug}`,
      display: "standalone",
      orientation: "portrait",
      background_color: "#f6f4ee",
      theme_color: nutritionist?.brand_primary_color ?? "#1f4b3f",
      icons: [
        { src: "/pwa-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json" } }
  );
}
