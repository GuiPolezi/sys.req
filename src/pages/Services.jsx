import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/store';
import {
  servicesForGroup, createService, deleteService,
  categoriesForGroup, groupMembers, URGENCY, TICKET_TYPES,
} from '../lib/domain';
import { Modal, Empty, UrgencyBadge } from '../components/ui';

// RCS04 / RCS07 — serviços padronizam a criação de tickets
export default function Services() {
  const { user, activeGroup, refresh } = useAuth();
  const [, setLocal] = useState(0);
  const [open, setOpen] = useState(false);
  const bump = () => { refresh(); setLocal((n) => n + 1); };

  const services = servicesForGroup(activeGroup.id);
  const categories = categoriesForGroup(activeGroup.id);
  const techs = groupMembers(activeGroup).filter((m) => m.role !== 'solicitante');

  const empty = { name: '', ticketType: 'Solicitação', defaultTitle: '', description: '', categoryId: '', assignTo: '', urgency: 'media' };
  const [form, setForm] = useState(empty);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = () => {
    if (!form.name.trim()) return;
    createService(activeGroup.id, form, user);
    setForm(empty); setOpen(false); bump();
  };

  return (
    <div>
      <div className="row between page-head">
        <div>
          <h1>Serviços</h1>
          <p className="muted">Modelos que padronizam a criação de chamados (título, categoria, atribuição, urgência). RCS07</p>
        </div>
        <button className="btn-primary" onClick={() => setOpen(true)}>➕ Novo serviço</button>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
        {services.length === 0 && <div className="card"><Empty>Nenhum serviço. Crie o primeiro modelo de chamado.</Empty></div>}
        {services.map((s) => {
          const cat = s.categoryId ? db.byId('categories', s.categoryId) : null;
          const assignee = s.assignTo ? db.byId('users', s.assignTo) : null;
          return (
            <div key={s.id} className="card card-pad">
              <div className="row between">
                <b>{s.name}</b>
                <button className="btn-ghost btn-sm btn-danger" onClick={() => { deleteService(s.id, user); bump(); }}>🗑️</button>
              </div>
              <div className="row wrap mt" style={{ gap: 6 }}>
                <span className="chip">{s.ticketType}</span>
                {cat && <span className="chip">🗂️ {cat.name}</span>}
                <UrgencyBadge urgency={s.urgency} />
              </div>
              <div className="muted small mt">
                {s.defaultTitle ? <>Título padrão: “{s.defaultTitle}”<br /></> : null}
                {assignee ? `Atribui p/ ${assignee.name}` : 'Sem atribuição automática'}
              </div>
            </div>
          );
        })}
      </div>

      {open && (
        <Modal
          title="Novo serviço"
          onClose={() => setOpen(false)}
          footer={<>
            <button onClick={() => setOpen(false)}>Cancelar</button>
            <button className="btn-primary" onClick={save}>Salvar serviço</button>
          </>}
        >
          <div className="field">
            <label>Nome do serviço</label>
            <input value={form.name} onChange={set('name')} placeholder="Ex.: Erro em site (Web)" autoFocus />
          </div>
          <div className="row" style={{ gap: 10 }}>
            <div className="field" style={{ flex: 1 }}>
              <label>Tipo do chamado</label>
              <select value={form.ticketType} onChange={set('ticketType')}>
                {TICKET_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Urgência padrão</label>
              <select value={form.urgency} onChange={set('urgency')}>
                {Object.entries(URGENCY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>
          <div className="field">
            <label>Título padrão (prefixo)</label>
            <input value={form.defaultTitle} onChange={set('defaultTitle')} placeholder="Ex.: Erro no site: " />
          </div>
          <div className="field">
            <label>Descrição do serviço</label>
            <input value={form.description} onChange={set('description')} placeholder="Explicação interna do modelo" />
          </div>
          <div className="row" style={{ gap: 10 }}>
            <div className="field" style={{ flex: 1 }}>
              <label>Categoria</label>
              <select value={form.categoryId} onChange={set('categoryId')}>
                <option value="">— Nenhuma —</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Atribuir para</label>
              <select value={form.assignTo} onChange={set('assignTo')}>
                <option value="">— Ninguém —</option>
                {techs.map((m) => <option key={m.userId} value={m.userId}>{m.user.name} ({m.role})</option>)}
              </select>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
