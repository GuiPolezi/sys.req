import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { createTicket, categoriesForGroup, URGENCY } from '../lib/domain';

const TYPES = ['Solicitação', 'Erro', 'Dúvida', 'Melhoria'];

export default function NewTicket() {
  const { user, activeGroup, refresh } = useAuth();
  const navigate = useNavigate();
  const categories = categoriesForGroup(activeGroup.id);

  const [form, setForm] = useState({
    title: '', description: '', type: 'Solicitação',
    categoryId: categories[0]?.id || '', urgency: 'media', cidade: user.cidade || '',
  });
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = (e) => {
    e.preventDefault();
    setError('');
    if (!form.title.trim()) return setError('Informe um título.');
    const t = createTicket(activeGroup.id, form, user);
    refresh();
    navigate(`/tickets/${t.id}`);
  };

  return (
    <div style={{ maxWidth: 640 }}>
      <div className="page-head">
        <h1>Abrir chamado</h1>
        <p className="muted">Descreva sua solicitação com o máximo de detalhes.</p>
      </div>

      <form onSubmit={submit} className="card card-pad">
        {error && <div className="alert alert-error">{error}</div>}

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
              {TYPES.map((t) => <option key={t}>{t}</option>)}
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
