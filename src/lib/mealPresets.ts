import type { DayMenu, MealSlot, WeeklyMenu } from "./types";

export type MealPresetKey = "gravidez" | "amamentacao" | "hipertrofia" | "emagrecimento";

export interface MealPreset {
  key: MealPresetKey;
  label: string;
  description: string;
  module: "geral" | "esportiva" | "materno_infantil";
  weekly_menu: WeeklyMenu;
  shopping_list: string[];
  guidance: string[];
}

const DAY_ORDER: (keyof WeeklyMenu)[] = ["seg", "ter", "qua", "qui", "sex", "sab", "dom"];

type MealOptions = Record<"cafe_da_manha" | "almoco" | "lanche" | "jantar", MealSlot[]>;

function buildWeek(options: MealOptions): WeeklyMenu {
  const menu: WeeklyMenu = {};
  DAY_ORDER.forEach((day, i) => {
    menu[day] = {
      cafe_da_manha: options.cafe_da_manha[i % options.cafe_da_manha.length],
      lanche_manha: options.lanche[i % options.lanche.length],
      almoco: options.almoco[i % options.almoco.length],
      lanche_tarde: options.lanche[(i + 1) % options.lanche.length],
      jantar: options.jantar[i % options.jantar.length],
    } satisfies DayMenu;
  });
  return menu;
}

export const MEAL_PRESETS: Record<MealPresetKey, MealPreset> = {
  gravidez: {
    key: "gravidez",
    label: "Gravidez",
    module: "materno_infantil",
    description: "Aporte extra de ferro, ácido fólico, cálcio e proteína para a gestação.",
    weekly_menu: buildWeek({
      cafe_da_manha: [
        { descricao: "Pão integral com ovo mexido e mamão", kcal: 380, proteina_g: 18, carboidrato_g: 42, gordura_g: 14 },
        { descricao: "Vitamina de banana com aveia e leite", kcal: 350, proteina_g: 14, carboidrato_g: 48, gordura_g: 9 },
        { descricao: "Tapioca com queijo branco e suco de laranja", kcal: 400, proteina_g: 16, carboidrato_g: 52, gordura_g: 12 },
      ],
      almoco: [
        { descricao: "Arroz integral, feijão, patinho grelhado, brócolis e cenoura", kcal: 620, proteina_g: 38, carboidrato_g: 65, gordura_g: 18 },
        { descricao: "Arroz, lentilha, frango grelhado e salada de folhas verdes", kcal: 590, proteina_g: 40, carboidrato_g: 60, gordura_g: 14 },
        { descricao: "Purê de batata-doce, filé de peixe e couve refogada", kcal: 560, proteina_g: 36, carboidrato_g: 55, gordura_g: 16 },
      ],
      lanche: [
        { descricao: "Iogurte natural com granola e morango", kcal: 240, proteina_g: 10, carboidrato_g: 32, gordura_g: 6 },
        { descricao: "Castanhas (mix) e uma fruta", kcal: 220, proteina_g: 6, carboidrato_g: 24, gordura_g: 12 },
      ],
      jantar: [
        { descricao: "Sopa de legumes com carne moída e torrada integral", kcal: 480, proteina_g: 28, carboidrato_g: 45, gordura_g: 14 },
        { descricao: "Omelete de espinafre com queijo e salada", kcal: 420, proteina_g: 26, carboidrato_g: 18, gordura_g: 24 },
        { descricao: "Frango desfiado com abóbora e arroz integral", kcal: 500, proteina_g: 34, carboidrato_g: 48, gordura_g: 15 },
      ],
    }),
    shopping_list: [
      "Ovos", "Pão integral", "Mamão", "Aveia em flocos", "Leite", "Tapioca (goma)",
      "Queijo branco", "Laranja", "Arroz integral", "Feijão", "Lentilha", "Patinho (carne)",
      "Peito de frango", "Filé de peixe", "Brócolis", "Cenoura", "Couve", "Batata-doce",
      "Iogurte natural", "Granola", "Morango", "Castanhas variadas", "Espinafre",
      "Abóbora", "Carne moída (magra)",
    ],
    guidance: [
      "Priorizar alimentos fonte de ácido fólico (folhas verde-escuras, feijão, lentilha).",
      "Garantir ingestão adequada de ferro (carnes vermelhas magras, feijão) associado à vitamina C.",
      "Manter hidratação de ao menos 2 a 2,5 L de água por dia.",
      "Evitar embutidos, peixes de alto teor de mercúrio e álcool.",
      "Fracionar as refeições para reduzir enjoo e refluxo.",
    ],
  },

  amamentacao: {
    key: "amamentacao",
    label: "Amamentação",
    module: "materno_infantil",
    description: "Calorias e líquidos extras para sustentar a produção de leite.",
    weekly_menu: buildWeek({
      cafe_da_manha: [
        { descricao: "Mingau de aveia com banana e canela", kcal: 420, proteina_g: 14, carboidrato_g: 62, gordura_g: 10 },
        { descricao: "Pão integral, queijo, ovo e suco natural", kcal: 450, proteina_g: 22, carboidrato_g: 48, gordura_g: 16 },
        { descricao: "Tapioca com frango desfiado e água de coco", kcal: 440, proteina_g: 24, carboidrato_g: 50, gordura_g: 12 },
      ],
      almoco: [
        { descricao: "Arroz, feijão, carne assada, abobrinha e salada", kcal: 680, proteina_g: 42, carboidrato_g: 68, gordura_g: 20 },
        { descricao: "Macarrão integral com frango e molho de tomate caseiro", kcal: 650, proteina_g: 38, carboidrato_g: 72, gordura_g: 16 },
        { descricao: "Arroz, grão-de-bico, peixe grelhado e legumes", kcal: 620, proteina_g: 40, carboidrato_g: 60, gordura_g: 18 },
      ],
      lanche: [
        { descricao: "Vitamina de frutas com leite e aveia", kcal: 300, proteina_g: 12, carboidrato_g: 42, gordura_g: 8 },
        { descricao: "Sanduíche natural de atum", kcal: 320, proteina_g: 20, carboidrato_g: 34, gordura_g: 10 },
      ],
      jantar: [
        { descricao: "Sopa de mandioquinha com frango desfiado", kcal: 500, proteina_g: 30, carboidrato_g: 50, gordura_g: 14 },
        { descricao: "Arroz, ovo, feijão e couve refogada", kcal: 540, proteina_g: 24, carboidrato_g: 62, gordura_g: 16 },
        { descricao: "Panqueca de frango com salada verde", kcal: 480, proteina_g: 32, carboidrato_g: 38, gordura_g: 18 },
      ],
    }),
    shopping_list: [
      "Aveia em flocos", "Banana", "Canela", "Pão integral", "Queijo", "Ovos",
      "Água de coco", "Frango (peito)", "Arroz", "Feijão", "Carne para assar",
      "Abobrinha", "Macarrão integral", "Molho de tomate", "Grão-de-bico", "Filé de peixe",
      "Leite", "Atum em lata", "Mandioquinha", "Couve", "Farinha para panqueca",
      "Folhas verdes (salada)",
    ],
    guidance: [
      "Aumentar a ingestão calórica em cerca de 400 a 500 kcal/dia em relação ao pré-gestacional.",
      "Beber água antes, durante e depois de cada mamada — meta de 3 a 3,5 L/dia.",
      "Manter boa oferta de cálcio (laticínios) e proteína em todas as refeições.",
      "Evitar dietas restritivas de emagrecimento neste período.",
      "Observar sensibilidade do bebê a alimentos como cafeína, cítricos e leite de vaca.",
    ],
  },

  hipertrofia: {
    key: "hipertrofia",
    label: "Hipertrofia",
    module: "esportiva",
    description: "Superávit calórico moderado com alta ingestão de proteína para ganho de massa magra.",
    weekly_menu: buildWeek({
      cafe_da_manha: [
        { descricao: "Ovos mexidos (3), aveia e banana", kcal: 520, proteina_g: 32, carboidrato_g: 58, gordura_g: 16 },
        { descricao: "Whey protein, pasta de amendoim e pão integral", kcal: 540, proteina_g: 38, carboidrato_g: 50, gordura_g: 18 },
        { descricao: "Tapioca com frango, queijo e suco de frutas", kcal: 500, proteina_g: 34, carboidrato_g: 56, gordura_g: 14 },
      ],
      almoco: [
        { descricao: "Arroz, feijão, patinho grelhado (200g) e batata-doce", kcal: 780, proteina_g: 55, carboidrato_g: 80, gordura_g: 20 },
        { descricao: "Arroz, frango grelhado (200g), brócolis e azeite", kcal: 750, proteina_g: 58, carboidrato_g: 70, gordura_g: 22 },
        { descricao: "Macarrão, carne moída, salada e queijo ralado", kcal: 800, proteina_g: 50, carboidrato_g: 85, gordura_g: 24 },
      ],
      lanche: [
        { descricao: "Whey protein com banana e aveia", kcal: 360, proteina_g: 30, carboidrato_g: 42, gordura_g: 8 },
        { descricao: "Iogurte grego, granola e castanhas", kcal: 340, proteina_g: 22, carboidrato_g: 30, gordura_g: 14 },
      ],
      jantar: [
        { descricao: "Arroz, ovo, filé de peixe e legumes refogados", kcal: 620, proteina_g: 42, carboidrato_g: 55, gordura_g: 18 },
        { descricao: "Batata-doce, frango desfiado e salada com azeite", kcal: 600, proteina_g: 45, carboidrato_g: 50, gordura_g: 16 },
        { descricao: "Panqueca de carne moída com queijo e salada", kcal: 640, proteina_g: 48, carboidrato_g: 40, gordura_g: 24 },
      ],
    }),
    shopping_list: [
      "Ovos", "Aveia em flocos", "Banana", "Whey protein", "Pasta de amendoim",
      "Pão integral", "Tapioca (goma)", "Peito de frango", "Queijo", "Arroz",
      "Feijão", "Patinho (carne)", "Batata-doce", "Brócolis", "Azeite de oliva",
      "Macarrão", "Carne moída", "Queijo ralado", "Iogurte grego", "Granola",
      "Castanhas variadas", "Filé de peixe", "Legumes variados (cenoura, abobrinha)",
    ],
    guidance: [
      "Manter ingestão proteica entre 1,8 e 2,2 g/kg de peso corporal por dia.",
      "Distribuir a proteína em todas as refeições, priorizando pós-treino.",
      "Superávit calórico moderado (~300 a 500 kcal acima da manutenção).",
      "Priorizar carboidratos complexos ao redor do treino para desempenho e recuperação.",
      "Hidratação adequada (35 ml/kg/dia) e sono de qualidade para recuperação muscular.",
    ],
  },

  emagrecimento: {
    key: "emagrecimento",
    label: "Emagrecimento",
    module: "geral",
    description: "Déficit calórico controlado, rico em fibras e proteína para preservar massa magra.",
    weekly_menu: buildWeek({
      cafe_da_manha: [
        { descricao: "Omelete de 2 ovos com espinafre e chá verde", kcal: 260, proteina_g: 18, carboidrato_g: 6, gordura_g: 18 },
        { descricao: "Iogurte natural com chia e morango", kcal: 220, proteina_g: 14, carboidrato_g: 24, gordura_g: 8 },
        { descricao: "Pão integral (1 fatia) com ricota e tomate", kcal: 240, proteina_g: 14, carboidrato_g: 26, gordura_g: 8 },
      ],
      almoco: [
        { descricao: "Filé de frango grelhado, salada crua e arroz integral (2 col.)", kcal: 420, proteina_g: 38, carboidrato_g: 35, gordura_g: 12 },
        { descricao: "Peixe grelhado, legumes no vapor e quinoa", kcal: 400, proteina_g: 36, carboidrato_g: 32, gordura_g: 12 },
        { descricao: "Patinho grelhado, abobrinha refogada e feijão (concha)", kcal: 440, proteina_g: 40, carboidrato_g: 30, gordura_g: 14 },
      ],
      lanche: [
        { descricao: "Maçã com canela e um punhado de castanhas", kcal: 160, proteina_g: 3, carboidrato_g: 22, gordura_g: 7 },
        { descricao: "Iogurte natural desnatado", kcal: 100, proteina_g: 9, carboidrato_g: 10, gordura_g: 2 },
      ],
      jantar: [
        { descricao: "Sopa de legumes com frango desfiado", kcal: 320, proteina_g: 26, carboidrato_g: 30, gordura_g: 8 },
        { descricao: "Omelete de claras com salada verde", kcal: 260, proteina_g: 24, carboidrato_g: 8, gordura_g: 12 },
        { descricao: "Peixe grelhado com legumes assados", kcal: 340, proteina_g: 32, carboidrato_g: 20, gordura_g: 12 },
      ],
    }),
    shopping_list: [
      "Ovos", "Espinafre", "Chá verde", "Iogurte natural desnatado", "Chia",
      "Morango", "Pão integral", "Ricota", "Tomate", "Peito de frango",
      "Alface e folhas para salada", "Arroz integral", "Filé de peixe", "Quinoa",
      "Legumes variados (vapor)", "Patinho (carne)", "Abobrinha", "Feijão",
      "Maçã", "Canela", "Castanhas variadas",
    ],
    guidance: [
      "Déficit calórico moderado (300 a 500 kcal/dia abaixo da manutenção) para perda gradual e sustentável.",
      "Priorizar proteína magra em todas as refeições para preservar massa muscular.",
      "Aumentar fibras (vegetais, folhas, frutas com casca) para saciedade.",
      "Evitar açúcar refinado, frituras e bebidas calóricas.",
      "Beber água antes das refeições e manter atividade física regular associada.",
    ],
  },
};

export const MEAL_PRESET_LIST: MealPreset[] = Object.values(MEAL_PRESETS);
