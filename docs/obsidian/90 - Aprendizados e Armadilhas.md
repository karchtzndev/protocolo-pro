---
tags: [protocolo-pro, aprendizados, armadilhas, lessons-learned]
---

# Aprendizados e Armadilhas

← [[00 - MOC Protocolo.Pro]]

Registro do que já custou tempo — para não custar de novo.

## Deploy serverless (Vercel)

**Metade dos commits de correção do projeto foram build/deploy, não lógica.** Ver [[70 - Histórico de Versões]].

1. **Stripe inicializado no topo do módulo quebra o build** (v2). Client de SDK que lê env var em tempo de import roda durante o build, onde a env var pode não existir. → Inicializar preguiçosamente.
2. **Fontes do pdfkit somem do bundle serverless** (v5→v7, três commits). `@react-pdf/renderer` depende de arquivos de fonte que o bundler não rastreia. Foi preciso forçar a inclusão — ver `next.config.ts`.
3. **Import do Dexie quebra o build** (`522f87a`). Biblioteca só-de-browser importada em caminho que o servidor avalia.

→ **Regra geral**: toda dependência que toca browser-only, filesystem ou env var em tempo de import é candidata a quebrar em serverless. Verificar antes de dar deploy.

## Fornecedores mudam a API embaixo de você

**Stripe descontinuou a Accounts API v1** e o onboarding do Connect teve que ser reescrito (v13). A adaptação ficou isolada em `src/lib/stripeAccountsV2.ts` — isolar integração volátil em arquivo próprio valeu a pena.

## Atrito de UI é o que mais gera retrabalho

v19, v20 e v21 são três versões seguidas só de **reduzir digitação no editor de protocolo**: limpar refeição de uma vez, autopreencher peso/altura/cintura, autopreencher gramatura pela porção usual. Nenhuma adicionou funcionalidade nova.

→ A tela usada todo dia merece investimento em autopreenchimento desde o começo.

## Detalhe pequeno, efeito visível

`short_name` do PWA cortado no meio da palavra (v18). Corte de string precisa respeitar limite de palavra.

## Automação precisa saber desligar

O melhor padrão do código: [[40 - Segurança Clínica]] — 6 sinalizadores que **bloqueiam** a geração automática, e piso calórico que faz o motor recusar gerar. A automação tem freio embutido no domínio, não só aviso na tela.

Mesma ideia em `energyEquations.ts`: equações indisponíveis retornam `available: false` + **motivo**, em vez de sumir da lista. O usuário entende por que não pode.

## Documentação apodrece rápido

O `README.md` ainda diz que o código **"nunca foi compilado nem rodado"** e descreve uma estrutura de pastas muito menor que a real (não menciona CRM, financeiro, equipe, receitas, agendamentos, broadcast, PWA, offline). Também lista como pendentes três coisas que já existem — ver [[80 - Pendências e Decisões Abertas]].

→ Em 4 dias de desenvolvimento intenso o README ficou obsoleto. **Vale reescrever.**

## Ver também
- [[80 - Pendências e Decisões Abertas]]
- [[10 - Arquitetura e Stack]]
