import { useAuth } from '../context/AuthContext';
import { db } from '../lib/store';
import { auditForGroup } from '../lib/domain';
import { Avatar, Empty, fmtDateTime } from '../components/ui';

// RP16 — log de auditoria de cada movimentação do grupo
const ICONS = {
  'grupo.criado': '🏗️', 'grupo.editado': '✏️', 'grupo.codigo': '🔑',
  'membro.entrou': '➡️', 'membro.saiu': '⬅️',
  'convite.enviado': '✉️', 'convite.aceito': '✅', 'convite.recusado': '🚫',
  'categoria.criada': '🗂️', 'categoria.removida': '🗑️', 'categoria.atribuida': '🏷️',
  'servico.criado': '🧩', 'servico.removido': '🗑️',
  'ticket.criado': '🎫', 'ticket.atribuido': '👤', 'ticket.status': '🔄',
  'ticket.urgencia': '⚡', 'ticket.alerta': '🚨', 'ticket.analise': '🔎',
  'ticket.aprovado': '👍', 'ticket.rejeitado': '👎',
  'atendimento.registrado': '🗒️',
};

export default function Audit() {
  const { activeGroup } = useAuth();
  const log = auditForGroup(activeGroup.id);

  return (
    <div style={{ maxWidth: 760 }}>
      <div className="page-head">
        <h1>📜 Log de auditoria</h1>
        <p className="muted">Toda movimentação registrada no grupo — {log.length} evento(s).</p>
      </div>

      <div className="card">
        {log.length === 0 ? (
          <Empty>Nenhum evento registrado.</Empty>
        ) : (
          log.map((l) => {
            const u = l.userId ? db.byId('users', l.userId) : null;
            return (
              <div key={l.id} className="ticket-row" style={{ cursor: 'default' }}>
                <span style={{ fontSize: 18 }}>{ICONS[l.action] || '•'}</span>
                <div style={{ flex: 1 }}>
                  <div className="t-title" style={{ fontWeight: 500 }}>{l.detail || l.action}</div>
                  <div className="t-meta">
                    <code className="small">{l.action}</code> · {u?.name || 'sistema'} · {fmtDateTime(l.at)}
                  </div>
                </div>
                {u && <Avatar name={u.name} size="sm" />}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
