// =============================================================
//  SEED — popula dados de demonstração na primeira execução
// =============================================================
import { db, isSeeded, markSeeded } from './store';
import {
  createUser,
  createGroup,
  createCategory,
  createTicket,
  joinGroupByCode,
  updateMemberCategories,
  createAutomation,
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
    password: '123', role: 'solicitante', cidade: 'Santos',
  });

  // --- grupo ----------------------------------------------------
  const group = createGroup('Equipe TI — Cartório', ana);

  // --- categorias de serviço -----------------------------------
  const siscam = createCategory(group.id, { name: 'Siscam', systems: ['Siscam 8', 'Siscam 9'] });
  const siave = createCategory(group.id, { name: 'Siave', systems: ['Siave Web'] });
  const workflow = createCategory(group.id, { name: 'Workflow', systems: ['Workflow', 'Firmas'] });
  createCategory(group.id, { name: 'Escrituras', systems: ['Escrituras', 'Site'] });

  // --- entrada dos demais membros ------------------------------
  joinGroupByCode(bruno, group.techInviteCode);
  joinGroupByCode(carla, group.techInviteCode);
  joinGroupByCode(davi, group.requesterCode);

  // devs atendem categorias específicas
  updateMemberCategories(group.id, bruno.id, [siscam.id, workflow.id]);
  updateMemberCategories(group.id, carla.id, [siave.id]);

  // --- automação: Siscam + urgência alta -> Bruno --------------
  createAutomation(group.id, {
    name: 'Siscam urgente para Bruno',
    categoryId: siscam.id,
    urgency: 'alta',
    assignTo: bruno.id,
  });

  // --- tickets --------------------------------------------------
  const t1 = createTicket(group.id, {
    title: 'Siscam 9 não abre após atualização',
    description: 'Ao abrir o Siscam 9 aparece erro de conexão com o banco.',
    type: 'Erro', categoryId: siscam.id, urgency: 'alta',
  }, davi);

  createTicket(group.id, {
    title: 'Dúvida sobre lançamento no Siave',
    description: 'Como faço para estornar um lançamento no Siave Web?',
    type: 'Dúvida', categoryId: siave.id, urgency: 'baixa',
  }, davi);

  createTicket(group.id, {
    title: 'Solicitar acesso ao Workflow',
    description: 'Novo funcionário precisa de acesso ao módulo de Firmas.',
    type: 'Solicitação', categoryId: workflow.id, urgency: 'media',
  }, davi);

  // --- conversas de exemplo ------------------------------------
  postTicketMessage(t1.id, davi.id, 'Bom dia! O erro começou hoje de manhã.');
  postTicketMessage(t1.id, bruno.id, 'Bom dia, Davi. Vou verificar a conexão com o servidor.');
  postInternalMessage(group.id, ana.id, 'Pessoal, priorizem os chamados de Siscam hoje.');
  postInternalMessage(group.id, bruno.id, 'Ok, já peguei o do Siscam 9.');

  markSeeded();
  return { ana, bruno, carla, davi, group };
}

// exportado para o botão "recarregar dados demo"
export function forceReseed() {
  db.replaceAll('users', []);
  db.replaceAll('groups', []);
  db.replaceAll('categories', []);
  db.replaceAll('tickets', []);
  db.replaceAll('ticketMessages', []);
  db.replaceAll('internalMessages', []);
  db.replaceAll('automations', []);
  localStorage.removeItem('helpdesk_alpha_v1:__seeded');
  seedIfNeeded();
}
