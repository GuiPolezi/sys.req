# HelpDesk — versão Alpha

Sistema de organização de solicitações e atendimentos (helpdesk) para **validar requisitos** antes de construir a versão real.

## Como rodar

```bash
npm install
npm run dev      # abre em http://localhost:5173
```

## Contas de demonstração (senha `123`)

| Login  | Papel        | O que faz                                                        |
|--------|--------------|------------------------------------------------------------------|
| `ana`  | Suporte      | Cria categorias, automações, atribui chamados, gerencia membros  |
| `bruno`| Dev          | Vê chamados das categorias Siscam/Workflow e os seus             |
| `carla`| Dev          | Vê chamados da categoria Siave                                    |
| `davi` | Solicitante  | Abre chamados e acompanha os seus                                |

> Botão **"Recarregar dados demo"** na tela de login restaura tudo.

## Papéis e permissões

- **Suporte** — cria automações, categorias, tickets, atribui chamados, vê tudo, gera códigos de convite, registra atendimentos.
- **Dev** — vê chamados de suas categorias e os atribuídos a si, "pega" chamados, muda status/urgência, conversa, registra atendimentos.
- **Solicitante** — abre chamados e conversa no chat do próprio chamado.

## Fluxo de grupos

1. Um técnico (suporte) **cria um grupo** → recebe 2 códigos:
   - **Convite de técnicos** — outros suporte/devs entram com ele.
   - **Cadastro de solicitantes** — solicitantes se cadastram já entrando no grupo.
2. Todos os tickets, categorias, automações e chat vivem dentro do grupo.

## Estrutura do código

```
src/
├── lib/
│   ├── store.js      ← ÚNICA camada de persistência (localStorage)
│   ├── domain.js     ← regras de negócio (papéis, tickets, automações)
│   └── seed.js       ← dados de demonstração
├── context/AuthContext.jsx
├── components/       ← Layout + UI compartilhada
└── pages/            ← telas (Auth, Dashboard, Tickets, Chat, etc.)
```

## Migração futura (Supabase / banco real)

Toda a persistência está isolada em **`src/lib/store.js`**. Para migrar:
1. Reimplemente `db.all/find/insert/update/remove` chamando o Supabase (ou API).
2. Torne-as `async` e ajuste `domain.js`/páginas para `await`.
3. O restante do app (componentes, layout, regras) permanece igual.

> Chat em tempo real entre dispositivos exige backend — no alpha (localStorage) o chat funciona por usuário/máquina.
