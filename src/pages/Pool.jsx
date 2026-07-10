import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { unassignedTickets, assignTicket } from '../lib/domain';
import { db } from '../lib/store';
import { UrgencyBadge, Empty, timeAgo } from '../components/ui';

// RCS06 — dashboard de tickets sem atribuição, visível a todos os devs/suporte
export default function Pool() {
  const { user, activeGroup, refresh } = useAuth();
  const navigate = useNavigate();
  const tickets = unassignedTickets(activeGroup.id)
    .sort((a, b) => {
      const order = { alta: 0, media: 1, baixa: 2 };
      return order[a.urgency] - order[b.urgency] || b.createdAt.localeCompare(a.createdAt);
    });

  const take = (e, id) => {
    e.stopPropagation();
    assignTicket(id, user.id, user);
    refresh();
    navigate(`/tickets/${id}`);
  };

  return (
    <div>
      <div className="page-head">
        <h1>📥 Chamados sem atribuição</h1>
        <p className="muted">{tickets.length} chamado(s) esperando alguém pegar. Assuma o que for da sua área.</p>
      </div>

      <div className="card">
        {tickets.length === 0 ? (
          <Empty>Nenhum chamado sem responsável. 🎉</Empty>
        ) : (
          tickets.map((t) => {
            const cat = t.categoryId ? db.byId('categories', t.categoryId) : null;
            const author = db.byId('users', t.createdBy);
            return (
              <div key={t.id} className="ticket-row" onClick={() => navigate(`/tickets/${t.id}`)}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="t-title">
                    {t.urgentAlert && <span title="Alerta de urgência">🚨 </span>}
                    {t.title}
                  </div>
                  <div className="t-meta">
                    #{t.id.slice(-4)} · {cat ? `${cat.name} · ` : ''}{t.type} · por {author?.name} · {timeAgo(t.createdAt)}
                    {t.cidade && ` · 📍 ${t.cidade}`}
                  </div>
                </div>
                <UrgencyBadge urgency={t.urgency} />
                <button className="btn-primary btn-sm" onClick={(e) => take(e, t.id)}>Pegar</button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
