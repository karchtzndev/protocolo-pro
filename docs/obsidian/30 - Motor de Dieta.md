---
tags: [protocolo-pro, dominio, nutricao, algoritmo]
---

# Motor de Dieta

← [[00 - MOC Protocolo.Pro]]

Código: `src/lib/diet/generateProtocol.ts` + `src/lib/health/energyEquations.ts`

## Pipeline

1. **Gasto energético** — 4 equações (`energyEquations.ts`):
   - Mifflin-St Jeor (padrão)
   - Harris-Benedict revisado (Roza & Shizgal, 1984)
   - Cunningham `500 + 22 × MLG` — exige massa magra
   - Katch-McArdle `370 + 21,6 × MLG` — exige massa magra

   Fatores de atividade: sedentário 1,2 · leve 1,375 · moderado 1,55 · ativo 1,725 · muito ativo 1,9.
   As duas últimas retornam `available: false` + `unavailableReason` quando não há massa magra — a UI mostra por que a opção está desabilitada em vez de sumir com ela. **Bom padrão.**

2. **Ajuste por objetivo**
   | Objetivo | Δ kcal | Proteína | Gordura |
   |---|---|---|---|
   | Emagrecimento | −500 | 2,0 g/kg | 25% kcal |
   | Hipertrofia | +400 | 2,0 g/kg | 25% kcal |
   | Manutenção | 0 | 1,6 g/kg | 27% kcal |

3. **Piso calórico de segurança** — o motor **se recusa** a gerar abaixo de 1500 kcal (masculino) / 1200 kcal (feminino). Guard-rail clínico embutido no algoritmo, não só na UI.

4. **Distribuição por refeição** (`MEAL_SCHEDULE` em `types.ts`):
   café 22% (07:00) · lanche manhã 8% (10:00) · almoço 32% (12:30) · lanche tarde 10% (16:00) · jantar 28% (19:30)

5. **Montagem por categoria** — cada refeição tem um `MEAL_TEMPLATE` com shares por categoria de alimento (ex.: almoço = 25% cereais, 15% leguminosas, 35% carnes/ovos, 25% vegetais), puxando do `foods_catalog`.

6. **Saídas derivadas** — lista de compras (`shoppingList.ts`), equivalentes/substituições (`equivalents.ts`), macros por refeição (`mealMacros.ts`).

## Inferência de objetivo

`clinicalScreening.ts → inferObjectiveFromText()` lê o campo livre de objetivo do paciente por regex (`/emagrec|perda de peso|déficit/` etc.) e pré-seleciona. Falha para manutenção por padrão — escolha segura.

## Ver também
- [[40 - Segurança Clínica]] — o que **bloqueia** a geração automática
- [[20 - Modelo de Dados]]
