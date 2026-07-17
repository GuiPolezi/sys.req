import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/store';
import {
  servicesForGroup, createService, updateService, deleteService,
  categoriesForGroup, systemsForGroup, groupMembers, workflowsForGroup,
  URGENCY, TICKET_TYPES,
} from '../lib/domain';
import { Modal, Empty, ConfirmModal, UrgencyBadge } from '../components/ui';

const EMPTY = {
  name: '', ticketType: 'Solicitação', defaultTitle: '', description: '',
  systemId: '', categoryId: '', assignMode: 'none', assignTo: '', assignCategoryId: '',
  workflowId: '', urgency: 'media',
};

// Serviços = modelos que padronizam a criação de chamados. Agrupados por sistema.
export default function Services() {
  const { user, activeGroup, refresh } = useAuth();
  const [, setLocal] = useState(0);
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [error, setError] = useState('');
  const bump = () => { refresh(); setLocal((n) => n + 1); };

  const services = servicesForGroup(activeGroup.id);
  const categories = categoriesForGroup(activeGroup.id);
  const systems = systemsForGroup(activeGroup.id);
  const techs = groupMembers(activeGroup).filter((m) => m.role !== 'solicitante');
  const workflows = workflowsForGroup(activeGroup.id);

  const set = (k) => (e) => setEditing({ ...editing, [k]: e.target.value });

  const save = () => {
    setError('');
    try {
      if (editing.id) updateService(editing.id, editing, user);
      else createService(activeGroup.id, editing, user);
      setEditing(null); bump();
    } catch (err) { setError(err.message); }
  };

  // agrupa por sistema (+ um bloco "sem sistema")
  const groupsBySystem = [
    ...systems.map((s) => ({ system: s, list: services.filter((x) => x.systemId === s.id) })),
    { system: null, list: services.filter((x) => !x.systemId) },
  ].filter((g) => g.list.length > 0 || g.system);

  const describeAssign = (s) => {
    const mode = s.assignMode || (s.assignTo ? 'user' : 'none');
    if (mode === 'user') return `Atribui p/ ${db.byId('users', s.assignTo)?.name || '?'}`;
    if (mode === 'category') {
      const c = db.byId('categories', s.assignCategoryId);
      return `Distribui na categoria "${c?.name || '?'}" (dev com menos chamados)`;
    }
    return 'Sem atribuição (vai para o pool)';
  };

  return (
    <div>
      <div className="row between page-head">
        <div>
          <h1>Serviços</h1>
          <p className="muted">Modelos que padronizam a criação de chamados. Cada serviço pertence a um sistema.</p>
        </div>
        <button className="btn-primary" onClick={() => { setError(''); setEditing({ ...EMPTY }); }}>➕ Novo serviço</button>
      </div>

      {services.length === 0 && <div className="card"><Empty>Nenhum serviço. Crie o primeiro modelo de chamado.</Empty></div>}

      {groupsBySystem.map((g) => (
        <div key={g.system?.id || 'none'} className="mb">
          <h2 style={{ marginBottom: 10 }}>
            {g.system ? `🖥️ ${g.system.name}` : '📋 Sem sistema definido'}
            <span className="muted small" style={{ fontWeight: 400 }}> · {g.list.length} serviço(s)</span>
          </h2>
          {g.list.length === 0 ? (
            <div className="card"><Empty>Nenhum serviço para este sistema ainda.</Empty></div>
          ) : (
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
              {g.list.map((s) => {
                const cat = s.categoryId ? db.byId('categories', s.categoryId) : null;
                return (
                  <div key={s.id} className="card card-pad">
                    <div className="row between">
                      <b>{s.name}</b>
                      <div className="row" style={{ gap: 2 }}>
                        <button className="btn-ghost btn-sm" title="Editar"
                          onClick={() => { setError(''); setEditing({ ...EMPTY, ...s, assignMode: s.assignMode || (s.assignTo ? 'user' : 'none'), systemId: s.systemId || '', categoryId: s.categoryId || '', assignTo: s.assignTo || '', assignCategoryId: s.assignCategoryId || '', workflowId: s.workflowId || '' }); }}>✏️</button>
                        <button className="btn-ghost btn-sm btn-danger" title="Excluir" onClick={() => setConfirm(s)}>🗑️</button>
                      </div>
                    </div>
                    <div className="row wrap mt" style={{ gap: 6 }}>
                      <span className="chip">{s.ticketType}</span>
                      {cat && <span className="chip">🗂️ {cat.name}</span>}
                      <UrgencyBadge urgency={s.urgency} />
                    </div>
                    <div className="muted small mt">
                      {s.defaultTitle ? <>Título padrão: “{s.defaultTitle}”<br /></> : null}
                      {describeAssign(s)}
                      {s.workflowId && <><br />Fluxo: {db.byId('workflows', s.workflowId)?.name || '?'}</>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}

      {editing && (
        <Modal
          title={editing.id ? 'Editar serviço' : 'Novo serviço'}
          onClose={() => setEditing(null)}
          footer={<>
            <button onClick={() => setEditing(null)}>Cancelar</button>
            <button className="btn-primary" onClick={save}>Salvar serviço</button>
          </>}
        >
          {error && <div className="alert alert-error">{error}</div>}

          <div className="field">
            <label>Nome do serviço</label>
            <input value={editing.name} onChange={set('name')} placeholder="Ex.: Erro no site" autoFocus />
          </div>

          <div className="field">
            <label>Sistema afetado</label>
            <select value={editing.systemId} onChange={set('systemId')}>
              <option value="">— Sem sistema —</option>
              {systems.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <div className="hint">Ao abrir o chamado, o usuário escolhe o sistema e vê os serviços dele — o sistema já vem preenchido.</div>
          </div>

          <div className="row" style={{ gap: 10 }}>
            <div className="field" style={{ flex: 1 }}>
              <label>Tipo do chamado</label>
              <select value={editing.ticketType} onChange={set('ticketType')}>
                {TICKET_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Urgência padrão</label>
              <select value={editing.urgency} onChange={set('urgency')}>
                {Object.entries(URGENCY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>

          <div className="field">
            <label>Título padrão (prefixo)</label>
            <input value={editing.defaultTitle} onChange={set('defaultTitle')} placeholder="Ex.: Erro no site: " />
          </div>

          <div className="field">
            <label>Categoria do chamado</label>
            <select value={editing.categoryId} onChange={set('categoryId')}>
              <option value="">— Herdar do sistema —</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="divider" />

          {/* Atribuição — nova em v0.0.3: por técnico OU por categoria (balanceada) */}
          <div className="field">
            <label>➡️ Atribuição automática</label>
            <div className="row wrap" style={{ gap: 6, marginBottom: 8 }}>
              {[
                { k: 'none', label: 'Nenhuma' },
                { k: 'user', label: 'Técnico fixo' },
                { k: 'category', label: 'Por categoria' },
              ].map((o) => (
                <button key={o.k} type="button"
                  className={editing.assignMode === o.k ? 'btn-primary btn-sm' : 'btn-sm'}
                  onClick={() => setEditing({ ...editing, assignMode: o.k })}>
                  {o.label}
                </button>
              ))}
            </div>

            {editing.assignMode === 'user' && (
              <select value={editing.assignTo} onChange={set('assignTo')}>
                <option value="">Selecione um técnico</option>
                {techs.map((m) => <option key={m.userId} value={m.userId}>{m.user.name} ({m.role})</option>)}
              </select>
            )}

            {editing.assignMode === 'category' && (
              <>
                <select value={editing.assignCategoryId} onChange={set('assignCategoryId')}>
                  <option value="">Selecione a categoria</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <div className="hint">
                  O chamado vai automaticamente para o <b>desenvolvedor da categoria com menos chamados ativos</b>
                  {' '}— sem precisar escolher a pessoa.
                </div>
              </>
            )}

            {editing.assignMode === 'none' && (
              <div className="hint">O chamado ficará sem responsável e aparecerá no pool de não atribuídos.</div>
            )}
          </div>

          <div className="field" style={{ marginBottom: 0 }}>
            <label>Fluxo de trabalho (opcional)</label>
            <select value={editing.workflowId} onChange={set('workflowId')}>
              <option value="">— Sem fluxo —</option>
              {workflows.map((w) => <option key={w.id} value={w.id}>{w.name} ({w.steps.length} etapas)</option>)}
            </select>
            <div className="hint">
              Chamados deste serviço seguem as etapas do fluxo (as etapas seguintes viram subchamados).
            </div>
          </div>
        </Modal>
      )}

      {confirm && (
        <ConfirmModal
          title="Excluir serviço"
          danger
          message={<>Excluir o serviço <b>{confirm.name}</b>? Os chamados já criados por ele não são afetados.</>}
          confirmLabel="Excluir"
          onCancel={() => setConfirm(null)}
          onConfirm={() => { deleteService(confirm.id, user); setConfirm(null); bump(); }}
        />
      )}
    </div>
  );
}
