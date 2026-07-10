import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { createTicket, categoriesForGroup, servicesForGroup, URGENCY, TICKET_TYPES } from '../lib/domain';
import { db } from '../lib/store';

export default function NewTicket() {
  const { user, activeGroup, refresh } = useAuth();
  const navigate = useNavigate();
  const categories = categoriesForGroup(activeGroup.id);
  const services = servicesForGroup(activeGroup.id);

  const [serviceId, setServiceId] = useState('');
  const [form, setForm] = useState({
    title: '', description: '', type: 'Solicitação',
    categoryId: categories[0]?.id || '', urgency: 'media', cidade: user.cidade || '',
  });
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  // RCS07 — aplicar serviço padroniza os campos
  const applyService = (id) => {
    setServiceId(id);
    const svc = id ? db.byId('services', id) : null;
    if (svc) {
      setForm((f) => ({
        ...f,
        title: svc.defaultTitle || f.title,
        type: svc.ticketType || f.type,
        categoryId: svc.categoryId || f.categoryId,
        urgency: svc.urgency || f.urgency,
      }));
    }
  };

  const submit = (e) => {
    e.preventDefault();
    setError('');
    if (!form.title.trim()) return setError('Informe um título.');
    const t = createTicket(activeGroup.id, form, user, serviceId || null);
    refresh();
    navigate(`/tickets/${t.id}`);
  };

  return (
    <div style={{ maxWidth: 640 }}>
      <div className="page-head">
        <h1>Abrir chamado</h1>
        <p className="muted">Use um serviço para padronizar, ou preencha manualmente.</p>
      </div>

      <form onSubmit={submit} className="card card-pad">
        {error && <div className="alert alert-error">{error}</div>}

        {services.length > 0 && (
          <div className="field">
            <label>🧩 Serviço (opcional)</label>
            <select value={serviceId} onChange={(e) => applyService(e.target.value)}>
              <option value="">— Chamado avulso —</option>
              {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <div className="hint">Preenche tipo, categoria, urgência e atribuição automaticamente.</div>
          </div>
        )}

        <div className="field">
          <label>Título *</label>
          <input value={form.title} onChange={set('title')} placeholder="Resumo do problema" autoFocus />
        </div>

        <div className="field">
          <label>Descrição</label>
          <textarea value={form.description} onChange={set('description')} placeholder="O que aconteceu? Passos para reproduzir, prints, etc." />
        </div>

        <div className="row" style={{ gap: 12 }}>
          <div className="field" style={{ flex: 1 }}>
            <label>Categoria / Sistema</label>
            <select value={form.categoryId} onChange={set('categoryId')}>
              <option value="">— Sem categoria —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Tipo</label>
            <select value={form.type} onChange={set('type')}>
              {TICKET_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <div className="row" style={{ gap: 12 }}>
          <div className="field" style={{ flex: 1 }}>
            <label>Urgência</label>
            <select value={form.urgency} onChange={set('urgency')}>
              {Object.entries(URGENCY).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Cidade</label>
            <input value={form.cidade} onChange={set('cidade')} />
          </div>
        </div>

        <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" onClick={() => navigate(-1)}>Cancelar</button>
          <button className="btn-primary">Criar chamado</button>
        </div>
      </form>
    </div>
  );
}
