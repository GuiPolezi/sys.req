# HelpDesk — versão Alpha (v0.0.6)

Sistema de organização de solicitações e atendimentos (helpdesk) para **validar requisitos**
antes de construir a versão real. Continua **100% em `localStorage`** — sem backend.

## Documentação

- **[`docs/SISTEMA.md`](docs/SISTEMA.md)** — documentação completa: arquitetura, modelo de dados,
  funcionalidades, permissões, telas, design e limitações. **Comece por aqui.**
- [`docs/DESIGN.md`](docs/DESIGN.md) — requisitos organizados (RC/RP/RCS/RPR), requisitos não-funcionais e diagramas UML.

## Como rodar

```bash
npm install
npm run dev      # abre em http://localhost:5173
npm run build    # build de produção
npm run lint     # oxlint
```

## Contas de demonstração (senha `123`)

| Login   | Papel        | O que faz                                                        |
|---------|--------------|------------------------------------------------------------------|
| `ana`   | Suporte      | Administração completa: grupos, categorias, sistemas, serviços, cidades, SLAs, workflows, membros, permissões, ranking, auditoria |
| `bruno` | Dev          | Atende Desktop, pega chamados do pool, envia para análise        |
| `carla` | Dev          | Atende Web                                                        |
| `davi`  | Solicitante  | Abre chamados (Itajubá), alerta de urgência, aprova/rejeita análise |
| `elis`  | Solicitante  | Solicitante de Itajubá (vê também os chamados da cidade)          |
| `fabio` | Dev          | **Tem um convite pendente** — logue e veja o fluxo de aceite (RP02) |

> Botão **"Recarregar dados demo"** na tela de login restaura tudo.

## Papéis e permissões

Desde a **v0.0.5** o papel é **por grupo**, não por conta: todo mundo entra no grupo como
**solicitante** (pelo código único ou por convite) e os técnicos promovem para dev/suporte
na página **Equipe** — onde também se marcam **⭐ gerentes** e se configuram as
**permissões do grupo** (exclusão de chamados, urgência, atribuição).

- **Suporte** — administra o grupo (categorias, sistemas, serviços, cidades, SLAs, workflows,
  membros, permissões); atribui e reabre chamados; ranking, auditoria e atendimentos avulsos.
- **Dev** — atende suas categorias, pega chamados do **pool**, envia para análise do solicitante,
  solicita **análise técnica** ao suporte, ganha XP (gamificação).
- **⭐ Gerente** — técnico que também pode **atribuir chamados**, conforme a permissão do grupo.
- **Solicitante** — abre chamados, envia **alerta de urgência**, **aprova/rejeita** a análise;
  vê os seus + os da sua cidade; no chat, participa apenas de **conversas individuais (DM)**.

> Dentro de um chamado, as ações de trabalho (status, urgência, atendimentos, chat) são do
> **técnico responsável**; um chamado concluído fica **encerrado** e só o suporte reabre.

## Principais novidades por versão

- **v0.0.3** — abertura de chamado em **3 passos** (sistema → serviço → formulário); **sistemas do
  grupo**; atribuição **balanceada por categoria**; **notificações** com badges; **cadastro de
  clientes**; **encerramento** do chamado concluído (reabertura pelo suporte); carga da equipe no painel.
- **v0.0.4** — redesign **"Aero"** (vidro/aqua, tema claro/escuro), sem mudanças de lógica.
- **v0.0.5** — **cadastro único** (papel por grupo); **gerentes** e **permissões configuráveis**;
  **gestão de membros** (perfil, senha, papel, remoção); tickets com **nº sequencial** e novos filtros;
  **DMs**; **painel personalizável** (widgets); **relatórios CSV**; **cadastro de cidades**;
  **SLA** (configuração + acompanhamento); **workflows** com etapas → **subchamados** encadeados;
  **análise técnica** dev ⇄ suporte.
- **v0.0.6** — **código ÚNICO de acesso** por grupo (entrada sempre como solicitante; técnicos
  promovem depois); aba **Visão geral** na Equipe com **técnicos online** (presença) e categorias ×
  membros; novos widgets no painel (por sistema, por cidade, tempo médio de resolução, análises
  pendentes, atendimentos dos últimos 7 dias).

## Estrutura do código

```
docs/                 ← SISTEMA.md (documentação completa) + DESIGN.md (requisitos + UML)
src/
├── lib/
│   ├── store.js      ← ÚNICA camada de persistência (localStorage, 19 coleções)
│   ├── domain.js     ← regras de negócio, permissões, SLA, workflows, auditoria, estatísticas
│   ├── report.js     ← exportação CSV
│   ├── theme.js      ← tema claro/escuro
│   └── seed.js       ← dados de demonstração
├── context/AuthContext.jsx  ← sessão: usuário + grupo ativo + papel efetivo + refresh()
├── components/       ← Layout, UI compartilhada, Charts (SVG puro), RichText (editor)
└── pages/            ← telas (Dashboard, Tickets, Pool, Assigned, Services, Systems, Cities,
                        Slas, Workflows, Team, Invites, Chat, Attendances, Ranking, Audit…)
```

## Migração futura (Supabase / banco real)

Toda a persistência está isolada em **`src/lib/store.js`**. Para migrar:
1. Reimplemente `db.all/find/insert/update/remove` chamando o Supabase (ou API).
2. Torne-as `async` e ajuste `domain.js`/páginas para `await`.
3. O restante do app (componentes, layout, regras) permanece igual.

> Chat e notificações em tempo real entre dispositivos exigem backend — no alpha (localStorage)
> funcionam por usuário/máquina. Senhas em texto plano e imagens como data URL também são
> limitações aceitas apenas no protótipo.
