import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { invitationsForUser, respondInvitation } from '../lib/domain';
import { Empty } from '../components/ui';

// RP06 — dev/técnico aceita ou recusa convites de grupos
export default function Invites() {
  const { user, refresh, selectGroup } = useAuth();
  const [, setLocal] = useState(0);
  const bump = () => { refresh(); setLocal((n) => n + 1); };
  const invites = invitationsForUser(user.id);

  const respond = (inv, accept) => {
    respondInvitation(inv.id, accept);
    bump();
    if (accept) selectGroup(inv.groupId);
  };

  return (
    <div style={{ maxWidth: 640 }}>
      <div className="page-head">
        <h1>Convites</h1>
        <p className="muted">Convites de grupos aguardando sua resposta.</p>
      </div>

      <div className="card">
        {invites.length === 0 ? (
          <Empty>Nenhum convite pendente.</Empty>
        ) : (
          invites.map((inv) => (
            <div key={inv.id} className="ticket-row" style={{ cursor: 'default' }}>
              <div style={{ flex: 1 }}>
                <div className="t-title">{inv.group.name}</div>
                <div className="t-meta">{inv.group.description || 'Sem descrição'}</div>
              </div>
              <button className="btn-primary btn-sm" onClick={() => respond(inv, true)}>Aceitar</button>
              <button className="btn-sm btn-danger" onClick={() => respond(inv, false)}>Recusar</button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
