import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/store';
import {
  assignTicket, setStatus, setUrgency, addAttendance,
  sendToReview, approveReview, rejectReview, toggleUrgentAlert,
  ticketMessages, postTicketMessage,
  groupMembers, isTech, can, STATUS, URGENCY,
} from '../lib/domain';
import { StatusBadge, UrgencyBadge, RoleBadge, Avatar, fmtDateTime } from '../components/ui';

// status ajustáveis manualmente (em_analise é definido via "Enviar para análise")
const MANUAL_STATUS = ['aberto', 'em_andamento', 'aguardando', 'concluido'];

export default function TicketDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, activeGroup, refresh, tick } = useAuth();
  const [, setLocal] = useState(0);
  const bump = () => { refresh(); setLocal((n) => n + 1); };

  const ticket = db.byId('tickets', id);
  if (!ticket || ticket.groupId !== activeGroup.id) {
    return <div className="empty">Chamado não encontrado. <a onClick={() => navigate('/tickets')}>Voltar</a></div>;
  }

  const isSuporte = user.role === 'suporte';
  const tech = isTech(user.role);
  const isAuthor = ticket.createdBy === user.id;
  const author = db.byId('users', ticket.createdBy);
  const assignee = ticket.assignedTo ? db.byId('users', ticket.assignedTo) : null;
  const cat = ticket.categoryId ? db.byId('categories', ticket.categoryId) : null;
  const assignables = groupMembers(activeGroup).filter((m) => m.role !== 'solicitante');

  return (
    <div>
      <div className="row between page-head">
        <button className="btn-sm" onClick={() => navigate('/tickets')}>← Chamados</button>
        <span className="muted small">#{ticket.id.slice(-6)}</span>
      </div>

      {ticket.urgentAlert && (
        <div className="alert" style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c' }}>
          🚨 <b>Alerta de urgência</b> enviado pelo solicitante — este chamado precisa de atenção imediata.
        </div>
      )}
      {ticket.status === 'em_analise' && (
        <div className="alert alert-info">
          🔎 Em análise — aguardando o solicitante <b>{author?.name}</b> confirmar se foi resolvido.
        </div>
      )}

      <div className="grid" style={{ gridTemplateColumns: '1fr 320px', alignItems: 'start' }}>
        {/* ---------- coluna principal ---------- */}
        <div className="col" style={{ gap: 16 }}>
          <div className="card card-pad">
            <div className="row between wrap" style={{ gap: 8 }}>
              <h1 style={{ margin: 0 }}>{ticket.title}</h1>
              <div className="row" style={{ gap: 6 }}>
                <UrgencyBadge urgency={ticket.urgency} />
                <StatusBadge status={ticket.status} />
              </div>
            </div>
            <p className="muted small" style={{ marginTop: 6 }}>
              Aberto por <b>{author?.name}</b> · {fmtDateTime(ticket.createdAt)} · {ticket.type}
              {cat && <> · <span className="chip">{cat.name}</span></>}
              {ticket.cidade && <> · 📍 {ticket.cidade}</>}
            </p>
            <div className="divider" />
            <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
              {ticket.description || <span className="muted">Sem descrição.</span>}
            </p>
          </div>

          <TicketChat ticket={ticket} user={user} onPost={bump} key={tick} />

          {tech && <Attendances ticket={ticket} user={user} onAdd={bump} />}
        </div>

        {/* ---------- coluna lateral (ações) ---------- */}
        <div className="col" style={{ gap: 16 }}>
          {/* Ações do solicitante autor: alerta + análise (RCS05 / RCS08) */}
          {isAuthor && user.role === 'solicitante' && (
            <div className="card card-pad">
              <h3>Ações do solicitante</h3>
              {ticket.status === 'em_analise' ? (
                <>
                  <p className="muted small">O time marcou como resolvido. Confere se está tudo certo?</p>
                  <div className="col" style={{ gap: 6 }}>
                    <button className="btn-primary btn-sm" style={{ justifyContent: 'center' }}
                      onClick={() => { approveReview(ticket.id, user); bump(); }}>👍 Aprovar (concluir)</button>
                    <button className="btn-sm btn-danger" style={{ justifyContent: 'center' }}
                      onClick={() => { rejectReview(ticket.id, user); bump(); }}>👎 Rejeitar (voltar ao time)</button>
                  </div>
                </>
              ) : ticket.status !== 'concluido' ? (
                <button
                  className={ticket.urgentAlert ? 'btn-sm btn-danger' : 'btn-sm'}
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={() => { toggleUrgentAlert(ticket.id, !ticket.urgentAlert, user); bump(); }}
                >
                  {ticket.urgentAlert ? '🔕 Cancelar alerta de urgência' : '🚨 Enviar alerta de urgência'}
                </button>
              ) : (
                <p className="muted small" style={{ margin: 0 }}>Chamado concluído.</p>
              )}
            </div>
          )}

          <div className="card card-pad">
            <h3>Responsável</h3>
            {assignee ? (
              <div className="row" style={{ gap: 8 }}>
                <Avatar name={assignee.name} size="sm" />
                <div className="col">
                  <b style={{ fontSize: 13 }}>{assignee.name}</b>
                  <RoleBadge role={assignee.role} />
                </div>
              </div>
            ) : (
              <p className="muted small" style={{ margin: 0 }}>Ninguém atribuído.</p>
            )}

            {isSuporte && (
              <div className="field" style={{ marginTop: 12, marginBottom: 0 }}>
                <label>Atribuir para</label>
                <select value={ticket.assignedTo || ''} onChange={(e) => { assignTicket(ticket.id, e.target.value || null, user); bump(); }}>
                  <option value="">— Ninguém —</option>
                  {assignables.map((m) => (
                    <option key={m.userId} value={m.userId}>{m.user.name} ({m.role})</option>
                  ))}
                </select>
              </div>
            )}
            {user.role === 'dev' && ticket.assignedTo !== user.id && (
              <button className="btn-primary btn-sm mt" style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => { assignTicket(ticket.id, user.id, user); bump(); }}>
                Pegar este chamado
              </button>
            )}
          </div>

          {tech && (
            <div className="card card-pad">
              <h3>Status</h3>
              <div className="col" style={{ gap: 6 }}>
                {MANUAL_STATUS.map((k) => (
                  <button
                    key={k}
                    className={ticket.status === k ? 'btn-primary btn-sm' : 'btn-sm'}
                    style={{ justifyContent: 'flex-start' }}
                    onClick={() => { setStatus(ticket.id, k, user); bump(); }}
                  >
                    <span className="dot" style={{ background: STATUS[k].color }} /> {STATUS[k].label}
                  </button>
                ))}
              </div>

              {/* RCS08 — enviar para análise do solicitante */}
              {can.sendToReview(user.role) && ['em_andamento', 'aguardando'].includes(ticket.status) && (
                <button className="btn-sm mt" style={{ width: '100%', justifyContent: 'center' }}
                  onClick={() => { sendToReview(ticket.id, user); bump(); }}>
                  🔎 Enviar para análise do solicitante
                </button>
              )}
              {ticket.status === 'em_analise' && (
                <p className="muted small mt">Aguardando aprovação do solicitante.</p>
              )}

              <div className="field" style={{ marginTop: 14, marginBottom: 0 }}>
                <label>Urgência</label>
                <select value={ticket.urgency} onChange={(e) => { setUrgency(ticket.id, e.target.value, user); bump(); }}>
                  {Object.entries(URGENCY).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
//  Chat do chamado (RCS03)
// -------------------------------------------------------------
function TicketChat({ ticket, user, onPost }) {
  const [text, setText] = useState('');
  const logRef = useRef(null);
  const messages = ticketMessages(ticket.id);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [messages.length]);

  const send = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    postTicketMessage(ticket.id, user.id, text);
    setText('');
    onPost();
  };

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', height: 420 }}>
      <div className="card-pad" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
        <h3 style={{ margin: 0 }}>💬 Conversa do chamado</h3>
      </div>
      <div className="chat-log" ref={logRef}>
        {messages.length === 0 && <p className="muted small" style={{ textAlign: 'center' }}>Nenhuma mensagem ainda.</p>}
        {messages.map((m) => {
          const u = db.byId('users', m.userId);
          const mine = m.userId === user.id;
          return (
            <div key={m.id} className={`bubble ${mine ? 'mine' : ''}`}>
              {!mine && <div className="who">{u?.name}</div>}
              <div>{m.text}</div>
              <div className="when">{fmtDateTime(m.at)}</div>
            </div>
          );
        })}
      </div>
      <form className="chat-input" onSubmit={send}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Escreva uma mensagem..." />
        <button className="btn-primary">Enviar</button>
      </form>
    </div>
  );
}

// -------------------------------------------------------------
//  Atendimentos (registro de trabalho feito) — só técnicos
// -------------------------------------------------------------
function Attendances({ ticket, user, onAdd }) {
  const [note, setNote] = useState('');
  const add = (e) => {
    e.preventDefault();
    if (!note.trim()) return;
    addAttendance(ticket.id, user.id, note);
    setNote('');
    onAdd();
  };
  return (
    <div className="card card-pad">
      <h3>🛠️ Atendimentos registrados</h3>
      {ticket.attendances.length === 0 && <p className="muted small">Nenhum atendimento registrado.</p>}
      <div className="col" style={{ gap: 8 }}>
        {ticket.attendances.map((a) => {
          const u = db.byId('users', a.userId);
          return (
            <div key={a.id} style={{ borderLeft: '3px solid var(--primary)', paddingLeft: 10 }}>
              <div style={{ fontSize: 13 }}>{a.note}</div>
              <div className="muted small">{u?.name} · {fmtDateTime(a.at)}</div>
            </div>
          );
        })}
      </div>
      <form className="row mt" onSubmit={add} style={{ gap: 8 }}>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Registrar o que foi feito..." />
        <button className="btn-primary btn-sm">Registrar</button>
      </form>
    </div>
  );
}
