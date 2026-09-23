# 🍢 Cumad's Grill — PWA

Site de pedidos, painel gerencial e TV de chamada do **Cumad's Grill**.
É o mesmo sistema do *O Markin* (karchtzndev/Marcos) — mesmas telas e funções —
com o visual do cardápio do Cumad's e o banco trocado de Firebase para **Supabase**.

| App | Caminho | Para quem |
|---|---|---|
| 🛍️ Cliente | `/` | cardápio, carrinho, pedido, acompanhamento |
| 📊 Gerencial | `/gerencial/` | equipe: pedidos, cozinha, caixa, cardápio, relatórios |
| 📺 Chamada | `/chamada/` | TV da loja: números chamados com som |

## Como funciona o banco

O front foi escrito com a API do Firestore. Em vez de reescrever ~14 mil linhas,
`supa-firebase.js` recria essa API (`collection/doc/onSnapshot/runTransaction/batch/
FieldValue.increment/firebase.auth()`) em cima do Supabase:

- **Dados:** tabela `public.fs_docs (col, id, data jsonb, version)` — um documento por linha.
- **Leitura:** RLS (listas) e RPC `fs_get` (um documento pelo id).
- **Escrita:** somente pela RPC `fs_commit`, que aplica as regras de segurança
  (portadas 1:1 do `firestore.rules` do Markin) e resolve increment/arrayUnion
  de forma atômica. Transações usam checagem de versão (otimista) com nova tentativa.
- **Tempo real:** Supabase Realtime, com atualização periódica como rede de segurança.
- **Contas:** Supabase Auth. A edge function `criar-conta` cria contas já confirmadas
  (cliente com conta de fidelidade e funcionário cadastrado pelo gerente).
  Quem dá acesso ao painel é o documento `users/{uid}`, que só gerente grava.

Projeto Supabase: `cumads-grill` (`usgykpjvptlxhmspsadn`, sa-east-1).

## Recriar do zero

1. Rode `supabase/migrations/0001_fs_docs.sql` e `0002_fs_helpers_private.sql` no SQL Editor.
2. Publique `supabase/functions/criar-conta` (sem verificação de JWT — ela valida os dados sozinha).
3. Crie a conta do gerente (Authentication → Add user, marcando "auto confirm") e rode `supabase/seed.sql`
   trocando o e-mail no final.
4. Troque `supabaseUrl`/`supabaseKey` nos três `index.html` (procure `firebaseConfig`).

## Configurações recomendadas no painel do Supabase

- **Authentication → URL Configuration → Site URL:** coloque o endereço do site na Vercel
  (sem isso o link de "esqueci minha senha" aponta para `localhost`). Adicione também
  `https://SEU-SITE/gerencial/` em *Redirect URLs*.
- **Authentication → Password security:** ligue *Leaked password protection*.

## Deploy

Site estático (sem build). Na Vercel: *Root Directory* = `cumads-grill`, Framework = *Other*.

## Cardápio e preços

Itens vieram do cardápio impresso. **Os preços são sugestões iniciais** (o impresso não tinha
preços) — ajuste em Gerencial → Cardápio. Bebidas e adicionais (vinagrete, farofa, torresmo)
também são sugestões e podem ser pausados/apagados por lá.
