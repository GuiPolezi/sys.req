import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { createGroup, joinGroupByCode, isTech, invitationsForUser } from '../lib/domain';
import { Avatar } from '../components/ui';

// Shell mínimo mostrado quando o usuário não tem grupo ativo (RP04).
function NoGroupShell({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const tech = isTech(user.role);
  const pending = tech ? invitationsForUser(user.id).length : 0;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">🛟 HelpDesk</div>
        <NavLink to="/" end className="nav-link">🏠 Grupos</NavLink>
        <NavLink to="/profile" className="nav-link">🙍 Meu perfil</NavLink>
        {tech && (
          <NavLink to="/invites" className="nav-link">
            ✉️ Convites{pending > 0 && <span className="nav-badge">{pending}</span>}
          </NavLink>
        )}
        <div className="spacer" />
        <div className="row" style={{ gap: 8, padding: 10 }}>
          <Avatar name={user.name} size="sm" />
          <span className="small" style={{ color: '#cbd5e1' }}>{user.name}</span>
        </div>
        <button className="btn-sm" onClick={() => { logout(); navigate('/login'); }}>Sair</button>
      </aside>
      <div className="main"><div className="content">{children}</div></div>
    </div>
  );
}

export default function GroupGate({ children }) {
  const { user, selectGroup, refresh } = useAuth();
  const [mode, setMode] = useState('create');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

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
      const g = joinGroupByCode(user, code);
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
                  <label>Código de convite da equipe</label>
                  <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Ex.: A1B2C3" autoFocus required />
                  <div className="hint">Peça ao suporte do grupo o código de convite de técnicos.</div>
                </div>
                <button className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>Entrar no grupo</button>
              </form>
            ) : null}
          </div>
        </div>
      </div>
    </NoGroupShell>
  );
}
