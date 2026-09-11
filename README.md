# Protocolo.Pro

Plataforma de prescrição nutricional — Next.js 15 (App Router) + React 19 + Supabase + Tailwind CSS v4 + Stripe.

## Status

Este é o código real da aplicação (não é mais o protótipo estático). Ele foi
escrito **sem Node.js instalado na máquina onde foi gerado**, então nunca foi
compilado nem rodado — trate a primeira `npm run dev` como o primeiro teste
real, não como confirmação de que já funciona.

## 1. Pré-requisitos

- Node.js 20+ e npm — https://nodejs.org
- Uma conta em https://supabase.com (grátis para começar)
- Uma conta em https://stripe.com (modo teste é suficiente para desenvolver)
- Conta na Vercel para o deploy final (opcional nesta fase)

## 2. Instalar dependências

```bash
npm install
```

## 3. Criar e configurar o projeto Supabase

Este projeto já está configurado e testado contra um Supabase real
(`protocolopro`, região `sa-east-1`) — os passos abaixo documentam como
refazer isso do zero, caso precise recriar em outra conta/projeto.

1. Crie um novo projeto em supabase.com.
2. Rode as migrations de `supabase/migrations/` (em ordem: `0001_init.sql`,
   depois `0002_signup_trigger.sql`). Duas formas:
   - **Manual**: cole o conteúdo de cada arquivo no **SQL Editor** do painel e rode.
   - **Via script** (mais rápido se for repetir isso): em **Project Settings → Database**,
     copie a *connection string* (modo "Session pooler" costuma funcionar melhor que a conexão direta) e rode:
     ```bash
     $env:SUPABASE_DB_URL = "postgresql://postgres.<ref>:<senha>@aws-0-<regiao>.pooler.supabase.com:5432/postgres"
     node scripts/run-migrations.mjs
     node scripts/create-storage-bucket.mjs
     ```
3. Se preferir fazer manualmente: em **Storage**, crie um bucket público chamado `exams`.
4. Em **Project Settings → API**, copie a **Project URL** e as chaves (o painel novo do Supabase
   chama de "Publishable key" e "Secret key" — equivalentes a anon/service_role) para `.env.local`
   (copie `.env.example`).

O catálogo de suplementos vem com 12 itens de exemplo — adicione os
restantes até completar os 35 pela tabela `supplements_catalog` no painel do
Supabase ou por uma migração nova.

## 4. Configurar o Stripe

1. Crie um produto "Plano Profissional" com um preço recorrente mensal.
2. Copie o `price_id` para `NEXT_PUBLIC_STRIPE_PRICE_ID`.
3. Copie a chave secreta para `STRIPE_SECRET_KEY`.
4. Rode `stripe listen --forward-to localhost:3000/api/stripe/webhook` durante o desenvolvimento e copie o `whsec_...` gerado para `STRIPE_WEBHOOK_SECRET`.

## 5. Rodar localmente

```bash
cp .env.example .env.local   # preencha com os valores acima
npm run dev
```

Acesse `http://localhost:3000/signup` para criar a primeira conta de
nutricionista. Por padrão o Supabase exige confirmação por e-mail antes de
liberar a sessão — depois de se cadastrar, confira sua caixa de entrada e
clique no link (ele volta para `/auth/callback`, que já está implementado).
Se quiser pular isso durante o desenvolvimento, desative "Confirm email" em
**Authentication → Sign In / Providers → Email** no painel do Supabase.

## Estrutura

```
src/
  app/
    login/, signup/            área pública de autenticação do nutricionista
    (app)/                     área logada — layout com sidebar
      dashboard/
      pacientes/[id]/          ficha do paciente com as 4 abas
      configuracoes/
      links/
    p/[slug]/                  área pública do paciente (consentimento → PIN → visão geral)
    api/
      stripe/                  checkout, portal do cliente, webhook
      pdf/                     geração de PDF (protocolo e suplementação) via @react-pdf/renderer
      exams/extract/           upload de exame + extração de resultados
  components/ui/                Button, Card, Badge, Tabs — o design system em código
  lib/
    supabase/                  clients de browser, server e service-role
    stripe.ts
    pdf/                       documentos React-PDF
    exams/extract.ts           ponto de integração com OCR (ver abaixo)
supabase/migrations/            schema SQL
```

## O que ainda precisa de uma decisão sua

- **OCR dos exames** (`src/lib/exams/extract.ts`): ainda não há um provedor
  real conectado. O fluxo de upload → tabela de resultados → destaque de
  valores fora da faixa já funciona ponta a ponta com dados de exemplo, mas
  para ler PDFs/fotos de exames de verdade você precisa plugar um provedor de
  OCR (AWS Textract, Google Document AI, ou visão da própria Anthropic).
- **Log de atividades do dashboard**: os itens em "Últimas ações" ainda são
  fixos — não existe tabela de auditoria ainda. Se quiser esse histórico de
  verdade, precisamos criar uma tabela `activity_log` e registrar eventos nas
  server actions.
- **Cardápio semanal e prescrição de suplementos**: hoje só existem as
  consultas de leitura. Falta a tela de edição do `weekly_menu` (jsonb) e de
  atribuição de suplementos a um paciente — a UI de leitura já está pronta
  para receber esses dados assim que as telas de criação existirem.
- **CRN e verificação de identidade do paciente**: o PIN usa mês+dia de
  nascimento (4 dígitos). Avalie se isso é suficiente para o seu caso de uso
  ou se prefere um PIN numérico independente.
