import { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/store';
import {
  registerAttendance, attendancesForGroup, attendancesByTech,
  clientsForGroup, createClient, updateClient, deleteClient, cityList,
} from '../lib/domain';
import { downloadCSV, fmtDate } from '../lib/report';
import { Avatar, Empty, Modal, ConfirmModal } from '../components/ui';
import { ColumnChart } from '../components/Charts';

const WEEK = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default function Attendances() {
  const { user, activeGroup, refresh } = useAuth();
  const [, setLocal] = useState(0);
  const today = new Date();
  const [tab, setTab] = useState('agenda');
  const [selected, setSelected] = useState(ymd(today));
  const [view, setView] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const [open, setOpen] = useState(false);
  const bump = () => { refresh(); setLocal((n) => n + 1); };

  const all = attendancesForGroup(activeGroup.id);
  const clients = clientsForGroup(activeGroup.id);

  const countByDay = useMemo(() => {
    const map = {};
    all.forEach((a) => { const d = a.at.slice(0, 10); map[d] = (map[d] || 0) + 1; });
    return map;
  }, [all]);

  const dayList = all.filter((a) => a.at.slice(0, 10) === selected);

  // grade do mês
  const first = new Date(view.y, view.m, 1);
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < first.getDay(); i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(view.y, view.m, d));

  const shiftMonth = (delta) => {
    const nd = new Date(view.y, view.m + delta, 1);
    setView({ y: nd.getFullYear(), m: nd.getMonth() });
  };
  const shiftDay = (delta) => {
    const d = new Date(selected + 'T12:00:00');
    d.setDate(d.getDate() + delta);
    setSelected(ymd(d));
    setView({ y: d.getFullYear(), m: d.getMonth() });
  };

  const selDate = new Date(selected + 'T12:00:00');
  const isToday = selected === ymd(today);

  return (
    <div>
      <div className="row between wrap page-head" style={{ gap: 10 }}>
        <div>
          <h1>Registro de atendimentos</h1>
          <p className="muted">Atendimentos feitos fora de um chamado (visita, telefone, presencial…).</p>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn-sm" onClick={() => downloadCSV('atendimentos', all.map((a) => ({
            Data: fmtDate(a.at),
            'Técnico': db.byId('users', a.userId)?.name || '',
            Cliente: a.client || (a.ticketId ? `Chamado #${db.byId('tickets', a.ticketId)?.number || ''}` : ''),
            Cidade: a.cidade || '',
            'Descrição': a.note || '',
          })))}>Gerar relatório</button>
          <button className="btn-primary" onClick={() => setOpen(true)}>Registrar atendimento</button>
        </div>
      </div>

      <div className="auth-tabs" style={{ maxWidth: 520 }}>
        <button className={tab === 'agenda' ? 'btn-primary' : ''} onClick={() => setTab('agenda')}>📅 Agenda</button>
        <button className={tab === 'tecnicos' ? 'btn-primary' : ''} onClick={() => setTab('tecnicos')}>📊 Por técnico</button>
        <button className={tab === 'clientes' ? 'btn-primary' : ''} onClick={() => setTab('clientes')}>👥 Clientes ({clients.length})</button>
      </div>

      {tab === 'agenda' && (
        <div className="grid grid-form" style={{ alignItems: 'start' }}>
          {/* mini calendário */}
          <div className="card card-pad">
            <div className="row between mb">
              <button className="btn-ghost btn-sm" onClick={() => shiftMonth(-1)}>‹</button>
              <b>{MONTHS[view.m]} {view.y}</b>
              <button className="btn-ghost btn-sm" onClick={() => shiftMonth(1)}>›</button>
            </div>
            <div className="cal-grid cal-head">
              {WEEK.map((w, i) => <div key={i} className="cal-w">{w}</div>)}
            </div>
            <div className="cal-grid">
              {cells.map((d, i) => {
                if (!d) return <div key={i} />;
                const key = ymd(d);
                const count = countByDay[key] || 0;
                const cls = ['cal-day'];
                if (key === selected) cls.push('sel');
                if (key === ymd(today)) cls.push('today');
                return (
                  <button key={i} className={cls.join(' ')} onClick={() => setSelected(key)}>
                    {d.getDate()}
                    {count > 0 && <span className="cal-badge">{count}</span>}
                  </button>
                );
              })}
            </div>
            <div className="divider" />
            <div className="row between"><span className="muted small">Total geral</span><b>{all.length}</b></div>
          </div>

          {/* lista do dia */}
          <div className="card">
            <div className="card-pad row between wrap" style={{ borderBottom: '1px solid var(--border)', gap: 8 }}>
              <div className="row" style={{ gap: 8 }}>
                <button className="btn-ghost btn-sm" onClick={() => shiftDay(-1)}>‹</button>
                <div>
                  <b>{selDate.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</b>
                  {isToday && <span className="chip" style={{ marginLeft: 8 }}>hoje</span>}
                </div>
                <button className="btn-ghost btn-sm" onClick={() => shiftDay(1)}>›</button>
              </div>
              <span className="muted small">{dayList.length} atendimento(s)</span>
            </div>
            {dayList.length === 0 ? (
              <Empty>Nenhum atendimento neste dia.</Empty>
            ) : (
              dayList.map((a) => {
                const u = db.byId('users', a.userId);
                return (
                  <div key={a.id} className="ticket-row" style={{ cursor: 'default', alignItems: 'flex-start' }}>
                    <Avatar name={u?.name} size="sm" />
                    <div style={{ flex: 1 }}>
                      <div className="t-title">
                        {a.client || (a.ticketId ? `Chamado #${a.ticketId.slice(-4)}` : 'Atendimento')}
                        {a.cidade && <span className="chip" style={{ marginLeft: 8 }}>📍 {a.cidade}</span>}
                      </div>
                      {a.note && <div style={{ fontSize: 13, marginTop: 2 }}>{a.note}</div>}
                      <div className="t-meta">
                        {u?.name} · {new Date(a.at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {tab === 'tecnicos' && (
        <ByTech group={activeGroup} selected={selected} setSelected={setSelected} today={ymd(today)} />
      )}

      {tab === 'clientes' && (
        <Clients group={activeGroup} user={user} bump={bump} />
      )}

      {open && (
        <RegisterModal group={activeGroup} user={user} clients={clients}
          onClose={() => setOpen(false)} onSaved={() => { setOpen(false); setSelected(ymd(new Date())); bump(); }} />
      )}
    </div>
  );
}

// Campo de cidade: seleção quando há cidades cadastradas (v0.0.5)
function CityField({ groupId, value, onChange }) {
  const cities = cityList(groupId);
  if (!cities.length) {
    return <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="Cidade" />;
  }
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">— Cidade —</option>
      {cities.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
    </select>
  );
}

// -------------------------------------------------------------
//  Atendimentos por técnico (dia selecionado x total)
// -------------------------------------------------------------
function ByTech({ group, selected, setSelected, today }) {
  const day = attendancesByTech(group, selected);
  const total = attendancesByTech(group, null);
  const dayTotal = day.reduce((s, d) => s + d.value, 0);
  const allTotal = total.reduce((s, d) => s + d.value, 0);
  const selDate = new Date(selected + 'T12:00:00');

  return (
    <div className="grid grid-2">
      <div className="card card-pad">
        <div className="row between wrap" style={{ gap: 8 }}>
          <h3 style={{ margin: 0 }}>No dia selecionado</h3>
          <div className="row" style={{ gap: 6 }}>
            <input type="date" value={selected} onChange={(e) => e.target.value && setSelected(e.target.value)} style={{ width: 'auto' }} />
            {selected !== today && <button className="btn-sm" onClick={() => setSelected(today)}>Hoje</button>}
          </div>
        </div>
        <p className="muted small">
          {selDate.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })} · {dayTotal} atendimento(s)
        </p>
        {dayTotal === 0 ? <Empty>Nenhum atendimento neste dia.</Empty> : <ColumnChart data={day} height={180} />}
      </div>

      <div className="card card-pad">
        <h3>Total acumulado</h3>
        <p className="muted small">Todos os atendimentos do grupo · {allTotal} no total</p>
        {allTotal === 0 ? <Empty>Nenhum atendimento registrado.</Empty> : <ColumnChart data={total} height={180} color="#7A74C9" />}
        <div className="divider" />
        <div className="col" style={{ gap: 8 }}>
          {total.map((t) => (
            <div key={t.full} className="row between">
              <span className="row small" style={{ gap: 8 }}><Avatar name={t.full} size="sm" />{t.full}</span>
              <b className="small">{t.value}</b>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
//  Clientes (cadastro usado no registro de atendimentos)
// -------------------------------------------------------------
function Clients({ group, user, bump }) {
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const clients = clientsForGroup(group.id);

  const save = () => {
    setError('');
    try {
      if (editing.id) updateClient(editing.id, editing, user);
      else createClient(group.id, editing, user);
      setEditing(null); bump();
    } catch (err) { setError(err.message); }
  };

  const filtered = clients.filter((c) => {
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return c.name.toLowerCase().includes(s) || (c.cidade || '').toLowerCase().includes(s);
  });

  return (
    <div>
      <div className="card card-pad mb">
        <div className="row wrap" style={{ gap: 8 }}>
          <input placeholder="🔍 Buscar cliente por nome ou cidade..." value={q} onChange={(e) => setQ(e.target.value)}
            style={{ flex: 1, minWidth: 200 }} />
          <button className="btn-primary" onClick={() => { setError(''); setEditing({ name: '', cidade: '', contact: '', note: '' }); }}>
            ➕ Novo cliente
          </button>
        </div>
        <div className="hint">Clientes cadastrados agilizam o registro: basta selecioná-los e descrever o atendimento.</div>
      </div>

      <div className="card">
        {filtered.length === 0 ? (
          <Empty>{clients.length === 0 ? 'Nenhum cliente cadastrado ainda.' : 'Nenhum cliente encontrado.'}</Empty>
        ) : (
          filtered.map((c) => {
            const n = db.filter('attendances', (a) => a.clientId === c.id).length;
            return (
              <div key={c.id} className="ticket-row" style={{ cursor: 'default' }}>
                <Avatar name={c.name} size="sm" />
                <div style={{ flex: 1 }}>
                  <b className="small">{c.name}</b>
                  <div className="t-meta">
                    {c.cidade ? `📍 ${c.cidade}` : 'sem cidade'}{c.contact ? ` · ${c.contact}` : ''} · {n} atendimento(s)
                  </div>
                  {c.note && <div className="muted small">{c.note}</div>}
                </div>
                <button className="btn-ghost btn-sm" title="Editar"
                  onClick={() => { setError(''); setEditing({ ...c }); }}>✏️</button>
                <button className="btn-ghost btn-sm btn-danger" title="Excluir" onClick={() => setConfirm(c)}>🗑️</button>
              </div>
            );
          })
        )}
      </div>

      {editing && (
        <Modal title={editing.id ? 'Editar cliente' : 'Novo cliente'} onClose={() => setEditing(null)}
          footer={<>
            <button onClick={() => setEditing(null)}>Cancelar</button>
            <button className="btn-primary" onClick={save}>Salvar</button>
          </>}>
          {error && <div className="alert alert-error">{error}</div>}
          <div className="field"><label>Nome do cliente *</label>
            <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              placeholder="Ex.: Cartório 1º Ofício" autoFocus /></div>
          <div className="row" style={{ gap: 10 }}>
            <div className="field" style={{ flex: 1 }}><label>Cidade</label>
              <CityField groupId={group.id} value={editing.cidade} onChange={(v) => setEditing({ ...editing, cidade: v })} /></div>
            <div className="field" style={{ flex: 1 }}><label>Contato</label>
              <input value={editing.contact} onChange={(e) => setEditing({ ...editing, contact: e.target.value })} placeholder="Telefone / e-mail" /></div>
          </div>
          <div className="field" style={{ marginBottom: 0 }}><label>Observações</label>
            <textarea value={editing.note} onChange={(e) => setEditing({ ...editing, note: e.target.value })}
              placeholder="Informações úteis sobre o cliente" /></div>
        </Modal>
      )}

      {confirm && (
        <ConfirmModal title="Excluir cliente" danger confirmLabel="Excluir"
          message={<>Excluir <b>{confirm.name}</b>? Os atendimentos já registrados são mantidos (ficam sem vínculo).</>}
          onCancel={() => setConfirm(null)}
          onConfirm={() => { deleteClient(confirm.id, user); setConfirm(null); bump(); }} />
      )}
    </div>
  );
}

// -------------------------------------------------------------
//  Registrar atendimento — cliente cadastrado OU manual
// -------------------------------------------------------------
function RegisterModal({ group, user, clients, onClose, onSaved }) {
  const [mode, setMode] = useState(clients.length ? 'registered' : 'manual');
  const [clientId, setClientId] = useState(clients[0]?.id || '');
  const [form, setForm] = useState({ client: '', cidade: '', note: '' });
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const selected = clientId ? clients.find((c) => c.id === clientId) : null;

  const save = () => {
    setError('');
    if (mode === 'registered' && !clientId) return setError('Selecione um cliente.');
    if (mode === 'manual' && !form.client.trim()) return setError('Informe o nome do cliente.');
    if (!form.note.trim()) return setError('Descreva o que foi feito.');
    registerAttendance(group.id, {
      clientId: mode === 'registered' ? clientId : null,
      client: mode === 'manual' ? form.client : '',
      cidade: mode === 'manual' ? form.cidade : '',
      note: form.note,
    }, user);
    onSaved();
  };

  return (
    <Modal title="Registrar atendimento" onClose={onClose}
      footer={<>
        <button onClick={onClose}>Cancelar</button>
        <button className="btn-primary" onClick={save}>Registrar</button>
      </>}>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="field">
        <label>Cliente</label>
        <div className="row" style={{ gap: 8, marginBottom: 8 }}>
          <button type="button" className={mode === 'registered' ? 'btn-primary btn-sm' : 'btn-sm'}
            onClick={() => setMode('registered')} disabled={!clients.length}>Cadastrado</button>
          <button type="button" className={mode === 'manual' ? 'btn-primary btn-sm' : 'btn-sm'}
            onClick={() => setMode('manual')}>Digitar manualmente</button>
        </div>

        {mode === 'registered' ? (
          clients.length ? (
            <>
              <select value={clientId} onChange={(e) => setClientId(e.target.value)}>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}{c.cidade ? ` — ${c.cidade}` : ''}</option>
                ))}
              </select>
              {selected?.cidade && <div className="hint">📍 {selected.cidade}{selected.contact ? ` · ${selected.contact}` : ''}</div>}
            </>
          ) : (
            <div className="hint">Nenhum cliente cadastrado. Use a aba <b>Clientes</b> ou digite manualmente.</div>
          )
        ) : (
          <div className="row" style={{ gap: 10 }}>
            <div className="field" style={{ flex: 1, marginBottom: 0 }}>
              <input value={form.client} onChange={set('client')} placeholder="Nome do cliente" autoFocus />
            </div>
            <div className="field" style={{ flex: 1, marginBottom: 0 }}>
              <CityField groupId={group.id} value={form.cidade} onChange={(v) => setForm({ ...form, cidade: v })} />
            </div>
          </div>
        )}
      </div>

      <div className="field" style={{ marginBottom: 0 }}>
        <label>O que foi feito *</label>
        <textarea value={form.note} onChange={set('note')} placeholder="Descreva o atendimento" />
      </div>
    </Modal>
  );
}
