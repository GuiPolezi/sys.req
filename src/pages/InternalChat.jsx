import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/store';
import { internalMessages, postInternalMessage } from '../lib/domain';
import { Avatar, fmtDateTime } from '../components/ui';

export default function InternalChat() {
  const { user, activeGroup, refresh } = useAuth();
  const [text, setText] = useState('');
  const [, setLocal] = useState(0);
  const logRef = useRef(null);
  const messages = internalMessages(activeGroup.id);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [messages.length]);

  const send = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    postInternalMessage(activeGroup.id, user.id, text);
    setText('');
    refresh();
    setLocal((n) => n + 1);
  };

  return (
    <div>
      <div className="page-head">
        <h1>💬 Chat interno da equipe</h1>
        <p className="muted">Conversa entre técnicos (suporte e devs) — solicitantes não veem isto.</p>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 220px)' }}>
        <div className="chat-log" ref={logRef}>
          {messages.length === 0 && <p className="muted small" style={{ textAlign: 'center' }}>Nenhuma mensagem ainda. Diga um oi 👋</p>}
          {messages.map((m) => {
            const u = db.byId('users', m.userId);
            const mine = m.userId === user.id;
            return (
              <div key={m.id} className="row" style={{ alignItems: 'flex-end', gap: 8, justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                {!mine && <Avatar name={u?.name} size="sm" />}
                <div className={`bubble ${mine ? 'mine' : ''}`}>
                  {!mine && <div className="who">{u?.name}</div>}
                  <div>{m.text}</div>
                  <div className="when">{fmtDateTime(m.at)}</div>
                </div>
              </div>
            );
          })}
        </div>
        <form className="chat-input" onSubmit={send}>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Mensagem para a equipe..." autoFocus />
          <button className="btn-primary">Enviar</button>
        </form>
      </div>
    </div>
  );
}
