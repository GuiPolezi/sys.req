import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Avatar, RoleBadge } from './ui';

export default function Layout({ children }) {
  const { user, groups, activeGroup, selectGroup, logout } = useAuth();
  const navigate = useNavigate();
  const isSuporte = user.role === 'suporte';
  const isTech = user.role === 'suporte' || user.role === 'dev';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">🛟 HelpDesk</div>

        <NavLink to="/" end className="nav-link">📊 Painel</NavLink>
        <NavLink to="/tickets" className="nav-link">🎫 Chamados</NavLink>
        {user.role === 'solicitante' && (
          <NavLink to="/tickets/new" className="nav-link">➕ Abrir chamado</NavLink>
        )}

        {isTech && (
          <>
            <div className="nav-section">Equipe</div>
            <NavLink to="/chat" className="nav-link">💬 Chat interno</NavLink>
          </>
        )}

        {isSuporte && (
          <>
            <div className="nav-section">Administração</div>
            <NavLink to="/categories" className="nav-link">🗂️ Categorias</NavLink>
            <NavLink to="/automations" className="nav-link">⚙️ Automações</NavLink>
            <NavLink to="/team" className="nav-link">👥 Membros & convites</NavLink>
          </>
        )}

        <div className="spacer" />
        <div className="row" style={{ padding: '10px', color: '#94a3b8', fontSize: 12 }}>
          Versão alpha · dados locais
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
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
