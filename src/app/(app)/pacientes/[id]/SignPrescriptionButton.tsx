"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { signPrescription } from "./supplement-actions";

export function SignPrescriptionButton({ patientId }: { patientId: string }) {
  const [pending, setPending] = useState(false);

  return (
    <Button
      variant="accent"
      disabled={pending}
      onClick={async () => {
        if (!confirm("Assinar a prescrição torna os itens atuais imutáveis. Confirmar?")) return;
        setPending(true);
        try {
          await signPrescription(patientId);
        } finally {
          setPending(false);
        }
      }}
    >
      ✓ Assinar prescrição
    </Button>
  );
}
