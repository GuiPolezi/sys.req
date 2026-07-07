import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/store';
import {
  automationsForGroup, createAutomation, toggleAutomation, deleteAutomation,
  categoriesForGroup, groupMembers, URGENCY,
} from '../lib/domain';
import { Modal, Empty, Avatar } from '../components/ui';

const TYPES = ['Solicitação', 'Erro', 'Dúvida', 'Melhoria'];

export default function Automations() {
  const { activeGroup, refresh } = useAuth();
  const [, setLocal] = useState(0);
  const [open, setOpen] = useState(false);
  const bump = () => { refresh(); setLocal((n) => n + 1); };

  const automations = automationsForGroup(activeGroup.id);
  const categories = categoriesForGroup(activeGroup.id);
  const techs = groupMembers(activeGroup).filter((m) => m.role !== 'solicitante');

  const [form, setForm] = useState({ name: '', categoryId: '', urgency: '', type: '', assignTo: '' });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = () => {
    if (!form.name.trim() || !form.assignTo) return;
    createAutomation(activeGroup.id, form);
    setForm({ name: '', categoryId: '', urgency: '', type: '', assignTo: '' });
    setOpen(false); bump();
  };

  const describe = (a) => {
    const parts = [];
    if (a.condition.categoryId) parts.push(`categoria "${db.byId('categories', a.condition.categoryId)?.name || '?'}"`);
    if (a.condition.urgency) parts.push(`urgência ${URGENCY[a.condition.urgency].label.toLowerCase()}`);
    if (a.condition.type) parts.push(`tipo ${a.condition.type}`);
    const cond = parts.length ? parts.join(' e ') : 'qualquer chamado';
    const who = db.byId('users', a.action.assignTo)?.name || '?';
    return `Quando ${cond} → atribuir para ${who}`;
  };

  return (
    <div>
      <div className="row between page-head">
        <div>
          <h1>Automações</h1>
          <p className="muted">Atribuem chamados automaticamente ao serem criados (workflow).</p>
        </div>
        <button className="btn-primary" onClick={() => setOpen(true)} disabled={techs.length === 0}>➕ Nova automação</button>
      </div>

      <div className="card">
        {automations.length === 0 ? (
          <Empty>Nenhuma automação. Crie regras para distribuir chamados sozinho.</Empty>
        ) : (
          automations.map((a) => (
            <div key={a.id} className="ticket-row" style={{ cursor: 'default' }}>
              <div style={{ flex: 1 }}>
                <div className="t-title">{a.name}</div>
                <div className="t-meta">{describe(a)}</div>
              </div>
              <label className="row small" style={{ gap: 6, marginBottom: 0 }}>
                <input type="checkbox" style={{ width: 'auto' }} checked={a.enabled}
                  onChange={(e) => { toggleAutomation(a.id, e.target.checked); bump(); }} />
                {a.enabled ? 'Ativa' : 'Inativa'}
              </label>
              <button className="btn-ghost btn-sm btn-danger" onClick={() => { deleteAutomation(a.id); bump(); }}>🗑️</button>
            </div>
          ))
        )}
      </div>

      {open && (
        <Modal
          title="Nova automação"
          onClose={() => setOpen(false)}
          footer={<>
            <button onClick={() => setOpen(false)}>Cancelar</button>
            <button className="btn-primary" onClick={save}>Salvar automação</button>
          </>}
        >
          <div className="field">
            <label>Nome da regra</label>
            <input value={form.name} onChange={set('name')} placeholder="Ex.: Siscam urgente para Bruno" autoFocus />
          </div>
          <div className="alert alert-info">Defina uma ou mais condições. Deixe em branco o que não importa.</div>
          <div className="row" style={{ gap: 10 }}>
            <div className="field" style={{ flex: 1 }}>
              <label>Categoria</label>
              <select value={form.categoryId} onChange={set('categoryId')}>
                <option value="">Qualquer</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Urgência</label>
              <select value={form.urgency} onChange={set('urgency')}>
                <option value="">Qualquer</option>
                {Object.entries(URGENCY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>
          <div className="field">
            <label>Tipo</label>
            <select value={form.type} onChange={set('type')}>
              <option value="">Qualquer</option>
              {TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="divider" />
          <div className="field" style={{ marginBottom: 0 }}>
            <label>➡️ Atribuir para</label>
            <select value={form.assignTo} onChange={set('assignTo')}>
              <option value="">Selecione um técnico</option>
              {techs.map((m) => <option key={m.userId} value={m.userId}>{m.user.name} ({m.role})</option>)}
            </select>
          </div>
        </Modal>
      )}
    </div>
  );
}
