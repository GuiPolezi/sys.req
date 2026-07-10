// =============================================================
//  SEED — popula dados de demonstração na primeira execução
// =============================================================
import { db, isSeeded, markSeeded, COLLECTIONS, resetAll } from './store';
import {
  createUser,
  createGroup,
  createCategory,
  createSystem,
  createTicket,
  joinGroupByCode,
  updateMemberCategories,
  createService,
  registerAttendance,
  createInvitation,
  sendToReview,
  postTicketMessage,
  postInternalMessage,
} from './domain';

export function seedIfNeeded() {
  if (isSeeded()) return;

  // --- usuários -------------------------------------------------
  const ana = createUser({
    name: 'Ana Suporte', login: 'ana', email: 'ana@demo.com',
    password: '123', role: 'suporte', cidade: 'São Paulo',
  });
  const bruno = createUser({
    name: 'Bruno Dev', login: 'bruno', email: 'bruno@demo.com',
    password: '123', role: 'dev', cidade: 'São Paulo',
  });
  const carla = createUser({
    name: 'Carla Dev', login: 'carla', email: 'carla@demo.com',
    password: '123', role: 'dev', cidade: 'Campinas',
  });
  const davi = createUser({
    name: 'Davi Cliente', login: 'davi', email: 'davi@demo.com',
    password: '123', role: 'solicitante', cidade: 'Itajubá',
  });
  const elis = createUser({
    name: 'Elis Cliente', login: 'elis', email: 'elis@demo.com',
    password: '123', role: 'solicitante', cidade: 'Itajubá',
  });
  // dev sem grupo, para demonstrar o fluxo de convite (RP06)
  createUser({
    name: 'Fabio Dev', login: 'fabio', email: 'fabio@demo.com',
    password: '123', role: 'dev', cidade: 'São Paulo',
  });

  // --- grupo (Nome + Descrição, RP09) ---------------------------
  const group = createGroup(
    { name: 'Equipe TI — Cartório', description: 'Atendimento e desenvolvimento dos sistemas do cartório.' },
    ana,
  );

  // --- categorias de desenvolvedor (RP14) -----------------------
  const web = createCategory(group.id, { name: 'Desenvolvimento Web', systems: ['Siscam Web', 'Site'] }, ana);
  const desktop = createCategory(group.id, { name: 'Desenvolvimento Desktop', systems: ['Siscam 9', 'Siave'] }, ana);
  createCategory(group.id, { name: 'Infraestrutura', systems: ['Rede', 'Servidores'] }, ana);

  // --- sistemas do grupo (selecionáveis no chamado) ------------
  const sSiscam9 = createSystem(group.id, { name: 'Siscam 9', categoryId: desktop.id }, ana);
  createSystem(group.id, { name: 'Siave', categoryId: desktop.id }, ana);
  const sSite = createSystem(group.id, { name: 'Site institucional', categoryId: web.id }, ana);
  createSystem(group.id, { name: 'Siscam Web', categoryId: web.id }, ana);

  // --- entrada dos demais membros ------------------------------
  joinGroupByCode(bruno, group.techInviteCode);
  joinGroupByCode(carla, group.techInviteCode);
  joinGroupByCode(davi, group.requesterCode);
  joinGroupByCode(elis, group.requesterCode);

  // devs escolhem/atendem categorias específicas (RP15)
  updateMemberCategories(group.id, bruno.id, [desktop.id], ana);
  updateMemberCategories(group.id, carla.id, [web.id], ana);

  // convite pendente para o Fabio (aparece em "Convites")
  createInvitation(group.id, 'fabio', ana);

  // --- serviço padrão (RCS04/07) --------------------------------
  createService(group.id, {
    name: 'Erro em site (Web)',
    ticketType: 'Erro',
    defaultTitle: 'Erro no site: ',
    description: 'Padroniza chamados de erro do site para a equipe Web.',
    categoryId: web.id,
    assignTo: carla.id,
    urgency: 'alta',
  }, ana);
  createService(group.id, {
    name: 'Dúvida Desktop',
    ticketType: 'Dúvida',
    defaultTitle: 'Dúvida sobre ',
    categoryId: desktop.id,
    assignTo: null,
    urgency: 'baixa',
  }, ana);

  // --- tickets --------------------------------------------------
  const t1 = createTicket(group.id, {
    title: 'Siscam 9 não abre após atualização',
    description: 'Ao abrir o Siscam 9 aparece erro de conexão com o banco.',
    type: 'Erro', categoryId: desktop.id, systemId: sSiscam9.id, urgency: 'alta',
  }, davi);

  createTicket(group.id, {
    title: 'Dúvida sobre lançamento no Siave',
    description: 'Como faço para estornar um lançamento no Siave?',
    type: 'Dúvida', categoryId: desktop.id, urgency: 'baixa',
  }, elis);

  // ticket sem atribuição -> aparece no pool (RCS06)
  createTicket(group.id, {
    title: 'Melhoria: filtro por data no site',
    description: 'Seria útil filtrar registros por período no site.',
    type: 'Melhoria', categoryId: web.id, systemId: sSite.id, urgency: 'media',
  }, davi);

  // ticket em análise (RCS08)
  const t4 = createTicket(group.id, {
    title: 'Ajuste no rodapé do site',
    description: 'Atualizar telefone de contato no rodapé.',
    type: 'Ajuste', categoryId: web.id, urgency: 'media',
  }, elis);
  db.update('tickets', t4.id, { assignedTo: carla.id, status: 'em_andamento' });
  sendToReview(t4.id, carla);

  // --- atendimentos avulsos do suporte (RCS12) ------------------
  registerAttendance(group.id, { cidade: 'Itajubá', client: 'Cartório 1º Ofício', note: 'Suporte presencial na rede.' }, ana);
  registerAttendance(group.id, { cidade: 'Pouso Alegre', client: 'Cartório Central', note: 'Configuração de impressora fiscal.' }, ana);

  // --- conversas de exemplo ------------------------------------
  postTicketMessage(t1.id, davi.id, 'Bom dia! O erro começou hoje de manhã.');
  postTicketMessage(t1.id, bruno.id, 'Bom dia, Davi. Vou verificar a conexão com o servidor.');
  postInternalMessage(group.id, ana.id, 'Pessoal, priorizem os chamados do site hoje.');
  postInternalMessage(group.id, bruno.id, 'Ok, já peguei o do Siscam 9.');
  // mensagem no canal da categoria Web
  postInternalMessage(group.id, carla.id, 'Time Web: fechei o ajuste do rodapé, podem revisar.', web.id);

  markSeeded();
  return { ana, bruno, carla, davi, group };
}

// exportado para o botão "recarregar dados demo"
export function forceReseed() {
  resetAll();
  COLLECTIONS.forEach((c) => db.replaceAll(c, []));
  seedIfNeeded();
}
