import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  ticketsVisibleTo, categoriesForGroup, teamLoad, ticketsAwaitingReview, isTech,
  getDashPrefs, saveDashPrefs, dashWidgetsFor, slaInfo, SLA_STATUS,
  systemsForGroup, attendancesForGroup,
  STATUS, URGENCY,
} from '../lib/domain';
import { db } from '../lib/store';
import { StatusBadge, UrgencyBadge, Empty, timeAgo, Modal } from '../components/ui';
import { AreaChart, BarList, Donut, ColumnChart } from '../components/Charts';

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

  // carga da equipe (só técnicos) e análises pendentes (só solicitante)
  const tech = isTech(user.role);
  const load = tech ? teamLoad(activeGroup) : [];
  const awaiting = user.role === 'solicitante' ? ticketsAwaitingReview(activeGroup.id, user.id) : [];

  // painel personalizável (v0.0.5): cada usuário escolhe seus widgets
  const [customizing, setCustomizing] = useState(false);
  const [prefsTick, setPrefsTick] = useState(0);
  void prefsTick;
  const available = dashWidgetsFor(user.role);
  const widgets = getDashPrefs(activeGroup.id, user.id, user.role)
    .filter((k) => available.some((w) => w.key === k));
  const show = (k) => widgets.includes(k);
  const toggleWidget = (k) => {
    const next = show(k) ? widgets.filter((x) => x !== k) : [...widgets, k];
    saveDashPrefs(activeGroup.id, user.id, next);
    setPrefsTick((n) => n + 1);
  };

  // situação de SLA dos chamados visíveis (widget)
  const slaCounts = tech ? tickets.reduce((acc, t) => {
    const info = slaInfo(t);
    if (info) acc[info.status] = (acc[info.status] || 0) + 1;
    return acc;
  }, {}) : {};

  // ---- widgets novos (v0.0.6) ----
  // por sistema
  const systems = systemsForGroup(activeGroup.id);
  const sysItems = [
    ...systems.map((s) => ({ key: s.id, label: s.name, color: 'var(--primary)', value: tickets.filter((t) => t.systemId === s.id).length })),
    { key: 'none', label: 'Sem sistema', color: 'var(--muted)', value: tickets.filter((t) => !t.systemId).length },
  ].filter((i) => i.value > 0).sort((a, b) => b.value - a.value);

  // por cidade
  const cityMap = {};
  tickets.forEach((t) => { const c = t.cidade || 'Sem cidade'; cityMap[c] = (cityMap[c] || 0) + 1; });
  const cityItems = Object.entries(cityMap)
    .map(([label, value]) => ({ key: label, label, color: '#2FA8A8', value }))
    .sort((a, b) => b.value - a.value).slice(0, 8);

  // tempo médio de resolução (concluídos)
  const doneWithTime = done.map((t) => (new Date(t.updatedAt) - new Date(t.createdAt)) / 3600_000);
  const avgHours = doneWithTime.length ? doneWithTime.reduce((s, h) => s + h, 0) / doneWithTime.length : 0;
  const fmtH = (h) => (h >= 48 ? `${(h / 24).toFixed(1)} dias` : `${h.toFixed(1)}h`);
  const avgByUrgency = Object.entries(URGENCY).map(([k, v]) => {
    const list = done.filter((t) => t.urgency === k).map((t) => (new Date(t.updatedAt) - new Date(t.createdAt)) / 3600_000);
    const avg = list.length ? list.reduce((s, h) => s + h, 0) / list.length : 0;
    return { key: k, label: v.label, color: v.color, value: Math.round(avg * 10) / 10 };
  });

  // análises pendentes (solicitante + técnica)
  const pendingReview = tickets.filter((t) => t.status === 'em_analise');
  const pendingTech = tickets.filter((t) => t.techReview?.status === 'pendente');

  // atendimentos dos últimos 7 dias (suporte)
  const att7 = [];
  if (user.role === 'suporte') {
    const all = attendancesForGroup(activeGroup.id);
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
      const key = ymd(d);
      att7.push({
        label: d.toLocaleDateString('pt-BR', { weekday: 'short' }).slice(0, 3),
        full: d.toLocaleDateString('pt-BR'),
        value: all.filter((a) => a.at.slice(0, 10) === key).length,
      });
    }
  }

  return (
    <div>
      <div className="row between wrap page-head" style={{ gap: 10 }}>
        <div>
          <h1>Painel</h1>
          <p className="muted">{greeting} — {activeGroup.name}</p>
        </div>
        <button className="btn-sm" onClick={() => setCustomizing(true)}>Personalizar painel</button>
      </div>

      {/* aviso destacado: chamados aguardando a análise do solicitante */}
      {awaiting.length > 0 && (
        <div className="card card-pad mb review-callout">
          <div className="row between wrap" style={{ gap: 10 }}>
            <div className="row" style={{ gap: 12 }}>
              <span style={{ fontSize: 26 }}>🔎</span>
              <div>
                <b>{awaiting.length} chamado(s) aguardando a sua análise</b>
                <div className="muted small">O time marcou como resolvido — confirme se está tudo certo ou rejeite.</div>
              </div>
            </div>
            <button className="btn-primary btn-sm" onClick={() => navigate(`/tickets/${awaiting[0].id}`)}>
              Revisar agora →
            </button>
          </div>
        </div>
      )}

      {/* KPIs */}
      {show('kpis') && (
      <div className="stats mb">
        <div className="stat"><div className="n">{tickets.length}</div><div className="l">Total de chamados</div></div>
        <div className="stat"><div className="n" style={{ color: '#E06A4E' }}>{urgent.length}</div><div className="l"><strong>Urgentes</strong></div></div>
        <div className="stat"><div className="n">{open.length}</div><div className="l">Em aberto</div></div>
        {user.role !== 'solicitante' && (
          <div className="stat"><div className="n" style={{ color: '#E3A93C' }}>{mine.length}</div><div className="l">Atribuídos a mim</div></div>
        )}
        <div className="stat"><div className="n" style={{ color: '#34B27A' }}>{done.length}</div><div className="l">Concluídos</div></div>
      </div>
      )}

      {/* série temporal */}
      {show('serie') && (
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
      )}

      {/* status (donut) + urgência/categoria (barras) */}
      {(show('status') || show('urgencia')) && (
      <div className="grid grid-2 mb">
        {show('status') && (
        <div className="card card-pad">
          <h3>Por status</h3>
          {tickets.length === 0 ? <p className="muted small">Sem dados.</p> : (
            <div className="row wrap" style={{ gap: 18, marginTop: 6, alignItems: 'center' }}>
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
        )}

        {show('urgencia') && user.role !== 'solicitante' && (
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
        )}
      </div>
      )}

      {/* por sistema / por cidade (v0.0.6) */}
      {(show('sistemas') || (tech && show('cidades'))) && (
        <div className="grid grid-2 mb">
          {show('sistemas') && (
            <div className="card card-pad">
              <h3>Chamados por sistema</h3>
              <div style={{ marginTop: 10 }}>
                <BarList items={sysItems} empty="Nenhum chamado com sistema." />
              </div>
            </div>
          )}
          {tech && show('cidades') && (
            <div className="card card-pad">
              <h3>Chamados por cidade</h3>
              <div style={{ marginTop: 10 }}>
                <BarList items={cityItems} empty="Nenhum chamado." />
              </div>
            </div>
          )}
        </div>
      )}

      {/* tempo médio de resolução / análises pendentes (v0.0.6) */}
      {tech && (show('tempo') || show('analises')) && (
        <div className="grid grid-2 mb">
          {show('tempo') && (
            <div className="card card-pad">
              <h3>Tempo médio de resolução</h3>
              <div className="row" style={{ gap: 16, marginTop: 10, alignItems: 'baseline' }}>
                <span style={{ fontSize: 34, fontWeight: 200 }}>{done.length ? fmtH(avgHours) : '—'}</span>
                <span className="muted small">média geral · {done.length} concluído(s)</span>
              </div>
              <div className="divider" />
              <div className="muted small mb">Por urgência (horas):</div>
              <BarList items={avgByUrgency} empty="Nenhum chamado concluído." />
            </div>
          )}
          {show('analises') && (
            <div className="card card-pad">
              <h3>Análises pendentes</h3>
              <div className="stats" style={{ marginTop: 10 }}>
                <div className="stat"><div className="n" style={{ color: '#7A74C9' }}>{pendingReview.length}</div><div className="l">Aguardando solicitante</div></div>
                <div className="stat"><div className="n" style={{ color: '#7A74C9' }}>{pendingTech.length}</div><div className="l">Análise técnica</div></div>
              </div>
              <div className="col mt" style={{ gap: 4 }}>
                {[...pendingReview, ...pendingTech].slice(0, 5).map((t) => (
                  <a key={t.id} className="small" style={{ cursor: 'pointer' }} onClick={() => navigate(`/tickets/${t.id}`)}>
                    #{t.number || ''} · {t.title}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* atendimentos — últimos 7 dias (suporte) */}
      {user.role === 'suporte' && show('atendimentos') && (
        <div className="card card-pad mb">
          <h3>Atendimentos — últimos 7 dias</h3>
          <div style={{ marginTop: 12 }}>
            <ColumnChart data={att7} height={150} color="#2FA8A8" />
          </div>
        </div>
      )}

      {/* situação de SLA (v0.0.5) */}
      {tech && show('sla') && (
        <div className="card card-pad mb">
          <h3>Situação de SLA</h3>
          <div className="stats" style={{ marginTop: 10 }}>
            {['ok', 'risco', 'estourado', 'cumprido', 'violado'].map((k) => (
              <div key={k} className="stat">
                <div className="n" style={{ color: SLA_STATUS[k].color }}>{slaCounts[k] || 0}</div>
                <div className="l">{SLA_STATUS[k].label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* carga da equipe — painel privado dos técnicos */}
      {tech && show('equipe') && (
        <div className="card card-pad mb">
          <div className="row between wrap" style={{ gap: 8 }}>
            <div>
              <h3 style={{ margin: 0 }}>👥 Carga da equipe</h3>
              <span className="muted small">Chamados ativos atribuídos por técnico · visível apenas para a equipe</span>
            </div>
            <span className="chip">{load.reduce((s, d) => s + d.value, 0)} ativos</span>
          </div>
          <div style={{ marginTop: 14 }}>
            {load.length === 0 ? <Empty>Nenhum técnico no grupo.</Empty> : <ColumnChart data={load} height={170} color="#7A74C9" />}
          </div>
        </div>
      )}

      {/* atividade recente */}
      {show('recentes') && (
      <>
      <div className="row between mb">
        <h2 style={{ margin: 0 }}>Atividade recente</h2>
        <div className="row">
          <Link to="/tickets/new" className="btn btn-primary btn-sm">Abrir chamado</Link>
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
                <span className="tkt-num">#{t.number || ''}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="t-title">{t.urgentAlert && '🚨 '}{t.title}</div>
                  <div className="t-meta">
                    {cat ? `${cat.name} · ` : ''}criado {timeAgo(t.createdAt)}
                  </div>
                </div>
                <UrgencyBadge urgency={t.urgency} />
                <StatusBadge status={t.status} />
              </div>
            );
          })
        )}
      </div>
      </>
      )}

      {widgets.length === 0 && (
        <div className="card"><Empty>Nenhum widget ativo. Clique em “Personalizar painel”.</Empty></div>
      )}

      {customizing && (
        <Modal title="Personalizar painel" onClose={() => setCustomizing(false)}
          footer={<button className="btn-primary" onClick={() => setCustomizing(false)}>Pronto</button>}>
          <p className="muted small" style={{ marginTop: 0 }}>
            Escolha o que aparece no seu painel. A preferência é sua — cada usuário tem a própria configuração.
          </p>
          <div className="col" style={{ gap: 10 }}>
            {available.map((w) => (
              <label key={w.key} className="row" style={{ gap: 10, textTransform: 'none', fontSize: 14, fontWeight: 450, marginBottom: 0 }}>
                <input type="checkbox" style={{ width: 'auto' }} checked={show(w.key)} onChange={() => toggleWidget(w.key)} />
                {w.label}
              </label>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
