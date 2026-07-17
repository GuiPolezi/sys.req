import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/store';
import {
  internalMessages, postInternalMessage, channelsForUser,
  markChannelRead, channelUnread, dmChannelId, dmContacts, dmUnreadFrom,
} from '../lib/domain';
import { Avatar, fmtDateTime } from '../components/ui';

// Chat interno: canais (Geral + categorias, só técnicos) e conversas
// individuais entre quaisquer membros do grupo (v0.0.5).
export default function InternalChat() {
  const { user, activeGroup, refresh } = useAuth();
  const [text, setText] = useState('');
  const [channel, setChannel] = useState(user.role === 'solicitante' ? '' : 'geral');
  const [, setLocal] = useState(0);
  const logRef = useRef(null);

  const channels = channelsForUser(activeGroup, user);
  const contacts = dmContacts(activeGroup, user);

  // se o usuário perdeu acesso ao canal aberto, volta ao primeiro disponível
  const validChannel =
    channels.some((c) => c.id === channel) || channel.startsWith('dm:')
      ? channel
      : (channels[0]?.id || (contacts[0] ? dmChannelId(user.id, contacts[0].userId) : ''));
  const active = validChannel;

  const isDm = active.startsWith('dm:');
  const dmOtherId = isDm ? active.split(':').slice(1).find((id) => id !== user.id) : null;
  const dmOther = dmOtherId ? db.byId('users', dmOtherId) : null;
  const messages = active ? internalMessages(activeGroup.id, active) : [];
  const current = isDm
    ? { name: dmOther?.name || 'Conversa', icon: '👤' }
    : channels.find((c) => c.id === active);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [messages.length, active]);

  useEffect(() => {
    if (!active) return;
    markChannelRead(activeGroup.id, user.id, active);
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, messages.length]);

  const send = (e) => {
    e.preventDefault();
    if (!text.trim() || !active) return;
    postInternalMessage(activeGroup.id, user.id, text, active);
    setText('');
    refresh();
    setLocal((n) => n + 1);
  };

  return (
    <div>
      <div className="page-head">
        <h1>Mensagens</h1>
        <p className="muted">
          {user.role === 'solicitante'
            ? 'Converse individualmente com a equipe do grupo.'
            : 'Canais da equipe e conversas individuais. Solicitantes só participam de conversas diretas.'}
        </p>
      </div>

      <div className="chat-layout">
        {/* canais + conversas */}
        <div className="card channels">
          {channels.length > 0 && (
            <>
              <div className="channels-title">Canais</div>
              {channels.map((c) => {
                const un = c.id === active ? 0 : channelUnread(activeGroup.id, user.id, c.id);
                return (
                  <button key={c.id} className={`channel ${active === c.id ? 'active' : ''}`} onClick={() => setChannel(c.id)}>
                    <span>{c.icon}</span>
                    <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                    {un > 0 && <span className="nav-badge" style={{ marginLeft: 0 }}>{un}</span>}
                  </button>
                );
              })}
            </>
          )}

          <div className="channels-title">Conversas</div>
          {contacts.length === 0 && <p className="muted small" style={{ padding: '0 12px' }}>Ninguém para conversar ainda.</p>}
          {contacts.map((m) => {
            const ch = dmChannelId(user.id, m.userId);
            const un = ch === active ? 0 : dmUnreadFrom(activeGroup, user, m.userId);
            return (
              <button key={m.userId} className={`channel ${active === ch ? 'active' : ''}`} onClick={() => setChannel(ch)}>
                <Avatar name={m.user.name} size="sm" />
                <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.user.name}</span>
                {un > 0 && <span className="nav-badge" style={{ marginLeft: 0 }}>{un}</span>}
              </button>
            );
          })}
        </div>

        {/* conversa */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 240px)', minHeight: 380 }}>
          <div className="card-pad row" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 12, gap: 8 }}>
            {isDm && dmOther ? (
              <>
                <Avatar name={dmOther.name} size="sm" />
                <b>{dmOther.name}</b>
                <span className="muted small">conversa individual</span>
              </>
            ) : (
              <b>{current?.icon} {current?.name || 'Selecione uma conversa'}</b>
            )}
          </div>
          <div className="chat-log" ref={logRef}>
            {!active && <p className="muted small" style={{ textAlign: 'center' }}>Escolha um canal ou uma conversa ao lado.</p>}
            {active && messages.length === 0 && <p className="muted small" style={{ textAlign: 'center' }}>Nenhuma mensagem ainda. Diga um oi 👋</p>}
            {messages.map((m) => {
              const u = db.byId('users', m.userId);
              const mine = m.userId === user.id;
              return (
                <div key={m.id} className="row" style={{ alignItems: 'flex-end', gap: 8, justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                  {!mine && <Avatar name={u?.name} size="sm" />}
                  <div className={`bubble ${mine ? 'mine' : ''}`}>
                    {!mine && !isDm && <div className="who">{u?.name}</div>}
                    <div>{m.text}</div>
                    <div className="when">{fmtDateTime(m.at)}</div>
                  </div>
                </div>
              );
            })}
          </div>
          {active && (
            <form className="chat-input" onSubmit={send}>
              <input value={text} onChange={(e) => setText(e.target.value)} placeholder={`Mensagem ${isDm ? `para ${dmOther?.name || ''}` : `em ${current?.name || ''}`}...`} autoFocus />
              <button className="btn-primary">Enviar</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
