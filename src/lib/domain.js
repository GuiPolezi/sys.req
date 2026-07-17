// =============================================================
//  CAMADA DE DOMÍNIO — regras de negócio do HELPDESK (v0.0.3)
// =============================================================
import { db, uid, nowISO, shortCode } from './store';

// Paleta "aero" — tons vivos aqua/verde/âmbar, legíveis no claro e no escuro
export const ROLES = {
  suporte: { label: 'Suporte', color: '#0F9BD7' },
  dev: { label: 'Desenvolvedor', color: '#7A74C9' },
  solicitante: { label: 'Solicitante', color: '#2FA8A8' },
};

export const STATUS = {
  aberto: { label: 'Aberto', color: '#E06A4E' },
  em_andamento: { label: 'Em andamento', color: '#E3A93C' },
  aguardando: { label: 'Aguardando', color: '#2FA8A8' },
  em_analise: { label: 'Em análise', color: '#7A74C9' },
  concluido: { label: 'Concluído', color: '#34B27A' },
};

export const URGENCY = {
  baixa: { label: 'Baixa', color: '#34B27A', weight: 1 },
  media: { label: 'Média', color: '#E3A93C', weight: 2 },
  alta: { label: 'Alta', color: '#E06A4E', weight: 3 },
};

export const TICKET_TYPES = ['Solicitação', 'Erro', 'Dúvida', 'Melhoria', 'Ajuste'];

// ------------------------------------------------------------
//  PERMISSÕES — fonte única de autorização
// ------------------------------------------------------------
export const isTech = (role) => role === 'suporte' || role === 'dev';

export const can = {
  manageGroup: (role) => role === 'suporte',
  createService: (role) => isTech(role),
  concludeTicket: (role) => isTech(role),
  sendToReview: (role) => isTech(role),
  leaveGroup: (role) => role !== 'solicitante',
  viewMembers: (role) => role !== 'solicitante',
  registerAttendance: (role) => role === 'suporte',
  viewReports: (role) => role === 'suporte',
  chooseOwnCategory: (role) => role === 'dev',
  createTicketForOthers: (role) => isTech(role),
};

// --- regras do chamado ---------------------------------------
// Chamado concluído fica ENCERRADO: sem chat, sem edição (v0.0.3).
export function isTicketClosed(ticket) {
  return ticket.status === 'concluido';
}
// Responsável pelo chamado
export function isTicketOwner(ticket, user) {
  return !!ticket.assignedTo && ticket.assignedTo === user.id;
}
// Só o responsável edita status/urgência/atendimentos — e nunca após encerrado.
export function canEditTicket(ticket, user) {
  return !isTicketClosed(ticket) && isTicketOwner(ticket, user);
}
// Chat: solicitante (autor) sempre; técnico só se for o responsável. Nunca após encerrado.
export function canChatOnTicket(ticket, user) {
  if (isTicketClosed(ticket)) return false;
  if (user.role === 'solicitante') return ticket.createdBy === user.id || ticket.requesterId === user.id;
  return isTicketOwner(ticket, user);
}
// O solicitante do chamado (para notificações)
export function ticketRequesterId(ticket) {
  return ticket.requesterId || (ticket.createdBy || null);
}

// ------------------------------------------------------------
//  AUDITORIA
// ------------------------------------------------------------
export function logAudit(groupId, actorId, action, detail = '') {
  if (!groupId) return;
  return db.insert('auditLog', {
    id: uid('log'), groupId, userId: actorId || null, action, detail, at: nowISO(),
  });
}

export function auditForGroup(groupId) {
  return db.filter('auditLog', (l) => l.groupId === groupId).sort((a, b) => b.at.localeCompare(a.at));
}

// ------------------------------------------------------------
//  NOTIFICAÇÕES
// ------------------------------------------------------------
export function notify(groupId, userId, type, text, ticketId = null) {
  if (!groupId || !userId) return;
  return db.insert('notifications', {
    id: uid('ntf'), groupId, userId, type, ticketId, text, at: nowISO(), read: false,
  });
}

export function notificationsForUser(groupId, userId) {
  return db
    .filter('notifications', (n) => n.groupId === groupId && n.userId === userId)
    .sort((a, b) => b.at.localeCompare(a.at));
}

export function unreadNotifications(groupId, userId) {
  return db.filter('notifications', (n) => n.groupId === groupId && n.userId === userId && !n.read).length;
}

export function markNotificationRead(id) {
  return db.update('notifications', id, { read: true });
}

export function markAllNotificationsRead(groupId, userId) {
  db.filter('notifications', (n) => n.groupId === groupId && n.userId === userId && !n.read)
    .forEach((n) => db.update('notifications', n.id, { read: true }));
}

// Avisa as partes envolvidas no chamado (exceto quem executou a ação)
function notifyTicketParties(ticket, actorId, type, text) {
  const targets = new Set([ticketRequesterId(ticket), ticket.assignedTo].filter(Boolean));
  targets.delete(actorId);
  targets.forEach((uid_) => notify(ticket.groupId, uid_, type, text, ticket.id));
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
    throw new Error('Solicitante precisa informar a cidade.');
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

// Cadastro ATÔMICO (v0.0.3 — corrige o bug de criar o usuário mesmo com código inválido).
// Valida TUDO antes de gravar qualquer coisa.
export function registerUser(data, code) {
  const role = data.role;

  // 1) valida o código ANTES de criar o usuário
  let group = null;
  if (role === 'solicitante') {
    const c = (code || '').trim().toUpperCase();
    if (!c) throw new Error('Informe o código de acesso fornecido pelo suporte.');
    group = db.find('groups', (g) => g.requesterCode === c || g.techInviteCode === c);
    if (!group) throw new Error('Código inválido.');
    if (group.requesterCode !== c)
      throw new Error('Este código é de convite de técnicos. Peça ao suporte o código de solicitantes.');
  }

  // 2) valida os demais dados (login, e-mail, cidade) — createUser lança se houver problema
  const user = createUser(data);

  // 3) vincula ao grupo
  if (group) {
    const members = [...group.members, { userId: user.id, role: user.role, categoryIds: [], joinedAt: nowISO() }];
    db.update('groups', group.id, { members });
    logAudit(group.id, user.id, 'membro.entrou', `${user.name} cadastrou-se com o código de solicitantes.`);
  }
  return user;
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

  if (membership(group, user.id)) return group;
  const members = [...group.members, { userId: user.id, role: user.role, categoryIds: [], joinedAt: nowISO() }];
  const updated = db.update('groups', group.id, { members });
  logAudit(group.id, user.id, 'membro.entrou', `${user.name} entrou via código.`);
  return updated;
}

export function leaveGroup(groupId, user) {
  const group = db.byId('groups', groupId);
  if (!group) throw new Error('Grupo não encontrado.');
  if (!can.leaveGroup(user.role)) throw new Error('Solicitantes não podem sair do grupo.');
  if (group.ownerId === user.id) throw new Error('O dono não pode sair. Transfira ou apague o grupo.');
  const members = group.members.filter((m) => m.userId !== user.id);
  db.update('groups', groupId, { members });
  db.filter('tickets', (t) => t.groupId === groupId && t.assignedTo === user.id)
    .forEach((t) => db.update('tickets', t.id, { assignedTo: null }));
  logAudit(groupId, user.id, 'membro.saiu', `${user.name} saiu do grupo.`);
}

export function deleteGroup(groupId, actor) {
  const group = db.byId('groups', groupId);
  if (!group) return;
  if (actor.role !== 'suporte') throw new Error('Apenas o suporte pode apagar o grupo.');
  const ids = db.filter('tickets', (t) => t.groupId === groupId).map((t) => t.id);
  db.filter('ticketMessages', (m) => ids.includes(m.ticketId)).forEach((m) => db.remove('ticketMessages', m.id));
  ['tickets', 'internalMessages', 'categories', 'systems', 'services', 'invitations',
    'clients', 'attendances', 'notifications', 'chatReads', 'auditLog']
    .forEach((coll) => db.filter(coll, (r) => r.groupId === groupId).forEach((r) => db.remove(coll, r.id)));
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
  const members = group.members.map((m) => (m.userId === userId ? { ...m, categoryIds } : m));
  const g = db.update('groups', groupId, { members });
  const who = db.byId('users', userId)?.name || '?';
  logAudit(groupId, actor?.id || userId, 'categoria.atribuida', `Categorias de ${who} atualizadas.`);
  return g;
}

// ------------------------------------------------------------
//  CONVITES
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
    id: uid('inv'), groupId, inviteeId: invitee.id, inviteeLogin: invitee.login,
    role: invitee.role, status: 'pendente', createdBy: actor.id, createdAt: nowISO(),
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
//  CATEGORIAS DE DESENVOLVEDOR
// ------------------------------------------------------------
const CAT_COLORS = ['#0F9BD7', '#7A74C9', '#2FA8A8', '#D96BA0', '#E3A93C', '#34B27A', '#5F8FD9'];

export function categoriesForGroup(groupId) {
  return db.filter('categories', (c) => c.groupId === groupId);
}

export function createCategory(groupId, { name }, actor) {
  if (!name.trim()) throw new Error('Informe o nome da categoria.');
  const count = categoriesForGroup(groupId).length;
  const category = {
    id: uid('cat'), groupId, name: name.trim(),
    color: CAT_COLORS[count % CAT_COLORS.length], createdAt: nowISO(),
  };
  db.insert('categories', category);
  logAudit(groupId, actor?.id, 'categoria.criada', `Categoria "${category.name}" criada.`);
  return category;
}

export function updateCategory(id, { name }, actor) {
  const cat = db.update('categories', id, { name: name.trim() });
  logAudit(cat.groupId, actor?.id, 'categoria.editada', `Categoria "${cat.name}" editada.`);
  return cat;
}

export function deleteCategory(id, actor) {
  const cat = db.byId('categories', id);
  db.filter('tickets', (t) => t.categoryId === id).forEach((t) => db.update('tickets', t.id, { categoryId: null }));
  db.filter('systems', (s) => s.categoryId === id).forEach((s) => db.update('systems', s.id, { categoryId: null }));
  db.remove('categories', id);
  if (cat) logAudit(cat.groupId, actor?.id, 'categoria.removida', `Categoria "${cat.name}" removida.`);
}

// ------------------------------------------------------------
//  SISTEMAS DO GRUPO
// ------------------------------------------------------------
export function systemsForGroup(groupId) {
  return db.filter('systems', (s) => s.groupId === groupId).sort((a, b) => a.name.localeCompare(b.name));
}

// Sistemas vinculados a uma categoria (usado na tela de Categorias)
export function systemsForCategory(categoryId) {
  return db.filter('systems', (s) => s.categoryId === categoryId).sort((a, b) => a.name.localeCompare(b.name));
}

export function createSystem(groupId, { name, categoryId }, actor) {
  if (!name.trim()) throw new Error('Informe o nome do sistema.');
  const sys = {
    id: uid('sys'), groupId, name: name.trim(),
    categoryId: categoryId || null, createdAt: nowISO(),
  };
  db.insert('systems', sys);
  logAudit(groupId, actor?.id, 'sistema.criado', `Sistema "${sys.name}" adicionado.`);
  return sys;
}

export function updateSystem(id, { name, categoryId }, actor) {
  const sys = db.update('systems', id, { name: name.trim(), categoryId: categoryId || null });
  logAudit(sys.groupId, actor?.id, 'sistema.editado', `Sistema "${sys.name}" editado.`);
  return sys;
}

export function deleteSystem(id, actor) {
  const sys = db.byId('systems', id);
  db.filter('tickets', (t) => t.systemId === id).forEach((t) => db.update('tickets', t.id, { systemId: null }));
  db.filter('services', (s) => s.systemId === id).forEach((s) => db.update('services', s.id, { systemId: null }));
  db.remove('systems', id);
  if (sys) logAudit(sys.groupId, actor?.id, 'sistema.removido', `Sistema "${sys.name}" removido.`);
}

// ------------------------------------------------------------
//  SERVIÇOS (modelos de chamado)
//  assignMode: 'none' | 'user' (técnico fixo) | 'category' (balanceia entre os devs)
// ------------------------------------------------------------
export function servicesForGroup(groupId) {
  return db.filter('services', (s) => s.groupId === groupId);
}

// Serviços de um sistema (ou os "sem sistema", quando systemId é vazio)
export function servicesForSystem(groupId, systemId) {
  return servicesForGroup(groupId).filter((s) => (s.systemId || '') === (systemId || ''));
}

export function createService(groupId, data, actor) {
  if (!data.name.trim()) throw new Error('Informe o nome do serviço.');
  const service = {
    id: uid('svc'),
    groupId,
    name: data.name.trim(),
    ticketType: data.ticketType || 'Solicitação',
    defaultTitle: (data.defaultTitle || '').trim(),
    description: (data.description || '').trim(),
    systemId: data.systemId || null,
    categoryId: data.categoryId || null,
    assignMode: data.assignMode || 'none',
    assignTo: data.assignMode === 'user' ? (data.assignTo || null) : null,
    assignCategoryId: data.assignMode === 'category' ? (data.assignCategoryId || null) : null,
    urgency: data.urgency || 'media',
    createdAt: nowISO(),
  };
  db.insert('services', service);
  logAudit(groupId, actor?.id, 'servico.criado', `Serviço "${service.name}" criado.`);
  return service;
}

export function updateService(id, data, actor) {
  const svc = db.update('services', id, {
    name: data.name.trim(),
    ticketType: data.ticketType,
    defaultTitle: (data.defaultTitle || '').trim(),
    description: (data.description || '').trim(),
    systemId: data.systemId || null,
    categoryId: data.categoryId || null,
    assignMode: data.assignMode || 'none',
    assignTo: data.assignMode === 'user' ? (data.assignTo || null) : null,
    assignCategoryId: data.assignMode === 'category' ? (data.assignCategoryId || null) : null,
    urgency: data.urgency || 'media',
  });
  logAudit(svc.groupId, actor?.id, 'servico.editado', `Serviço "${svc.name}" editado.`);
  return svc;
}

export function deleteService(id, actor) {
  const svc = db.byId('services', id);
  db.remove('services', id);
  if (svc) logAudit(svc.groupId, actor?.id, 'servico.removido', `Serviço "${svc.name}" removido.`);
}

// Balanceamento: escolhe o dev DA CATEGORIA com menos chamados ativos.
export function pickDevForCategory(group, categoryId) {
  if (!group || !categoryId) return null;
  const devs = group.members.filter((m) => m.role === 'dev' && (m.categoryIds || []).includes(categoryId));
  if (!devs.length) return null;
  const load = devs.map((m) => ({
    userId: m.userId,
    count: db.filter('tickets',
      (t) => t.groupId === group.id && t.assignedTo === m.userId && t.status !== 'concluido').length,
  }));
  load.sort((a, b) => a.count - b.count);
  return load[0].userId;
}

// Carga da equipe: chamados ativos atribuídos por técnico (gráfico do painel)
export function teamLoad(group) {
  return groupMembers(group)
    .filter((m) => m.role !== 'solicitante')
    .map((m) => ({
      label: m.user.name.split(' ')[0],
      full: m.user.name,
      value: db.filter('tickets',
        (t) => t.groupId === group.id && t.assignedTo === m.userId && t.status !== 'concluido').length,
    }))
    .sort((a, b) => b.value - a.value);
}

// ------------------------------------------------------------
//  TICKETS
// ------------------------------------------------------------
export function createTicket(groupId, data, author, serviceId = null) {
  const group = db.byId('groups', groupId);
  const service = serviceId ? db.byId('services', serviceId) : null;

  // solicitante do chamado (pode ser diferente de quem registrou)
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

  const systemId = data.systemId || service?.systemId || null;
  const sys = systemId ? db.byId('systems', systemId) : null;
  const categoryId = data.categoryId || service?.categoryId || sys?.categoryId || null;

  // atribuição: escolha explícita > serviço (técnico fixo ou balanceado por categoria)
  let assignedTo = data.assignTo || null;
  if (!assignedTo && service) {
    const mode = service.assignMode || (service.assignTo ? 'user' : 'none');
    if (mode === 'user') assignedTo = service.assignTo || null;
    else if (mode === 'category') assignedTo = pickDevForCategory(group, service.assignCategoryId);
  }

  const ticket = {
    id: uid('tkt'),
    groupId,
    title: data.title.trim(),
    description: data.description || '', // HTML do editor rico
    type: data.type || service?.ticketType || 'Solicitação',
    categoryId,
    systemId,
    status: assignedTo ? 'em_andamento' : 'aberto',
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
  db.insert('tickets', ticket);
  logAudit(groupId, author.id, 'ticket.criado',
    `#${ticket.id.slice(-4)} "${ticket.title}"${service ? ` (serviço ${service.name})` : ''}.`);
  if (assignedTo && assignedTo !== author.id)
    notify(groupId, assignedTo, 'atribuicao', `Novo chamado atribuído a você: "${ticket.title}"`, ticket.id);
  return db.byId('tickets', ticket.id);
}

export function updateTicket(id, patch) {
  return db.update('tickets', id, { ...patch, updatedAt: nowISO() });
}

export function assignTicket(id, userId, actor) {
  const t = updateTicket(id, { assignedTo: userId, status: userId ? 'em_andamento' : 'aberto' });
  const who = userId ? (db.byId('users', userId)?.name || '?') : 'ninguém';
  logAudit(t.groupId, actor?.id, 'ticket.atribuido', `#${id.slice(-4)} → ${who}.`);
  if (userId && userId !== actor?.id)
    notify(t.groupId, userId, 'atribuicao', `Chamado atribuído a você: "${t.title}"`, t.id);
  return t;
}

export function setStatus(id, status, actor) {
  const t = updateTicket(id, { status });
  const label = STATUS[status]?.label || status;
  logAudit(t.groupId, actor?.id, 'ticket.status', `#${id.slice(-4)} → ${label}.`);
  notifyTicketParties(t, actor?.id, 'status', `Chamado "${t.title}" agora está: ${label}`);
  return t;
}

export function setUrgency(id, urgency, actor) {
  const t = updateTicket(id, { urgency });
  logAudit(t.groupId, actor?.id, 'ticket.urgencia', `#${id.slice(-4)} → ${URGENCY[urgency]?.label || urgency}.`);
  return t;
}

export function toggleUrgentAlert(id, on, actor) {
  const t = updateTicket(id, { urgentAlert: on, ...(on ? { urgency: 'alta' } : {}) });
  logAudit(t.groupId, actor?.id, 'ticket.alerta', `#${id.slice(-4)} alerta ${on ? 'LIGADO' : 'desligado'}.`);
  if (on && t.assignedTo && t.assignedTo !== actor?.id)
    notify(t.groupId, t.assignedTo, 'urgencia', `🚨 Alerta de urgência no chamado "${t.title}"`, t.id);
  return t;
}

export function sendToReview(id, actor) {
  const t = updateTicket(id, { status: 'em_analise' });
  logAudit(t.groupId, actor?.id, 'ticket.analise', `#${id.slice(-4)} enviado para análise.`);
  const req = ticketRequesterId(t);
  if (req && req !== actor?.id)
    notify(t.groupId, req, 'analise', `O chamado "${t.title}" aguarda sua análise. Confirme se foi resolvido.`, t.id);
  return t;
}

export function approveReview(id, actor) {
  const t = updateTicket(id, { status: 'concluido', urgentAlert: false });
  logAudit(t.groupId, actor?.id, 'ticket.aprovado', `#${id.slice(-4)} aprovado pelo solicitante — encerrado.`);
  if (t.assignedTo && t.assignedTo !== actor?.id)
    notify(t.groupId, t.assignedTo, 'aprovado', `✅ Solicitante aprovou o chamado "${t.title}". Encerrado.`, t.id);
  return t;
}

export function rejectReview(id, actor) {
  const t = updateTicket(id, { status: 'em_andamento', urgentAlert: false });
  logAudit(t.groupId, actor?.id, 'ticket.rejeitado', `#${id.slice(-4)} rejeitado — voltou ao dev.`);
  if (t.assignedTo && t.assignedTo !== actor?.id)
    notify(t.groupId, t.assignedTo, 'rejeitado', `👎 Solicitante rejeitou o chamado "${t.title}". Voltou para você.`, t.id);
  return t;
}

// Reabrir um chamado encerrado — exclusivo do suporte (evita travar o chamado por engano).
export function reopenTicket(id, actor) {
  if (actor.role !== 'suporte') throw new Error('Apenas o suporte pode reabrir um chamado encerrado.');
  const current = db.byId('tickets', id);
  const t = updateTicket(id, { status: current?.assignedTo ? 'em_andamento' : 'aberto' });
  logAudit(t.groupId, actor.id, 'ticket.reaberto', `#${id.slice(-4)} reaberto pelo suporte.`);
  notifyTicketParties(t, actor.id, 'status', `O chamado "${t.title}" foi reaberto pelo suporte.`);
  return t;
}

export function addAttendance(ticketId, userId, note) {
  const ticket = db.byId('tickets', ticketId);
  const attendances = [...ticket.attendances, { id: uid('att'), userId, note: note.trim(), at: nowISO() }];
  db.insert('attendances', {
    id: uid('atd'), groupId: ticket.groupId, userId, ticketId,
    clientId: null, client: '', cidade: ticket.cidade, note: note.trim(), at: nowISO(),
  });
  return updateTicket(ticketId, { attendances });
}

export function ticketsVisibleTo(group, user) {
  const all = db.filter('tickets', (t) => t.groupId === group.id);
  const mem = membership(group, user.id);
  if (!mem && user.role !== 'solicitante') return [];
  if (user.role === 'suporte') return all;
  if (user.role === 'dev') {
    const cats = mem?.categoryIds || [];
    return all.filter(
      (t) => t.assignedTo === user.id || (t.categoryId && cats.includes(t.categoryId)) || !t.assignedTo
    );
  }
  return all.filter(
    (t) => t.createdBy === user.id || t.requesterId === user.id ||
      (user.cidade && t.cidade && t.cidade.toLowerCase() === user.cidade.toLowerCase())
  );
}

export function ticketsAssignedTo(groupId, userId) {
  return db
    .filter('tickets', (t) => t.groupId === groupId && t.assignedTo === userId)
    .sort((a, b) => {
      const ad = a.status === 'concluido' ? 1 : 0;
      const bd = b.status === 'concluido' ? 1 : 0;
      if (ad !== bd) return ad - bd;
      return b.updatedAt.localeCompare(a.updatedAt);
    });
}

export function unassignedTickets(groupId) {
  return db.filter('tickets', (t) => t.groupId === groupId && !t.assignedTo && t.status !== 'concluido');
}

// Chamados do solicitante que estão aguardando a análise dele
export function ticketsAwaitingReview(groupId, userId) {
  return db.filter('tickets',
    (t) => t.groupId === groupId && t.status === 'em_analise' && ticketRequesterId(t) === userId);
}

// ------------------------------------------------------------
//  CLIENTES (usados no registro de atendimentos)
// ------------------------------------------------------------
export function clientsForGroup(groupId) {
  return db.filter('clients', (c) => c.groupId === groupId).sort((a, b) => a.name.localeCompare(b.name));
}

export function createClient(groupId, { name, cidade, contact, note }, actor) {
  if (!name.trim()) throw new Error('Informe o nome do cliente.');
  const client = {
    id: uid('cli'), groupId,
    name: name.trim(), cidade: (cidade || '').trim(),
    contact: (contact || '').trim(), note: (note || '').trim(),
    createdAt: nowISO(),
  };
  db.insert('clients', client);
  logAudit(groupId, actor?.id, 'cliente.criado', `Cliente "${client.name}" cadastrado.`);
  return client;
}

export function updateClient(id, { name, cidade, contact, note }, actor) {
  const c = db.update('clients', id, {
    name: name.trim(), cidade: (cidade || '').trim(),
    contact: (contact || '').trim(), note: (note || '').trim(),
  });
  logAudit(c.groupId, actor?.id, 'cliente.editado', `Cliente "${c.name}" editado.`);
  return c;
}

export function deleteClient(id, actor) {
  const c = db.byId('clients', id);
  db.filter('attendances', (a) => a.clientId === id).forEach((a) => db.update('attendances', a.id, { clientId: null }));
  db.remove('clients', id);
  if (c) logAudit(c.groupId, actor?.id, 'cliente.removido', `Cliente "${c.name}" removido.`);
}

// ------------------------------------------------------------
//  ATENDIMENTOS
// ------------------------------------------------------------
export function registerAttendance(groupId, data, actor) {
  const client = data.clientId ? db.byId('clients', data.clientId) : null;
  const rec = db.insert('attendances', {
    id: uid('atd'),
    groupId,
    userId: actor.id,
    ticketId: null,
    clientId: client?.id || null,
    client: (client?.name || data.client || '').trim(),
    cidade: (client?.cidade || data.cidade || '').trim(),
    note: (data.note || '').trim(),
    at: nowISO(),
  });
  logAudit(groupId, actor.id, 'atendimento.registrado',
    `Atendimento${rec.client ? ` — ${rec.client}` : ''}${rec.cidade ? ` (${rec.cidade})` : ''}.`);
  return rec;
}

export function attendancesForGroup(groupId) {
  return db.filter('attendances', (a) => a.groupId === groupId).sort((a, b) => b.at.localeCompare(a.at));
}

// Atendimentos por técnico — no dia informado (YYYY-MM-DD) ou no total
export function attendancesByTech(group, day = null) {
  return groupMembers(group)
    .filter((m) => m.role !== 'solicitante')
    .map((m) => {
      const list = db.filter('attendances',
        (a) => a.groupId === group.id && a.userId === m.userId && (!day || a.at.slice(0, 10) === day));
      return { label: m.user.name.split(' ')[0], full: m.user.name, value: list.length };
    })
    .sort((a, b) => b.value - a.value);
}

// ------------------------------------------------------------
//  ESTATÍSTICAS / GAMIFICAÇÃO
// ------------------------------------------------------------
export function devStats(groupId, userId) {
  const tickets = db.filter('tickets', (t) => t.groupId === groupId && t.assignedTo === userId);
  const finished = tickets.filter((t) => t.status === 'concluido').length;
  const assigned = tickets.length;
  const xp = finished * 100 + (assigned - finished) * 10;
  const level = Math.floor(xp / 500) + 1;
  return { assigned, finished, active: assigned - finished, xp, level, nextLevelXp: level * 500 };
}

export function supportStats(groupId, userId) {
  const list = db.filter('attendances', (a) => a.groupId === groupId && a.userId === userId);
  const byDay = {};
  list.forEach((a) => { const d = a.at.slice(0, 10); byDay[d] = (byDay[d] || 0) + 1; });
  const days = Object.entries(byDay).map(([day, count]) => ({ day, count })).sort((a, b) => b.day.localeCompare(a.day));
  const today = nowISO().slice(0, 10);
  return { total: list.length, today: byDay[today] || 0, days };
}

export function requesterRanking(groupId, cidadeFilter = '') {
  const tickets = db.filter('tickets', (t) => t.groupId === groupId);
  const byUser = {};
  tickets.forEach((t) => {
    if (cidadeFilter && (t.cidade || '').toLowerCase() !== cidadeFilter.toLowerCase()) return;
    const rid = ticketRequesterId(t);
    if (!rid) return;
    byUser[rid] = (byUser[rid] || 0) + 1;
  });
  return Object.entries(byUser)
    .map(([userId, count]) => ({ user: db.byId('users', userId), count }))
    .filter((r) => r.user && r.user.role === 'solicitante')
    .sort((a, b) => b.count - a.count);
}

export function requesterStats(groupId, userId) {
  const mine = db.filter('tickets',
    (t) => t.groupId === groupId && (t.requesterId === userId || t.createdBy === userId));
  return {
    total: mine.length,
    concluido: mine.filter((t) => t.status === 'concluido').length,
    emAndamento: mine.filter((t) => t.status !== 'concluido').length,
  };
}

export function citiesInGroup(groupId) {
  const set = new Set();
  db.filter('tickets', (t) => t.groupId === groupId).forEach((t) => t.cidade && set.add(t.cidade));
  db.filter('clients', (c) => c.groupId === groupId).forEach((c) => c.cidade && set.add(c.cidade));
  return [...set].sort();
}

// ------------------------------------------------------------
//  CHAT
// ------------------------------------------------------------
export function ticketMessages(ticketId) {
  return db.filter('ticketMessages', (m) => m.ticketId === ticketId).sort((a, b) => a.at.localeCompare(b.at));
}

export function postTicketMessage(ticketId, userId, text) {
  const msg = db.insert('ticketMessages', {
    id: uid('msg'), ticketId, userId, text: text.trim(), at: nowISO(),
  });
  const t = db.byId('tickets', ticketId);
  const author = db.byId('users', userId);
  if (t) notifyTicketParties(t, userId, 'mensagem', `💬 ${author?.name} enviou uma mensagem em "${t.title}"`);
  return msg;
}

// channel: 'geral' ou o id de uma categoria
export function internalMessages(groupId, channel = 'geral') {
  return db
    .filter('internalMessages', (m) => m.groupId === groupId && (m.channel || 'geral') === channel)
    .sort((a, b) => a.at.localeCompare(b.at));
}

export function postInternalMessage(groupId, userId, text, channel = 'geral') {
  return db.insert('internalMessages', {
    id: uid('imsg'), groupId, userId, channel, text: text.trim(), at: nowISO(),
  });
}

// --- leitura por canal (badge de não lidas) ---
export function markChannelRead(groupId, userId, channel) {
  const rec = db.find('chatReads',
    (r) => r.groupId === groupId && r.userId === userId && r.channel === channel);
  if (rec) return db.update('chatReads', rec.id, { at: nowISO() });
  return db.insert('chatReads', { id: uid('rd'), groupId, userId, channel, at: nowISO() });
}

export function channelUnread(groupId, userId, channel) {
  const rec = db.find('chatReads',
    (r) => r.groupId === groupId && r.userId === userId && r.channel === channel);
  const since = rec?.at || '';
  return db.filter('internalMessages',
    (m) => m.groupId === groupId && (m.channel || 'geral') === channel &&
      m.userId !== userId && m.at > since).length;
}

// Canais visíveis ao usuário: 'geral' + categorias.
// O suporte vê todas; o desenvolvedor vê apenas as categorias em que atua.
export function channelsForUser(group, user) {
  const cats = categoriesForGroup(group.id);
  const geral = { id: 'geral', name: 'Geral', icon: '💬' };
  if (user.role === 'suporte') {
    return [geral, ...cats.map((c) => ({ id: c.id, name: c.name, icon: '🗂️', color: c.color }))];
  }
  const mine = membership(group, user.id)?.categoryIds || [];
  return [
    geral,
    ...cats.filter((c) => mine.includes(c.id)).map((c) => ({ id: c.id, name: c.name, icon: '🗂️', color: c.color })),
  ];
}

export function internalUnreadTotal(group, user) {
  return channelsForUser(group, user)
    .reduce((sum, ch) => sum + channelUnread(group.id, user.id, ch.id), 0);
}
