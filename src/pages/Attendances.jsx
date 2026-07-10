import { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/store';
import { registerAttendance, attendancesForGroup } from '../lib/domain';
import { Avatar, Empty, Modal } from '../components/ui';

const WEEK = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// RCS12 — registro de atendimentos avulsos, com calendário e navegação por dia.
export default function Attendances() {
  const { user, activeGroup, refresh } = useAuth();
  const [, setLocal] = useState(0);
  const today = new Date();
  const [selected, setSelected] = useState(ymd(today));
  const [view, setView] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ cidade: user.cidade || '', client: '', note: '' });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const bump = () => { refresh(); setLocal((n) => n + 1); };

  const all = attendancesForGroup(activeGroup.id);
  const countByDay = useMemo(() => {
    const map = {};
    all.forEach((a) => { const d = a.at.slice(0, 10); map[d] = (map[d] || 0) + 1; });
    return map;
  }, [all]);

  const dayList = all.filter((a) => a.at.slice(0, 10) === selected);

  const save = (e) => {
    e.preventDefault();
    if (!form.note.trim() && !form.client.trim()) return;
    registerAttendance(activeGroup.id, form, user);
    setForm({ cidade: user.cidade || '', client: '', note: '' });
    setOpen(false);
    bump();
  };

  // grade do mês
  const first = new Date(view.y, view.m, 1);
  const startWeekday = first.getDay();
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
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
      <div className="row between page-head">
        <div>
          <h1>🗒️ Registro de atendimentos</h1>
          <p className="muted">Atendimentos feitos fora de um chamado (visita, telefone, presencial…).</p>
        </div>
        <button className="btn-primary" onClick={() => setOpen(true)}>➕ Registrar atendimento</button>
      </div>

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
          <div className="row between">
            <span className="muted small">Total geral</span>
            <b>{all.length}</b>
          </div>
        </div>

        {/* lista do dia */}
        <div className="card">
          <div className="card-pad row between" style={{ borderBottom: '1px solid var(--border)' }}>
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
                    <div className="t-meta">{u?.name} · {new Date(a.at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {open && (
        <Modal title="Registrar atendimento" onClose={() => setOpen(false)}
          footer={<><button onClick={() => setOpen(false)}>Cancelar</button><button className="btn-primary" onClick={save}>Registrar</button></>}>
          <div className="field"><label>Cliente / local</label><input value={form.client} onChange={set('client')} placeholder="Ex.: Cartório 1º Ofício" autoFocus /></div>
          <div className="field"><label>Cidade</label><input value={form.cidade} onChange={set('cidade')} placeholder="Ex.: Itajubá" /></div>
          <div className="field" style={{ marginBottom: 0 }}><label>O que foi feito</label><textarea value={form.note} onChange={set('note')} placeholder="Descreva o atendimento" /></div>
        </Modal>
      )}
    </div>
  );
}
