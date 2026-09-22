---
tags: [moc, protocolo-pro, saas, nutricao]
criado: 2026-09-22
fonte: repositório karchtzndev/protocolo-pro
---

# MOC — Protocolo.Pro

Mapa de conteúdo do segundo cérebro sobre o **Protocolo.Pro**: SaaS de prescrição nutricional para nutricionistas.

## O que é

Plataforma onde o nutricionista gerencia pacientes, monta protocolos alimentares, prescreve suplementos e fórmulas manipuladas, acompanha composição corporal e exames, e cobra mensalidade dos próprios pacientes. O paciente acessa uma área pública própria (PWA offline-first) por link + PIN.

Dois lados do produto:
- **Área logada do nutricionista** (`/(app)`) — dashboard, pacientes, CRM, financeiro, equipe, receitas, agendamentos.
- **Área pública do paciente** (`/p/[slug]`) — consentimento → PIN → protocolo, check-ins, push, offline.

## Notas

- [[10 - Arquitetura e Stack]]
- [[20 - Modelo de Dados]]
- [[30 - Motor de Dieta]]
- [[40 - Segurança Clínica]]
- [[50 - Billing e Monetização]]
- [[60 - Offline-first e PWA]]
- [[70 - Histórico de Versões]]
- [[80 - Pendências e Decisões Abertas]]
- [[90 - Aprendizados e Armadilhas]]

## Estado em 2026-09-22

- 18 migrations aplicadas, 27 tabelas.
- ~130 arquivos em `src/`.
- Último trabalho: implementação offline-first completa + correção de build.
- ⚠️ O `README.md` do repositório está **desatualizado** — descreve uma estrutura muito menor do que a que existe hoje. Ver [[90 - Aprendizados e Armadilhas]].
