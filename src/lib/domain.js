// =============================================================
//  CAMADA DE DOMÍNIO — regras de negócio do HELPDESK
//  (papéis, grupos, tickets, automações, permissões)
// =============================================================
import { db, uid, nowISO, shortCode } from './store';

export const ROLES = {
  suporte: { label: 'Suporte', color: '#2563eb' },
  dev: { label: 'Desenvolvedor', color: '#7c3aed' },
  solicitante: { label: 'Solicitante', color: '#0f766e' },
};

export const STATUS = {
  aberto: { label: 'Aberto', color: '#dc2626' },
  em_andamento: { label: 'Em andamento', color: '#d97706' },
  aguardando: { label: 'Aguardando', color: '#0891b2' },
  concluido: { label: 'Concluído', color: '#16a34a' },
};

export const URGENCY = {
  baixa: { label: 'Baixa', color: '#16a34a', weight: 1 },
  media: { label: 'Média', color: '#d97706', weight: 2 },
  alta: { label: 'Alta', color: '#dc2626', weight: 3 },
};

// ------------------------------------------------------------
//  USUÁRIOS / AUTENTICAÇÃO
// ------------------------------------------------------------
export function findUserByLogin(login) {
  const l = login.trim().toLowerCase();
  return db.find('users', (u) => u.login.toLowerCase() === l || u.email.toLowerCase() === l);
}

export function createUser({ name, login, email, password, role, cidade }) {
  if (findUserByLogin(login)) throw new Error('Login já em uso.');
  if (email && db.find('users', (u) => u.email.toLowerCase() === email.toLowerCase()))
    throw new Error('E-mail já cadastrado.');
  const user = {
    id: uid('user'),
    name: name.trim(),
    login: login.trim(),
    email: (email || '').trim(),
    password, // alpha: texto plano. No projeto real, hash no backend.
    role,
    cidade: (cidade || '').trim(),
    createdAt: nowISO(),
  };
  return db.insert('users', user);
}

export function authenticate(login, password) {
  const user = findUserByLogin(login);
  if (!user || user.password !== password) throw new Error('Credenciais inválidas.');
  return user;
}

// ------------------------------------------------------------
//  GRUPOS
// ------------------------------------------------------------
export function createGroup(name, ownerUser) {
  const group = {
    id: uid('grp'),
    name: name.trim(),
    ownerId: ownerUser.id,
    members: [{ userId: ownerUser.id, role: ownerUser.role, categoryIds: [] }],
    techInviteCode: shortCode(),
    requesterCode: shortCode(),
    createdAt: nowISO(),
  };
  return db.insert('groups', group);
}

export function groupsForUser(userId) {
  return db.filter('groups', (g) => g.members.some((m) => m.userId === userId));
}

export function membership(group, userId) {
  return group?.members.find((m) => m.userId === userId) || null;
}

export function joinGroupByCode(user, code) {
  const c = code.trim().toUpperCase();
  const group = db.find(
    'groups',
    (g) => g.techInviteCode === c || g.requesterCode === c
  );
  if (!group) throw new Error('Código inválido.');

  // solicitante só entra por requesterCode; técnico só por techInviteCode
  const isRequesterCode = group.requesterCode === c;
  if (user.role === 'solicitante' && !isRequesterCode)
    throw new Error('Este código não é de acesso para solicitantes.');
  if (user.role !== 'solicitante' && isRequesterCode)
    throw new Error('Este código é de acesso para solicitantes.');

  if (membership(group, user.id)) return group; // já é membro
  const members = [...group.members, { userId: user.id, role: user.role, categoryIds: [] }];
  return db.update('groups', group.id, { members });
}

export function updateMemberCategories(groupId, userId, categoryIds) {
  const group = db.byId('groups', groupId);
  const members = group.members.map((m) =>
    m.userId === userId ? { ...m, categoryIds } : m
  );
  return db.update('groups', groupId, { members });
}

export function regenerateCode(groupId, which) {
  const patch = which === 'tech' ? { techInviteCode: shortCode() } : { requesterCode: shortCode() };
  return db.update('groups', groupId, patch);
}

export function groupMembers(group) {
  return group.members
    .map((m) => ({ ...m, user: db.byId('users', m.userId) }))
    .filter((m) => m.user);
}

// ------------------------------------------------------------
//  CATEGORIAS DE SERVIÇO
// ------------------------------------------------------------
const CAT_COLORS = ['#2563eb', '#7c3aed', '#0891b2', '#db2777', '#ea580c', '#16a34a', '#4f46e5'];

export function categoriesForGroup(groupId) {
  return db.filter('categories', (c) => c.groupId === groupId);
}

export function createCategory(groupId, { name, systems }) {
  const count = categoriesForGroup(groupId).length;
  const category = {
    id: uid('cat'),
    groupId,
    name: name.trim(),
    systems: (systems || []).map((s) => s.trim()).filter(Boolean),
    color: CAT_COLORS[count % CAT_COLORS.length],
    createdAt: nowISO(),
  };
  return db.insert('categories', category);
}

export function deleteCategory(id) {
  db.remove('categories', id);
}

// ------------------------------------------------------------
//  TICKETS
// ------------------------------------------------------------
export function createTicket(groupId, data, author) {
  const ticket = {
    id: uid('tkt'),
    groupId,
    title: data.title.trim(),
    description: (data.description || '').trim(),
    type: data.type || 'Solicitação',
    categoryId: data.categoryId || null,
    status: 'aberto',
    urgency: data.urgency || 'media',
    createdBy: author.id,
    assignedTo: null,
    cidade: (data.cidade || author.cidade || '').trim(),
    attendances: [],
    createdAt: nowISO(),
    updatedAt: nowISO(),
  };
  db.insert('tickets', ticket);
  runAutomations(ticket); // atribuição automática
  return db.byId('tickets', ticket.id);
}

export function updateTicket(id, patch) {
  return db.update('tickets', id, { ...patch, updatedAt: nowISO() });
}

export function assignTicket(id, userId) {
  return updateTicket(id, {
    assignedTo: userId,
    status: userId ? 'em_andamento' : 'aberto',
  });
}

export function addAttendance(ticketId, userId, note) {
  const ticket = db.byId('tickets', ticketId);
  const attendances = [
    ...ticket.attendances,
    { id: uid('att'), userId, note: note.trim(), at: nowISO() },
  ];
  return updateTicket(ticketId, { attendances });
}

// Tickets que um usuário PODE ver, conforme papel
export function ticketsVisibleTo(group, user) {
  const all = db.filter('tickets', (t) => t.groupId === group.id);
  const mem = membership(group, user.id);
  if (!mem) return [];
  if (user.role === 'suporte') return all;
  if (user.role === 'dev') {
    const cats = mem.categoryIds || [];
    return all.filter(
      (t) => t.assignedTo === user.id || (t.categoryId && cats.includes(t.categoryId))
    );
  }
  // solicitante
  return all.filter((t) => t.createdBy === user.id);
}

// ------------------------------------------------------------
//  AUTOMAÇÕES  (condição -> atribuir para dev)
// ------------------------------------------------------------
export function automationsForGroup(groupId) {
  return db.filter('automations', (a) => a.groupId === groupId);
}

export function createAutomation(groupId, data) {
  const automation = {
    id: uid('auto'),
    groupId,
    name: data.name.trim(),
    condition: {
      categoryId: data.categoryId || null,
      urgency: data.urgency || null,
      type: data.type || null,
    },
    action: { assignTo: data.assignTo || null },
    enabled: true,
    createdAt: nowISO(),
  };
  return db.insert('automations', automation);
}

export function toggleAutomation(id, enabled) {
  return db.update('automations', id, { enabled });
}
export function deleteAutomation(id) {
  db.remove('automations', id);
}

function matches(condition, ticket) {
  if (condition.categoryId && condition.categoryId !== ticket.categoryId) return false;
  if (condition.urgency && condition.urgency !== ticket.urgency) return false;
  if (condition.type && condition.type !== ticket.type) return false;
  return true;
}

export function runAutomations(ticket) {
  const autos = automationsForGroup(ticket.groupId).filter((a) => a.enabled);
  for (const a of autos) {
    if (a.action.assignTo && matches(a.condition, ticket)) {
      db.update('tickets', ticket.id, {
        assignedTo: a.action.assignTo,
        status: 'em_andamento',
        updatedAt: nowISO(),
      });
      return; // primeira automação que casa vence
    }
  }
}

// ------------------------------------------------------------
//  CHAT
// ------------------------------------------------------------
export function ticketMessages(ticketId) {
  return db
    .filter('ticketMessages', (m) => m.ticketId === ticketId)
    .sort((a, b) => a.at.localeCompare(b.at));
}
export function postTicketMessage(ticketId, userId, text) {
  return db.insert('ticketMessages', {
    id: uid('msg'),
    ticketId,
    userId,
    text: text.trim(),
    at: nowISO(),
  });
}

export function internalMessages(groupId) {
  return db
    .filter('internalMessages', (m) => m.groupId === groupId)
    .sort((a, b) => a.at.localeCompare(b.at));
}
export function postInternalMessage(groupId, userId, text) {
  return db.insert('internalMessages', {
    id: uid('imsg'),
    groupId,
    userId,
    text: text.trim(),
    at: nowISO(),
  });
}
