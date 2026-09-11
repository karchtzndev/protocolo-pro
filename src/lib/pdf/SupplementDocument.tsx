import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { Patient, PatientSupplement, Nutritionist } from "@/lib/types";

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: "Helvetica", color: "#1B211D" },
  header: { marginBottom: 18, borderBottom: "2px solid #1F4B3F", paddingBottom: 10 },
  clinic: { fontSize: 9, color: "#5B6259" },
  title: { fontSize: 18, fontWeight: 700, marginTop: 2 },
  row: { flexDirection: "row", justifyContent: "space-between", borderBottom: "1px solid #E9E5D8", paddingVertical: 8 },
  name: { fontSize: 11, fontWeight: 700 },
  schedule: { fontSize: 10, color: "#5B6259" },
  footer: { marginTop: 24, fontSize: 8, color: "#8A9088", textAlign: "center" },
});

export function SupplementDocument({
  patient,
  supplements,
  nutritionist,
}: {
  patient: Patient;
  supplements: PatientSupplement[];
  nutritionist: Nutritionist;
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.clinic}>{nutritionist.clinic_name ?? nutritionist.full_name}</Text>
          <Text style={styles.title}>Suplementação — {patient.full_name}</Text>
        </View>

        {supplements.map((s) => (
          <View key={s.id} style={styles.row}>
            <Text style={styles.name}>{s.supplement?.name}</Text>
            <Text style={styles.schedule}>
              {s.dose} {s.dose_unit} — {s.schedule}
            </Text>
          </View>
        ))}

        <Text style={styles.footer}>
          Gerado por Protocolo.Pro em {new Date().toLocaleDateString("pt-BR")} — siga as orientações do seu
          nutricionista antes de iniciar qualquer suplementação.
        </Text>
      </Page>
    </Document>
  );
}
