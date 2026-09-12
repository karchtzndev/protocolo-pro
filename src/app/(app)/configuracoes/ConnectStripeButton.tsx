"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

export function ConnectStripeButton({ label }: { label: string }) {
  const [loading, setLoading] = useState(false);

  async function go() {
    setLoading(true);
    const res = await fetch("/api/stripe/connect/onboard", { method: "POST" });
    const { url, error } = await res.json();
    if (error) {
      alert(error);
      setLoading(false);
      return;
    }
    window.location.href = url;
  }

  return (
    <Button variant="ghost" size="sm" disabled={loading} onClick={go}>
      {label}
    </Button>
  );
}
