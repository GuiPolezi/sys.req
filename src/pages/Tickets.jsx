import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ticketsVisibleTo, categoriesForGroup, STATUS } from '../lib/domain';
import { db } from '../lib/store';
import { StatusBadge, UrgencyBadge, Avatar, Empty, timeAgo } from '../components/ui';

export default function Tickets() {
  const { user, activeGroup } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('todos');
  const [cat, setCat] = useState('todas');

  const categories = categoriesForGroup(activeGroup.id);
  let tickets = ticketsVisibleTo(activeGroup, user);

  if (q.trim()) {
    const s = q.toLowerCase();
    tickets = tickets.filter((t) => t.title.toLowerCase().includes(s) || t.description.toLowerCase().includes(s));
  }
  if (status !== 'todos') tickets = tickets.filter((t) => t.status === status);
  if (cat !== 'todas') tickets = tickets.filter((t) => t.categoryId === cat);

  tickets = tickets.sort((a, b) => {
    const order = { alta: 0, media: 1, baixa: 2 };
    if (a.status === 'concluido' !== (b.status === 'concluido'))
      return a.status === 'concluido' ? 1 : -1;
    return order[a.urgency] - order[b.urgency] || b.updatedAt.localeCompare(a.updatedAt);
  });

  return (
    <div>
      <div className="row between page-head">
        <div>
          <h1>Chamados</h1>
          <p className="muted">{tickets.length} chamado(s)</p>
        </div>
        {(user.role === 'solicitante' || user.role === 'suporte') && (
          <Link to="/tickets/new" className="btn btn-primary">➕ Abrir chamado</Link>
        )}
      </div>

      <div className="card card-pad mb">
        <div className="row wrap">
          <input placeholder="🔍 Buscar..." value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: 2, minWidth: 180 }} />
          <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ flex: 1, minWidth: 140 }}>
            <option value="todos">Todos os status</option>
            {Object.entries(STATUS).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          <select value={cat} onChange={(e) => setCat(e.target.value)} style={{ flex: 1, minWidth: 140 }}>
            <option value="todas">Todas categorias</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="card">
        {tickets.length === 0 ? (
          <Empty>Nenhum chamado encontrado.</Empty>
        ) : (
          tickets.map((t) => {
            const cat = t.categoryId ? db.byId('categories', t.categoryId) : null;
            const assignee = t.assignedTo ? db.byId('users', t.assignedTo) : null;
            return (
              <div key={t.id} className="ticket-row" onClick={() => navigate(`/tickets/${t.id}`)}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="t-title">{t.title}</div>
                  <div className="t-meta">
                    #{t.id.slice(-4)} · {cat ? `${cat.name} · ` : ''}{t.type} · {timeAgo(t.updatedAt)}
                  </div>
                </div>
                {assignee ? (
                  <div className="row" style={{ gap: 6 }} title={`Responsável: ${assignee.name}`}>
                    <Avatar name={assignee.name} size="sm" />
                  </div>
                ) : (
                  <span className="chip">sem responsável</span>
                )}
                <UrgencyBadge urgency={t.urgency} />
                <StatusBadge status={t.status} />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
