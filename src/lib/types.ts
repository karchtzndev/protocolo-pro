export type MealSlot = {
  descricao: string;
  kcal: number;
  proteina_g?: number;
  carboidrato_g?: number;
  gordura_g?: number;
};

export type DayMenu = {
  cafe_da_manha?: MealSlot;
  lanche_manha?: MealSlot;
  almoco?: MealSlot;
  lanche_tarde?: MealSlot;
  jantar?: MealSlot;
};

export const MEAL_SCHEDULE: { key: keyof DayMenu; label: string; time: string; pctOfDay: number }[] = [
  { key: "cafe_da_manha", label: "Café da manhã", time: "07:00", pctOfDay: 0.22 },
  { key: "lanche_manha", label: "Lanche da manhã", time: "10:00", pctOfDay: 0.08 },
  { key: "almoco", label: "Almoço", time: "12:30", pctOfDay: 0.32 },
  { key: "lanche_tarde", label: "Lanche da tarde", time: "16:00", pctOfDay: 0.1 },
  { key: "jantar", label: "Jantar", time: "19:30", pctOfDay: 0.28 },
];

export type WeeklyMenu = Partial<
  Record<"seg" | "ter" | "qua" | "qui" | "sex" | "sab" | "dom", DayMenu>
>;

export type PatientStatus = "ativo" | "pendente" | "inativo";

export interface Nutritionist {
  id: string;
  full_name: string;
  crn: string;
  clinic_name: string | null;
  clinic_phone: string | null;
  brand_primary_color: string;
  brand_accent_color: string;
  logo_url: string | null;
  consent_document_url: string | null;
  privacy_document_url: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: "trialing" | "active" | "past_due" | "canceled";
  plan: "solo" | "clinica";
  booking_slug: string | null;
  stripe_connect_account_id: string | null;
  stripe_connect_onboarded: boolean;
  enabled_modules: NutritionModule[];
  created_at: string;
}

export type NutritionModule = "esportiva" | "materno_infantil" | "clinico";

export interface FormulaIngredient {
  name: string;
  dose: number;
  unit: string;
}

export interface SubstanceInteraction {
  id: string;
  substance_a: string;
  substance_b: string;
  severity: "leve" | "moderada" | "grave";
  description: string;
}

export interface CompoundedFormula {
  id: string;
  nutritionist_id: string;
  patient_id: string;
  name: string;
  ingredients: FormulaIngredient[];
  interaction_warnings: string[];
  created_at: string;
}

export interface SubscriptionPlan {
  id: string;
  nutritionist_id: string;
  name: string;
  description: string | null;
  price_cents: number;
  interval: "month" | "quarter";
  stripe_product_id: string | null;
  stripe_price_id: string | null;
  active: boolean;
  created_at: string;
}

export type PatientSubscriptionStatus = "incomplete" | "trialing" | "active" | "past_due" | "canceled";

export interface PatientSubscription {
  id: string;
  patient_id: string;
  plan_id: string;
  nutritionist_id: string;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  status: PatientSubscriptionStatus;
  current_period_end: string | null;
  created_at: string;
  plan?: SubscriptionPlan;
}

export interface CrmStage {
  id: string;
  nutritionist_id: string;
  key: string;
  label: string;
  position: number;
  color: "neutral" | "success" | "warning" | "danger";
  created_at: string;
}

export interface Broadcast {
  id: string;
  nutritionist_id: string;
  title: string;
  body: string;
  filter_tags: string[];
  recipient_count: number;
  sent_at: string;
}

export type ClinicalFlag =
  | "gestante_lactante"
  | "doenca_renal_hepatica_cardiaca"
  | "diabetes_insulina"
  | "cirurgia_bariatrica"
  | "transtorno_alimentar";

export interface Patient {
  id: string;
  nutritionist_id: string;
  full_name: string;
  birth_date: string;
  sex: "feminino" | "masculino" | "outro" | null;
  phone: string | null;
  email: string | null;
  objective: string | null;
  restrictions: string[];
  clinical_history: string | null;
  clinical_flags: ClinicalFlag[];
  status: PatientStatus;
  stage_id: string | null;
  tags: string[];
  created_at: string;
}

export interface Protocol {
  id: string;
  patient_id: string;
  weight_kg: number | null;
  height_m: number | null;
  body_fat_pct: number | null;
  waist_cm: number | null;
  weekly_menu: WeeklyMenu;
  shopping_list: string[];
  guidance: string[];
  active: boolean;
  is_draft: boolean;
  created_at: string;
}

export type FoodCategory =
  | "cereais_e_paes"
  | "leguminosas"
  | "carnes_e_ovos"
  | "laticinios"
  | "frutas"
  | "vegetais"
  | "tuberculos"
  | "gorduras_e_oleaginosas"
  | "bebidas_e_outros";

export interface FoodCatalogItem {
  id: string;
  name: string;
  category: FoodCategory;
  kcal_100g: number;
  protein_100g: number;
  carb_100g: number;
  fat_100g: number;
  usual_portion_g: number;
  usual_portion_label: string;
}

export interface AnthropometryRecord {
  id: string;
  patient_id: string;
  recorded_at: string;
  activity_level: "sedentario" | "leve" | "moderado" | "ativo" | "muito_ativo";
  weight_kg: number;
  height_m: number;
  lean_mass_kg: number | null;
  neck_cm: number | null;
  waist_cm: number | null;
  hip_cm: number | null;
  skinfold_chest_mm: number | null;
  skinfold_midaxillary_mm: number | null;
  skinfold_triceps_mm: number | null;
  skinfold_subscapular_mm: number | null;
  skinfold_abdominal_mm: number | null;
  skinfold_suprailiac_mm: number | null;
  skinfold_thigh_mm: number | null;
  skinfold_bicep_mm: number | null;
  notes: string | null;
  created_at: string;
}

export type CfnCategory =
  | "vitaminas_e_minerais"
  | "bioativos_enzimas_probioticos"
  | "novos_alimentos_e_apicolas"
  | "alegacao_funcional"
  | "uso_esportivo"
  | "gestantes_e_nutrizes"
  | "medicamento_isento_prescricao";

export type EvidenceLevel = "alta" | "moderada" | "baixa" | "insuficiente";

export interface SupplementCatalogItem {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  max_daily_dose: number | null;
  dose_unit: string | null;
  default_dose: number | null;
  cfn_category: CfnCategory | null;
  evidence_level: EvidenceLevel | null;
  requires_fitoterapia_license: boolean;
}

export interface PatientSupplement {
  id: string;
  patient_id: string;
  supplement_id: string;
  dose: number;
  dose_unit: string;
  schedule: string;
  justification: string | null;
  signed_at: string | null;
  signed_by: string | null;
  created_at: string;
  supplement?: SupplementCatalogItem;
}

export interface SupplementPreset {
  id: string;
  name: string;
  description: string | null;
}

export interface SupplementPresetItem {
  id: string;
  preset_id: string;
  supplement_id: string;
  dose: number;
  dose_unit: string;
  schedule: string;
  supplement?: SupplementCatalogItem;
}

export interface Exam {
  id: string;
  patient_id: string;
  file_url: string;
  exam_date: string | null;
  status: "processando" | "concluido" | "erro";
  created_at: string;
}

export interface ExamResult {
  id: string;
  exam_id: string;
  test_name: string;
  result_value: string;
  reference_range: string | null;
  out_of_range: boolean;
  metodo_extracao: "texto_pdf" | "ia_visao" | null;
  confirmed: boolean;
}

export interface PatientLink {
  id: string;
  patient_id: string;
  slug: string;
  pin_last4_birthdate: string;
  expires_at: string | null;
  revoked_at: string | null;
  consent_accepted_at: string | null;
  created_at: string;
}

export interface Appointment {
  id: string;
  patient_id: string;
  nutritionist_id: string;
  scheduled_at: string;
  status: "agendado" | "concluido" | "cancelado";
  notes: string | null;
  created_at: string;
}

export interface AnamnesisResponses {
  alimentos_habituais?: string[];
  alimentos_intolerancia?: string[];
  habitos_alimentares?: string;
  historico_familiar?: string;
  atividade_fisica?: string;
  qualidade_sono?: string;
  uso_medicamentos?: string;
  alergias_intolerancias?: string;
  tabagismo_alcool?: string;
  observacoes?: string;
}

export interface AnamnesisResponse {
  id: string;
  patient_id: string;
  appointment_id: string | null;
  status: "pendente" | "preenchido";
  responses: AnamnesisResponses;
  submitted_at: string | null;
  created_at: string;
}

export interface AuditLogEntry {
  id: string;
  nutritionist_id: string;
  action_type: string;
  target_type: string | null;
  target_id: string | null;
  ip_truncated: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AccountDeletionRequest {
  id: string;
  nutritionist_id: string;
  requested_at: string;
  status: "pendente" | "cancelada" | "concluida";
  cancelled_at: string | null;
}

// Placeholder mínimo do tipo gerado pelo Supabase CLI.
// Substitua por `npx supabase gen types typescript --project-id <id>` quando
// o projeto Supabase estiver criado — isso dá autocomplete e checagem de
// tipos completos nas queries.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any;
