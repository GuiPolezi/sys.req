import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/store';
import {
  workflowsForGroup, createWorkflow, updateWorkflow, deleteWorkflow,
  categoriesForGroup, groupMembers,
} from '../lib/domain';
import { Modal, Empty, ConfirmModal } from '../components/ui';

const NEW_STEP = { title: '', description: '', assignType: 'suporte', assignCategoryId: '', assignUserId: '' };

// Fluxos de trabalho — etapas que geram subchamados encadeados.
// Ex.: "Criar site" (dev da categoria Web) → "Checklist" (suporte) → devolve → finaliza.
export default function Workflows() {
  const { user, activeGroup, refresh } = useAuth();
  const [, setLocal] = useState(0);
  const [editing, setEditing] = useState(null); // { id?, name, steps: [] }
  const [confirm, setConfirm] = useState(null);
  const [error, setError] = useState('');
  const bump = () => { refresh(); setLocal((n) => n + 1); };

  const workflows = workflowsForGroup(activeGroup.id);
  const categories = categoriesForGroup(activeGroup.id);
  const techs = groupMembers(activeGroup).filter((m) => m.role !== 'solicitante');

  const save = () => {
    setError('');
    try {
      if (editing.id) updateWorkflow(editing.id, editing, user);
      else createWorkflow(activeGroup.id, editing, user);
      setEditing(null); bump();
    } catch (err) { setError(err.message); }
  };

  const describeAssign = (step) => {
    if (step.assignType === 'user') return db.byId('users', step.assignUserId)?.name || 'técnico específico';
    if (step.assignType === 'category') return `categoria ${db.byId('categories', step.assignCategoryId)?.name || '?'} (balanceado)`;
    if (step.assignType === 'creator') return 'responsável pelo chamado principal';
    return 'suporte (menos ocupado)';
  };

  const setStep = (i, patch) => {
    const steps = editing.steps.map((s, idx) => (idx === i ? { ...s, ...patch } : s));
    setEditing({ ...editing, steps });
  };
  const moveStep = (i, delta) => {
    const steps = [...editing.steps];
    const j = i + delta;
    if (j < 0 || j >= steps.length) return;
    [steps[i], steps[j]] = [steps[j], steps[i]];
    setEditing({ ...editing, steps });
  };
  const removeStep = (i) => setEditing({ ...editing, steps: editing.steps.filter((_, idx) => idx !== i) });

  return (
    <div>
      <div className="row between wrap page-head" style={{ gap: 10 }}>
        <div>
          <h1>Fluxos de trabalho</h1>
          <p className="muted">
            Sequências de etapas que geram subchamados encadeados. A 1ª etapa é o chamado principal;
            as demais são geradas dele e, ao concluir, devolvem ao responsável.
          </p>
        </div>
        <button className="btn-primary" onClick={() => { setError(''); setEditing({ name: '', steps: [{ ...NEW_STEP, title: '' }, { ...NEW_STEP }] }); }}>
          Novo fluxo
        </button>
      </div>

      {workflows.length === 0 && <div className="card"><Empty>Nenhum fluxo. Crie o primeiro (ex.: Criação de website → Checklist).</Empty></div>}

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
        {workflows.map((w) => {
          const usedBy = db.filter('services', (s) => s.workflowId === w.id).length;
          return (
            <div key={w.id} className="card card-pad">
              <div className="row between">
                <b>{w.name}</b>
                <div className="row" style={{ gap: 2 }}>
                  <button className="btn-ghost btn-sm" onClick={() => { setError(''); setEditing({ id: w.id, name: w.name, steps: w.steps.map((s) => ({ ...NEW_STEP, ...s, assignCategoryId: s.assignCategoryId || '', assignUserId: s.assignUserId || '' })) }); }}>Editar</button>
                  <button className="btn-ghost btn-sm btn-danger" onClick={() => setConfirm(w)}>Excluir</button>
                </div>
              </div>
              <div className="col mt" style={{ gap: 8 }}>
                {w.steps.map((s, i) => (
                  <div key={i} className="wf-step">
                    <span className="wf-num">{i + 1}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <b className="small">{s.title}</b>
                      <div className="muted small">→ {describeAssign(s)}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="muted small mt">{usedBy > 0 ? `Usado por ${usedBy} serviço(s).` : 'Nenhum serviço usa este fluxo ainda.'}</div>
            </div>
          );
        })}
      </div>

      {editing && (
        <Modal title={editing.id ? 'Editar fluxo' : 'Novo fluxo'} onClose={() => setEditing(null)}
          footer={<>
            <button onClick={() => setEditing(null)}>Cancelar</button>
            <button className="btn-primary" onClick={save}>Salvar fluxo</button>
          </>}>
          {error && <div className="alert alert-error">{error}</div>}
          <div className="field">
            <label>Nome do fluxo</label>
            <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              placeholder="Ex.: Criação de website" autoFocus />
          </div>

          <div className="field" style={{ marginBottom: 8 }}>
            <label>Etapas</label>
            <div className="hint" style={{ marginTop: 0, marginBottom: 8 }}>
              A etapa 1 é o chamado principal. As seguintes viram subchamados gerados a partir dele.
            </div>
          </div>

          {editing.steps.map((s, i) => (
            <div key={i} className="card card-pad mb" style={{ padding: 14 }}>
              <div className="row between mb" style={{ marginBottom: 8 }}>
                <b className="small">Etapa {i + 1}{i === 0 ? ' — chamado principal' : ''}</b>
                <div className="row" style={{ gap: 2 }}>
                  <button type="button" className="btn-ghost btn-sm" onClick={() => moveStep(i, -1)} disabled={i === 0}>↑</button>
                  <button type="button" className="btn-ghost btn-sm" onClick={() => moveStep(i, 1)} disabled={i === editing.steps.length - 1}>↓</button>
                  <button type="button" className="btn-ghost btn-sm btn-danger" onClick={() => removeStep(i)} disabled={editing.steps.length <= 1}>✕</button>
                </div>
              </div>
              <div className="field" style={{ marginBottom: 8 }}>
                <input value={s.title} onChange={(e) => setStep(i, { title: e.target.value })} placeholder="Título da etapa (ex.: Checklist do site)" />
              </div>
              <div className="field" style={{ marginBottom: 8 }}>
                <input value={s.description} onChange={(e) => setStep(i, { description: e.target.value })} placeholder="Descrição (opcional)" />
              </div>
              <div className="row wrap" style={{ gap: 8 }}>
                <select value={s.assignType} onChange={(e) => setStep(i, { assignType: e.target.value })} style={{ flex: 1, minWidth: 170 }}>
                  <option value="suporte">→ Suporte (menos ocupado)</option>
                  <option value="category">→ Categoria (dev balanceado)</option>
                  <option value="user">→ Técnico específico</option>
                  {i > 0 && <option value="creator">→ Responsável pelo principal</option>}
                </select>
                {s.assignType === 'category' && (
                  <select value={s.assignCategoryId} onChange={(e) => setStep(i, { assignCategoryId: e.target.value })} style={{ flex: 1, minWidth: 150 }}>
                    <option value="">Escolha a categoria</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                )}
                {s.assignType === 'user' && (
                  <select value={s.assignUserId} onChange={(e) => setStep(i, { assignUserId: e.target.value })} style={{ flex: 1, minWidth: 150 }}>
                    <option value="">Escolha o técnico</option>
                    {techs.map((m) => <option key={m.userId} value={m.userId}>{m.user.name} ({m.role})</option>)}
                  </select>
                )}
              </div>
            </div>
          ))}

          <button type="button" className="btn-sm" onClick={() => setEditing({ ...editing, steps: [...editing.steps, { ...NEW_STEP }] })}>
            + Adicionar etapa
          </button>
          <div className="hint mt">Vincule o fluxo a um serviço (página Serviços) para os chamados nascerem com ele.</div>
        </Modal>
      )}

      {confirm && (
        <ConfirmModal title="Excluir fluxo" danger confirmLabel="Excluir"
          message={<>Excluir o fluxo <b>{confirm.name}</b>? Serviços que o usam deixarão de gerar etapas.</>}
          onCancel={() => setConfirm(null)}
          onConfirm={() => { deleteWorkflow(confirm.id, user); setConfirm(null); bump(); }} />
      )}
    </div>
  );
}
