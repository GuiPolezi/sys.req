import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ticketsVisibleTo, categoriesForGroup, groupMembers, isTech, STATUS } from '../lib/domain';
import { db } from '../lib/store';
import { downloadCSV, fmtDate } from '../lib/report';
import { StatusBadge, UrgencyBadge, Avatar, Empty, timeAgo, stripHtml } from '../components/ui';

export default function Tickets() {
  const { user, activeGroup } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('todos');
  const [cat, setCat] = useState('todas');
  const [techFilter, setTechFilter] = useState('todos');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const categories = categoriesForGroup(activeGroup.id);
  const techs = groupMembers(activeGroup).filter((m) => m.role !== 'solicitante');
  let tickets = ticketsVisibleTo(activeGroup, user);

  // busca por texto OU número do chamado (ex.: "12" ou "#12")
  if (q.trim()) {
    const s = q.toLowerCase();
    const num = parseInt(s.replace('#', ''), 10);
    tickets = tickets.filter((t) =>
      t.title.toLowerCase().includes(s) ||
      stripHtml(t.description).toLowerCase().includes(s) ||
      (!Number.isNaN(num) && t.number === num)
    );
  }
  if (status !== 'todos') tickets = tickets.filter((t) => t.status === status);
  if (cat !== 'todas') tickets = tickets.filter((t) => t.categoryId === cat);
  if (techFilter === 'sem') tickets = tickets.filter((t) => !t.assignedTo);
  else if (techFilter !== 'todos') tickets = tickets.filter((t) => t.assignedTo === techFilter);
  if (from) tickets = tickets.filter((t) => t.createdAt.slice(0, 10) >= from);
  if (to) tickets = tickets.filter((t) => t.createdAt.slice(0, 10) <= to);

  tickets = tickets.sort((a, b) => {
    const order = { alta: 0, media: 1, baixa: 2 };
    const aDone = a.status === 'concluido';
    const bDone = b.status === 'concluido';
    if (aDone !== bDone) return aDone ? 1 : -1; // concluídos vão para o fim
    return order[a.urgency] - order[b.urgency] || b.updatedAt.localeCompare(a.updatedAt);
  });

  const exportCSV = () => {
    downloadCSV('chamados', tickets.map((t) => ({
      'Nº': t.number || '',
      'Título': t.title,
      'Status': STATUS[t.status]?.label || t.status,
      'Urgência': t.urgency,
      'Categoria': t.categoryId ? (db.byId('categories', t.categoryId)?.name || '') : '',
      'Sistema': t.systemId ? (db.byId('systems', t.systemId)?.name || '') : '',
      'Solicitante': t.requesterName || (t.requesterId ? db.byId('users', t.requesterId)?.name : '') || '',
      'Responsável': t.assignedTo ? (db.byId('users', t.assignedTo)?.name || '') : '',
      'Cidade': t.cidade || '',
      'Criado em': fmtDate(t.createdAt),
      'Atualizado em': fmtDate(t.updatedAt),
    })));
  };

  return (
    <div>
      <div className="row between page-head">
        <div>
          <h1>Chamados</h1>
          <p className="muted">{tickets.length} chamado(s)</p>
        </div>
        <div className="row" style={{ gap: 8 }}>
          {isTech(user.role) && <button className="btn-sm" onClick={exportCSV}>Gerar relatório</button>}
          <Link to="/tickets/new" className="btn btn-primary">Abrir chamado</Link>
        </div>
      </div>

      <div className="card card-pad mb">
        <div className="row wrap">
          <input placeholder="Buscar por título, descrição ou nº..." value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: 2, minWidth: 180 }} />
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
        <div className="row wrap mt" style={{ gap: 12 }}>
          <select value={techFilter} onChange={(e) => setTechFilter(e.target.value)} style={{ flex: 1, minWidth: 160 }}>
            <option value="todos">Todos os técnicos</option>
            <option value="sem">Sem responsável</option>
            {techs.map((m) => <option key={m.userId} value={m.userId}>{m.user.name}</option>)}
          </select>
          <div className="row" style={{ gap: 6 }}>
            <span className="muted small">Criado de</span>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            <span className="muted small">até</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            {(from || to) && <button className="btn-ghost btn-sm" onClick={() => { setFrom(''); setTo(''); }}>✕</button>}
          </div>
        </div>
      </div>

      <div className="card">
        {tickets.length === 0 ? (
          <Empty>Nenhum chamado encontrado.</Empty>
        ) : (
          tickets.map((t) => {
            const cat_ = t.categoryId ? db.byId('categories', t.categoryId) : null;
            const assignee = t.assignedTo ? db.byId('users', t.assignedTo) : null;
            return (
              <div key={t.id} className="ticket-row" onClick={() => navigate(`/tickets/${t.id}`)}>
                <span className="tkt-num">#{t.number || '—'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="t-title">{t.urgentAlert && '🚨 '}{t.title}</div>
                  <div className="t-meta">
                    {cat_ ? `${cat_.name} · ` : ''}{t.type}
                    {t.cidade && ` · 📍 ${t.cidade}`}
                    {' · criado '}{new Date(t.createdAt).toLocaleDateString('pt-BR')}
                    {' · '}{timeAgo(t.updatedAt)}
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
