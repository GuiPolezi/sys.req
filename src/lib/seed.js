// =============================================================
//  SEED — popula dados de demonstração na primeira execução
// =============================================================
import { db, isSeeded, markSeeded, COLLECTIONS, resetAll } from './store';
import {
  createUser, createGroup, createCategory, createSystem, createTicket,
  joinGroupByCode, updateMemberCategories, createService, createClient,
  registerAttendance, createInvitation, sendToReview,
  postTicketMessage, postInternalMessage,
} from './domain';

export function seedIfNeeded() {
  if (isSeeded()) return;

  // --- usuários -------------------------------------------------
  const ana = createUser({ name: 'Ana Suporte', login: 'ana', email: 'ana@demo.com', password: '123', role: 'suporte' });
  const bruno = createUser({ name: 'Bruno Dev', login: 'bruno', email: 'bruno@demo.com', password: '123', role: 'dev' });
  const carla = createUser({ name: 'Carla Dev', login: 'carla', email: 'carla@demo.com', password: '123', role: 'dev' });
  const davi = createUser({ name: 'Davi Cliente', login: 'davi', email: 'davi@demo.com', password: '123', role: 'solicitante', cidade: 'Itajubá' });
  const elis = createUser({ name: 'Elis Cliente', login: 'elis', email: 'elis@demo.com', password: '123', role: 'solicitante', cidade: 'Itajubá' });
  // dev sem grupo, para demonstrar o fluxo de convite
  createUser({ name: 'Fabio Dev', login: 'fabio', email: 'fabio@demo.com', password: '123', role: 'dev' });

  // --- grupo ----------------------------------------------------
  const group = createGroup(
    { name: 'Equipe TI — Cartório', description: 'Atendimento e desenvolvimento dos sistemas do cartório.' },
    ana,
  );

  // --- categorias de desenvolvedor ------------------------------
  const web = createCategory(group.id, { name: 'Desenvolvimento Web' }, ana);
  const desktop = createCategory(group.id, { name: 'Desenvolvimento Desktop' }, ana);
  createCategory(group.id, { name: 'Infraestrutura' }, ana);

  // --- sistemas do grupo ---------------------------------------
  const sSiscam9 = createSystem(group.id, { name: 'Siscam 9', categoryId: desktop.id }, ana);
  createSystem(group.id, { name: 'Siave', categoryId: desktop.id }, ana);
  const sSite = createSystem(group.id, { name: 'Site institucional', categoryId: web.id }, ana);
  createSystem(group.id, { name: 'Siscam Web', categoryId: web.id }, ana);

  // --- membros --------------------------------------------------
  joinGroupByCode(bruno, group.techInviteCode);
  joinGroupByCode(carla, group.techInviteCode);
  joinGroupByCode(davi, group.requesterCode);
  joinGroupByCode(elis, group.requesterCode);

  updateMemberCategories(group.id, bruno.id, [desktop.id], ana);
  updateMemberCategories(group.id, carla.id, [web.id], ana);

  createInvitation(group.id, 'fabio', ana);

  // --- serviços (agrupados por sistema) ------------------------
  // atribuição balanceada por categoria: vai para o dev da categoria com menos chamados
  createService(group.id, {
    name: 'Erro no site', ticketType: 'Erro', defaultTitle: 'Erro no site: ',
    systemId: sSite.id, categoryId: web.id,
    assignMode: 'category', assignCategoryId: web.id, urgency: 'alta',
  }, ana);
  createService(group.id, {
    name: 'Melhoria no site', ticketType: 'Melhoria', defaultTitle: 'Melhoria: ',
    systemId: sSite.id, categoryId: web.id,
    assignMode: 'none', urgency: 'baixa',
  }, ana);
  createService(group.id, {
    name: 'Dúvida sobre o Siscam 9', ticketType: 'Dúvida', defaultTitle: 'Dúvida: ',
    systemId: sSiscam9.id, categoryId: desktop.id,
    assignMode: 'user', assignTo: bruno.id, urgency: 'baixa',
  }, ana);

  // --- clientes (usados no registro de atendimentos) ------------
  createClient(group.id, { name: 'Cartório 1º Ofício', cidade: 'Itajubá', contact: '(35) 3622-0000' }, ana);
  createClient(group.id, { name: 'Cartório Central', cidade: 'Pouso Alegre', contact: '(35) 3421-1111' }, ana);

  // --- tickets --------------------------------------------------
  const t1 = createTicket(group.id, {
    title: 'Siscam 9 não abre após atualização',
    description: '<p>Ao abrir o Siscam 9 aparece <b>erro de conexão com o banco</b>.</p>',
    type: 'Erro', categoryId: desktop.id, systemId: sSiscam9.id, urgency: 'alta',
  }, davi);

  createTicket(group.id, {
    title: 'Dúvida sobre lançamento no Siave',
    description: '<p>Como faço para estornar um lançamento no Siave?</p>',
    type: 'Dúvida', categoryId: desktop.id, urgency: 'baixa',
  }, elis);

  // sem atribuição -> aparece no pool
  createTicket(group.id, {
    title: 'Melhoria: filtro por data no site',
    description: '<p>Seria útil filtrar registros por período no site.</p>',
    type: 'Melhoria', categoryId: web.id, systemId: sSite.id, urgency: 'media',
  }, davi);

  // em análise -> demonstra a notificação e o fluxo de aprovação
  const t4 = createTicket(group.id, {
    title: 'Ajuste no rodapé do site',
    description: '<p>Atualizar telefone de contato no rodapé.</p>',
    type: 'Ajuste', categoryId: web.id, systemId: sSite.id, urgency: 'media',
  }, elis);
  db.update('tickets', t4.id, { assignedTo: carla.id, status: 'em_andamento' });
  sendToReview(t4.id, carla);

  // --- atendimentos avulsos ------------------------------------
  const clients = db.filter('clients', (c) => c.groupId === group.id);
  registerAttendance(group.id, { clientId: clients[0].id, note: 'Suporte presencial na rede.' }, ana);
  registerAttendance(group.id, { clientId: clients[1].id, note: 'Configuração de impressora fiscal.' }, ana);

  // --- conversas -----------------------------------------------
  postTicketMessage(t1.id, davi.id, 'Bom dia! O erro começou hoje de manhã.');
  postTicketMessage(t1.id, bruno.id, 'Bom dia, Davi. Vou verificar a conexão com o servidor.');
  postInternalMessage(group.id, ana.id, 'Pessoal, priorizem os chamados do site hoje.');
  postInternalMessage(group.id, bruno.id, 'Ok, já peguei o do Siscam 9.');
  postInternalMessage(group.id, carla.id, 'Time Web: fechei o ajuste do rodapé, podem revisar.', web.id);

  markSeeded();
  return { ana, bruno, carla, davi, group };
}

// botão "recarregar dados demo"
export function forceReseed() {
  resetAll();
  COLLECTIONS.forEach((c) => db.replaceAll(c, []));
  seedIfNeeded();
}
