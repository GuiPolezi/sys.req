# HelpDesk — Documentação do Sistema (v0.0.2)

Documento único que explica **tudo o que foi desenvolvido até agora**: propósito, arquitetura,
modelo de dados, funcionalidades, regras de negócio, telas, design e limitações.

> Complementa o [`DESIGN.md`](DESIGN.md), que contém os **requisitos organizados** e os **diagramas UML**.

---

## 1. O que é este projeto

Um sistema de **help desk** (chamados/tickets) construído como **protótipo de validação**:
o objetivo é testar se as regras de negócio e os fluxos fazem sentido **antes** de investir
na construção da versão real com backend.

Por isso:

- **Não há servidor.** Toda a persistência é feita no **`localStorage`** do navegador.
- Toda leitura/escrita passa por **uma única camada** (`src/lib/store.js`), justamente para que
  a migração futura para um banco real (Supabase, API própria) não exija reescrever o app.
- Senhas ficam em texto plano — aceitável **somente** neste protótipo.

### Como rodar

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # build de produção
npm run lint     # oxlint
```

### Contas de demonstração (senha `123`)

| Login | Papel | Serve para testar |
|-------|-------|-------------------|
| `ana` | Suporte | Administração completa: grupos, categorias, sistemas, serviços, convites, ranking, auditoria, atendimentos |
| `bruno` | Desenvolvedor | Categoria Desktop; pegar chamados do pool; enviar para análise |
| `carla` | Desenvolvedor | Categoria Web |
| `davi` | Solicitante | Abre chamados (Itajubá), alerta de urgência, aprova/rejeita análise |
| `elis` | Solicitante | Também de Itajubá — valida a visão "chamados da minha cidade" |
| `fabio` | Desenvolvedor | **Tem convite pendente** — valida o fluxo de aceitar/recusar |

O botão **"Recarregar dados demo"** na tela de login apaga tudo e repopula o seed.

---

## 2. Papéis e permissões

O sistema tem **3 papéis**. Toda autorização vem de um objeto único (`can`) em `domain.js`,
usado tanto pela UI quanto pelas regras — nunca há regra duplicada.

| Ação | Suporte | Desenvolvedor | Solicitante |
|------|:-------:|:-------------:|:-----------:|
| Criar grupo / entrar por código | ✅ | ✅ | ❌ (entra pelo código no cadastro) |
| Convidar técnico / apagar grupo | ✅ | ❌ | ❌ |
| Sair do grupo | ✅ | ✅ | ❌ |
| Ver membros do grupo | ✅ | ✅ | ❌ |
| Criar categorias e sistemas | ✅ | ❌ | ❌ |
| Escolher a própria categoria | — | ✅ | — |
| Criar serviços (modelos) | ✅ | ✅ | ❌ |
| Criar chamado | ✅ | ✅ | ✅ |
| Criar chamado **em nome de** um solicitante | ✅ | ✅ | — |
| Atribuir chamado a alguém | ✅ | só "pegar" p/ si | ❌ |
| Mudar status / urgência / registrar atendimento no chamado | **só se for o responsável** | **só se for o responsável** | ❌ |
| Escrever no chat do chamado | só se for o responsável | só se for o responsável | ✅ (autor) |
| Enviar chamado para análise | ✅ (responsável) | ✅ (responsável) | ❌ |
| Aprovar / rejeitar a análise | ❌ | ❌ | ✅ (autor) |
| Enviar alerta de urgência | ❌ | ❌ | ✅ (autor) |
| Registro de atendimentos avulsos (página) | ✅ | ❌ | ❌ |
| Ranking e auditoria | ✅ | ❌ | ❌ |

**Regra central de segurança de operação:** dentro de um chamado, as ações de trabalho
(status, urgência, atendimentos e chat) são liberadas **apenas para o técnico responsável**.
Se ninguém está atribuído, só o solicitante pode escrever. O suporte continua podendo
**reatribuir** o chamado (função supervisória), mas não executa as ações no lugar do responsável.

---

## 3. Conceito de Grupo (multi-tenant lógico)

O grupo é o **"organismo"** do sistema: tudo (chamados, categorias, sistemas, serviços, chats,
atendimentos, auditoria) pertence a um grupo e **não vaza** para outro.

- Um usuário **sem grupo** só enxerga o próprio perfil, seus convites e a tela de grupos.
- Suporte e dev podem participar de **vários grupos** e **alternar** entre eles (página *Meus grupos*
  ou o seletor na barra superior) — a troca muda todo o conteúdo exibido.
- Cada grupo tem **dois códigos**:
  - **Código de técnicos** — suporte/dev entram com ele.
  - **Código de solicitantes** — o solicitante usa no **cadastro** (é a única forma de ele entrar).
- Além do código, o suporte pode **convidar** um técnico pelo login/e-mail; o convidado
  **aceita ou recusa** na página *Convites*.
- Apagar um grupo (só suporte) passa por **3 avisos encadeados** e remove todo o conteúdo dele.

---

## 4. Arquitetura

Três camadas bem separadas — a UI nunca fala com o `localStorage` diretamente.

```
src/
├── lib/
│   ├── store.js        ← ÚNICA camada de persistência (localStorage) + API db.*
│   ├── domain.js       ← regras de negócio, permissões, auditoria, estatísticas
│   └── seed.js         ← dados de demonstração
├── context/
│   └── AuthContext.jsx ← sessão: usuário logado + grupo ativo + refresh()
├── components/
│   ├── Layout.jsx      ← shell do app (sidebar + topbar)
│   ├── ui.jsx          ← Avatar, Badges, Modal, Empty, helpers de data
│   ├── Charts.jsx      ← AreaChart, BarList, Donut, ColumnChart (SVG puro)
│   └── RichText.jsx    ← editor de texto rico + RichView (leitura)
├── pages/              ← 18 telas
├── App.jsx             ← rotas (com guardas por papel)
└── index.css           ← design system completo
```

**Stack:** React 19 + Vite + React Router. **Zero dependências** de UI, gráficos ou editor —
tudo foi construído à mão, o que mantém o bundle enxuto e o projeto sem acoplamento.

### Como o estado se atualiza
Como o `localStorage` não é reativo, o `AuthContext` expõe um contador (`tick`) e uma função
`refresh()`. Depois de qualquer mutação, a página chama `refresh()` e os dados são relidos.
É simples e suficiente para o protótipo; num backend real isso vira cache/query invalidation.

---

## 5. Modelo de dados

11 coleções no `localStorage`, sob o namespace `helpdesk_alpha_v2`:

| Coleção | Descrição | Campos principais |
|---------|-----------|-------------------|
| `users` | Usuários | `id, name, login, email, password, role, cidade, createdAt` |
| `groups` | Grupos + membros embutidos | `id, name, description, ownerId, members[], techInviteCode, requesterCode` |
| `categories` | **Categorias de desenvolvedor** (Web, Desktop, Infra…) | `id, groupId, name, systems[], color` |
| `systems` | **Sistemas do grupo** (selecionáveis no chamado) | `id, groupId, name, categoryId` |
| `services` | **Modelos** que padronizam a criação de chamados | `id, groupId, name, ticketType, defaultTitle, categoryId, assignTo, urgency` |
| `tickets` | Chamados | ver abaixo |
| `ticketMessages` | Chat de cada chamado | `id, ticketId, userId, text, at` |
| `internalMessages` | Chat interno dos técnicos, **por canal** | `id, groupId, channel, userId, text, at` |
| `invitations` | Convites com aceite/recusa | `id, groupId, inviteeId, role, status, createdBy` |
| `attendances` | Atendimentos (avulsos e os do chamado) | `id, groupId, userId, ticketId?, cidade, client, note, at` |
| `auditLog` | Log de auditoria do grupo | `id, groupId, userId, action, detail, at` |

**Membro do grupo** (`groups.members[]`): `{ userId, role, categoryIds[], joinedAt }` — é aqui que
fica a relação "este dev atende estas categorias".

**Ticket** — o registro mais rico do sistema:

```
id, groupId, title,
description      → HTML (editor rico, com imagens em data URL)
type             → Solicitação | Erro | Dúvida | Melhoria | Ajuste
categoryId       → área de desenvolvimento
systemId         → sistema afetado
status           → aberto | em_andamento | aguardando | em_analise | concluido
urgency          → baixa | media | alta
urgentAlert      → alerta disparado pelo solicitante
createdBy        → quem registrou (pode ser um técnico)
requesterId      → o SOLICITANTE do chamado (pode ser ≠ de createdBy)
requesterName    → nome livre, quando o solicitante não é cadastrado
assignedTo       → técnico responsável
serviceId, cidade, attendances[], createdAt, updatedAt
```

> A separação **`createdBy` × `requesterId`** é o que permite o suporte abrir um chamado
> **em nome de um cliente** (cadastrado ou não) — e é por `requesterId` que o ranking credita
> a solicitação à pessoa certa.

---

## 6. Funcionalidades

### 6.1 Chamados (tickets)

**Abertura em 2 passos:** primeiro o usuário escolhe um **Serviço** (modelo) ou **Chamado avulso**;
só depois aparece o formulário — já pré-preenchido pelo serviço quando aplicável.

O formulário tem:
- **Descrição rica** — editor próprio com negrito, itálico, sublinhado, título, citação, listas e
  **inserção de imagens** (embutidas como data URL).
- **Sistema afetado** e **Categoria**.
- **Tipo** e **Urgência**.
- **Técnico responsável** (só técnicos podem atribuir na criação).
- **Solicitante** (só quando um técnico abre): escolher um solicitante **cadastrado** ou digitar o
  **nome de um não cadastrado**.
- **Cidade** — travada: vem do cadastro do solicitante (o solicitante nunca a edita).

**Ciclo de vida (máquina de estados):**

```
aberto → em_andamento → (aguardando) → em_analise → concluido
                             ▲              │
                             └──────────────┘  rejeitado pelo solicitante
```

- O responsável marca **Enviar para análise**.
- O solicitante então **aprova** (vira `concluido`) ou **rejeita** (volta para `em_andamento`).
- O solicitante pode ligar/desligar um **alerta de urgência** (🚨), que destaca o chamado.

**Visibilidade — quem vê o quê:**

| Papel | Vê |
|-------|-----|
| Suporte | **todos** os chamados do grupo |
| Desenvolvedor | os **atribuídos a si** + os da **sua categoria** + os **sem atribuição** |
| Solicitante | os **seus** (criados por ele ou **em seu nome**) + todos os da **sua cidade** |

**Páginas de chamados:**
- **Chamados** — lista com busca, filtro por status e por categoria.
- **📌 Atribuídos a mim** — a fila pessoal do técnico.
- **📥 Não atribuídos** (pool) — chamados sem dono, visíveis a todos os técnicos, com botão "Pegar".

### 6.2 Serviços (modelos de chamado)

Um serviço padroniza a abertura: define **tipo, título padrão (prefixo), categoria, urgência e
atribuição automática**. Pode-se ter vários serviços para o mesmo assunto (ex.: "Erro em site",
"Melhoria no site", "Ajuste de configuração"). Ao escolher o serviço, o formulário já vem pronto —
e o chamado pode ir direto para o dev correto.

### 6.3 Categorias e Sistemas

- **Categorias** = áreas de atuação do desenvolvedor (Desenvolvimento Web, Desktop, Infraestrutura).
  Classificam o chamado e definem o que cada dev atende. O suporte cria; o **dev escolhe as suas**
  no próprio perfil, e o suporte também pode atribuí-las.
- **Sistemas** = os sistemas atendidos pelo grupo (Siscam 9, Siave, Site…). São selecionados no
  chamado para **identificar o que está com problema**. Podem ser vinculados a uma categoria.

### 6.4 Comunicação

- **Chat do chamado** — entre o solicitante e o técnico responsável (RCS03).
- **Chat interno da equipe** — só técnicos, com **canais**: **Geral** + **um canal por categoria**
  (ex.: canal do Desenvolvimento Web).

### 6.5 Atendimentos (RCS12)

Página **exclusiva do suporte** para registrar atendimentos feitos **fora de um chamado**
(visita, telefone, presencial). Ex.: "atendi o cliente em Itajubá".

Foi desenhada para uso intenso no dia a dia:
- **Mini calendário** do mês com a **contagem de atendimentos em cada dia**.
- **Navegação por dia** (‹ hoje ›) e lista limpa do dia selecionado.
- **Formulário em modal**, aberto por botão (cliente/local, cidade, o que foi feito).

### 6.6 Painel (dashboard)

Visão analítica, sempre respeitando o que o papel pode ver:
- **KPIs**: total, urgentes, em aberto, atribuídos a mim, concluídos.
- **Gráfico de área** "Chamados criados", com **filtro de período** (7/14/30/90 dias),
  **tooltip com crosshair** e eixo Y arredondado. *(Área/linha é a forma correta para série
  temporal — colunas só funcionam bem com poucos períodos discretos.)*
- **Rosca (donut)** por status, com legenda.
- **Barras** por urgência e por categoria.
- **Atividade recente** — os 8 chamados mais recentes, em **ordem decrescente de criação**.

### 6.7 Relatórios e governança

- **🏆 Ranking de solicitantes** — quem mais abre chamados, com **pódio** (🥇🥈🥉), barras e
  **filtro por cidade**. Considera **apenas solicitantes** (técnicos são desconsiderados) e credita
  ao `requesterId`, mesmo quando o chamado foi registrado por um técnico.
- **📜 Auditoria** — log de **toda** movimentação do grupo (criação/atribuição/status de chamados,
  convites, categorias, sistemas, serviços, entradas e saídas de membros…), com ícone, autor e data.

### 6.8 Perfis (gamificação e estatísticas)

O perfil muda conforme o papel:
- **Desenvolvedor** — **gamificação**: XP, nível, barra de progresso, chamados finalizados/ativos/
  atribuídos; e a escolha das **próprias categorias**.
- **Suporte** — **atendimentos por dia e no total**, com barras por dia.
- **Solicitante** — total de solicitações, concluídas, em andamento e **taxa de conclusão**.
  A **cidade não é editável** (e nem aparece para técnicos, que não têm cidade).

---

## 7. Telas (rotas)

| Rota | Tela | Acesso |
|------|------|--------|
| `/login` | Autenticação (entrar / criar conta) | público |
| `/` | Painel (dashboard) | todos |
| `/tickets` | Lista de chamados | todos |
| `/tickets/new` | Abrir chamado (2 passos) | todos |
| `/tickets/:id` | Detalhe do chamado | quem pode ver o chamado |
| `/assigned` | Atribuídos a mim | técnicos |
| `/pool` | Não atribuídos | técnicos |
| `/chat` | Chat interno (canais) | técnicos |
| `/team` | Membros (abas Técnicos / Solicitantes) + convites + config. do grupo | técnicos |
| `/invites` | Convites recebidos (aceitar/recusar) | técnicos |
| `/attendances` | Registro de atendimentos | **suporte** |
| `/categories` | Categorias de desenvolvedor | **suporte** |
| `/systems` | Sistemas do grupo | **suporte** |
| `/services` | Serviços (modelos) | técnicos |
| `/ranking` | Ranking de solicitantes | **suporte** |
| `/audit` | Log de auditoria | **suporte** |
| `/groups` | Meus grupos (alternar, criar, entrar por código) | todos |
| `/profile` | Meu perfil | todos |

Sem grupo ativo, o app só libera **perfil**, **convites** e **grupos** (regra RP04).

---

## 8. Design e responsividade

**Estilo "Claude": minimalista, quente e profissional.**

- **Paleta paper/clay** — fundo creme (`#F5F3EC`), superfícies off-white, acento **terracota**
  (`#C15F3C`), tinta escura quente. Status, urgências, papéis e categorias usam tons **quentes
  harmonizados** (nada de vermelho/azul saturados).
- **Tipografia** — títulos e números em **serifada** (toque editorial), corpo em sans.
- Cantos suaves, sombras sutis, foco acessível (anel), animações discretas.

**Menu lateral (aside)** — reestruturado em **três regiões**:
1. marca (fixa no topo), 2. **navegação com scroll interno próprio**, 3. rodapé fixo (Grupos, Perfil).
Assim o menu **nunca faz a página rolar**, mesmo em telas baixas. Há ainda um **modo "rail"**
(só ícones, 70px) com botão de recolher — a preferência é salva no `localStorage`.

**Responsividade:**
- **≤ 860px** — o menu vira **gaveta (drawer)** com overlay; clicar num item fecha.
- **≤ 820px** — grades de duas colunas (detalhe do chamado, atendimentos, perfil) **empilham**.
- **≤ 640px** — campos lado a lado quebram, KPIs compactam, textos truncam em vez de estourar.
- **≤ 480px** — ajustes finos (seleção de papel em coluna única, badges ocultos na topbar).

---

## 9. Histórico da evolução

| Etapa | O que foi feito |
|-------|-----------------|
| **v0.0.1 (alpha)** | Base: auth, 3 papéis, grupos por código, categorias, tickets, 2 chats, atendimentos no ticket, visibilidade por papel, automações de atribuição. |
| **v0.0.2 — requisitos** | Organização dos requisitos + UML. Adicionados: perfil, convites com aceite/recusa, descrição do grupo, sair/apagar grupo, dev escolhe categoria, auditoria, pool de não atribuídos, cidade na visibilidade, **Serviços** (substituíram as automações), alerta de urgência, fluxo de análise, ranking, gamificação, stats de suporte, atendimentos avulsos. |
| **v0.0.2 — design** | Reformulação visual completa (paleta, tipografia, componentes) + responsividade. |
| **v0.0.2 — rodada de testes 1** | Página de grupos; cidade só para solicitante; ranking com pódio e só solicitantes; atendimentos com calendário; membros em abas; chat com canais; abertura de chamado em 2 passos; editor rico; sistemas do grupo; atribuição de técnico; "atribuídos a mim"; permissões por responsável; chamado em nome de terceiros; stats do solicitante; dev sem acesso a atendimentos. |
| **v0.0.2 — rodada de testes 2** | Dashboard profissional com gráficos; atividade recente por criação; cidade vazia no registro de atendimento; gráfico de área com filtro de período; redesenho do menu lateral e revisão da responsividade. |

---

## 10. Limitações conhecidas (por ser um protótipo)

- **Sem backend**: os dados vivem no navegador. O chat **não é em tempo real entre máquinas** —
  cada usuário/dispositivo tem seu próprio `localStorage`.
- **Senhas em texto plano** — no sistema real, hash no servidor.
- **Imagens no editor viram data URL** dentro do ticket — funciona para validar, mas num backend
  real devem ir para um storage de arquivos.
- **Sem paginação** — listas carregam tudo; com centenas de milhares de registros seria necessário paginar.

### Backlog (levantado nos testes, ainda não implementado)
- **Foto de perfil** dos usuários.
- **Destaque visual mais forte do grupo ativo**, para não haver dúvida sobre onde se está.

---

## 11. Caminho para a versão real

A migração foi planejada desde o início:

1. Reimplementar `db.all / find / filter / byId / insert / update / remove` em **`src/lib/store.js`**
   chamando o Supabase (ou uma API própria).
2. Torná-las `async` e ajustar `domain.js` e as páginas para `await`.
3. **Nada mais muda**: componentes, layout, permissões e regras de negócio permanecem iguais.

Pontos que passam a ser responsabilidade do servidor:
- hash de senha e autenticação real;
- **aplicação das permissões no backend** (hoje elas são de UI/domínio — num sistema real,
  o servidor precisa reforçá-las);
- realtime no chat (websockets/subscriptions);
- storage de imagens e anexos.
