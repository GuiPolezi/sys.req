import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  notificationsForUser, markNotificationRead, markAllNotificationsRead, unreadNotifications,
} from '../lib/domain';
import { Empty, timeAgo } from '../components/ui';

const ICONS = {
  mensagem: '💬',
  status: '🔄',
  analise: '🔎',
  atribuicao: '📌',
  urgencia: '🚨',
  aprovado: '✅',
  rejeitado: '👎',
};

export default function Notifications() {
  const { user, activeGroup, refresh } = useAuth();
  const navigate = useNavigate();
  const [, setLocal] = useState(0);
  const [onlyUnread, setOnlyUnread] = useState(false);
  const bump = () => { refresh(); setLocal((n) => n + 1); };

  const all = notificationsForUser(activeGroup.id, user.id);
  const unread = unreadNotifications(activeGroup.id, user.id);
  const list = onlyUnread ? all.filter((n) => !n.read) : all;

  const openIt = (n) => {
    markNotificationRead(n.id);
    bump();
    if (n.ticketId) navigate(`/tickets/${n.ticketId}`);
  };

  return (
    <div>
      <div className="row between wrap page-head" style={{ gap: 10 }}>
        <div>
          <h1>🔔 Notificações</h1>
          <p className="muted">
            {unread > 0 ? <><b>{unread}</b> não lida(s)</> : 'Tudo em dia por aqui.'} — {activeGroup.name}
          </p>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className={onlyUnread ? 'btn-primary btn-sm' : 'btn-sm'} onClick={() => setOnlyUnread((v) => !v)}>
            Só não lidas
          </button>
          {unread > 0 && (
            <button className="btn-sm" onClick={() => { markAllNotificationsRead(activeGroup.id, user.id); bump(); }}>
              ✓ Marcar todas como lidas
            </button>
          )}
        </div>
      </div>

      <div className="card">
        {list.length === 0 ? (
          <Empty>{onlyUnread ? 'Nenhuma notificação não lida.' : 'Nenhuma notificação ainda.'}</Empty>
        ) : (
          list.map((n) => (
            <div
              key={n.id}
              className={`ticket-row notif ${n.read ? '' : 'unread'}`}
              onClick={() => openIt(n)}
            >
              <span style={{ fontSize: 18, flexShrink: 0 }}>{ICONS[n.type] || '🔔'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="t-title" style={{ fontWeight: n.read ? 500 : 700 }}>{n.text}</div>
                <div className="t-meta">{timeAgo(n.at)}{n.ticketId ? ' · abrir chamado →' : ''}</div>
              </div>
              {!n.read && <span className="notif-dot" title="Não lida" />}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
