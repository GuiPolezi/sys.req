import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/store';
import { internalMessages, postInternalMessage, categoriesForGroup } from '../lib/domain';
import { Avatar, fmtDateTime } from '../components/ui';

// RCS02 — chat interno dos técnicos, com canais: Geral + por categoria de dev.
export default function InternalChat() {
  const { user, activeGroup, refresh } = useAuth();
  const [text, setText] = useState('');
  const [channel, setChannel] = useState('geral');
  const [, setLocal] = useState(0);
  const logRef = useRef(null);

  const categories = categoriesForGroup(activeGroup.id);
  const channels = [{ id: 'geral', name: 'Geral', icon: '💬' }, ...categories.map((c) => ({ id: c.id, name: c.name, icon: '🗂️', color: c.color }))];
  const messages = internalMessages(activeGroup.id, channel);
  const current = channels.find((c) => c.id === channel);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [messages.length, channel]);

  const send = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    postInternalMessage(activeGroup.id, user.id, text, channel);
    setText('');
    refresh();
    setLocal((n) => n + 1);
  };

  return (
    <div>
      <div className="page-head">
        <h1>💬 Chat interno da equipe</h1>
        <p className="muted">Conversa entre técnicos — solicitantes não veem isto. Use os canais por área.</p>
      </div>

      <div className="chat-layout">
        {/* canais */}
        <div className="card channels">
          <div className="channels-title">Canais</div>
          {channels.map((c) => (
            <button key={c.id} className={`channel ${channel === c.id ? 'active' : ''}`} onClick={() => setChannel(c.id)}>
              <span>{c.icon}</span>
              <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
            </button>
          ))}
        </div>

        {/* conversa */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 240px)', minHeight: 380 }}>
          <div className="card-pad" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
            <b>{current?.icon} {current?.name}</b>
            {channel !== 'geral' && <span className="muted small"> · canal da categoria</span>}
          </div>
          <div className="chat-log" ref={logRef}>
            {messages.length === 0 && <p className="muted small" style={{ textAlign: 'center' }}>Nenhuma mensagem neste canal ainda. Diga um oi 👋</p>}
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
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder={`Mensagem em ${current?.name}...`} autoFocus />
            <button className="btn-primary">Enviar</button>
          </form>
        </div>
      </div>
    </div>
  );
}
