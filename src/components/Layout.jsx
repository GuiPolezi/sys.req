import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  can, isTech, invitationsForUser, unreadNotifications,
  internalUnreadTotal, unassignedTickets,
} from '../lib/domain';
import { Avatar, RoleBadge } from './ui';

const RAIL_KEY = 'helpdesk_sidebar_rail';

export default function Layout({ children }) {
  const { user, groups, activeGroup, selectGroup, logout, tick } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [rail, setRail] = useState(() => localStorage.getItem(RAIL_KEY) === '1');

  useEffect(() => { localStorage.setItem(RAIL_KEY, rail ? '1' : '0'); }, [rail]);

  const role = user.role;
  const tech = isTech(role);
  void tick; // recomputa os contadores a cada mutação
  const pendingInvites = invitationsForUser(user.id).length;
  const unread = unreadNotifications(activeGroup.id, user.id);
  const chatUnread = tech ? internalUnreadTotal(activeGroup, user.id) : 0;
  const poolCount = tech ? unassignedTickets(activeGroup.id).length : 0;

  // ----- itens de navegação, agrupados por seção -----
  const sections = [
    {
      items: [
        { to: '/', end: true, icon: '📊', label: 'Painel' },
        { to: '/tickets', icon: '🎫', label: 'Chamados' },
        { to: '/tickets/new', icon: '➕', label: 'Abrir chamado' },
        { to: '/notifications', icon: '🔔', label: 'Notificações', badge: unread },
        tech && { to: '/assigned', icon: '📌', label: 'Atribuídos a mim' },
        tech && { to: '/pool', icon: '📥', label: 'Não atribuídos', badge: poolCount, soft: true },
      ],
    },
    tech && {
      title: 'Equipe',
      items: [
        { to: '/chat', icon: '💬', label: 'Chat interno', badge: chatUnread },
        can.viewMembers(role) && { to: '/team', icon: '👥', label: 'Equipe' },
        { to: '/invites', icon: '✉️', label: 'Convites', badge: pendingInvites },
        can.registerAttendance(role) && { to: '/attendances', icon: '🗒️', label: 'Atendimentos' },
      ],
    },
    role === 'suporte' && {
      title: 'Administração',
      items: [
        { to: '/categories', icon: '🗂️', label: 'Categorias' },
        { to: '/systems', icon: '🖥️', label: 'Sistemas' },
        { to: '/services', icon: '🧩', label: 'Serviços' },
        { to: '/ranking', icon: '🏆', label: 'Ranking' },
        { to: '/audit', icon: '📜', label: 'Auditoria' },
      ],
    },
    role === 'dev' && {
      title: 'Administração',
      items: [{ to: '/services', icon: '🧩', label: 'Serviços' }],
    },
  ].filter(Boolean);

  const handleLogout = () => { logout(); navigate('/login'); };
  const close = () => setMenuOpen(false);

  const Item = ({ to, end, icon, label, badge, soft }) => (
    <NavLink to={to} end={end} className="nav-link" title={label} onClick={close}>
      <span className="nav-ico">{icon}</span>
      <span className="nav-txt">{label}</span>
      {badge > 0 && <span className={`nav-badge ${soft ? 'soft' : ''}`}>{badge}</span>}
    </NavLink>
  );

  return (
    <div className="app-shell">
      <div className={`sidebar-overlay ${menuOpen ? 'show' : ''}`} onClick={close} />

      <aside className={`sidebar ${menuOpen ? 'open' : ''} ${rail ? 'rail' : ''}`}>
        <div className="sidebar-head">
          <div className="brand">
            <span className="brand-ico">🛟</span>
            <span className="brand-txt">HelpDesk</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {sections.map((sec, i) => (
            <div key={i} className="nav-group">
              {sec.title && <div className="nav-section">{sec.title}</div>}
              {sec.items.filter(Boolean).map((it) => <Item key={it.to} {...it} />)}
            </div>
          ))}
        </nav>

        <div className="sidebar-foot">
          <Item to="/groups" icon="🗃️" label="Meus grupos" />
          <Item to="/profile" icon="🙍" label="Meu perfil" />
          <button className="collapse-btn" onClick={() => setRail((v) => !v)} title={rail ? 'Expandir menu' : 'Recolher menu'}>
            <span className="nav-ico">{rail ? '»' : '«'}</span>
            <span className="nav-txt">Recolher</span>
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button className="menu-btn btn-sm" onClick={() => setMenuOpen((v) => !v)} aria-label="Abrir menu">☰</button>

          {groups.length > 1 ? (
            <select className="group-select" value={activeGroup.id} onChange={(e) => selectGroup(e.target.value)}>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          ) : (
            <span className="title">{activeGroup.name}</span>
          )}

          <div className="spacer" />

          <span className="topbar-role"><RoleBadge role={user.role} /></span>
          <div className="row topbar-user" style={{ gap: 8 }}>
            <Avatar name={user.name} size="sm" />
            <div className="col">
              <span style={{ fontWeight: 600, fontSize: 13 }}>{user.name}</span>
              <span className="muted small">{user.email}</span>
            </div>
          </div>
          <button className="btn-sm" onClick={handleLogout}>Sair</button>
        </header>

        <div className="content">{children}</div>
      </div>
    </div>
  );
}
