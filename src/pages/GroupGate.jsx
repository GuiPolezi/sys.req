import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { createGroup, joinGroupByCode, isTech, invitationsForUser, groupForCode, cityList } from '../lib/domain';
import { getTheme, toggleTheme } from '../lib/theme';
import { Avatar } from '../components/ui';

// Shell mínimo mostrado quando o usuário não tem grupo ativo (RP04).
function NoGroupShell({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [theme, setThemeState] = useState(getTheme());
  const tech = isTech(user.role);
  const pending = tech ? invitationsForUser(user.id).length : 0;
  return (
    <div className="app-shell">
      <header className="menubar">
        <span className="brand">Help<b>Desk</b></span>
        <div className="menu-wrap">
          <NavLink to="/" end className="menu-trigger">Grupos</NavLink>
        </div>
        <div className="menu-wrap">
          <NavLink to="/profile" className="menu-trigger">Meu perfil</NavLink>
        </div>
        {tech && (
          <div className="menu-wrap">
            <NavLink to="/invites" className="menu-trigger">
              Convites{pending > 0 && <span className="nav-badge" style={{ marginLeft: 6 }}>{pending}</span>}
            </NavLink>
          </div>
        )}
        <div className="spacer" />
        <button className="theme-btn" onClick={() => setThemeState(toggleTheme())}
          title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}>
          {theme === 'dark' ? '☀︎' : '☾'}
        </button>
        <div className="row" style={{ gap: 8 }}>
          <Avatar name={user.name} size="sm" />
          <span className="small" style={{ color: 'var(--text-soft)' }}>{user.name}</span>
        </div>
        <button className="btn-sm" onClick={() => { logout(); navigate('/login'); }}>Sair</button>
      </header>
      <div className="content">{children}</div>
    </div>
  );
}

export default function GroupGate({ children }) {
  const { user, selectGroup, refresh } = useAuth();
  const [mode, setMode] = useState('create');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [code, setCode] = useState('');
  const [cidade, setCidade] = useState(user?.cidade || '');
  const [error, setError] = useState('');

  const match = groupForCode(code);
  const joinCities = match ? cityList(match.group.id) : [];

  // páginas acessíveis sem grupo (perfil, convites)
  if (children) return <NoGroupShell>{children}</NoGroupShell>;

  const canCreate = isTech(user.role); // RP01/RP04 — solicitante só entra por código

  const doCreate = (e) => {
    e.preventDefault();
    setError('');
    try {
      const g = createGroup({ name, description }, user);
      refresh();
      selectGroup(g.id);
    } catch (err) { setError(err.message); }
  };

  const doJoin = (e) => {
    e.preventDefault();
    setError('');
    try {
      const g = joinGroupByCode(user, code, cidade);
      refresh();
      selectGroup(g.id);
    } catch (err) { setError(err.message); }
  };

  return (
    <NoGroupShell>
      <div className="auth-wrap" style={{ minHeight: 'calc(100vh - 44px)', background: 'transparent', padding: 0 }}>
        <div className="auth-card">
          <div className="card card-pad">
            <h2 style={{ textAlign: 'center' }}>Olá, {user.name} 👋</h2>
            <p className="muted" style={{ textAlign: 'center', marginTop: -6, marginBottom: 18 }}>
              Você ainda não faz parte de um grupo de trabalho.
            </p>

            {canCreate ? (
              <div className="auth-tabs">
                <button className={mode === 'create' ? 'btn-primary' : ''} onClick={() => setMode('create')}>Criar grupo</button>
                <button className={mode === 'join' ? 'btn-primary' : ''} onClick={() => setMode('join')}>Entrar com código</button>
              </div>
            ) : (
              <div className="alert alert-info">
                Solicitantes entram automaticamente pelo código no cadastro. Se ainda não tem grupo,
                peça um novo código ao suporte e recadastre-se, ou fale com o suporte para receber um convite.
              </div>
            )}

            {error && <div className="alert alert-error">{error}</div>}

            {canCreate && mode === 'create' ? (
              <form onSubmit={doCreate}>
                <div className="field">
                  <label>Nome do grupo</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Equipe TI — Cartório" autoFocus required />
                </div>
                <div className="field">
                  <label>Descrição</label>
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Para que serve este grupo?" />
                </div>
                <button className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>Criar grupo</button>
              </form>
            ) : canCreate ? (
              <form onSubmit={doJoin}>
                <div className="field">
                  <label>Código de acesso do grupo</label>
                  <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Ex.: A1B2C3" autoFocus required />
                  {match ? (
                    <div className="hint">✓ Grupo <b>{match.group.name}</b> — você entra como solicitante; a equipe pode promover depois.</div>
                  ) : (
                    <div className="hint">Peça o código de acesso à equipe do grupo.</div>
                  )}
                </div>
                {match && (
                  <div className="field">
                    <label>Sua cidade *</label>
                    {joinCities.length ? (
                      <select value={cidade} onChange={(e) => setCidade(e.target.value)} required>
                        <option value="">Selecione sua cidade</option>
                        {joinCities.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                      </select>
                    ) : (
                      <input value={cidade} onChange={(e) => setCidade(e.target.value)} required placeholder="Sua cidade" />
                    )}
                  </div>
                )}
                <button className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>Entrar no grupo</button>
              </form>
            ) : null}
          </div>
        </div>
      </div>
    </NoGroupShell>
  );
}
