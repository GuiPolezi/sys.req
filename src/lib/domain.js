// =============================================================
//  CAMADA DE DOMÍNIO — regras de negócio do HELPDESK (v02)
//  (papéis, grupos, convites, tickets, serviços, permissões,
//   auditoria, estatísticas/gamificação)
// =============================================================
import { db, uid, nowISO, shortCode } from './store';

// Paleta quente e harmônica com o tema "paper/clay" (design v02)
export const ROLES = {
  suporte: { label: 'Suporte', color: '#C15F3C' },
  dev: { label: 'Desenvolvedor', color: '#6A62A8' },
  solicitante: { label: 'Solicitante', color: '#3F8F7B' },
};

export const STATUS = {
  aberto: { label: 'Aberto', color: '#C2542F' },
  em_andamento: { label: 'Em andamento', color: '#C08A3E' },
  aguardando: { label: 'Aguardando', color: '#4A8D9E' },
  em_analise: { label: 'Em análise', color: '#6A62A8' }, // RCS08
  concluido: { label: 'Concluído', color: '#4F8A5B' },
};

export const URGENCY = {
  baixa: { label: 'Baixa', color: '#4F8A5B', weight: 1 },
  media: { label: 'Média', color: '#C08A3E', weight: 2 },
  alta: { label: 'Alta', color: '#C2542F', weight: 3 },
};

export const TICKET_TYPES = ['Solicitação', 'Erro', 'Dúvida', 'Melhoria', 'Ajuste'];

// ------------------------------------------------------------
//  PERMISSÕES (RNF03) — fonte única de autorização por papel
// ------------------------------------------------------------
export const isTech = (role) => role === 'suporte' || role === 'dev';

export const can = {
  manageGroup: (role) => role === 'suporte',            // convidar, apagar, categorias, atribuir
  createService: (role) => isTech(role),                // RCS04/07
  createTicket: () => true,                              // RCS01
  concludeTicket: (role) => isTech(role),               // RP20
  sendToReview: (role) => isTech(role),                 // RCS08
  leaveGroup: (role) => role !== 'solicitante',         // RP12
  viewMembers: (role) => role !== 'solicitante',        // RP05
  registerAttendance: (role) => role === 'suporte',     // RCS12 — exclusivo do suporte
  viewReports: (role) => role === 'suporte',            // RCS09 / RP16
  chooseOwnCategory: (role) => role === 'dev',          // RP15
  createTicketForOthers: (role) => isTech(role),        // técnico abre em nome de um solicitante
};

// Ações restritas ao RESPONSÁVEL pelo ticket (status, urgência, atendimentos).
export function isTicketOwner(ticket, user) {
  return !!ticket.assignedTo && ticket.assignedTo === user.id;
}
// Quem pode escrever no chat do chamado: o solicitante (autor) sempre; o técnico só se for o responsável.
export function canChatOnTicket(ticket, user) {
  if (user.role === 'solicitante') return ticket.createdBy === user.id || ticket.requesterId === user.id;
  return isTicketOwner(ticket, user);
}

// ------------------------------------------------------------
//  AUDITORIA (RP16)
// ------------------------------------------------------------
export function logAudit(groupId, actorId, action, detail = '') {
  if (!groupId) return;
  return db.insert('auditLog', {
    id: uid('log'),
    groupId,
    userId: actorId || null,
    action,
    detail,
    at: nowISO(),
  });
}

export function auditForGroup(groupId) {
  return db
    .filter('auditLog', (l) => l.groupId === groupId)
    .sort((a, b) => b.at.localeCompare(a.at));
}

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
  if (role === 'solicitante' && !(cidade || '').trim())
    throw new Error('Solicitante precisa informar a cidade.'); // RC06
  const user = {
    id: uid('user'),
    name: name.trim(),
    login: login.trim(),
    email: (email || '').trim(),
    password, // alpha: texto plano. No projeto real, hash no backend. (RNF10)
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

export function updateUser(id, patch) {
  return db.update('users', id, patch);
}

// ------------------------------------------------------------
//  GRUPOS
// ------------------------------------------------------------
export function createGroup({ name, description }, ownerUser) {
  if (!name.trim()) throw new Error('Informe o nome do grupo.');
  const group = {
    id: uid('grp'),
    name: name.trim(),
    description: (description || '').trim(),
    ownerId: ownerUser.id,
    members: [{ userId: ownerUser.id, role: ownerUser.role, categoryIds: [], joinedAt: nowISO() }],
    techInviteCode: shortCode(),
    requesterCode: shortCode(),
    createdAt: nowISO(),
  };
  db.insert('groups', group);
  logAudit(group.id, ownerUser.id, 'grupo.criado', `Grupo "${group.name}" criado.`);
  return group;
}

export function updateGroup(groupId, patch, actor) {
  const g = db.update('groups', groupId, patch);
  logAudit(groupId, actor?.id, 'grupo.editado', 'Dados do grupo atualizados.');
  return g;
}

export function groupsForUser(userId) {
  return db.filter('groups', (g) => g.members.some((m) => m.userId === userId));
}

export function membership(group, userId) {
  return group?.members.find((m) => m.userId === userId) || null;
}

export function groupMembers(group) {
  return group.members
    .map((m) => ({ ...m, user: db.byId('users', m.userId) }))
    .filter((m) => m.user);
}

export function joinGroupByCode(user, code) {
  const c = code.trim().toUpperCase();
  const group = db.find('groups', (g) => g.techInviteCode === c || g.requesterCode === c);
  if (!group) throw new Error('Código inválido.');

  const isRequesterCode = group.requesterCode === c;
  if (user.role === 'solicitante' && !isRequesterCode)
    throw new Error('Este código não é de acesso para solicitantes.');
  if (user.role !== 'solicitante' && isRequesterCode)
    throw new Error('Este código é de acesso para solicitantes.');

  if (membership(group, user.id)) return group; // já é membro
  const members = [...group.members, { userId: user.id, role: user.role, categoryIds: [], joinedAt: nowISO() }];
  const updated = db.update('groups', group.id, { members });
  logAudit(group.id, user.id, 'membro.entrou', `${user.name} entrou via código.`);
  return updated;
}

// RP12 — sair do grupo (exceto solicitante e dono)
export function leaveGroup(groupId, user) {
  const group = db.byId('groups', groupId);
  if (!group) throw new Error('Grupo não encontrado.');
  if (!can.leaveGroup(user.role)) throw new Error('Solicitantes não podem sair do grupo.');
  if (group.ownerId === user.id)
    throw new Error('O dono não pode sair. Transfira ou apague o grupo.');
  const members = group.members.filter((m) => m.userId !== user.id);
  db.update('groups', groupId, { members });
  // libera tickets atribuídos a quem saiu
  db.filter('tickets', (t) => t.groupId === groupId && t.assignedTo === user.id)
    .forEach((t) => db.update('tickets', t.id, { assignedTo: null }));
  logAudit(groupId, user.id, 'membro.saiu', `${user.name} saiu do grupo.`);
}

// RP13 — apagar grupo (só suporte/dono), remove todo o "organismo" do grupo
export function deleteGroup(groupId, actor) {
  const group = db.byId('groups', groupId);
  if (!group) return;
  if (actor.role !== 'suporte') throw new Error('Apenas o suporte pode apagar o grupo.');
  ['tickets', 'ticketMessages', 'internalMessages', 'categories', 'services', 'invitations', 'attendances', 'auditLog']
    .forEach((coll) => {
      if (coll === 'ticketMessages') {
        const ids = db.filter('tickets', (t) => t.groupId === groupId).map((t) => t.id);
        db.filter('ticketMessages', (m) => ids.includes(m.ticketId)).forEach((m) => db.remove('ticketMessages', m.id));
      } else {
        db.filter(coll, (r) => r.groupId === groupId).forEach((r) => db.remove(coll, r.id));
      }
    });
  db.remove('groups', groupId);
}

export function regenerateCode(groupId, which, actor) {
  const patch = which === 'tech' ? { techInviteCode: shortCode() } : { requesterCode: shortCode() };
  const g = db.update('groups', groupId, patch);
  logAudit(groupId, actor?.id, 'grupo.codigo', `Novo código (${which}) gerado.`);
  return g;
}

export function updateMemberCategories(groupId, userId, categoryIds, actor) {
  const group = db.byId('groups', groupId);
  const members = group.members.map((m) =>
    m.userId === userId ? { ...m, categoryIds } : m
  );
  const g = db.update('groups', groupId, { members });
  const who = db.byId('users', userId)?.name || '?';
  logAudit(groupId, actor?.id || userId, 'categoria.atribuida', `Categorias de ${who} atualizadas.`);
  return g;
}

// ------------------------------------------------------------
//  CONVITES (RP02 / RP06)
// ------------------------------------------------------------
export function createInvitation(groupId, inviteeLogin, actor) {
  const invitee = findUserByLogin(inviteeLogin);
  if (!invitee) throw new Error('Usuário não encontrado. Ele precisa ter conta.');
  if (invitee.role === 'solicitante')
    throw new Error('Solicitantes entram pelo código de cadastro, não por convite.');
  const group = db.byId('groups', groupId);
  if (membership(group, invitee.id)) throw new Error('Usuário já é membro do grupo.');
  const pending = db.find('invitations',
    (i) => i.groupId === groupId && i.inviteeId === invitee.id && i.status === 'pendente');
  if (pending) throw new Error('Já existe um convite pendente para este usuário.');

  const invite = db.insert('invitations', {
    id: uid('inv'),
    groupId,
    inviteeId: invitee.id,
    inviteeLogin: invitee.login,
    role: invitee.role,
    status: 'pendente',
    createdBy: actor.id,
    createdAt: nowISO(),
  });
  logAudit(groupId, actor.id, 'convite.enviado', `Convite para ${invitee.name}.`);
  return invite;
}

export function invitationsForUser(userId) {
  return db
    .filter('invitations', (i) => i.inviteeId === userId && i.status === 'pendente')
    .map((i) => ({ ...i, group: db.byId('groups', i.groupId) }))
    .filter((i) => i.group);
}

export function invitationsForGroup(groupId) {
  return db
    .filter('invitations', (i) => i.groupId === groupId)
    .map((i) => ({ ...i, invitee: db.byId('users', i.inviteeId) }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function respondInvitation(inviteId, accept) {
  const invite = db.byId('invitations', inviteId);
  if (!invite || invite.status !== 'pendente') throw new Error('Convite indisponível.');
  const user = db.byId('users', invite.inviteeId);
  if (accept) {
    const group = db.byId('groups', invite.groupId);
    if (!membership(group, user.id)) {
      const members = [...group.members, { userId: user.id, role: user.role, categoryIds: [], joinedAt: nowISO() }];
      db.update('groups', group.id, { members });
    }
    logAudit(invite.groupId, user.id, 'convite.aceito', `${user.name} aceitou o convite.`);
  } else {
    logAudit(invite.groupId, user.id, 'convite.recusado', `${user.name} recusou o convite.`);
  }
  return db.update('invitations', inviteId, { status: accept ? 'aceito' : 'recusado' });
}

// ------------------------------------------------------------
//  CATEGORIAS DE DESENVOLVEDOR (RP14/RP15)
// ------------------------------------------------------------
const CAT_COLORS = ['#C15F3C', '#6A62A8', '#4A8D9E', '#B5567E', '#C08A3E', '#4F8A5B', '#8A6D4B'];

export function categoriesForGroup(groupId) {
  return db.filter('categories', (c) => c.groupId === groupId);
}

export function createCategory(groupId, { name, systems }, actor) {
  const count = categoriesForGroup(groupId).length;
  const category = {
    id: uid('cat'),
    groupId,
    name: name.trim(),
    systems: (systems || []).map((s) => s.trim()).filter(Boolean),
    color: CAT_COLORS[count % CAT_COLORS.length],
    createdAt: nowISO(),
  };
  db.insert('categories', category);
  logAudit(groupId, actor?.id, 'categoria.criada', `Categoria "${category.name}" criada.`);
  return category;
}

export function deleteCategory(id, actor) {
  const cat = db.byId('categories', id);
  // RNF09 — desvincula tickets órfãos
  db.filter('tickets', (t) => t.categoryId === id).forEach((t) => db.update('tickets', t.id, { categoryId: null }));
  db.remove('categories', id);
  if (cat) logAudit(cat.groupId, actor?.id, 'categoria.removida', `Categoria "${cat.name}" removida.`);
}

// ------------------------------------------------------------
//  SISTEMAS DO GRUPO — identificam o sistema afetado no chamado
// ------------------------------------------------------------
export function systemsForGroup(groupId) {
  return db.filter('systems', (s) => s.groupId === groupId).sort((a, b) => a.name.localeCompare(b.name));
}

export function createSystem(groupId, { name, categoryId }, actor) {
  if (!name.trim()) throw new Error('Informe o nome do sistema.');
  const sys = {
    id: uid('sys'),
    groupId,
    name: name.trim(),
    categoryId: categoryId || null,
    createdAt: nowISO(),
  };
  db.insert('systems', sys);
  logAudit(groupId, actor?.id, 'sistema.criado', `Sistema "${sys.name}" adicionado.`);
  return sys;
}

export function deleteSystem(id, actor) {
  const sys = db.byId('systems', id);
  db.filter('tickets', (t) => t.systemId === id).forEach((t) => db.update('tickets', t.id, { systemId: null }));
  db.remove('systems', id);
  if (sys) logAudit(sys.groupId, actor?.id, 'sistema.removido', `Sistema "${sys.name}" removido.`);
}

// ------------------------------------------------------------
//  SERVIÇOS (RCS04 / RCS07) — templates de criação de tickets
// ------------------------------------------------------------
export function servicesForGroup(groupId) {
  return db.filter('services', (s) => s.groupId === groupId);
}

export function createService(groupId, data, actor) {
  const service = {
    id: uid('svc'),
    groupId,
    name: data.name.trim(),
    ticketType: data.ticketType || 'Solicitação',
    defaultTitle: (data.defaultTitle || '').trim(),
    description: (data.description || '').trim(),
    categoryId: data.categoryId || null,
    assignTo: data.assignTo || null,
    urgency: data.urgency || 'media',
    createdAt: nowISO(),
  };
  db.insert('services', service);
  logAudit(groupId, actor?.id, 'servico.criado', `Serviço "${service.name}" criado.`);
  return service;
}

export function deleteService(id, actor) {
  const svc = db.byId('services', id);
  db.remove('services', id);
  if (svc) logAudit(svc.groupId, actor?.id, 'servico.removido', `Serviço "${svc.name}" removido.`);
}

// ------------------------------------------------------------
//  TICKETS
// ------------------------------------------------------------
export function createTicket(groupId, data, author, serviceId = null) {
  const service = serviceId ? db.byId('services', serviceId) : null;

  // Quem é o solicitante do chamado?
  //  - solicitante abrindo: ele mesmo
  //  - técnico abrindo em nome de alguém: solicitante registrado (requesterId) ou nome avulso
  let requesterId = null;
  let requesterName = '';
  let cidade = '';
  if (author.role === 'solicitante') {
    requesterId = author.id;
    requesterName = author.name;
    cidade = author.cidade || '';
  } else {
    requesterId = data.requesterId || null;
    const reg = requesterId ? db.byId('users', requesterId) : null;
    requesterName = (reg?.name || data.requesterName || '').trim();
    cidade = (reg?.cidade || data.cidade || '').trim();
  }

  const assignedTo = data.assignTo || service?.assignTo || null; // técnico responsável
  const ticket = {
    id: uid('tkt'),
    groupId,
    title: data.title.trim(),
    description: data.description || '', // pode conter HTML (editor rico)
    type: data.type || service?.ticketType || 'Solicitação',
    categoryId: data.categoryId || service?.categoryId || null,
    systemId: data.systemId || null,
    status: 'aberto',
    urgency: data.urgency || service?.urgency || 'media',
    urgentAlert: false,
    createdBy: author.id,
    requesterId,
    requesterName,
    assignedTo,
    serviceId: serviceId || null,
    cidade: cidade.trim(),
    attendances: [],
    createdAt: nowISO(),
    updatedAt: nowISO(),
  };
  if (ticket.assignedTo) ticket.status = 'em_andamento';
  db.insert('tickets', ticket);
  logAudit(groupId, author.id, 'ticket.criado',
    `#${ticket.id.slice(-4)} "${ticket.title}"${service ? ` (serviço ${service.name})` : ''}.`);
  return db.byId('tickets', ticket.id);
}

export function updateTicket(id, patch) {
  return db.update('tickets', id, { ...patch, updatedAt: nowISO() });
}

export function assignTicket(id, userId, actor) {
  const t = updateTicket(id, {
    assignedTo: userId,
    status: userId ? 'em_andamento' : 'aberto',
  });
  const who = userId ? (db.byId('users', userId)?.name || '?') : 'ninguém';
  logAudit(t.groupId, actor?.id, 'ticket.atribuido', `#${id.slice(-4)} → ${who}.`);
  return t;
}

export function setStatus(id, status, actor) {
  const t = updateTicket(id, { status });
  logAudit(t.groupId, actor?.id, 'ticket.status', `#${id.slice(-4)} → ${STATUS[status]?.label || status}.`);
  return t;
}

export function setUrgency(id, urgency, actor) {
  const t = updateTicket(id, { urgency });
  logAudit(t.groupId, actor?.id, 'ticket.urgencia', `#${id.slice(-4)} → ${URGENCY[urgency]?.label || urgency}.`);
  return t;
}

// RCS05 — solicitante liga/desliga alerta de urgência
export function toggleUrgentAlert(id, on, actor) {
  const t = updateTicket(id, { urgentAlert: on, ...(on ? { urgency: 'alta' } : {}) });
  logAudit(t.groupId, actor?.id, 'ticket.alerta', `#${id.slice(-4)} alerta ${on ? 'LIGADO' : 'desligado'}.`);
  return t;
}

// RCS08 — fluxo de análise
export function sendToReview(id, actor) {
  const t = updateTicket(id, { status: 'em_analise' });
  logAudit(t.groupId, actor?.id, 'ticket.analise', `#${id.slice(-4)} enviado para análise.`);
  return t;
}
export function approveReview(id, actor) {
  const t = updateTicket(id, { status: 'concluido' });
  logAudit(t.groupId, actor?.id, 'ticket.aprovado', `#${id.slice(-4)} aprovado pelo solicitante.`);
  return t;
}
export function rejectReview(id, actor) {
  const t = updateTicket(id, { status: 'em_andamento', urgentAlert: false });
  logAudit(t.groupId, actor?.id, 'ticket.rejeitado', `#${id.slice(-4)} rejeitado — voltou ao dev.`);
  return t;
}

export function addAttendance(ticketId, userId, note) {
  const ticket = db.byId('tickets', ticketId);
  const attendances = [
    ...ticket.attendances,
    { id: uid('att'), userId, note: note.trim(), at: nowISO() },
  ];
  // registra também no log de atendimentos avulsos p/ estatística (RCS11)
  db.insert('attendances', {
    id: uid('atd'), groupId: ticket.groupId, userId, ticketId,
    cidade: ticket.cidade, client: '', note: note.trim(), at: nowISO(),
  });
  return updateTicket(ticketId, { attendances });
}

// Tickets que um usuário PODE ver, conforme papel
export function ticketsVisibleTo(group, user) {
  const all = db.filter('tickets', (t) => t.groupId === group.id);
  const mem = membership(group, user.id);
  if (!mem && user.role !== 'solicitante') return [];
  if (user.role === 'suporte') return all;                       // RP17
  if (user.role === 'dev') {                                     // RP18
    const cats = mem?.categoryIds || [];
    return all.filter(
      (t) =>
        t.assignedTo === user.id ||
        (t.categoryId && cats.includes(t.categoryId)) ||
        !t.assignedTo // sem atribuição aparece para o dev
    );
  }
  // solicitante (RP19): os seus (criados por si ou em seu nome) + os da sua cidade
  return all.filter(
    (t) =>
      t.createdBy === user.id ||
      t.requesterId === user.id ||
      (user.cidade && t.cidade && t.cidade.toLowerCase() === user.cidade.toLowerCase())
  );
}

// Tickets atribuídos a um técnico (página "Atribuídos a mim")
export function ticketsAssignedTo(groupId, userId) {
  return db
    .filter('tickets', (t) => t.groupId === groupId && t.assignedTo === userId)
    .sort((a, b) => {
      const done = { concluido: 1 };
      const ad = done[a.status] || 0, bd = done[b.status] || 0;
      if (ad !== bd) return ad - bd;
      return b.updatedAt.localeCompare(a.updatedAt);
    });
}

// RCS06 — pool de não-atribuídos (dashboard de devs)
export function unassignedTickets(groupId) {
  return db.filter('tickets', (t) => t.groupId === groupId && !t.assignedTo && t.status !== 'concluido');
}

// ------------------------------------------------------------
//  ATENDIMENTOS AVULSOS (RCS12)
// ------------------------------------------------------------
export function registerAttendance(groupId, data, actor) {
  const rec = db.insert('attendances', {
    id: uid('atd'),
    groupId,
    userId: actor.id,
    ticketId: null,
    cidade: (data.cidade || '').trim(),
    client: (data.client || '').trim(),
    note: (data.note || '').trim(),
    at: nowISO(),
  });
  logAudit(groupId, actor.id, 'atendimento.registrado', `Atendimento${data.cidade ? ` em ${data.cidade}` : ''} registrado.`);
  return rec;
}

export function attendancesForGroup(groupId) {
  return db
    .filter('attendances', (a) => a.groupId === groupId)
    .sort((a, b) => b.at.localeCompare(a.at));
}

// ------------------------------------------------------------
//  ESTATÍSTICAS / GAMIFICAÇÃO
// ------------------------------------------------------------
// RCS10 — XP e contadores do dev
export function devStats(groupId, userId) {
  const tickets = db.filter('tickets', (t) => t.groupId === groupId && t.assignedTo === userId);
  const finished = tickets.filter((t) => t.status === 'concluido').length;
  const assigned = tickets.length;
  const xp = finished * 100 + (assigned - finished) * 10;
  const level = Math.floor(xp / 500) + 1;
  const nextLevelXp = level * 500;
  return { assigned, finished, active: assigned - finished, xp, level, nextLevelXp };
}

// RCS11 — atendimentos do suporte (por dia e total)
export function supportStats(groupId, userId) {
  const list = db.filter('attendances', (a) => a.groupId === groupId && a.userId === userId);
  const byDay = {};
  list.forEach((a) => {
    const day = a.at.slice(0, 10);
    byDay[day] = (byDay[day] || 0) + 1;
  });
  const days = Object.entries(byDay)
    .map(([day, count]) => ({ day, count }))
    .sort((a, b) => b.day.localeCompare(a.day));
  const today = nowISO().slice(0, 10);
  return { total: list.length, today: byDay[today] || 0, days };
}

// RCS09 — ranking de quem mais abre solicitações (só SOLICITANTES; filtro por cidade)
export function requesterRanking(groupId, cidadeFilter = '') {
  const tickets = db.filter('tickets', (t) => t.groupId === groupId);
  const byUser = {};
  tickets.forEach((t) => {
    if (cidadeFilter && (t.cidade || '').toLowerCase() !== cidadeFilter.toLowerCase()) return;
    const uid_ = t.requesterId || t.createdBy; // conta para o solicitante em nome de quem foi aberto
    if (!uid_) return;
    byUser[uid_] = (byUser[uid_] || 0) + 1;
  });
  return Object.entries(byUser)
    .map(([userId, count]) => ({ user: db.byId('users', userId), count }))
    .filter((r) => r.user && r.user.role === 'solicitante') // técnicos são desconsiderados
    .sort((a, b) => b.count - a.count);
}

// Estatísticas do solicitante (perfil): total criado e concluídos
export function requesterStats(groupId, userId) {
  const mine = db.filter('tickets', (t) => t.groupId === groupId && (t.requesterId === userId || t.createdBy === userId));
  const total = mine.length;
  const concluido = mine.filter((t) => t.status === 'concluido').length;
  const emAndamento = mine.filter((t) => t.status !== 'concluido').length;
  return { total, concluido, emAndamento };
}

export function citiesInGroup(groupId) {
  const set = new Set();
  db.filter('tickets', (t) => t.groupId === groupId).forEach((t) => t.cidade && set.add(t.cidade));
  return [...set].sort();
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

// channel: 'geral' ou o id de uma categoria de dev
export function internalMessages(groupId, channel = 'geral') {
  return db
    .filter('internalMessages', (m) => m.groupId === groupId && (m.channel || 'geral') === channel)
    .sort((a, b) => a.at.localeCompare(b.at));
}
export function postInternalMessage(groupId, userId, text, channel = 'geral') {
  return db.insert('internalMessages', {
    id: uid('imsg'),
    groupId,
    userId,
    channel,
    text: text.trim(),
    at: nowISO(),
  });
}
