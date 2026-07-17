import { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  can, isTech, invitationsForUser, unreadNotifications,
  internalUnreadTotal, unassignedTickets,
} from '../lib/domain';
import { getTheme, toggleTheme } from '../lib/theme';
import { Avatar, RoleBadge } from './ui';

export default function Layout({ children }) {
  const { user, groups, activeGroup, selectGroup, logout, tick } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [openMenu, setOpenMenu] = useState(null);   // chave do dropdown aberto
  const [mobileOpen, setMobileOpen] = useState(false);
  const [theme, setThemeState] = useState(getTheme());

  const role = user.role;
  const tech = isTech(role);
  void tick; // recomputa os contadores a cada mutação
  const pendingInvites = invitationsForUser(user.id).length;
  const unread = unreadNotifications(activeGroup.id, user.id);
  const chatUnread = internalUnreadTotal(activeGroup, user); // canais + conversas individuais
  const poolCount = tech ? unassignedTickets(activeGroup.id).length : 0;

  // ----- menus (sem ícones — minimalismo) -----
  const menus = [
    { key: 'painel', label: 'Painel', to: '/', end: true },
    {
      key: 'chamados',
      label: 'Chamados',
      badge: 0,
      items: [
        { to: '/tickets', label: 'Todos os chamados' },
        { to: '/tickets/new', label: 'Abrir chamado' },
        tech && { to: '/assigned', label: 'Atribuídos a mim' },
        tech && { to: '/pool', label: 'Não atribuídos', badge: poolCount, soft: true },
      ].filter(Boolean),
    },
    tech ? {
      key: 'equipe',
      label: 'Equipe',
      badge: chatUnread + pendingInvites,
      items: [
        { to: '/chat', label: 'Mensagens', badge: chatUnread },
        can.viewMembers(role) && { to: '/team', label: 'Equipe' },
        { to: '/invites', label: 'Convites', badge: pendingInvites },
        can.registerAttendance(role) && { to: '/attendances', label: 'Atendimentos' },
      ].filter(Boolean),
    } : {
      key: 'equipe',
      label: 'Mensagens',
      to: '/chat',
      badge: chatUnread,
    },
    (role === 'suporte' || role === 'dev') && {
      key: 'admin',
      label: 'Administração',
      badge: 0,
      items: role === 'suporte' ? [
        { to: '/categories', label: 'Categorias' },
        { to: '/systems', label: 'Sistemas' },
        { to: '/services', label: 'Serviços' },
        { to: '/cities', label: 'Cidades' },
        { to: '/workflows', label: 'Fluxos de trabalho' },
        { to: '/slas', label: 'SLA' },
        { sep: true },
        { to: '/ranking', label: 'Ranking' },
        { to: '/audit', label: 'Auditoria' },
      ] : [
        { to: '/services', label: 'Serviços' },
      ],
    },
  ].filter(Boolean);

  const accountItems = [
    { to: '/profile', label: 'Meu perfil' },
    { to: '/groups', label: 'Meus grupos' },
    { sep: true },
    { action: 'logout', label: 'Sair' },
  ];

  const closeAll = () => { setOpenMenu(null); setMobileOpen(false); };
  const handleLogout = () => { closeAll(); logout(); navigate('/login'); };
  const flipTheme = () => setThemeState(toggleTheme());

  const isCurrentSection = (menu) =>
    menu.items?.some((it) => it.to && (it.to === '/' ? location.pathname === '/' : location.pathname.startsWith(it.to)));

  const DropItem = ({ item }) => {
    if (item.sep) return <div className="dd-sep" />;
    if (item.action === 'logout') {
      return <button className="dd-item" onClick={handleLogout}>Sair</button>;
    }
    return (
      <NavLink to={item.to} end={item.end} className="dd-item" onClick={closeAll}>
        {item.label}
        <span className="spacer" />
        {item.badge > 0 && <span className={`nav-badge ${item.soft ? 'soft' : ''}`}>{item.badge}</span>}
      </NavLink>
    );
  };

  return (
    <div className="app-shell">
      <header className="menubar">
        <span className="brand">Help<b>Desk</b></span>

        {/* navegação desktop */}
        {menus.map((m) => m.to ? (
          <div className="menu-wrap desktop" key={m.key}>
            <NavLink to={m.to} end={m.end} className="menu-trigger" onClick={closeAll}>
              {m.label}
              {m.badge > 0 && <span className="nav-badge" style={{ marginLeft: 6 }}>{m.badge}</span>}
            </NavLink>
          </div>
        ) : (
          <div className="menu-wrap desktop" key={m.key}>
            <button
              className={`menu-trigger ${openMenu === m.key ? 'open' : ''} ${isCurrentSection(m) ? 'current' : ''}`}
              onClick={() => setOpenMenu(openMenu === m.key ? null : m.key)}
            >
              {m.label} <span className="caret">▾</span>
              {m.badge > 0 && openMenu !== m.key && <span className="trigger-dot" />}
            </button>
            {openMenu === m.key && (
              <div className="dropdown">
                {m.items.map((it, i) => <DropItem key={it.to || `s${i}`} item={it} />)}
              </div>
            )}
          </div>
        ))}

        {/* notificações — acesso direto */}
        <div className="menu-wrap desktop">
          <NavLink to="/notifications" className="menu-trigger" onClick={closeAll}>
            Notificações
            {unread > 0 && <span className="nav-badge" style={{ marginLeft: 6 }}>{unread}</span>}
          </NavLink>
        </div>

        <div className="spacer" />

        {/* hambúrguer (mobile) */}
        <button className="menu-btn btn-sm" onClick={() => { setMobileOpen((v) => !v); setOpenMenu(null); }}>
          Menu{(unread + chatUnread + pendingInvites) > 0 && <span className="nav-badge">{unread + chatUnread + pendingInvites}</span>}
        </button>

        {groups.length > 1 ? (
          <select className="group-select" value={activeGroup.id} onChange={(e) => selectGroup(e.target.value)}>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        ) : (
          <span className="muted small" style={{ whiteSpace: 'nowrap', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {activeGroup.name}
          </span>
        )}

        <button className="theme-btn" onClick={flipTheme} title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}>
          {theme === 'dark' ? '☀︎' : '☾'}
        </button>

        {/* conta */}
        <div className="menu-wrap">
          <button className="user-chip" onClick={() => setOpenMenu(openMenu === 'conta' ? null : 'conta')}>
            <Avatar name={user.name} size="sm" />
            <span className="u-name">{user.name}</span>
            <span className="caret">▾</span>
          </button>
          {openMenu === 'conta' && (
            <div className="dropdown right">
              <div style={{ padding: '8px 12px 4px' }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{user.name}</div>
                <div className="muted small">{user.email || user.login}</div>
                <div style={{ marginTop: 6 }}><RoleBadge role={user.role} /></div>
              </div>
              <div className="dd-sep" />
              {accountItems.map((it, i) => <DropItem key={it.to || it.action || i} item={it} />)}
            </div>
          )}
        </div>
      </header>

      {/* fecha dropdowns ao clicar fora */}
      {openMenu && <div className="menu-overlay" onClick={() => setOpenMenu(null)} />}

      {/* menu mobile — folha de vidro */}
      {mobileOpen && (
        <>
          <div className="menu-overlay" onClick={closeAll} />
          <div className="mobile-sheet">
            <NavLink to="/" end className="dd-item" onClick={closeAll}>Painel</NavLink>
            <NavLink to="/notifications" className="dd-item" onClick={closeAll}>
              Notificações<span className="spacer" />{unread > 0 && <span className="nav-badge">{unread}</span>}
            </NavLink>
            {menus.filter((m) => m.to && m.key !== 'painel').map((m) => (
              <NavLink key={m.key} to={m.to} className="dd-item" onClick={closeAll}>
                {m.label}<span className="spacer" />{m.badge > 0 && <span className="nav-badge">{m.badge}</span>}
              </NavLink>
            ))}
            {menus.filter((m) => m.items).map((m) => (
              <div key={m.key}>
                <div className="msheet-title">{m.label}</div>
                {m.items.map((it, i) => <DropItem key={it.to || `s${i}`} item={it} />)}
              </div>
            ))}
            <div className="msheet-title">Conta</div>
            {accountItems.map((it, i) => <DropItem key={it.to || it.action || i} item={it} />)}
          </div>
        </>
      )}

      <div className="content">{children}</div>
    </div>
  );
}
