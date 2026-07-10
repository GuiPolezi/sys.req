import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ticketsVisibleTo } from '../lib/domain';
import { db } from '../lib/store';
import { StatusBadge, UrgencyBadge, Empty, timeAgo } from '../components/ui';

export default function Dashboard() {
  const { user, activeGroup } = useAuth();
  const navigate = useNavigate();
  const tickets = ticketsVisibleTo(activeGroup, user);

  const open = tickets.filter((t) => t.status !== 'concluido');
  const urgent = open.filter((t) => t.urgency === 'alta');
  const done = tickets.filter((t) => t.status === 'concluido');
  const mine = tickets.filter((t) => t.assignedTo === user.id && t.status !== 'concluido');

  const recent = [...tickets].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 6);

  const greeting = { suporte: 'Visão geral da equipe', dev: 'Seus chamados', solicitante: 'Meus chamados' }[user.role];

  return (
    <div>
      <div className="page-head">
        <h1>Painel</h1>
        <p className="muted">{greeting} — {activeGroup.name}</p>
      </div>

      <div className="stats mb">
        <div className="stat">
          <div className="n" style={{ color: '#C2542F' }}>{urgent.length}</div>
          <div className="l">Chamados urgentes ⚠️</div>
        </div>
        <div className="stat">
          <div className="n">{open.length}</div>
          <div className="l">Em aberto</div>
        </div>
        {user.role !== 'solicitante' && (
          <div className="stat">
            <div className="n" style={{ color: '#C08A3E' }}>{mine.length}</div>
            <div className="l">Atribuídos a mim</div>
          </div>
        )}
        <div className="stat">
          <div className="n" style={{ color: '#4F8A5B' }}>{done.length}</div>
          <div className="l">Concluídos</div>
        </div>
      </div>

      <div className="row between mb">
        <h2 style={{ margin: 0 }}>Atividade recente</h2>
        <div className="row">
          {user.role === 'solicitante' && (
            <Link to="/tickets/new" className="btn btn-primary btn-sm">➕ Abrir chamado</Link>
          )}
          <Link to="/tickets" className="btn btn-sm">Ver todos →</Link>
        </div>
      </div>

      <div className="card">
        {recent.length === 0 ? (
          <Empty>Nenhum chamado ainda.</Empty>
        ) : (
          recent.map((t) => {
            const cat = t.categoryId ? db.byId('categories', t.categoryId) : null;
            return (
              <div key={t.id} className="ticket-row" onClick={() => navigate(`/tickets/${t.id}`)}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="t-title">{t.title}</div>
                  <div className="t-meta">
                    {cat ? `${cat.name} · ` : ''}atualizado {timeAgo(t.updatedAt)}
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
