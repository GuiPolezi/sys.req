import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/store';
import { registerAttendance, attendancesForGroup } from '../lib/domain';
import { Avatar, Empty, fmtDateTime } from '../components/ui';

// RCS12 — suporte/técnico registra atendimentos avulsos (ex.: atendeu cliente em Itajubá)
export default function Attendances() {
  const { user, activeGroup, refresh } = useAuth();
  const [, setLocal] = useState(0);
  const [form, setForm] = useState({ cidade: user.cidade || '', client: '', note: '' });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const bump = () => { refresh(); setLocal((n) => n + 1); };

  const list = attendancesForGroup(activeGroup.id);

  const save = (e) => {
    e.preventDefault();
    if (!form.note.trim() && !form.client.trim()) return;
    registerAttendance(activeGroup.id, form, user);
    setForm({ cidade: user.cidade || '', client: '', note: '' });
    bump();
  };

  return (
    <div>
      <div className="page-head">
        <h1>🗒️ Registro de atendimentos</h1>
        <p className="muted">Registre atendimentos feitos fora de um chamado (visita, telefone, presencial…).</p>
      </div>

      <div className="grid" style={{ gridTemplateColumns: '360px 1fr', alignItems: 'start' }}>
        <form className="card card-pad" onSubmit={save}>
          <h3>Novo atendimento</h3>
          <div className="field"><label>Cliente / local</label><input value={form.client} onChange={set('client')} placeholder="Ex.: Cartório 1º Ofício" /></div>
          <div className="field"><label>Cidade</label><input value={form.cidade} onChange={set('cidade')} placeholder="Ex.: Itajubá" /></div>
          <div className="field"><label>O que foi feito</label><textarea value={form.note} onChange={set('note')} placeholder="Descreva o atendimento" /></div>
          <button className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>Registrar</button>
        </form>

        <div className="card">
          <div className="card-pad" style={{ borderBottom: '1px solid var(--border)' }}>
            <b>Histórico ({list.length})</b>
          </div>
          {list.length === 0 ? (
            <Empty>Nenhum atendimento registrado.</Empty>
          ) : (
            list.map((a) => {
              const u = db.byId('users', a.userId);
              return (
                <div key={a.id} className="ticket-row" style={{ cursor: 'default', alignItems: 'flex-start' }}>
                  <Avatar name={u?.name} size="sm" />
                  <div style={{ flex: 1 }}>
                    <div className="t-title">
                      {a.client || (a.ticketId ? `Chamado #${a.ticketId.slice(-4)}` : 'Atendimento')}
                      {a.cidade && <span className="chip" style={{ marginLeft: 8 }}>📍 {a.cidade}</span>}
                    </div>
                    {a.note && <div style={{ fontSize: 13 }}>{a.note}</div>}
                    <div className="t-meta">{u?.name} · {fmtDateTime(a.at)}</div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
