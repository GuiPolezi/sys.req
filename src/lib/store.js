// =============================================================
//  CAMADA DE PERSISTÊNCIA (localStorage)
// -------------------------------------------------------------
//  TODA a leitura/gravação de dados passa por aqui.
//  Para migrar para Supabase / API real no futuro, basta
//  reimplementar as funções deste arquivo (read/write/collections)
//  mantendo a mesma assinatura — o resto do app não muda.
// =============================================================

const NS = 'helpdesk_alpha_v3';

const COLLECTIONS = [
  'users',
  'groups',
  'categories',
  'systems',       // sistemas do grupo (selecionáveis no chamado)
  'tickets',
  'ticketMessages',
  'internalMessages',
  'services',      // templates de criação de tickets
  'invitations',   // convites com aceite/recusa
  'clients',       // cadastro de clientes (registro de atendimentos)
  'cities',        // cadastro de cidades do grupo (campos "cidade" viram seleção)
  'slas',          // configurações de SLA (prazos por urgência/categoria)
  'workflows',     // fluxos de trabalho (etapas que geram subtickets)
  'attendances',   // registro de atendimentos avulsos
  'notifications', // avisos por usuário
  'chatReads',     // leitura por canal do chat interno (inclui DMs)
  'prefs',         // preferências por usuário (ex.: widgets do painel)
  'presence',      // último acesso por usuário/grupo (técnicos online)
  'auditLog',      // log de auditoria por grupo
];

function keyFor(name) {
  return `${NS}:${name}`;
}

function read(name, fallback = []) {
  try {
    const raw = localStorage.getItem(keyFor(name));
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(name, value) {
  localStorage.setItem(keyFor(name), JSON.stringify(value));
}

// ID simples e único o suficiente para o alpha
export function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function nowISO() {
  return new Date().toISOString();
}

// código curto e legível (grupos / convites)
export function shortCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

// ---------------------------------------------------------------
//  API genérica de coleção
// ---------------------------------------------------------------
export const db = {
  all(collection) {
    return read(collection);
  },
  find(collection, predicate) {
    return read(collection).find(predicate);
  },
  filter(collection, predicate) {
    return read(collection).filter(predicate);
  },
  byId(collection, id) {
    return read(collection).find((x) => x.id === id);
  },
  insert(collection, record) {
    const list = read(collection);
    list.push(record);
    write(collection, list);
    return record;
  },
  update(collection, id, patch) {
    const list = read(collection);
    const idx = list.findIndex((x) => x.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...patch };
    write(collection, list);
    return list[idx];
  },
  remove(collection, id) {
    const list = read(collection).filter((x) => x.id !== id);
    write(collection, list);
  },
  replaceAll(collection, list) {
    write(collection, list);
  },
};

// ---------------------------------------------------------------
//  Sessão (usuário logado + grupo ativo)
// ---------------------------------------------------------------
export const session = {
  get() {
    return read('__session', null);
  },
  set(value) {
    write('__session', value);
  },
  clear() {
    localStorage.removeItem(keyFor('__session'));
  },
};

// ---------------------------------------------------------------
//  Reset / seed control
// ---------------------------------------------------------------
export function isSeeded() {
  return localStorage.getItem(keyFor('__seeded')) === 'true';
}
export function markSeeded() {
  localStorage.setItem(keyFor('__seeded'), 'true');
}
export function resetAll() {
  COLLECTIONS.forEach((c) => localStorage.removeItem(keyFor(c)));
  localStorage.removeItem(keyFor('__session'));
  localStorage.removeItem(keyFor('__seeded'));
}

export { COLLECTIONS };
