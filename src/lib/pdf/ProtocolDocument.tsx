import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { Patient, Protocol, Nutritionist, FoodCatalogItem } from "@/lib/types";
import { MEAL_SCHEDULE } from "@/lib/types";
import { findEquivalents } from "@/lib/diet/equivalents";

const ITEM_PATTERN = /^(.+?)\s*\((\d+(?:\.\d+)?)\s*g\)$/;

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: "Helvetica", color: "#1B211D" },
  header: { marginBottom: 18, borderBottom: "2px solid #1F4B3F", paddingBottom: 10 },
  clinic: { fontSize: 9, color: "#5B6259" },
  title: { fontSize: 18, fontWeight: 700, marginTop: 2 },
  sectionTitle: { fontSize: 12, fontWeight: 700, marginTop: 16, marginBottom: 6, color: "#1F4B3F" },
  row: { flexDirection: "row", gap: 8, marginBottom: 8 },
  tile: { flex: 1, border: "1px solid #DEDACC", borderRadius: 6, padding: 6, textAlign: "center" },
  tileValue: { fontSize: 12, fontWeight: 700 },
  tileLabel: { fontSize: 7, color: "#5B6259", marginTop: 2 },
  dayBlock: { marginBottom: 8, border: "1px solid #E9E5D8", borderRadius: 6, padding: 8 },
  dayName: { fontSize: 10, fontWeight: 700, marginBottom: 4, textTransform: "uppercase" },
  meal: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
  shoppingGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  shoppingItem: { fontSize: 9, width: "31%" },
  equivRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 },
  footer: { marginTop: 24, fontSize: 8, color: "#8A9088", textAlign: "center" },
  watermark: {
    position: "absolute",
    top: 320,
    left: 90,
    fontSize: 72,
    color: "#1F4B3F",
    opacity: 0.12,
    transform: "rotate(-30deg)",
  },
});

const DAY_LABELS: Record<string, string> = {
  seg: "Segunda", ter: "Terça", qua: "Quarta", qui: "Quinta", sex: "Sexta", sab: "Sábado", dom: "Domingo",
};

export function ProtocolDocument({
  patient,
  protocol,
  nutritionist,
  foods = [],
}: {
  patient: Patient;
  protocol: Protocol | null;
  nutritionist: Nutritionist;
  foods?: FoodCatalogItem[];
}) {
  const imc =
    protocol?.weight_kg && protocol?.height_m
      ? (protocol.weight_kg / (protocol.height_m * protocol.height_m)).toFixed(1)
      : "—";

  const equivalents = protocol ? buildEquivalenceRows(protocol, foods) : [];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {protocol?.is_draft && <Text style={styles.watermark}>RASCUNHO</Text>}

        <View style={styles.header}>
          <Text style={styles.clinic}>{nutritionist.clinic_name ?? nutritionist.full_name} · {nutritionist.clinic_phone ?? ""}</Text>
          <Text style={styles.title}>Protocolo alimentar — {patient.full_name}</Text>
        </View>

        {protocol && (
          <>
            <Text style={styles.sectionTitle}>Antropometria</Text>
            <View style={styles.row}>
              <Tile value={protocol.weight_kg ? `${protocol.weight_kg} kg` : "—"} label="Peso" />
              <Tile value={protocol.height_m ? `${protocol.height_m} m` : "—"} label="Altura" />
              <Tile value={imc} label="IMC" />
              <Tile value={protocol.body_fat_pct ? `${protocol.body_fat_pct}%` : "—"} label="Gordura" />
              <Tile value={protocol.waist_cm ? `${protocol.waist_cm} cm` : "—"} label="Cintura" />
            </View>

            <Text style={styles.sectionTitle}>Cardápio — 7 dias</Text>
            {Object.entries(protocol.weekly_menu).map(([dayKey, menu]) => (
              <View key={dayKey} style={styles.dayBlock} wrap={false}>
                <Text style={styles.dayName}>{DAY_LABELS[dayKey] ?? dayKey}</Text>
                {MEAL_SCHEDULE.map(({ key: mealKey, label }) => {
                  const meal = menu?.[mealKey];
                  if (!meal) return null;
                  return (
                    <View key={mealKey} style={styles.meal}>
                      <Text>{label}: {meal.descricao}</Text>
                      <Text>{meal.kcal} kcal</Text>
                    </View>
                  );
                })}
              </View>
            ))}

            <Text style={styles.sectionTitle}>Lista de compras</Text>
            <View style={styles.shoppingGrid}>
              {protocol.shopping_list.map((item) => (
                <Text key={item} style={styles.shoppingItem}>• {item}</Text>
              ))}
            </View>

            {protocol.guidance.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Orientações</Text>
                {protocol.guidance.map((g) => (
                  <Text key={g} style={styles.shoppingItem}>• {g}</Text>
                ))}
              </>
            )}

            {equivalents.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Tabela de equivalências rápidas</Text>
                {equivalents.map(({ reference, rows }) => (
                  <View key={reference} style={styles.dayBlock} wrap={false}>
                    <Text style={styles.dayName}>{reference}</Text>
                    {rows.map((r) => (
                      <View key={r.food.id} style={styles.equivRow}>
                        <Text>{r.food.name}</Text>
                        <Text>{r.gramsForSameKcal} g</Text>
                      </View>
                    ))}
                  </View>
                ))}
              </>
            )}
          </>
        )}

        <Text style={styles.footer}>
          {nutritionist.full_name} — CRN {nutritionist.crn}{"\n"}
          Gerado por Protocolo.Pro em {new Date().toLocaleDateString("pt-BR")} — documento de uso pessoal do paciente.
        </Text>
      </Page>
    </Document>
  );
}

/** Extrai até 4 alimentos únicos usados no cardápio e monta equivalências para cada um. */
function buildEquivalenceRows(protocol: Protocol, foods: FoodCatalogItem[]) {
  if (!foods.length) return [];

  const seen = new Map<string, { food: FoodCatalogItem; grams: number }>();
  for (const day of Object.values(protocol.weekly_menu)) {
    if (!day) continue;
    for (const meal of Object.values(day)) {
      if (!meal?.descricao) continue;
      for (const part of meal.descricao.split("+")) {
        const match = ITEM_PATTERN.exec(part.trim());
        if (!match) continue;
        const [, name, grams] = match;
        if (seen.has(name)) continue;
        const food = foods.find((f) => f.name === name);
        if (food) seen.set(name, { food, grams: Number(grams) });
      }
    }
  }

  return Array.from(seen.values())
    .slice(0, 4)
    .map(({ food, grams }) => ({
      reference: `${food.name} (${grams} g)`,
      rows: findEquivalents(food, foods, grams, 3),
    }));
}

function Tile({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileValue}>{value}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
    </View>
  );
}
