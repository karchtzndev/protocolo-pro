import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import type { AnthropometryRecord, Patient, Nutritionist } from "@/lib/types";
import { calculateIndices } from "@/lib/health/indices";
import { calculateSkinfoldProtocols } from "@/lib/health/skinfolds";

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 9, fontFamily: "Helvetica", color: "#1B211D" },
  header: {
    marginBottom: 16,
    borderBottomWidth: 2,
    borderBottomStyle: "solid",
    borderBottomColor: "#1F4B3F",
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  logo: { width: 40, height: 40, marginRight: 10, objectFit: "contain" },
  clinic: { fontSize: 9, color: "#5B6259" },
  title: { fontSize: 16, fontWeight: 700, marginTop: 2 },
  patientRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 14, fontSize: 9 },
  table: { borderWidth: 1, borderColor: "#E9E5D8", borderRadius: 4 },
  row: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#E9E5D8" },
  rowFirst: { flexDirection: "row" },
  headerRow: { flexDirection: "row", backgroundColor: "#F4F2EA" },
  labelCell: { width: "26%", padding: 5, fontWeight: 700, fontSize: 8 },
  valueCell: { padding: 5, fontSize: 8, textAlign: "center", borderLeftWidth: 1, borderLeftColor: "#E9E5D8" },
  classification: { fontSize: 6.5, color: "#5B6259", marginTop: 1 },
  sectionTitle: { fontSize: 11, fontWeight: 700, marginTop: 18, marginBottom: 6, color: "#1F4B3F" },
  footer: { marginTop: 20, fontSize: 8, color: "#8A9088", textAlign: "center" },
});

function ageAt(birthDate: string, atDate: string) {
  const birth = new Date(birthDate);
  const at = new Date(atDate);
  let age = at.getFullYear() - birth.getFullYear();
  const m = at.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && at.getDate() < birth.getDate())) age--;
  return age;
}

const SKINFOLD_PRIORITY: Array<"jp7" | "jp3" | "durnin_womersley" | "faulkner"> = [
  "jp7",
  "jp3",
  "durnin_womersley",
  "faulkner",
];

function pickBodyFat(record: AnthropometryRecord, sex: "masculino" | "feminino", age: number) {
  const results = calculateSkinfoldProtocols({
    sex,
    ageYears: age,
    chest: record.skinfold_chest_mm,
    midaxillary: record.skinfold_midaxillary_mm,
    triceps: record.skinfold_triceps_mm,
    subscapular: record.skinfold_subscapular_mm,
    abdominal: record.skinfold_abdominal_mm,
    suprailiac: record.skinfold_suprailiac_mm,
    thigh: record.skinfold_thigh_mm,
    bicep: record.skinfold_bicep_mm,
  });
  for (const key of SKINFOLD_PRIORITY) {
    const found = results.find((r) => r.key === key && r.available);
    if (found) return found;
  }
  return null;
}

const DOBRAS: { key: keyof AnthropometryRecord; label: string }[] = [
  { key: "skinfold_triceps_mm", label: "Dobra tríceps (mm)" },
  { key: "skinfold_subscapular_mm", label: "Dobra subescapular (mm)" },
  { key: "skinfold_midaxillary_mm", label: "Dobra axilar média (mm)" },
  { key: "skinfold_suprailiac_mm", label: "Dobra suprailíaca (mm)" },
  { key: "skinfold_abdominal_mm", label: "Dobra abdômen (mm)" },
  { key: "skinfold_chest_mm", label: "Dobra peitoral (mm)" },
  { key: "skinfold_thigh_mm", label: "Dobra coxa (mm)" },
  { key: "skinfold_bicep_mm", label: "Dobra bíceps (mm)" },
];

export function AnthropometryDocument({
  patient,
  nutritionist,
  records,
}: {
  patient: Patient;
  nutritionist: Nutritionist;
  records: AnthropometryRecord[];
}) {
  const columns = records.slice(0, 5);
  const colWidth = `${74 / Math.max(columns.length, 1)}%`;
  const sex: "masculino" | "feminino" = patient.sex === "masculino" ? "masculino" : "feminino";

  const computed = columns.map((r) => {
    const age = ageAt(patient.birth_date, r.recorded_at);
    return { record: r, age, indices: calculateIndices({ weightKg: r.weight_kg, heightM: r.height_m, waistCm: r.waist_cm, hipCm: r.hip_cm, sex: patient.sex }), fat: pickBodyFat(r, sex, age) };
  });

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View
          style={[
            styles.header,
            nutritionist.brand_primary_color ? { borderBottomColor: nutritionist.brand_primary_color } : {},
          ]}
        >
          {nutritionist.logo_url && <Image src={nutritionist.logo_url} style={styles.logo} />}
          <View>
            <Text style={styles.clinic}>
              {nutritionist.clinic_name ?? nutritionist.full_name} · {nutritionist.full_name} — CRN {nutritionist.crn}
            </Text>
            <Text style={styles.title}>Relatório de composição corporal — {patient.full_name}</Text>
          </View>
        </View>

        <View style={styles.patientRow}>
          <Text>Nascimento: {new Date(patient.birth_date).toLocaleDateString("pt-BR")}</Text>
          <Text>Sexo: {patient.sex ?? "—"}</Text>
          <Text>Emitido em: {new Date().toLocaleDateString("pt-BR")}</Text>
        </View>

        <Text style={styles.sectionTitle}>Evolução — últimas {columns.length} aferições</Text>

        <View style={styles.table}>
          <View style={styles.headerRow}>
            <Text style={styles.labelCell}>Data</Text>
            {computed.map(({ record }, i) => (
              <Text key={i} style={[styles.valueCell, { width: colWidth, fontWeight: 700 }]}>
                {new Date(record.recorded_at).toLocaleDateString("pt-BR")}
              </Text>
            ))}
          </View>

          <MetricRow label="Idade (anos)" values={computed.map((c) => `${c.age}`)} colWidth={colWidth} first />
          <MetricRow label="Peso (kg)" values={computed.map((c) => c.record.weight_kg?.toFixed(1) ?? "—")} colWidth={colWidth} />
          <MetricRow label="Estatura (m)" values={computed.map((c) => c.record.height_m?.toFixed(2) ?? "—")} colWidth={colWidth} />
          <MetricRow
            label="IMC"
            values={computed.map((c) => (c.indices.imc !== null ? `${c.indices.imc}` : "—"))}
            sub={computed.map((c) => c.indices.imcClassification ?? "")}
            colWidth={colWidth}
          />
          <MetricRow
            label="% Gordura"
            values={computed.map((c) => (c.fat ? `${c.fat.bodyFatPct}%` : "—"))}
            sub={computed.map((c) => c.fat?.label ?? "sem dobras suficientes")}
            colWidth={colWidth}
          />
          <MetricRow label="Circunf. cintura (cm)" values={computed.map((c) => c.record.waist_cm?.toFixed(1) ?? "—")} colWidth={colWidth} />
          <MetricRow label="Circunf. quadril (cm)" values={computed.map((c) => c.record.hip_cm?.toFixed(1) ?? "—")} colWidth={colWidth} />
          <MetricRow
            label="RCQ"
            values={computed.map((c) => (c.indices.rcq !== null ? `${c.indices.rcq}` : "—"))}
            sub={computed.map((c) => c.indices.rcqRisk ?? "")}
            colWidth={colWidth}
          />
          {DOBRAS.map(({ key, label }) => {
            const hasAny = computed.some((c) => c.record[key] != null);
            if (!hasAny) return null;
            return (
              <MetricRow
                key={key}
                label={label}
                values={computed.map((c) => {
                  const v = c.record[key] as number | null | undefined;
                  return v != null ? `${v}` : "—";
                })}
                colWidth={colWidth}
              />
            );
          })}
        </View>

        <Text style={styles.footer}>
          {nutritionist.full_name} — CRN {nutritionist.crn}
          {"\n"}Gerado por Protocolo.Pro em {new Date().toLocaleDateString("pt-BR")} — relatório de acompanhamento de
          composição corporal, não substitui avaliação clínica presencial.
        </Text>
      </Page>
    </Document>
  );
}

function MetricRow({
  label,
  values,
  sub,
  colWidth,
  first,
}: {
  label: string;
  values: string[];
  sub?: string[];
  colWidth: string;
  first?: boolean;
}) {
  return (
    <View style={first ? styles.rowFirst : styles.row}>
      <Text style={styles.labelCell}>{label}</Text>
      {values.map((v, i) => (
        <View key={i} style={[styles.valueCell, { width: colWidth }]}>
          <Text>{v}</Text>
          {sub?.[i] ? <Text style={styles.classification}>{sub[i]}</Text> : null}
        </View>
      ))}
    </View>
  );
}
