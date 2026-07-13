# HelpDesk — versão Alpha (v02)

Sistema de organização de solicitações e atendimentos (helpdesk) para **validar requisitos**
antes de construir a versão real. Continua **100% em `localStorage`** — sem backend.

## Documentação

- **[`docs/SISTEMA.md`](docs/SISTEMA.md)** — documentação completa: arquitetura, modelo de dados,
  funcionalidades, permissões, telas, design e limitações. **Comece por aqui.**
- [`docs/DESIGN.md`](docs/DESIGN.md) — requisitos organizados (RC/RP/RCS), requisitos não-funcionais e diagramas UML.

## Como rodar

```bash
npm install
npm run dev      # abre em http://localhost:5173
```

## Contas de demonstração (senha `123`)

| Login   | Papel        | O que faz                                                        |
|---------|--------------|------------------------------------------------------------------|
| `ana`   | Suporte      | Cria grupos/categorias/serviços, convida, atribui, vê tudo, ranking, auditoria |
| `bruno` | Dev          | Atende Desktop, pega chamados do pool, envia para análise        |
| `carla` | Dev          | Atende Web                                                        |
| `davi`  | Solicitante  | Abre chamados (Itajubá), alerta de urgência, aprova/rejeita análise |
| `elis`  | Solicitante  | Solicitante de Itajubá (vê também os chamados da cidade)          |
| `fabio` | Dev          | **Tem um convite pendente** — logue e veja o fluxo de aceite (RP06) |

> Botão **"Recarregar dados demo"** na tela de login restaura tudo.

## Papéis e permissões

- **Suporte** — cria grupos, categorias, serviços; convida/apaga grupo; atribui; ranking, auditoria; registra atendimentos avulsos.
- **Dev** — atende suas categorias, pega chamados do **pool** de não-atribuídos, envia para análise, ganha XP (gamificação).
- **Solicitante** — abre chamados, envia **alerta de urgência**, **aprova/rejeita** a análise; vê os seus + os da sua cidade.

## Principais novidades da v02

- **Perfil** do usuário (RC07) com gamificação (dev) e estatísticas de atendimento (suporte).
- **Convites** com aceite/recusa (RP02/RP06) — além dos códigos de acesso.
- **Sair** / **apagar** grupo com avisos progressivos (RP12/RP13).
- **Serviços**: modelos que padronizam a criação de chamados (RCS04/RCS07).
- **Pool** de chamados sem atribuição para os devs (RCS06).
- Fluxo de **Análise** → aprovar/rejeitar (RCS08).
- **Ranking** de solicitantes por cidade (RCS09) e **log de auditoria** do grupo (RP16).
- **Registro de atendimentos avulsos** pelo suporte (RCS12).

## Estrutura do código

```
docs/DESIGN.md        ← requisitos organizados + UML (classes, estados, casos de uso)
src/
├── lib/
│   ├── store.js      ← ÚNICA camada de persistência (localStorage)
│   ├── domain.js     ← regras de negócio, permissões, auditoria, estatísticas
│   └── seed.js       ← dados de demonstração
├── context/AuthContext.jsx
├── components/       ← Layout + UI compartilhada
└── pages/            ← telas (Auth, Dashboard, Tickets, Pool, Services, Team, Profile, Ranking, Audit…)
```

## Migração futura (Supabase / banco real)

Toda a persistência está isolada em **`src/lib/store.js`**. Para migrar:
1. Reimplemente `db.all/find/insert/update/remove` chamando o Supabase (ou API).
2. Torne-as `async` e ajuste `domain.js`/páginas para `await`.
3. O restante do app (componentes, layout, regras) permanece igual.

> Chat em tempo real entre dispositivos exige backend — no alpha (localStorage) o chat funciona por usuário/máquina.
