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

// v0.0.5 — cadastro UNIFICADO: a conta não tem papel fixo; o papel é definido
// pela participação em cada grupo (código usado ou configuração do suporte).
export function createUser({ name, login, email, password, cidade }) {
  if (findUserByLogin(login)) throw new Error('Login já em uso.');
  if (email && db.find('users', (u) => u.email.toLowerCase() === email.toLowerCase()))
    throw new Error('E-mail já cadastrado.');
  const user = {
    id: uid('user'),
    name: name.trim(),
    login: login.trim(),
    email: (email || '').trim(),
    password, // alpha: texto plano. No projeto real, hash no backend.
    cidade: (cidade || '').trim(),
    createdAt: nowISO(),
  };
  return db.insert('users', user);
}

// v0.0.6 — o grupo tem UM único código de acesso. Quem entra por ele
// entra sempre como SOLICITANTE (informando a cidade); os técnicos do
// grupo promovem depois para dev/suporte, se for o caso.
export function groupAccessCode(group) {
  // compatível com grupos antigos (que tinham dois códigos)
  return group.accessCode || group.techInviteCode || group.requesterCode;
}

// Identifica o grupo de um código digitado (aceita códigos legados).
export function groupForCode(code) {
  const c = (code || '').trim().toUpperCase();
  if (!c) return null;
  const group = db.find(
    'groups',
    (g) => g.accessCode === c || g.requesterCode === c || g.techInviteCode === c
  );
  return group ? { group } : null;
}

// Vincula um usuário a um grupo como SOLICITANTE (entrada padrão).
function joinAsRequester(group, user, cidade) {
  const city = (cidade || user.cidade || '').trim();
  if (!city) throw new Error('Informe a sua cidade para entrar no grupo.');
  if (!user.cidade) db.update('users', user.id, { cidade: city });
  const members = [...group.members, { userId: user.id, role: 'solicitante', categoryIds: [], joinedAt: nowISO() }];
  db.update('groups', group.id, { members });
  logAudit(group.id, user.id, 'membro.entrou', `${user.name} entrou como solicitante (${city}).`);
}

// Cadastro ATÔMICO: valida TUDO antes de gravar qualquer coisa.
// - com código → entra no grupo como solicitante (cidade obrigatória)
// - sem código → conta criada; cria ou entra num grupo depois
export function registerUser(data, code) {
  const c = (code || '').trim();
  let match = null;
  if (c) {
    match = groupForCode(c);
    if (!match) throw new Error('Código inválido.');
    if (!(data.cidade || '').trim())
      throw new Error('Informe a sua cidade para entrar no grupo.');
  }

  const user = createUser(data);
  if (match) joinAsRequester(match.group, user, data.cidade);
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
    // quem cria o grupo é o suporte dele (papel é por grupo desde a v0.0.5)
    members: [{ userId: ownerUser.id, role: 'suporte', categoryIds: [], joinedAt: nowISO() }],
    accessCode: shortCode(), // código ÚNICO de acesso (v0.0.6)
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

// Entrada por código: SEMPRE como solicitante, informando a cidade (v0.0.6).
export function joinGroupByCode(user, code, cidade = '') {
  const match = groupForCode(code);
  if (!match) throw new Error('Código inválido.');
  const { group } = match;
  if (membership(group, user.id)) return group;
  joinAsRequester(group, user, cidade);
  return db.byId('groups', group.id);
}

// ------------------------------------------------------------
//  GESTÃO DE MEMBROS (v0.0.5) — papel, gerente, perfil, remoção
// ------------------------------------------------------------
function patchMember(groupId, userId, patch) {
  const group = db.byId('groups', groupId);
  const members = group.members.map((m) => (m.userId === userId ? { ...m, ...patch } : m));
  return db.update('groups', groupId, { members });
}

// Papel EFETIVO de um usuário num grupo. Nunca confie em actor.role
// diretamente: com o cadastro unificado, a conta pode não ter papel —
// a fonte da verdade é a membership.
export function roleInGroup(groupOrId, userId, fallback = null) {
  const group = typeof groupOrId === 'string' ? db.byId('groups', groupOrId) : groupOrId;
  return membership(group, userId)?.role || fallback;
}

function assertSuporte(groupId, actor, message) {
  if (roleInGroup(groupId, actor.id, actor.role) !== 'suporte') throw new Error(message);
}

// v0.0.6 — os TÉCNICOS do grupo (suporte e dev) definem o papel de cada membro:
// solicitante (padrão de entrada), desenvolvedor ou suporte.
export function setMemberRole(groupId, userId, role, actor) {
  if (!['solicitante', 'dev', 'suporte'].includes(role)) throw new Error('Papel inválido.');
  if (!isTech(roleInGroup(groupId, actor.id, actor.role)))
    throw new Error('Apenas técnicos do grupo podem alterar papéis.');
  const group = db.byId('groups', groupId);
  if (group.ownerId === userId && role !== 'suporte')
    throw new Error('O dono do grupo precisa continuar como suporte.');
  // ao virar solicitante, perde gerência e categorias
  const patch = role === 'solicitante' ? { role, isManager: false, categoryIds: [] } : { role };
  const g = patchMember(groupId, userId, patch);
  const who = db.byId('users', userId)?.name || '?';
  logAudit(groupId, actor.id, 'membro.papel', `${who} agora é ${ROLES[role]?.label || role}.`);
  return g;
}

// Marca/desmarca um técnico como GERENTE (pode atribuir chamados)
export function setMemberManager(groupId, userId, isManager, actor) {
  assertSuporte(groupId, actor, 'Apenas o suporte pode definir gerentes.');
  const g = patchMember(groupId, userId, { isManager: !!isManager });
  const who = db.byId('users', userId)?.name || '?';
  logAudit(groupId, actor.id, 'membro.gerente', `${who} ${isManager ? 'agora é gerente' : 'não é mais gerente'}.`);
  return g;
}

export function isManagerOf(group, userId) {
  return !!membership(group, userId)?.isManager;
}

// Quem pode ATRIBUIR chamados neste grupo (respeita a permissão configurada).
export function canAssignTickets(group, user) {
  if (user.role === 'suporte') return true;
  const perms = groupPermissions(group);
  return perms.assignTickets === 'sup_ger' && isManagerOf(group, user.id);
}

// Quem pode alterar a URGÊNCIA de um chamado (permissão configurável).
export function canChangeUrgency(group, ticket, user) {
  if (isTicketClosed(ticket)) return false;
  const perms = groupPermissions(group);
  if (perms.urgencyChange === 'suporte') return user.role === 'suporte';
  return isTicketOwner(ticket, user); // 'owner'
}

// A exclusão de chamados está liberada para este usuário?
export function canDeleteTickets(group, user) {
  return groupPermissions(group).ticketDelete === 'suporte' && user.role === 'suporte';
}

// Suporte edita o perfil de um membro (nome, e-mail, senha, cidade)
export function adminUpdateUser(groupId, userId, patch, actor) {
  assertSuporte(groupId, actor, 'Apenas o suporte pode editar membros.');
  const clean = {};
  if (patch.name?.trim()) clean.name = patch.name.trim();
  if (patch.email !== undefined) clean.email = patch.email.trim();
  if (patch.cidade !== undefined) clean.cidade = patch.cidade.trim();
  if (patch.password) clean.password = patch.password;
  const u = db.update('users', userId, clean);
  logAudit(groupId, actor.id, 'membro.editado',
    `Perfil de ${u?.name || '?'} editado pelo suporte${patch.password ? ' (senha redefinida)' : ''}.`);
  return u;
}

// Suporte remove um membro do grupo (chamados dele voltam ao pool)
export function removeMember(groupId, userId, actor) {
  assertSuporte(groupId, actor, 'Apenas o suporte pode remover membros.');
  const group = db.byId('groups', groupId);
  if (group.ownerId === userId) throw new Error('O dono do grupo não pode ser removido.');
  const who = db.byId('users', userId)?.name || '?';
  const members = group.members.filter((m) => m.userId !== userId);
  db.update('groups', groupId, { members });
  db.filter('tickets', (t) => t.groupId === groupId && t.assignedTo === userId)
    .forEach((t) => db.update('tickets', t.id, { assignedTo: null, status: t.status === 'concluido' ? 'concluido' : 'aberto' }));
  logAudit(groupId, actor.id, 'membro.removido', `${who} foi removido do grupo.`);
}

// ------------------------------------------------------------
//  PERMISSÕES CONFIGURÁVEIS DO GRUPO (v0.0.5)
// ------------------------------------------------------------
export const DEFAULT_PERMISSIONS = {
  ticketDelete: 'off',        // 'off' | 'suporte'  — exclusão de chamados
  urgencyChange: 'owner',     // 'owner' | 'suporte' — quem muda urgência
  assignTickets: 'sup_ger',   // 'sup_ger' | 'suporte' — quem atribui (gerentes incluídos?)
};

export function groupPermissions(group) {
  return { ...DEFAULT_PERMISSIONS, ...(group?.permissions || {}) };
}

export function updateGroupPermissions(groupId, permissions, actor) {
  assertSuporte(groupId, actor, 'Apenas o suporte pode configurar permissões.');
  const g = db.update('groups', groupId, { permissions });
  logAudit(groupId, actor.id, 'grupo.permissoes', 'Permissões do grupo atualizadas.');
  return g;
}

// Exclusão de chamado — bloqueada por padrão; liberável ao suporte via permissão.
export function deleteTicket(id, actor) {
  const t = db.byId('tickets', id);
  if (!t) return;
  const group = db.byId('groups', t.groupId);
  const perms = groupPermissions(group);
  if (perms.ticketDelete !== 'suporte' || roleInGroup(group, actor.id, actor.role) !== 'suporte')
    throw new Error('A exclusão de chamados está bloqueada pelas permissões do grupo.');
  const children = db.filter('tickets', (x) => x.parentId === id && x.status !== 'concluido');
  if (children.length) throw new Error('Este chamado tem subchamados abertos — conclua ou exclua-os antes.');
  db.filter('ticketMessages', (m) => m.ticketId === id).forEach((m) => db.remove('ticketMessages', m.id));
  db.remove('tickets', id);
  logAudit(t.groupId, actor.id, 'ticket.excluido', `#${t.number || t.id.slice(-4)} "${t.title}" excluído.`);
}

export function leaveGroup(groupId, user) {
  const group = db.byId('groups', groupId);
  if (!group) throw new Error('Grupo não encontrado.');
  if (!can.leaveGroup(roleInGroup(group, user.id, user.role))) throw new Error('Solicitantes não podem sair do grupo.');
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
  if (roleInGroup(group, actor.id, actor.role) !== 'suporte')
    throw new Error('Apenas o suporte pode apagar o grupo.');
  const ids = db.filter('tickets', (t) => t.groupId === groupId).map((t) => t.id);
  db.filter('ticketMessages', (m) => ids.includes(m.ticketId)).forEach((m) => db.remove('ticketMessages', m.id));
  ['tickets', 'internalMessages', 'categories', 'systems', 'services', 'invitations',
    'clients', 'attendances', 'notifications', 'chatReads', 'auditLog']
    .forEach((coll) => db.filter(coll, (r) => r.groupId === groupId).forEach((r) => db.remove(coll, r.id)));
  db.remove('groups', groupId);
}

export function regenerateCode(groupId, actor) {
  // invalida também códigos legados
  const g = db.update('groups', groupId, { accessCode: shortCode(), techInviteCode: null, requesterCode: null });
  logAudit(groupId, actor?.id, 'grupo.codigo', 'Novo código de acesso gerado.');
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

export function respondInvitation(inviteId, accept, cidade = '') {
  const invite = db.byId('invitations', inviteId);
  if (!invite || invite.status !== 'pendente') throw new Error('Convite indisponível.');
  const user = db.byId('users', invite.inviteeId);
  if (accept) {
    const group = db.byId('groups', invite.groupId);
    // v0.0.6 — todo mundo entra como solicitante (com cidade); técnicos promovem depois
    if (!membership(group, user.id)) joinAsRequester(group, user, cidade);
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
    workflowId: data.workflowId || null, // fluxo de trabalho vinculado (v0.0.5)
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
    workflowId: data.workflowId || null,
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
//  CIDADES (v0.0.5) — cadastro; campos "cidade" viram seleção
// ------------------------------------------------------------
export function cityList(groupId) {
  return db.filter('cities', (c) => c.groupId === groupId).sort((a, b) => a.name.localeCompare(b.name));
}

export function createCity(groupId, name, actor) {
  const n = (name || '').trim();
  if (!n) throw new Error('Informe o nome da cidade.');
  if (cityList(groupId).some((c) => c.name.toLowerCase() === n.toLowerCase()))
    throw new Error('Cidade já cadastrada.');
  const city = db.insert('cities', { id: uid('city'), groupId, name: n, createdAt: nowISO() });
  logAudit(groupId, actor?.id, 'cidade.criada', `Cidade "${n}" cadastrada.`);
  return city;
}

export function deleteCity(id, actor) {
  const c = db.byId('cities', id);
  db.remove('cities', id);
  if (c) logAudit(c.groupId, actor?.id, 'cidade.removida', `Cidade "${c.name}" removida.`);
}

// ------------------------------------------------------------
//  SLA (v0.0.5) — prazos por urgência (e opcionalmente categoria)
// ------------------------------------------------------------
export function slasForGroup(groupId) {
  return db.filter('slas', (s) => s.groupId === groupId);
}

export function createSla(groupId, data, actor) {
  if (!data.name.trim()) throw new Error('Informe o nome do SLA.');
  const sla = {
    id: uid('sla'),
    groupId,
    name: data.name.trim(),
    urgency: data.urgency || null,          // casa com a urgência do chamado (null = qualquer)
    categoryId: data.categoryId || null,    // opcional: restringe à categoria
    responseHours: Number(data.responseHours) || 0,   // prazo de 1ª resposta
    resolutionHours: Number(data.resolutionHours) || 0, // prazo de solução
    createdAt: nowISO(),
  };
  db.insert('slas', sla);
  logAudit(groupId, actor?.id, 'sla.criado', `SLA "${sla.name}" criado.`);
  return sla;
}

export function updateSla(id, data, actor) {
  const s = db.update('slas', id, {
    name: data.name.trim(),
    urgency: data.urgency || null,
    categoryId: data.categoryId || null,
    responseHours: Number(data.responseHours) || 0,
    resolutionHours: Number(data.resolutionHours) || 0,
  });
  logAudit(s.groupId, actor?.id, 'sla.editado', `SLA "${s.name}" editado.`);
  return s;
}

export function deleteSla(id, actor) {
  const s = db.byId('slas', id);
  db.remove('slas', id);
  if (s) logAudit(s.groupId, actor?.id, 'sla.removido', `SLA "${s.name}" removido.`);
}

// Melhor SLA para um chamado: categoria+urgência > urgência > genérico.
export function matchSla(groupId, { urgency, categoryId }) {
  const all = slasForGroup(groupId);
  return (
    all.find((s) => s.urgency === urgency && s.categoryId && s.categoryId === categoryId) ||
    all.find((s) => s.urgency === urgency && !s.categoryId) ||
    all.find((s) => !s.urgency && !s.categoryId) ||
    null
  );
}

// Situação do SLA de um chamado (prazo de solução).
export function slaInfo(ticket) {
  const sla = ticket.slaId ? db.byId('slas', ticket.slaId) : matchSla(ticket.groupId, ticket);
  if (!sla || !sla.resolutionHours) return null;
  const deadline = new Date(new Date(ticket.createdAt).getTime() + sla.resolutionHours * 3600_000);
  const done = ticket.status === 'concluido';
  const ref = done ? new Date(ticket.updatedAt) : new Date();
  const remainingMs = deadline.getTime() - ref.getTime();
  let status;
  if (done) status = remainingMs >= 0 ? 'cumprido' : 'violado';
  else if (remainingMs < 0) status = 'estourado';
  else if (remainingMs < 0.25 * sla.resolutionHours * 3600_000) status = 'risco';
  else status = 'ok';
  return { sla, deadline, status, remainingMs };
}

export const SLA_STATUS = {
  ok: { label: 'Dentro do prazo', color: '#34B27A' },
  risco: { label: 'Perto de vencer', color: '#E3A93C' },
  estourado: { label: 'Prazo estourado', color: '#E06A4E' },
  cumprido: { label: 'Cumprido', color: '#34B27A' },
  violado: { label: 'Violado', color: '#E06A4E' },
};

// ------------------------------------------------------------
//  WORKFLOWS (v0.0.5) — etapas que geram subchamados encadeados
//  Ex.: "Criar site" (dev) → etapa "Checklist" (suporte) → devolve → finaliza.
// ------------------------------------------------------------
export function workflowsForGroup(groupId) {
  return db.filter('workflows', (w) => w.groupId === groupId);
}

// step: { title, description, assignType: 'suporte'|'category'|'user'|'creator',
//         assignCategoryId?, assignUserId? }
export function createWorkflow(groupId, { name, steps }, actor) {
  if (!name.trim()) throw new Error('Informe o nome do fluxo.');
  const clean = (steps || []).filter((s) => s.title?.trim());
  if (!clean.length) throw new Error('Adicione pelo menos uma etapa.');
  const wf = db.insert('workflows', {
    id: uid('wf'), groupId, name: name.trim(),
    steps: clean.map((s) => ({
      title: s.title.trim(),
      description: (s.description || '').trim(),
      assignType: s.assignType || 'suporte',
      assignCategoryId: s.assignCategoryId || null,
      assignUserId: s.assignUserId || null,
    })),
    createdAt: nowISO(),
  });
  logAudit(groupId, actor?.id, 'workflow.criado', `Fluxo "${wf.name}" criado (${wf.steps.length} etapa(s)).`);
  return wf;
}

export function updateWorkflow(id, { name, steps }, actor) {
  const wf = db.update('workflows', id, {
    name: name.trim(),
    steps: (steps || []).filter((s) => s.title?.trim()),
  });
  logAudit(wf.groupId, actor?.id, 'workflow.editado', `Fluxo "${wf.name}" editado.`);
  return wf;
}

export function deleteWorkflow(id, actor) {
  const wf = db.byId('workflows', id);
  db.remove('workflows', id);
  if (wf) logAudit(wf.groupId, actor?.id, 'workflow.removido', `Fluxo "${wf.name}" removido.`);
}

// Resolve a atribuição de uma etapa do fluxo.
function resolveStepAssignee(group, step, parentTicket) {
  if (step.assignType === 'user') return step.assignUserId || null;
  if (step.assignType === 'category') return pickDevForCategory(group, step.assignCategoryId);
  if (step.assignType === 'creator') return parentTicket?.assignedTo || null; // devolve ao responsável do pai
  // 'suporte': o suporte com menos chamados ativos
  const sups = group.members.filter((m) => m.role === 'suporte');
  if (!sups.length) return null;
  const load = sups.map((m) => ({
    userId: m.userId,
    count: db.filter('tickets',
      (t) => t.groupId === group.id && t.assignedTo === m.userId && t.status !== 'concluido').length,
  })).sort((a, b) => a.count - b.count);
  return load[0].userId;
}

// Subchamados de um chamado
export function childTickets(parentId) {
  return db.filter('tickets', (t) => t.parentId === parentId);
}
export function openChildTickets(parentId) {
  return childTickets(parentId).filter((t) => t.status !== 'concluido');
}

// Próxima etapa do fluxo do chamado (null se acabou / sem fluxo)
export function nextWorkflowStep(ticket) {
  if (!ticket.workflowId) return null;
  const wf = db.byId('workflows', ticket.workflowId);
  if (!wf) return null;
  const done = childTickets(ticket.id).filter((t) => t.workflowStep != null).map((t) => t.workflowStep);
  const nextIdx = wf.steps.findIndex((_, i) => i > 0 && !done.includes(i));
  if (nextIdx === -1) return null;
  return { wf, step: wf.steps[nextIdx], index: nextIdx };
}

// Gera o subchamado da próxima etapa do fluxo.
export function advanceWorkflow(ticketId, actor) {
  const parent = db.byId('tickets', ticketId);
  const nxt = nextWorkflowStep(parent);
  if (!nxt) throw new Error('Não há próxima etapa neste fluxo.');
  const group = db.byId('groups', parent.groupId);
  const assignedTo = resolveStepAssignee(group, nxt.step, parent);
  const sub = createTicket(parent.groupId, {
    title: `${nxt.step.title} — ${parent.title}`,
    description: nxt.step.description ? `<p>${nxt.step.description}</p>` : '',
    type: parent.type,
    categoryId: parent.categoryId,
    systemId: parent.systemId,
    urgency: parent.urgency,
    assignTo: assignedTo,
    requesterId: parent.requesterId,
    requesterName: parent.requesterName,
    cidade: parent.cidade,
    parentId: parent.id,
    workflowId: parent.workflowId,
    workflowStep: nxt.index,
  }, actor);
  logAudit(parent.groupId, actor.id, 'workflow.etapa',
    `Etapa "${nxt.step.title}" gerada a partir de #${parent.number || parent.id.slice(-4)}.`);
  return sub;
}

// Cria um subchamado manual (sem fluxo) a partir de um chamado.
export function createSubticket(parentId, data, actor) {
  const parent = db.byId('tickets', parentId);
  const sub = createTicket(parent.groupId, {
    ...data,
    requesterId: parent.requesterId,
    requesterName: parent.requesterName,
    cidade: parent.cidade,
    parentId: parent.id,
  }, actor);
  return sub;
}

// ------------------------------------------------------------
//  TICKETS
// ------------------------------------------------------------
export function createTicket(groupId, data, author, serviceId = null) {
  const group = db.byId('groups', groupId);
  const service = serviceId ? db.byId('services', serviceId) : null;

  // papel efetivo do autor NESTE grupo (v0.0.5 — papel é por membership)
  const authorRole = membership(group, author.id)?.role || author.role || 'dev';

  // solicitante do chamado (pode ser diferente de quem registrou)
  let requesterId = null;
  let requesterName = '';
  let cidade = '';
  if (authorRole === 'solicitante') {
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

  // número sequencial por grupo (v0.0.5)
  const number = db.filter('tickets', (t) => t.groupId === groupId)
    .reduce((max, t) => Math.max(max, t.number || 0), 0) + 1;
  const urgency = data.urgency || service?.urgency || 'media';
  const sla = matchSla(groupId, { urgency, categoryId });

  const ticket = {
    id: uid('tkt'),
    number,
    groupId,
    title: data.title.trim(),
    description: data.description || '', // HTML do editor rico
    type: data.type || service?.ticketType || 'Solicitação',
    categoryId,
    systemId,
    status: assignedTo ? 'em_andamento' : 'aberto',
    urgency,
    urgentAlert: false,
    createdBy: author.id,
    requesterId,
    requesterName,
    assignedTo,
    serviceId: serviceId || null,
    slaId: sla?.id || null,
    workflowId: data.workflowId || service?.workflowId || null,
    workflowStep: data.workflowStep ?? (data.workflowId || service?.workflowId ? 0 : null),
    parentId: data.parentId || null,
    techReview: null, // análise técnica: { requestedBy, assignedTo, note, response, status, at }
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
  // um chamado com subchamados abertos não pode ser concluído (fluxo pai/filho)
  if (status === 'concluido' && openChildTickets(id).length > 0)
    throw new Error('Este chamado tem subchamados abertos. Conclua as etapas antes de finalizá-lo.');
  const t = updateTicket(id, { status });
  const label = STATUS[status]?.label || status;
  logAudit(t.groupId, actor?.id, 'ticket.status', `#${t.number || id.slice(-4)} → ${label}.`);
  notifyTicketParties(t, actor?.id, 'status', `Chamado "${t.title}" agora está: ${label}`);

  // subchamado concluído → avisa o responsável pelo chamado pai (devolução do fluxo)
  if (status === 'concluido' && t.parentId) {
    const parent = db.byId('tickets', t.parentId);
    if (parent?.assignedTo && parent.assignedTo !== actor?.id) {
      notify(t.groupId, parent.assignedTo, 'status',
        `✅ Etapa "${t.title}" concluída — o chamado #${parent.number || ''} pode seguir.`, parent.id);
    }
  }
  return t;
}

// ------------------------------------------------------------
//  ANÁLISE TÉCNICA (v0.0.5) — dev encaminha ao SUPORTE, que responde
// ------------------------------------------------------------
export function requestTechReview(ticketId, suporteId, note, actor) {
  const t = db.byId('tickets', ticketId);
  if (t.techReview?.status === 'pendente') throw new Error('Já existe uma análise pendente neste chamado.');
  const updated = updateTicket(ticketId, {
    techReview: {
      requestedBy: actor.id, assignedTo: suporteId,
      note: (note || '').trim(), response: '', status: 'pendente', at: nowISO(),
    },
  });
  logAudit(t.groupId, actor.id, 'ticket.analise_tecnica', `#${t.number || ''} enviado para análise do suporte.`);
  if (suporteId && suporteId !== actor.id)
    notify(t.groupId, suporteId, 'analise', `🔎 Análise técnica solicitada no chamado "${t.title}".`, ticketId);
  return updated;
}

export function respondTechReview(ticketId, response, actor) {
  const t = db.byId('tickets', ticketId);
  if (!t.techReview || t.techReview.status !== 'pendente') throw new Error('Não há análise pendente.');
  if (t.techReview.assignedTo !== actor.id && roleInGroup(t.groupId, actor.id, actor.role) !== 'suporte')
    throw new Error('Apenas o suporte designado pode responder a análise.');
  const updated = updateTicket(ticketId, {
    techReview: { ...t.techReview, response: (response || '').trim(), status: 'respondida', respondedAt: nowISO() },
  });
  logAudit(t.groupId, actor.id, 'ticket.analise_respondida', `Análise técnica de #${t.number || ''} respondida.`);
  if (t.techReview.requestedBy && t.techReview.requestedBy !== actor.id)
    notify(t.groupId, t.techReview.requestedBy, 'analise', `✅ O suporte respondeu a análise do chamado "${t.title}".`, ticketId);
  return updated;
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
  if (openChildTickets(id).length > 0)
    throw new Error('Este chamado tem subchamados abertos. Conclua as etapas antes de enviar para análise.');
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
  const current = db.byId('tickets', id);
  if (roleInGroup(current?.groupId, actor.id, actor.role) !== 'suporte')
    throw new Error('Apenas o suporte pode reabrir um chamado encerrado.');
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
  db.filter('cities', (c) => c.groupId === groupId).forEach((c) => set.add(c.name));
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
// Suporte vê todas; dev vê as categorias em que atua; solicitante não vê canais (só DMs).
export function channelsForUser(group, user) {
  if (user.role === 'solicitante') return [];
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

// ------------------------------------------------------------
//  CONVERSAS INDIVIDUAIS (DM) — v0.0.5
//  Reutilizam internalMessages com channel = 'dm:<idA>:<idB>' (ordenado).
// ------------------------------------------------------------
export function dmChannelId(userA, userB) {
  return `dm:${[userA, userB].sort().join(':')}`;
}

// Com quem o usuário pode conversar: todos os demais membros do grupo.
export function dmContacts(group, user) {
  return groupMembers(group).filter((m) => m.userId !== user.id);
}

export function dmUnreadFrom(group, user, otherId) {
  return channelUnread(group.id, user.id, dmChannelId(user.id, otherId));
}

export function internalUnreadTotal(group, user) {
  const channels = channelsForUser(group, user)
    .reduce((sum, ch) => sum + channelUnread(group.id, user.id, ch.id), 0);
  const dms = dmContacts(group, user)
    .reduce((sum, m) => sum + dmUnreadFrom(group, user, m.userId), 0);
  return channels + dms;
}

// ------------------------------------------------------------
//  PRESENÇA (v0.0.6) — técnicos online (último acesso por grupo)
// ------------------------------------------------------------
const ONLINE_WINDOW_MS = 5 * 60_000; // considerado online por 5 min

export function touchPresence(groupId, userId) {
  const rec = db.find('presence', (p) => p.groupId === groupId && p.userId === userId);
  if (rec) return db.update('presence', rec.id, { at: nowISO() });
  return db.insert('presence', { id: uid('prs'), groupId, userId, at: nowISO() });
}

export function lastSeen(groupId, userId) {
  return db.find('presence', (p) => p.groupId === groupId && p.userId === userId)?.at || null;
}

export function isOnline(groupId, userId) {
  const at = lastSeen(groupId, userId);
  return !!at && Date.now() - new Date(at).getTime() < ONLINE_WINDOW_MS;
}

// ------------------------------------------------------------
//  PREFERÊNCIAS DO PAINEL — widgets escolhidos pelo usuário
// ------------------------------------------------------------
export const DASH_WIDGETS_TECH = [
  { key: 'kpis', label: 'Indicadores (KPIs)' },
  { key: 'serie', label: 'Chamados criados (linha do tempo)' },
  { key: 'status', label: 'Distribuição por status' },
  { key: 'urgencia', label: 'Por urgência e categoria' },
  { key: 'sistemas', label: 'Chamados por sistema' },
  { key: 'cidades', label: 'Chamados por cidade' },
  { key: 'tempo', label: 'Tempo médio de resolução' },
  { key: 'analises', label: 'Análises pendentes' },
  { key: 'equipe', label: 'Carga da equipe' },
  { key: 'sla', label: 'Situação de SLA' },
  { key: 'recentes', label: 'Atividade recente' },
];
export const DASH_WIDGETS_SUPORTE = [
  ...DASH_WIDGETS_TECH,
  { key: 'atendimentos', label: 'Atendimentos (últimos 7 dias)' },
];
export const DASH_WIDGETS_REQUESTER = [
  { key: 'kpis', label: 'Meus números' },
  { key: 'serie', label: 'Meus chamados (linha do tempo)' },
  { key: 'status', label: 'Distribuição por status' },
  { key: 'sistemas', label: 'Por sistema' },
  { key: 'recentes', label: 'Atividade recente' },
];

export function dashWidgetsFor(role) {
  if (role === 'solicitante') return DASH_WIDGETS_REQUESTER;
  if (role === 'suporte') return DASH_WIDGETS_SUPORTE;
  return DASH_WIDGETS_TECH;
}

export function getDashPrefs(groupId, userId, role) {
  const rec = db.find('prefs', (p) => p.groupId === groupId && p.userId === userId && p.kind === 'dashboard');
  if (rec) return rec.widgets;
  return dashWidgetsFor(role).map((w) => w.key); // padrão: tudo ligado
}

export function saveDashPrefs(groupId, userId, widgets) {
  const rec = db.find('prefs', (p) => p.groupId === groupId && p.userId === userId && p.kind === 'dashboard');
  if (rec) return db.update('prefs', rec.id, { widgets });
  return db.insert('prefs', { id: uid('prf'), groupId, userId, kind: 'dashboard', widgets });
}
