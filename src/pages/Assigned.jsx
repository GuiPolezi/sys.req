import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ticketsAssignedTo, STATUS } from '../lib/domain';
import { db } from '../lib/store';
import { StatusBadge, UrgencyBadge, Empty, timeAgo } from '../components/ui';

// Chamados atribuídos ao técnico logado (suporte e dev).
export default function Assigned() {
  const { user, activeGroup } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState('abertos');

  let tickets = ticketsAssignedTo(activeGroup.id, user.id);
  if (status === 'abertos') tickets = tickets.filter((t) => t.status !== 'concluido');
  else if (status !== 'todos') tickets = tickets.filter((t) => t.status === status);

  const openCount = ticketsAssignedTo(activeGroup.id, user.id).filter((t) => t.status !== 'concluido').length;

  return (
    <div>
      <div className="page-head">
        <h1>📌 Atribuídos a mim</h1>
        <p className="muted">{openCount} chamado(s) em aberto sob sua responsabilidade.</p>
      </div>

      <div className="card card-pad mb">
        <div className="row wrap">
          <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: 'auto' }}>
            <option value="abertos">Em aberto</option>
            <option value="todos">Todos</option>
            {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
      </div>

      <div className="card">
        {tickets.length === 0 ? (
          <Empty>Nenhum chamado nesta visão.</Empty>
        ) : (
          tickets.map((t) => {
            const cat = t.categoryId ? db.byId('categories', t.categoryId) : null;
            const sys = t.systemId ? db.byId('systems', t.systemId) : null;
            return (
              <div key={t.id} className="ticket-row" onClick={() => navigate(`/tickets/${t.id}`)}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="t-title">{t.urgentAlert && '🚨 '}{t.title}</div>
                  <div className="t-meta">
                    #{t.id.slice(-4)} · {sys ? `${sys.name} · ` : ''}{cat ? `${cat.name} · ` : ''}{t.type} · {timeAgo(t.updatedAt)}
                  </div>
                </div>
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
