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

  const urgent = tickets.filter((t) => t.urgency === 'alta').length;
  const alerted = tickets.filter((t) => t.urgentAlert).length;

  return (
    <div>
      <div className="page-head">
        <h1>📥 Chamados sem atribuição</h1>
        <p className="muted">Fila aberta a todos os técnicos. Assuma o que for da sua área.</p>
      </div>

      <div className="stats mb">
        <div className="stat"><div className="n">{tickets.length}</div><div className="l">Aguardando responsável</div></div>
        <div className="stat"><div className="n" style={{ color: '#C2542F' }}>{urgent}</div><div className="l">Urgência alta</div></div>
        <div className="stat"><div className="n" style={{ color: '#C2542F' }}>{alerted}</div><div className="l">Com alerta 🚨</div></div>
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
