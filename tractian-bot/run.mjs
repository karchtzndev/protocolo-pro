// Robô Tractian: preenche o procedimento padrão e conclui as OS da lista.
// Uso: veja README.md
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(DIR, 'output');
const SHOTS = path.join(OUT, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });

// ---------------- configuração ----------------
const LIST_URL =
  process.env.LIST_URL ||
  'https://app.tractian.com/cmms/workorders?table=workOrders&v=table&filters=eyJzdGF0dXMiOlsiaW5Qcm9ncmVzcyIsIm9uSG9sZCJdfQ';
// Se souber a URL direta de uma OS, use ex.: ORDER_URL_TEMPLATE="https://.../workorders/{id}"
const ORDER_URL_TEMPLATE = process.env.ORDER_URL_TEMPLATE || '';
const NOME_RESPONSAVEL = process.env.NOME_RESPONSAVEL || 'EDUARDO';

// Cartões do procedimento que o robô sabe preencher
const CARTOES_CONHECIDOS = [
  /PREENCHIMENTO\s+EXECUTANTE\s+DA\s+ATIVIDADE/i,
  /PREENCHIMENTO\s+DOS\s+REVISORES/i,
];
// Resposta de cada pergunta Sim/Não/N/A: padrão "Sim"; "Equipamento Substituído?" = "Não"
function respostaPara(label) {
  return /substitu[ií]d/i.test(label) ? 'Não' : 'Sim';
}
const ehCampoNome = (label) => /NOME\s+DO\s+RESPONS[ÁA]VEL\s+PELA\s+INSPE/i.test(label);

// ---------------- argumentos ----------------
const argv = process.argv.slice(2);
const flag = (n) => argv.includes(`--${n}`);
const opt = (n) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const PLAN = flag('plan'); // não altera nada, só mostra o que faria
const NO_CONCLUDE = flag('sem-concluir'); // preenche mas não clica em Concluída
const INSPECT = opt('inspect'); // salva HTML/JSON de uma OS para ajustes
const LIMIT = opt('limit') ? Number(opt('limit')) : Infinity;
const ONLY = opt('only')?.split(',').map((s) => s.trim());
const FILE = opt('file') || path.join(DIR, 'ordens.txt');

// ---------------- lista de ordens ----------------
function lerOrdens(file) {
  const buf = fs.readFileSync(file);
  const utf16 = buf[0] === 0xff && buf[1] === 0xfe; // arquivos exportados do Excel vêm em UTF-16 LE
  const linhas = buf.toString(utf16 ? 'utf16le' : 'utf8').replace(/^﻿/, '').split(/\r?\n/);
  const vistos = new Set();
  const ordens = [];
  for (const l of linhas) {
    const c = l.split('\t').map((s) => s.trim());
    if (!/^\d+$/.test(c[0]) || vistos.has(c[0])) continue;
    vistos.add(c[0]);
    ordens.push({ id: c[0], titulo: c[1] || '', sap: c[2] && c[2] !== '-' ? c[2] : '', notificador: c[3] || '' });
  }
  return ordens;
}

// ---------------- estado / relatório ----------------
const STATE_FILE = path.join(OUT, 'state.json');
const state = fs.existsSync(STATE_FILE) ? JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) : {};
function salvar(ordens) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  const por = (s) => ordens.filter((o) => state[o.id]?.status === s);
  const linha = (o) => `- #${o.id} ${o.titulo} (${o.notificador})` + (state[o.id]?.detalhe?.length ? '\n' + state[o.id].detalhe.map((d) => `    - ${d}`).join('\n') : '');
  const md = [
    `# Relatório de fechamento — ${new Date().toLocaleString('pt-BR')}`,
    `Total na lista: ${ordens.length} | Concluídas: ${por('concluida').length} | Pendentes p/ verificar: ${por('pendente').length} | Falhas: ${por('falha').length}`,
    '',
    '## Para verificar (procedimento não preenchido / outro procedimento)',
    ...por('pendente').map(linha),
    '',
    '## Falhas do robô (tentar de novo ou fazer manual)',
    ...por('falha').map(linha),
    '',
    '## Concluídas',
    ...por('concluida').map(linha),
  ].join('\n');
  fs.writeFileSync(path.join(OUT, 'relatorio.md'), md);
  const csv = ['id;sap;titulo;notificador;status;detalhe', ...ordens.filter((o) => state[o.id]).map((o) =>
    [o.id, o.sap, o.titulo, o.notificador, state[o.id].status, (state[o.id].detalhe || []).join(' | ')]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';'))].join('\n');
  fs.writeFileSync(path.join(OUT, 'relatorio.csv'), '﻿' + csv);
}

// ---------------- extração da tela (roda dentro da página) ----------------
function extrairCampos() {
  const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
  document.querySelectorAll('[data-bot],[data-bot-btn]').forEach((e) => { e.removeAttribute('data-bot'); e.removeAttribute('data-bot-btn'); });
  const todos = [...document.querySelectorAll('body *')].filter((e) => e.offsetParent !== null || getComputedStyle(e).position === 'fixed');
  const folhas = todos.filter((e) => e.children.length === 0);
  const isLeaf = (root, txt) => [...root.querySelectorAll('*')].some((e) => e.children.length === 0 && norm(e.textContent) === txt);
  const bgSel = (el) => {
    for (let e = el, i = 0; e && i < 3; e = e.parentElement, i++) {
      const m = getComputedStyle(e).backgroundColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/);
      if (m && (m[4] === undefined || Number(m[4]) > 0.05) && !(m[1] === '255' && m[2] === '255' && m[3] === '255')) return true;
    }
    return false;
  };
  const cartoes = todos.filter((e) => e.children.length <= 1 && /^PREENCHIMENTO\b/.test(norm(e.textContent)) && norm(e.textContent).length < 120);
  const cartaoDe = (el) => {
    let ult = '';
    for (const h of cartoes) if (h.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) ult = norm(h.textContent);
    return ult;
  };
  const out = [];
  let n = 0;

  // grupos Sim / Não / N/A
  const grupos = [];
  for (const sim of folhas.filter((e) => norm(e.textContent) === 'Sim')) {
    let p = sim;
    while (p && !(isLeaf(p, 'Não') && isLeaf(p, 'N/A'))) p = p.parentElement;
    if (p && !grupos.includes(p)) grupos.push(p);
  }
  for (const g of grupos) {
    let q = g;
    while (q.parentElement && grupos.filter((x) => q.parentElement.contains(x)).length === 1) q = q.parentElement;
    const t = q.innerText || '';
    const gi = t.indexOf(g.innerText);
    const label = norm(t.slice(0, gi < 0 ? t.length : gi)).slice(-300);
    const id = n++;
    const sel = {};
    for (const op of ['Sim', 'Não', 'N/A']) {
      const leaf = [...g.querySelectorAll('*')].find((e) => e.children.length === 0 && norm(e.textContent) === op);
      let btn = leaf;
      while (btn.parentElement && btn.parentElement !== g) btn = btn.parentElement;
      btn.setAttribute('data-bot-btn', `${id}:${op}`);
      sel[op] = bgSel(btn);
    }
    const marcado = Object.keys(sel).filter((k) => sel[k]);
    out.push({ id, kind: 'radio', label, required: label.includes('*'), card: cartaoDe(g), selecionado: marcado.length === 1 ? marcado[0] : null });
  }

  // campos de texto
  for (const inp of document.querySelectorAll('input[placeholder*="Digite" i], textarea[placeholder*="Digite" i]')) {
    if (inp.offsetParent === null) continue;
    let q = inp;
    const campos = [...document.querySelectorAll('input[placeholder*="Digite" i], textarea[placeholder*="Digite" i]')];
    while (q.parentElement && campos.filter((x) => q.parentElement.contains(x)).length === 1 && !grupos.some((g) => q.parentElement.contains(g))) q = q.parentElement;
    const label = norm((q.innerText || '').slice(0, 300));
    const id = n++;
    inp.setAttribute('data-bot', String(id));
    out.push({ id, kind: 'text', label, required: label.includes('*'), card: cartaoDe(inp), valor: inp.value });
  }

  // assinaturas
  for (const h of folhas.filter((e) => /^ASSINATURA\b/i.test(norm(e.textContent)) && norm(e.textContent).length < 90)) {
    let b = h;
    for (let i = 0; i < 4 && b.parentElement; i++) {
      if (/Assinado digitalmente|Assinar/.test(b.innerText || '')) break;
      b = b.parentElement;
    }
    const id = n++;
    b.setAttribute('data-bot', String(id));
    out.push({ id, kind: 'sign', label: norm(h.textContent), required: norm(h.parentElement.textContent).includes('*'), card: cartaoDe(h), assinado: /Assinado digitalmente/.test(b.innerText || '') });
  }
  return out;
}

const conhecido = (card) => CARTOES_CONHECIDOS.some((r) => r.test(card));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------- navegação ----------------
async function garantirLogin(page) {
  await page.goto(LIST_URL, { waitUntil: 'domcontentloaded' });
  await sleep(3000);
  const logado = async () => page.url().includes('/cmms/workorders') && (await page.locator('table, [role=table], [role=row]').count()) > 0;
  if (!(await logado())) {
    console.log('\n>>> Faça login no Tractian na janela aberta e deixe a lista de ordens visível.');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    await rl.question('>>> Depois aperte ENTER aqui... ');
    rl.close();
  }
}

async function abrirOrdem(page, o) {
  const alvo = new RegExp(`#${o.id}\\b`);
  if (ORDER_URL_TEMPLATE) {
    await page.goto(ORDER_URL_TEMPLATE.replace('{id}', o.id), { waitUntil: 'domcontentloaded' });
  } else {
    await page.goto(LIST_URL, { waitUntil: 'domcontentloaded' });
    const busca = page.locator('input[placeholder*="esquis" i], input[placeholder*="uscar" i], input[placeholder*="earch" i]').first();
    await busca.waitFor({ timeout: 20000 });
    await busca.fill(o.sap || o.titulo.slice(0, 40));
    await sleep(2500);
    const chave = o.sap || o.titulo.slice(0, 40);
    const linha = page.locator('tr, [role=row]').filter({ hasText: chave }).first();
    await linha.waitFor({ timeout: 15000 });
    await linha.click();
  }
  await page.getByText(alvo).first().waitFor({ timeout: 20000 });
  await sleep(1000);
}

async function abrirAbaProcedimentos(page) {
  const aba = page.getByText(/^\s*Procedimentos\s*\d*\s*$/).first();
  if (!(await aba.count())) return { existe: false, qtd: 0 };
  const txt = (await aba.innerText()).replace(/\D/g, '');
  const qtd = txt ? Number(txt) : -1;
  if (qtd === 0) return { existe: true, qtd: 0 };
  await aba.click();
  await sleep(1500);
  return { existe: true, qtd };
}

async function expandirSecoes(page) {
  await page.evaluate(() => {
    document.querySelectorAll('[aria-expanded="false"]').forEach((e) => {
      if (/^\d{3}\b/.test((e.innerText || '').trim())) e.click();
    });
  });
  await sleep(500);
}

async function carregarTudo(page) {
  // rola o painel até o fim para renderizar tudo
  for (let i = 0; i < 6; i++) {
    await page.mouse.wheel(0, 1200);
    await sleep(250);
  }
}

// ---------------- preenchimento ----------------
async function preencher(page, o, { plano }) {
  const detalhe = [];
  const acoes = [];
  const tentativas = new Map();
  let campos = [];
  for (let it = 0; it < 80; it++) {
    await carregarTudo(page);
    campos = await page.evaluate(extrairCampos);
    let agiu = false;
    for (const c of campos) {
      if (!conhecido(c.card)) continue;
      const chave = `${c.kind}:${c.label}`;
      let acao = null;
      if (c.kind === 'radio') {
        const alvo = respostaPara(c.label);
        if (c.selecionado !== alvo) acao = { desc: `"${c.label.slice(-80)}" → ${alvo}`, fn: () => page.locator(`[data-bot-btn="${c.id}:${alvo}"]`).first().click() };
      } else if (c.kind === 'text' && ehCampoNome(c.label)) {
        if (c.valor.trim().toUpperCase() !== NOME_RESPONSAVEL.toUpperCase())
          acao = { desc: `campo nome → ${NOME_RESPONSAVEL}`, fn: () => page.locator(`[data-bot="${c.id}"]`).first().fill(NOME_RESPONSAVEL) };
      } else if (c.kind === 'sign' && !c.assinado) {
        acao = { desc: `assinar "${c.label}"`, fn: async () => {
          const b = page.locator(`[data-bot="${c.id}"]`).first();
          await b.getByText(/^Assinar$/).first().click();
          await sleep(1200);
          const dlg = page.locator('[role=dialog]').last();
          await dlg.getByRole('button', { name: /^(Assinar|Confirmar|Salvar)$/ }).last().click({ timeout: 4000 }).catch(() => {});
        } };
      }
      if (!acao) continue;
      acoes.push(acao.desc);
      if (plano) continue; // plano: só registra o que faria
      const k = (tentativas.get(chave) || 0) + 1;
      tentativas.set(chave, k);
      if (k > 3) { detalhe.push(`Não consegui preencher: ${c.label.slice(-100)}`); continue; }
      try { await acao.fn(); } catch (e) { detalhe.push(`Erro ao agir em "${c.label.slice(-60)}": ${e.message.split('\n')[0]}`); }
      await sleep(400);
      agiu = true;
      break; // reextrai a tela após cada ação
    }
    if (plano || !agiu) break;
  }

  // pendências: obrigatórios de procedimentos desconhecidos, ou conhecidos que não ficaram preenchidos
  if (!plano) {
    for (const c of campos) {
      const nomeBase = c.label.slice(-100);
      if (!conhecido(c.card)) {
        if (c.kind === 'radio' && !c.selecionado && c.required) detalhe.push(`Outro procedimento sem preencher [${c.card || 'sem cartão'}]: ${nomeBase}`);
        if (c.kind === 'text' && !c.valor.trim() && c.required) detalhe.push(`Outro procedimento sem preencher [${c.card || 'sem cartão'}]: ${nomeBase}`);
        if (c.kind === 'sign' && !c.assinado && c.required) detalhe.push(`Assinatura pendente [${c.card || 'sem cartão'}]: ${c.label}`);
      } else {
        if (c.kind === 'radio' && c.selecionado !== respostaPara(c.label)) detalhe.push(`Pergunta não ficou marcada: ${nomeBase}`);
        if (c.kind === 'text' && c.required && !c.valor.trim()) detalhe.push(`Campo obrigatório vazio: ${nomeBase}`);
        if (c.kind === 'sign' && !c.assinado) detalhe.push(`Assinatura pendente: ${c.label}`);
      }
    }
  }
  return { acoes, detalhe: [...new Set(detalhe)], total: campos.length, desconhecidos: campos.filter((c) => !conhecido(c.card)).length };
}

async function concluir(page) {
  await page.evaluate(() => window.scrollTo(0, 0));
  const topo = page.locator('[role=dialog], body').first();
  await topo.evaluate((el) => el.scrollTo?.(0, 0)).catch(() => {});
  for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, -2000); await sleep(150); }
  const btn = page.getByRole('button', { name: /^\s*Conclu[ií]da\s*$/ }).first();
  const alvo = (await btn.count()) ? btn : page.getByText(/^Conclu[ií]da$/).first();
  await alvo.click({ timeout: 8000 });
  await sleep(1500);
  // possível confirmação
  const dlgs = await page.locator('[role=dialog]').count();
  if (dlgs > 1) {
    await page.locator('[role=dialog]').last().getByRole('button', { name: /^(Confirmar|Concluir|Finalizar|Salvar|OK|Sim)$/i }).last().click({ timeout: 4000 }).catch(() => {});
    await sleep(1500);
  }
  // verificação: botão "Concluída" ficou marcado (fundo colorido)
  for (let i = 0; i < 8; i++) {
    const ok = await alvo.evaluate((el) => {
      for (let e = el, i = 0; e && i < 3; e = e.parentElement, i++) {
        const m = getComputedStyle(e).backgroundColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/);
        if (m && (m[4] === undefined || Number(m[4]) > 0.05) && !(m[1] === '255' && m[2] === '255' && m[3] === '255')) return true;
      }
      return false;
    }).catch(() => false);
    if (ok) return true;
    await sleep(700);
  }
  return false;
}

// ---------------- principal ----------------
const ordensTodas = lerOrdens(FILE);
let ordens = ordensTodas;
if (INSPECT) ordens = ordensTodas.filter((o) => o.id === INSPECT);
else if (ONLY) ordens = ordensTodas.filter((o) => ONLY.includes(o.id));
else if (!PLAN) ordens = ordensTodas.filter((o) => state[o.id]?.status !== 'concluida'); // retoma de onde parou
console.log(`Ordens na lista: ${ordensTodas.length} | a processar: ${Math.min(ordens.length, LIMIT)}${PLAN ? ' [PLANO — nada será alterado]' : ''}`);

const ctx = await chromium.launchPersistentContext(path.join(DIR, '.profile'), { headless: false, viewport: { width: 1400, height: 950 } });
const page = ctx.pages()[0] || (await ctx.newPage());
await garantirLogin(page);

let feitos = 0;
for (const o of ordens) {
  if (feitos >= LIMIT) break;
  feitos++;
  const tag = `[${feitos}] #${o.id} ${o.titulo.slice(0, 60)}`;
  try {
    await abrirOrdem(page, o);
    const aba = await abrirAbaProcedimentos(page);

    if (INSPECT) {
      await expandirSecoes(page);
      await carregarTudo(page);
      fs.writeFileSync(path.join(OUT, `inspect-${o.id}.html`), await page.content());
      fs.writeFileSync(path.join(OUT, `inspect-${o.id}.json`), JSON.stringify(await page.evaluate(extrairCampos), null, 2));
      await page.screenshot({ path: path.join(OUT, `inspect-${o.id}.png`), fullPage: true });
      console.log(`Inspeção salva em ${OUT}/inspect-${o.id}.*`);
      break;
    }

    let res = { acoes: [], detalhe: [], total: 0, desconhecidos: 0 };
    if (aba.existe && aba.qtd !== 0) {
      await expandirSecoes(page);
      res = await preencher(page, o, { plano: PLAN });
      if (res.total === 0) res.detalhe.push('Aba Procedimentos tem itens mas o robô não conseguiu ler os campos');
    } else {
      res.detalhe.push('(info) OS sem procedimentos');
    }
    await page.screenshot({ path: path.join(SHOTS, `${o.id}-preenchido.png`) }).catch(() => {});

    if (PLAN) {
      console.log(`${tag}\n   ações: ${res.acoes.length ? res.acoes.join('\n          ') : 'nenhuma'}\n   campos: ${res.total} (de procedimentos desconhecidos: ${res.desconhecidos})`);
      continue;
    }

    const problemas = res.detalhe.filter((d) => !d.startsWith('(info)'));
    if (problemas.length) {
      state[o.id] = { status: 'pendente', detalhe: res.detalhe };
      console.log(`${tag} → PENDENTE (${problemas.length})`);
    } else if (NO_CONCLUDE) {
      state[o.id] = { status: 'preenchida', detalhe: res.detalhe };
      console.log(`${tag} → preenchida (sem concluir)`);
    } else {
      const ok = await concluir(page);
      await page.screenshot({ path: path.join(SHOTS, `${o.id}-final.png`) }).catch(() => {});
      state[o.id] = ok ? { status: 'concluida', detalhe: res.detalhe } : { status: 'falha', detalhe: [...res.detalhe, 'Cliquei em Concluída mas não confirmou — veja shots/'] };
      console.log(`${tag} → ${ok ? 'CONCLUÍDA' : 'FALHA ao concluir'}`);
    }
  } catch (e) {
    state[o.id] = { status: 'falha', detalhe: [e.message.split('\n')[0]] };
    await page.screenshot({ path: path.join(SHOTS, `${o.id}-erro.png`) }).catch(() => {});
    console.log(`${tag} → FALHA: ${e.message.split('\n')[0]}`);
  }
  if (!PLAN) salvar(ordensTodas);
  await sleep(800);
}
if (!PLAN && !INSPECT) { salvar(ordensTodas); console.log(`\nRelatório: ${path.join(OUT, 'relatorio.md')}`); }
await ctx.close();
