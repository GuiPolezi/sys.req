import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { can, isTech, invitationsForUser } from '../lib/domain';
import { Avatar, RoleBadge } from './ui';

export default function Layout({ children }) {
  const { user, groups, activeGroup, selectGroup, logout, tick } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const role = user.role;
  const tech = isTech(role);
  void tick; // recomputa a contagem de convites a cada mutação
  const pendingInvites = invitationsForUser(user.id).length;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const close = () => setMenuOpen(false);

  return (
    <div className="app-shell">
      <div className={`sidebar-overlay ${menuOpen ? 'show' : ''}`} onClick={close} />
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`} onClick={close}>
        <div className="brand">🛟 HelpDesk</div>

        <NavLink to="/" end className="nav-link">📊 Painel</NavLink>
        <NavLink to="/tickets" className="nav-link">🎫 Chamados</NavLink>
        {(role === 'solicitante' || tech) && (
          <NavLink to="/tickets/new" className="nav-link">➕ Abrir chamado</NavLink>
        )}
        {tech && <NavLink to="/assigned" className="nav-link">📌 Atribuídos a mim</NavLink>}
        {tech && <NavLink to="/pool" className="nav-link">📥 Não atribuídos</NavLink>}

        {tech && (
          <>
            <div className="nav-section">Equipe</div>
            <NavLink to="/chat" className="nav-link">💬 Chat interno</NavLink>
            {can.viewMembers(role) && <NavLink to="/team" className="nav-link">👥 Membros</NavLink>}
            <NavLink to="/invites" className="nav-link">
              ✉️ Convites{pendingInvites > 0 && <span className="nav-badge">{pendingInvites}</span>}
            </NavLink>
            {can.registerAttendance(role) && <NavLink to="/attendances" className="nav-link">🗒️ Atendimentos</NavLink>}
          </>
        )}

        {role === 'suporte' && (
          <>
            <div className="nav-section">Administração</div>
            <NavLink to="/categories" className="nav-link">🗂️ Categorias</NavLink>
            <NavLink to="/systems" className="nav-link">🖥️ Sistemas</NavLink>
            <NavLink to="/services" className="nav-link">🧩 Serviços</NavLink>
            <NavLink to="/ranking" className="nav-link">🏆 Ranking</NavLink>
            <NavLink to="/audit" className="nav-link">📜 Auditoria</NavLink>
          </>
        )}
        {role === 'dev' && (
          <>
            <div className="nav-section">Administração</div>
            <NavLink to="/services" className="nav-link">🧩 Serviços</NavLink>
          </>
        )}

        <div className="spacer" />
        <NavLink to="/groups" className="nav-link">🗃️ Meus grupos</NavLink>
        <NavLink to="/profile" className="nav-link">🙍 Meu perfil</NavLink>
        <div className="row" style={{ padding: '6px 11px', color: 'var(--muted)', fontSize: 11 }}>
          Versão alpha · dados locais
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button className="menu-btn btn-sm" onClick={() => setMenuOpen((v) => !v)} aria-label="Menu">☰</button>
          {groups.length > 1 ? (
            <select
              style={{ width: 'auto' }}
              value={activeGroup.id}
              onChange={(e) => selectGroup(e.target.value)}
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          ) : (
            <span className="title">{activeGroup.name}</span>
          )}
          <div className="spacer" />
          <RoleBadge role={user.role} />
          <div className="row" style={{ gap: 8 }}>
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
