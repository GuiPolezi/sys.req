// =============================================================
//  SEED — popula dados de demonstração na primeira execução
// =============================================================
import { db, isSeeded, markSeeded, COLLECTIONS, resetAll } from './store';
import {
  createUser, createGroup, createCategory, createSystem, createTicket,
  joinGroupByCode, updateMemberCategories, createService, createClient,
  createCity, createSla, createWorkflow, setMemberManager, setMemberRole,
  registerAttendance, createInvitation, sendToReview,
  postTicketMessage, postInternalMessage,
} from './domain';

export function seedIfNeeded() {
  if (isSeeded()) return;

  // Se uma execução anterior do seed falhou no meio (dados gravados sem a marca
  // de "seeded"), limpa o resíduo antes de popular de novo — evita "Login já em uso".
  if (db.all('users').length > 0) {
    resetAll();
    COLLECTIONS.forEach((c) => db.replaceAll(c, []));
  }

  // --- usuários (conta única, sem papel fixo — v0.0.5) ----------
  const ana = createUser({ name: 'Ana Suporte', login: 'ana', email: 'ana@demo.com', password: '123' });
  const bruno = createUser({ name: 'Bruno Dev', login: 'bruno', email: 'bruno@demo.com', password: '123' });
  const carla = createUser({ name: 'Carla Dev', login: 'carla', email: 'carla@demo.com', password: '123' });
  const davi = createUser({ name: 'Davi Cliente', login: 'davi', email: 'davi@demo.com', password: '123', cidade: 'Itajubá' });
  const elis = createUser({ name: 'Elis Cliente', login: 'elis', email: 'elis@demo.com', password: '123', cidade: 'Itajubá' });
  createUser({ name: 'Fabio Dev', login: 'fabio', email: 'fabio@demo.com', password: '123' });

  // --- grupo (ana cria e vira o suporte dele) -------------------
  const group = createGroup(
    { name: 'Equipe TI — Cartório', description: 'Atendimento e desenvolvimento dos sistemas do cartório.' },
    ana,
  );

  // --- cidades cadastradas (v0.0.5) -----------------------------
  createCity(group.id, 'Itajubá', ana);
  createCity(group.id, 'Pouso Alegre', ana);
  createCity(group.id, 'Araras', ana);

  // --- categorias -----------------------------------------------
  const web = createCategory(group.id, { name: 'Desenvolvimento Web' }, ana);
  const desktop = createCategory(group.id, { name: 'Desenvolvimento Desktop' }, ana);
  createCategory(group.id, { name: 'Infraestrutura' }, ana);

  // --- sistemas -------------------------------------------------
  const sSiscam9 = createSystem(group.id, { name: 'Siscam 9', categoryId: desktop.id }, ana);
  createSystem(group.id, { name: 'Siave', categoryId: desktop.id }, ana);
  const sSite = createSystem(group.id, { name: 'Site institucional', categoryId: web.id }, ana);
  createSystem(group.id, { name: 'Siscam Web', categoryId: web.id }, ana);

  // --- membros (v0.0.6: todos entram como solicitante; a equipe promove) ---
  joinGroupByCode(bruno, group.accessCode, 'São Paulo');
  joinGroupByCode(carla, group.accessCode, 'São Paulo');
  joinGroupByCode(davi, group.accessCode, 'Itajubá');
  joinGroupByCode(elis, group.accessCode, 'Itajubá');

  setMemberRole(group.id, bruno.id, 'dev', ana);
  setMemberRole(group.id, carla.id, 'dev', ana);
  updateMemberCategories(group.id, bruno.id, [desktop.id], ana);
  updateMemberCategories(group.id, carla.id, [web.id], ana);
  setMemberManager(group.id, bruno.id, true, ana); // Bruno é gerente

  createInvitation(group.id, 'fabio', ana);

  // --- SLAs (v0.0.5) --------------------------------------------
  createSla(group.id, { name: 'Crítico', urgency: 'alta', responseHours: 2, resolutionHours: 8 }, ana);
  createSla(group.id, { name: 'Padrão', urgency: 'media', responseHours: 8, resolutionHours: 48 }, ana);
  createSla(group.id, { name: 'Baixa prioridade', urgency: 'baixa', responseHours: 24, resolutionHours: 120 }, ana);

  // --- workflow: criação de website (v0.0.5) --------------------
  const wfSite = createWorkflow(group.id, {
    name: 'Criação de website',
    steps: [
      { title: 'Criar o site', description: 'Etapa principal — desenvolvimento do site.', assignType: 'category', assignCategoryId: web.id },
      { title: 'Checklist do site', description: 'Conferir conteúdo, links, responsividade e SEO.', assignType: 'suporte' },
    ],
  }, ana);

  // --- serviços -------------------------------------------------
  createService(group.id, {
    name: 'Criação de website', ticketType: 'Solicitação', defaultTitle: 'Criar site: ',
    systemId: sSite.id, categoryId: web.id,
    assignMode: 'category', assignCategoryId: web.id, urgency: 'media',
    workflowId: wfSite.id,
  }, ana);
  createService(group.id, {
    name: 'Erro no site', ticketType: 'Erro', defaultTitle: 'Erro no site: ',
    systemId: sSite.id, categoryId: web.id,
    assignMode: 'category', assignCategoryId: web.id, urgency: 'alta',
  }, ana);
  createService(group.id, {
    name: 'Dúvida sobre o Siscam 9', ticketType: 'Dúvida', defaultTitle: 'Dúvida: ',
    systemId: sSiscam9.id, categoryId: desktop.id,
    assignMode: 'user', assignTo: bruno.id, urgency: 'baixa',
  }, ana);

  // --- clientes -------------------------------------------------
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

  createTicket(group.id, {
    title: 'Melhoria: filtro por data no site',
    description: '<p>Seria útil filtrar registros por período no site.</p>',
    type: 'Melhoria', categoryId: web.id, systemId: sSite.id, urgency: 'media',
  }, davi);

  const t4 = createTicket(group.id, {
    title: 'Ajuste no rodapé do site',
    description: '<p>Atualizar telefone de contato no rodapé.</p>',
    type: 'Ajuste', categoryId: web.id, systemId: sSite.id, urgency: 'media',
  }, elis);
  db.update('tickets', t4.id, { assignedTo: carla.id, status: 'em_andamento' });
  sendToReview(t4.id, carla);

  // --- atendimentos ---------------------------------------------
  const clients = db.filter('clients', (c) => c.groupId === group.id);
  registerAttendance(group.id, { clientId: clients[0].id, note: 'Suporte presencial na rede.' }, ana);
  registerAttendance(group.id, { clientId: clients[1].id, note: 'Configuração de impressora fiscal.' }, ana);

  // --- conversas ------------------------------------------------
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
