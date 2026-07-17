import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/store';
import {
  assignTicket, setStatus, setUrgency, addAttendance,
  sendToReview, approveReview, rejectReview, toggleUrgentAlert, reopenTicket,
  ticketMessages, postTicketMessage,
  groupMembers, isTech, can, isTicketOwner, isTicketClosed, canEditTicket, canChatOnTicket,
  ticketRequesterId, STATUS, URGENCY,
  slaInfo, SLA_STATUS, childTickets, openChildTickets, nextWorkflowStep, advanceWorkflow,
  createSubticket, requestTechReview, respondTechReview,
  canAssignTickets, canChangeUrgency, canDeleteTickets, deleteTicket,
} from '../lib/domain';
import { StatusBadge, UrgencyBadge, RoleBadge, Avatar, fmtDateTime } from '../components/ui';
import { RichView } from '../components/RichText';

// status ajustáveis manualmente (em_analise vem do botão "Enviar para análise")
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
  const closed = isTicketClosed(ticket);            // concluído = encerrado
  const owner = isTicketOwner(ticket, user);
  const canEdit = canEditTicket(ticket, user);
  const canChat = canChatOnTicket(ticket, user);
  const isRequester = ticketRequesterId(ticket) === user.id;
  const mayAssign = canAssignTickets(activeGroup, user);      // suporte OU gerente (v0.0.5)
  const mayUrgency = canChangeUrgency(activeGroup, ticket, user);
  const mayDelete = canDeleteTickets(activeGroup, user);

  const author = db.byId('users', ticket.createdBy);
  const assignee = ticket.assignedTo ? db.byId('users', ticket.assignedTo) : null;
  const cat = ticket.categoryId ? db.byId('categories', ticket.categoryId) : null;
  const sys = ticket.systemId ? db.byId('systems', ticket.systemId) : null;
  const assignables = groupMembers(activeGroup).filter((m) => m.role !== 'solicitante');
  const requesterLabel = ticket.requesterName || author?.name;

  const sla = slaInfo(ticket);
  const parent = ticket.parentId ? db.byId('tickets', ticket.parentId) : null;
  const children = childTickets(ticket.id);
  const openChildren = openChildTickets(ticket.id).length;
  const nextStep = tech ? nextWorkflowStep(ticket) : null;

  const doDelete = () => {
    if (!confirm(`Excluir definitivamente o chamado #${ticket.number || ''} "${ticket.title}"?`)) return;
    try { deleteTicket(ticket.id, user); refresh(); navigate('/tickets'); }
    catch (err) { alert(err.message); }
  };

  return (
    <div>
      <div className="row between page-head">
        <button className="btn-sm" onClick={() => navigate('/tickets')}>← Chamados</button>
        <div className="row" style={{ gap: 8 }}>
          {mayDelete && <button className="btn-ghost btn-sm btn-danger" onClick={doDelete}>Excluir chamado</button>}
          <span className="muted small">Nº <b>#{ticket.number || ticket.id.slice(-6)}</b> · criado {new Date(ticket.createdAt).toLocaleDateString('pt-BR')}</span>
        </div>
      </div>

      {parent && (
        <div className="alert alert-info">
          Este é um <b>subchamado</b> de{' '}
          <a onClick={() => navigate(`/tickets/${parent.id}`)} style={{ cursor: 'pointer' }}>
            #{parent.number || ''} — {parent.title}
          </a>. Ao concluir, o responsável pelo principal é avisado.
        </div>
      )}

      {/* faixas de estado */}
      {closed && (
        <div className="alert alert-ok">
          ✅ <b>Chamado concluído e encerrado.</b> O chat e todas as edições estão bloqueados.
        </div>
      )}
      {!closed && ticket.urgentAlert && (
        <div className="alert alert-error">
          🚨 <b>Alerta de urgência</b> enviado pelo solicitante — este chamado precisa de atenção imediata.
        </div>
      )}
      {!closed && ticket.status === 'em_analise' && (
        isRequester ? (
          <div className="alert alert-review">
            🔎 <b>Aguardando a sua análise.</b> O time marcou este chamado como resolvido —
            confirme abaixo se está tudo certo ou rejeite para devolvê-lo.
          </div>
        ) : (
          <div className="alert alert-info">
            🔎 Em análise — aguardando o solicitante <b>{requesterLabel}</b> confirmar se foi resolvido.
          </div>
        )
      )}

      <div className="grid grid-sidebar" style={{ alignItems: 'start' }}>
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
              Solicitante <b>{requesterLabel}</b>
              {author && author.id !== ticket.requesterId && <> · registrado por {author.name}</>}
              {' · '}{fmtDateTime(ticket.createdAt)} · {ticket.type}
              {sys && <> · <span className="chip">🖥️ {sys.name}</span></>}
              {cat && <> · <span className="chip">{cat.name}</span></>}
              {ticket.cidade && <> · 📍 {ticket.cidade}</>}
            </p>
            <div className="divider" />
            <RichView html={ticket.description} />
          </div>

          {/* subchamados / etapas do fluxo (v0.0.5) */}
          {tech && (children.length > 0 || nextStep || (owner && !closed)) && (
            <Subtickets
              ticket={ticket} subs={children} nextStep={nextStep}
              canAct={owner && !closed} user={user} group={activeGroup}
              onChange={bump} navigate={navigate}
            />
          )}

          {/* análise técnica: dev ⇄ suporte (v0.0.5) */}
          {tech && (ticket.techReview || (owner && !closed)) && (
            <TechReview ticket={ticket} user={user} group={activeGroup} closed={closed} onChange={bump} />
          )}

          <TicketChat ticket={ticket} user={user} onPost={bump} canChat={canChat} closed={closed} key={tick} />

          {tech && <Attendances ticket={ticket} user={user} onAdd={bump} canRegister={canEdit} closed={closed} />}
        </div>

        {/* ---------- coluna lateral ---------- */}
        <div className="col" style={{ gap: 16 }}>
          {/* SLA (v0.0.5) */}
          {sla && (
            <div className="card card-pad">
              <div className="row between">
                <h3 style={{ margin: 0 }}>SLA · {sla.sla.name}</h3>
                <span className="badge" style={{ background: 'transparent', border: `1px solid ${SLA_STATUS[sla.status].color}`, color: SLA_STATUS[sla.status].color }}>
                  {SLA_STATUS[sla.status].label}
                </span>
              </div>
              <p className="muted small" style={{ margin: '8px 0 0' }}>
                Prazo de solução: <b>{sla.deadline.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</b>
                {!closed && sla.remainingMs > 0 && <> · restam ~{Math.max(1, Math.round(sla.remainingMs / 3600_000))}h</>}
              </p>
            </div>
          )}
          {/* ações do solicitante */}
          {isRequester && user.role === 'solicitante' && !closed && (
            <div className="card card-pad">
              <h3>Ações do solicitante</h3>
              {ticket.status === 'em_analise' ? (
                <>
                  <p className="muted small">Confira se o problema foi realmente resolvido.</p>
                  <div className="col" style={{ gap: 6 }}>
                    <button className="btn-primary btn-sm" style={{ justifyContent: 'center' }}
                      onClick={() => { approveReview(ticket.id, user); bump(); }}>👍 Aprovar e concluir</button>
                    <button className="btn-sm btn-danger" style={{ justifyContent: 'center' }}
                      onClick={() => { rejectReview(ticket.id, user); bump(); }}>👎 Rejeitar (voltar ao time)</button>
                  </div>
                  <p className="hint">Ao aprovar, o chamado é <b>encerrado</b> — o chat e as edições são bloqueados.</p>
                </>
              ) : (
                <button
                  className={ticket.urgentAlert ? 'btn-sm btn-danger' : 'btn-sm'}
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={() => { toggleUrgentAlert(ticket.id, !ticket.urgentAlert, user); bump(); }}
                >
                  {ticket.urgentAlert ? '🔕 Cancelar alerta de urgência' : '🚨 Enviar alerta de urgência'}
                </button>
              )}
            </div>
          )}

          <div className="card card-pad">
            <h3>Responsável</h3>
            {assignee ? (
              <div className="row" style={{ gap: 8 }}>
                <Avatar name={assignee.name} size="sm" />
                <div className="col">
                  <b style={{ fontSize: 13 }}>{assignee.name}{owner && ' (você)'}</b>
                  <RoleBadge role={assignee.role} />
                </div>
              </div>
            ) : (
              <p className="muted small" style={{ margin: 0 }}>Ninguém atribuído.</p>
            )}

            {mayAssign && !closed && (
              <div className="field" style={{ marginTop: 12, marginBottom: 0 }}>
                <label>Atribuir para</label>
                <select value={ticket.assignedTo || ''} onChange={(e) => { assignTicket(ticket.id, e.target.value || null, user); bump(); }}>
                  <option value="">— Ninguém —</option>
                  {assignables.map((m) => (
                    <option key={m.userId} value={m.userId}>{m.user.name} ({m.role}{m.isManager ? ' · gerente' : ''})</option>
                  ))}
                </select>
                {!isSuporte && <div className="hint">Você pode atribuir por ser gerente.</div>}
              </div>
            )}
            {user.role === 'dev' && !closed && ticket.assignedTo !== user.id && (
              <button className="btn-primary btn-sm mt" style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => { assignTicket(ticket.id, user.id, user); bump(); }}>
                Pegar este chamado
              </button>
            )}
          </div>

          {/* status/urgência — só o responsável e só se não encerrado */}
          {tech && canEdit && (
            <div className="card card-pad">
              <h3>Status</h3>
              <div className="col" style={{ gap: 6 }}>
                {MANUAL_STATUS.map((k) => (
                  <button key={k}
                    className={ticket.status === k ? 'btn-primary btn-sm' : 'btn-sm'}
                    style={{ justifyContent: 'flex-start' }}
                    onClick={() => {
                      try { setStatus(ticket.id, k, user); bump(); }
                      catch (err) { alert(err.message); }
                    }}>
                    <span className="dot" style={{ background: STATUS[k].color }} /> {STATUS[k].label}
                  </button>
                ))}
              </div>

              {can.sendToReview(user.role) && ['em_andamento', 'aguardando'].includes(ticket.status) && (
                <button className="btn-sm mt" style={{ width: '100%', justifyContent: 'center' }}
                  onClick={() => {
                    try { sendToReview(ticket.id, user); bump(); }
                    catch (err) { alert(err.message); }
                  }}>
                  🔎 Enviar para análise do solicitante
                </button>
              )}
              {ticket.status === 'em_analise' && <p className="muted small mt">Aguardando aprovação do solicitante.</p>}
              {openChildren > 0 && (
                <p className="hint mt">Há {openChildren} subchamado(s) em aberto — conclua as etapas antes de finalizar.</p>
              )}

              <div className="field" style={{ marginTop: 14, marginBottom: 0 }}>
                <label>Urgência</label>
                <select value={ticket.urgency} disabled={!mayUrgency}
                  onChange={(e) => { setUrgency(ticket.id, e.target.value, user); bump(); }}>
                  {Object.entries(URGENCY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                {!mayUrgency && <div className="hint">A permissão do grupo restringe a alteração de urgência.</div>}
              </div>
            </div>
          )}

          {tech && !canEdit && !closed && (
            <div className="card card-pad">
              <p className="muted small" style={{ margin: 0 }}>
                🔒 Alterar status, urgência e registrar atendimentos é liberado apenas para o <b>responsável</b> pelo chamado.
              </p>
            </div>
          )}

          {/* saída de emergência: só o suporte pode reabrir um chamado encerrado */}
          {closed && isSuporte && (
            <div className="card card-pad">
              <h3>Chamado encerrado</h3>
              <p className="muted small">Precisa retomar o atendimento? Só o suporte pode reabrir.</p>
              <button className="btn-sm" style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => { reopenTicket(ticket.id, user); bump(); }}>
                ↩️ Reabrir chamado
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
//  Subchamados & etapas do fluxo (v0.0.5)
// -------------------------------------------------------------
function Subtickets({ ticket, subs, nextStep, canAct, user, group, onChange, navigate }) {
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: '', assignTo: '' });
  const techs = groupMembers(group).filter((m) => m.role !== 'solicitante');

  const advance = () => {
    try { const sub = advanceWorkflow(ticket.id, user); onChange(); navigate(`/tickets/${sub.id}`); }
    catch (err) { alert(err.message); }
  };

  const createManual = (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    const sub = createSubticket(ticket.id, {
      title: form.title, type: ticket.type, categoryId: ticket.categoryId,
      systemId: ticket.systemId, urgency: ticket.urgency, assignTo: form.assignTo || null,
    }, user);
    setForm({ title: '', assignTo: '' });
    setCreating(false);
    onChange();
    navigate(`/tickets/${sub.id}`);
  };

  return (
    <div className="card card-pad">
      <div className="row between wrap" style={{ gap: 8 }}>
        <h3 style={{ margin: 0 }}>Etapas & subchamados</h3>
        {canAct && (
          <div className="row" style={{ gap: 6 }}>
            {nextStep && (
              <button className="btn-primary btn-sm" onClick={advance}>
                ▶ Gerar próxima etapa: {nextStep.step.title}
              </button>
            )}
            <button className="btn-sm" onClick={() => setCreating((v) => !v)}>+ Subchamado</button>
          </div>
        )}
      </div>

      {ticket.workflowId && (
        <p className="muted small" style={{ margin: '6px 0 0' }}>
          Fluxo: <b>{db.byId('workflows', ticket.workflowId)?.name || '—'}</b>
          {nextStep ? ` · próxima etapa: ${nextStep.step.title}` : ' · todas as etapas geradas'}
        </p>
      )}

      {creating && (
        <form className="row wrap mt" onSubmit={createManual} style={{ gap: 8 }}>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Título do subchamado" style={{ flex: 2, minWidth: 180 }} autoFocus />
          <select value={form.assignTo} onChange={(e) => setForm({ ...form, assignTo: e.target.value })} style={{ flex: 1, minWidth: 150 }}>
            <option value="">Sem atribuição (pool)</option>
            {techs.map((m) => <option key={m.userId} value={m.userId}>{m.user.name} ({m.role})</option>)}
          </select>
          <button className="btn-primary btn-sm">Criar</button>
        </form>
      )}

      <div className="col mt" style={{ gap: 6 }}>
        {subs.length === 0 && <p className="muted small" style={{ margin: 0 }}>Nenhum subchamado ainda.</p>}
        {subs.map((c) => {
          const a = c.assignedTo ? db.byId('users', c.assignedTo) : null;
          return (
            <div key={c.id} className="ticket-row" style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 12 }}
              onClick={() => navigate(`/tickets/${c.id}`)}>
              <span className="tkt-num">#{c.number || ''}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="t-title" style={{ fontSize: 13.5 }}>{c.title}</div>
                <div className="t-meta">{a ? `→ ${a.name}` : 'sem responsável'}</div>
              </div>
              <StatusBadge status={c.status} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// -------------------------------------------------------------
//  Análise técnica (v0.0.5) — dev encaminha ao suporte, que responde
// -------------------------------------------------------------
function TechReview({ ticket, user, group, closed, onChange }) {
  const review = ticket.techReview;
  const sups = groupMembers(group).filter((m) => m.role === 'suporte');
  const [asking, setAsking] = useState(false);
  const [suporteId, setSuporteId] = useState(sups[0]?.userId || '');
  const [note, setNote] = useState('');
  const [answer, setAnswer] = useState('');

  const canRespond = review?.status === 'pendente' &&
    (review.assignedTo === user.id || user.role === 'suporte');
  const requester = review ? db.byId('users', review.requestedBy) : null;
  const reviewer = review ? db.byId('users', review.assignedTo) : null;

  const ask = (e) => {
    e.preventDefault();
    try { requestTechReview(ticket.id, suporteId, note, user); setAsking(false); setNote(''); onChange(); }
    catch (err) { alert(err.message); }
  };

  const respond = (e) => {
    e.preventDefault();
    if (!answer.trim()) return;
    try { respondTechReview(ticket.id, answer, user); setAnswer(''); onChange(); }
    catch (err) { alert(err.message); }
  };

  return (
    <div className="card card-pad">
      <div className="row between wrap" style={{ gap: 8 }}>
        <h3 style={{ margin: 0 }}>Análise técnica (suporte)</h3>
        {!review?.status && !closed && isTicketOwner(ticket, user) && (
          <button className="btn-sm" onClick={() => setAsking((v) => !v)} disabled={!sups.length}>
            Solicitar análise do suporte
          </button>
        )}
      </div>

      {!review && !asking && (
        <p className="muted small" style={{ margin: '6px 0 0' }}>
          Encaminhe o chamado para um técnico de suporte revisar e responder antes de seguir.
        </p>
      )}

      {asking && (
        <form className="col mt" onSubmit={ask} style={{ gap: 8 }}>
          <select value={suporteId} onChange={(e) => setSuporteId(e.target.value)}>
            {sups.map((m) => <option key={m.userId} value={m.userId}>{m.user.name}</option>)}
          </select>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="O que o suporte deve analisar?" />
          <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="btn-sm" onClick={() => setAsking(false)}>Cancelar</button>
            <button className="btn-primary btn-sm">Enviar para o suporte</button>
          </div>
        </form>
      )}

      {review && (
        <div className="mt">
          <div className="alert alert-review" style={{ marginBottom: 10 }}>
            <b>{requester?.name}</b> solicitou análise a <b>{reviewer?.name}</b>
            {' · '}{fmtDateTime(review.at)}
            {review.note && <div style={{ marginTop: 4 }}>“{review.note}”</div>}
          </div>

          {review.status === 'respondida' ? (
            <div className="alert alert-ok" style={{ margin: 0 }}>
              <b>Resposta do suporte</b> · {fmtDateTime(review.respondedAt)}
              <div style={{ marginTop: 4 }}>{review.response || '—'}</div>
            </div>
          ) : canRespond ? (
            <form className="col" onSubmit={respond} style={{ gap: 8 }}>
              <textarea value={answer} onChange={(e) => setAnswer(e.target.value)}
                placeholder="Escreva a resposta da análise (volta para quem solicitou)" />
              <div className="row" style={{ justifyContent: 'flex-end' }}>
                <button className="btn-primary btn-sm">Responder e devolver</button>
              </div>
            </form>
          ) : (
            <p className="muted small" style={{ margin: 0 }}>⏳ Aguardando a resposta do suporte.</p>
          )}
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------
//  Chat do chamado — bloqueado quando encerrado
// -------------------------------------------------------------
function TicketChat({ ticket, user, onPost, canChat, closed }) {
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
        <h3 style={{ margin: 0 }}>💬 Conversa do chamado {closed && <span className="chip">encerrada</span>}</h3>
      </div>
      <div className="chat-log" ref={logRef}>
        {messages.length === 0 && <p className="muted small" style={{ textAlign: 'center' }}>Nenhuma mensagem.</p>}
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
      {canChat ? (
        <form className="chat-input" onSubmit={send}>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Escreva uma mensagem..." />
          <button className="btn-primary">Enviar</button>
        </form>
      ) : (
        <div className="chat-input" style={{ justifyContent: 'center' }}>
          <span className="muted small">
            {closed
              ? '🔒 Chamado encerrado — a conversa foi finalizada.'
              : '🔒 Apenas o responsável pelo chamado e o solicitante podem enviar mensagens.'}
          </span>
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------
//  Atendimentos do chamado — só o responsável registra
// -------------------------------------------------------------
function Attendances({ ticket, user, onAdd, canRegister, closed }) {
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
      {canRegister ? (
        <form className="row mt" onSubmit={add} style={{ gap: 8 }}>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Registrar o que foi feito..." />
          <button className="btn-primary btn-sm">Registrar</button>
        </form>
      ) : (
        <p className="muted small mt" style={{ margin: '10px 0 0' }}>
          {closed ? '🔒 Chamado encerrado.' : '🔒 Só o responsável pelo chamado pode registrar atendimentos.'}
        </p>
      )}
    </div>
  );
}
