import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ticketsVisibleTo, categoriesForGroup, STATUS, URGENCY } from '../lib/domain';
import { db } from '../lib/store';
import { StatusBadge, UrgencyBadge, Empty, timeAgo } from '../components/ui';
import { AreaChart, BarList, Donut } from '../components/Charts';

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export default function Dashboard() {
  const { user, activeGroup } = useAuth();
  const navigate = useNavigate();
  const tickets = ticketsVisibleTo(activeGroup, user);

  const open = tickets.filter((t) => t.status !== 'concluido');
  const urgent = open.filter((t) => t.urgency === 'alta');
  const done = tickets.filter((t) => t.status === 'concluido');
  const mine = tickets.filter((t) => t.assignedTo === user.id && t.status !== 'concluido');

  // atividade recente — mais recente (por criação) primeiro
  const recent = [...tickets].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8);

  // série: chamados criados no período escolhido
  const [period, setPeriod] = useState(30); // dias
  const today = new Date();
  const perDay = [];
  for (let i = period - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    const key = ymd(d);
    perDay.push({
      label: pad(d.getDate()),
      full: d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' }),
      value: tickets.filter((t) => t.createdAt.slice(0, 10) === key).length,
    });
  }
  const createdInPeriod = perDay.reduce((s, d) => s + d.value, 0);

  // distribuição por status / urgência / categoria (dos chamados visíveis)
  const statusSeg = Object.entries(STATUS).map(([k, v]) => ({
    key: k, label: v.label, color: v.color, value: tickets.filter((t) => t.status === k).length,
  }));
  const urgencyItems = Object.entries(URGENCY).map(([k, v]) => ({
    key: k, label: v.label, color: v.color, value: tickets.filter((t) => t.urgency === k).length,
  }));
  const cats = categoriesForGroup(activeGroup.id);
  const catItems = [
    ...cats.map((c) => ({ key: c.id, label: c.name, color: c.color, value: tickets.filter((t) => t.categoryId === c.id).length })),
    { key: 'none', label: 'Sem categoria', color: 'var(--muted)', value: tickets.filter((t) => !t.categoryId).length },
  ].filter((i) => i.value > 0).sort((a, b) => b.value - a.value);

  const greeting = { suporte: 'Visão geral da equipe', dev: 'Seus chamados e da sua área', solicitante: 'Meus chamados' }[user.role];

  return (
    <div>
      <div className="page-head">
        <h1>Painel</h1>
        <p className="muted">{greeting} — {activeGroup.name}</p>
      </div>

      {/* KPIs */}
      <div className="stats mb">
        <div className="stat"><div className="n">{tickets.length}</div><div className="l">Total de chamados</div></div>
        <div className="stat"><div className="n" style={{ color: '#C2542F' }}>{urgent.length}</div><div className="l">Urgentes ⚠️</div></div>
        <div className="stat"><div className="n">{open.length}</div><div className="l">Em aberto</div></div>
        {user.role !== 'solicitante' && (
          <div className="stat"><div className="n" style={{ color: '#C08A3E' }}>{mine.length}</div><div className="l">Atribuídos a mim</div></div>
        )}
        <div className="stat"><div className="n" style={{ color: '#4F8A5B' }}>{done.length}</div><div className="l">Concluídos</div></div>
      </div>

      {/* série temporal */}
      <div className="card card-pad mb">
        <div className="row between wrap" style={{ gap: 10 }}>
          <div>
            <h3 style={{ margin: 0 }}>Chamados criados</h3>
            <span className="muted small">{createdInPeriod} no período</span>
          </div>
          <select value={period} onChange={(e) => setPeriod(Number(e.target.value))} style={{ width: 'auto' }}>
            <option value={7}>Últimos 7 dias</option>
            <option value={14}>Últimos 14 dias</option>
            <option value={30}>Últimos 30 dias</option>
            <option value={90}>Últimos 90 dias</option>
          </select>
        </div>
        <div style={{ marginTop: 8 }}>
          <AreaChart data={perDay} />
        </div>
      </div>

      {/* status (donut) + urgência/categoria (barras) */}
      <div className="grid grid-2 mb">
        <div className="card card-pad">
          <h3>Por status</h3>
          {tickets.length === 0 ? <p className="muted small">Sem dados.</p> : (
            <div className="row" style={{ gap: 18, marginTop: 6, alignItems: 'center' }}>
              <Donut segments={statusSeg} />
              <div className="col" style={{ gap: 8, flex: 1 }}>
                {statusSeg.filter((s) => s.value > 0).map((s) => (
                  <div key={s.key} className="row between" style={{ gap: 8 }}>
                    <span className="row small" style={{ gap: 7 }}><span className="dot" style={{ background: s.color, width: 9, height: 9 }} />{s.label}</span>
                    <b className="small">{s.value}</b>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="card card-pad">
          <h3>Por urgência</h3>
          <div style={{ marginTop: 10 }}>
            <BarList items={urgencyItems} empty="Nenhum chamado." />
          </div>
          <div className="divider" />
          <h3>Por categoria</h3>
          <div style={{ marginTop: 10 }}>
            <BarList items={catItems} empty="Nenhum chamado categorizado." />
          </div>
        </div>
      </div>

      {/* atividade recente */}
      <div className="row between mb">
        <h2 style={{ margin: 0 }}>Atividade recente</h2>
        <div className="row">
          <Link to="/tickets/new" className="btn btn-primary btn-sm">➕ Abrir chamado</Link>
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
                  <div className="t-title">{t.urgentAlert && '🚨 '}{t.title}</div>
                  <div className="t-meta">
                    #{t.id.slice(-4)} · {cat ? `${cat.name} · ` : ''}criado {timeAgo(t.createdAt)}
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
