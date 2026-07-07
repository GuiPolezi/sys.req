import { STATUS, URGENCY, ROLES } from '../lib/domain';

export function Avatar({ name, size }) {
  const initials = (name || '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return <div className={`avatar ${size === 'sm' ? 'avatar-sm' : ''}`}>{initials}</div>;
}

export function Badge({ color, children }) {
  return (
    <span className="badge" style={{ background: `${color}18`, color }}>
      <span className="dot" style={{ background: color }} />
      {children}
    </span>
  );
}

export function StatusBadge({ status }) {
  const s = STATUS[status] || STATUS.aberto;
  return <Badge color={s.color}>{s.label}</Badge>;
}

export function UrgencyBadge({ urgency }) {
  const u = URGENCY[urgency] || URGENCY.media;
  return <Badge color={u.color}>{u.label}</Badge>;
}

export function RoleBadge({ role }) {
  const r = ROLES[role] || ROLES.solicitante;
  return <Badge color={r.color}>{r.label}</Badge>;
}

export function Modal({ title, onClose, children, footer }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span>{title}</span>
          <button className="btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Empty({ children }) {
  return <div className="empty">{children}</div>;
}

export function timeAgo(iso) {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'agora';
  if (diff < 3600) return `${Math.floor(diff / 60)} min atrás`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h atrás`;
  return d.toLocaleDateString('pt-BR');
}

export function fmtDateTime(iso) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}
