import type { Metadata } from "next";
import { ServiceWorkerRegistrar } from "./ServiceWorkerRegistrar";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return {
    manifest: `/p/${slug}/manifest.webmanifest`,
    appleWebApp: { capable: true, statusBarStyle: "default", title: "Meu protocolo" },
    icons: { apple: "/pwa-icon/192" },
  };
}

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <ServiceWorkerRegistrar />
    </>
  );
}
