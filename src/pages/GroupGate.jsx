import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { createGroup, joinGroupByCode } from '../lib/domain';

export default function GroupGate() {
  const { user, selectGroup, logout, refresh } = useAuth();
  const [mode, setMode] = useState('create');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const doCreate = (e) => {
    e.preventDefault();
    setError('');
    try {
      const g = createGroup(name, user);
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
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="card card-pad">
          <h2 style={{ textAlign: 'center' }}>Olá, {user.name} 👋</h2>
          <p className="muted" style={{ textAlign: 'center', marginTop: -6, marginBottom: 18 }}>
            Você ainda não faz parte de um grupo de trabalho.
          </p>

          <div className="auth-tabs">
            <button className={mode === 'create' ? 'btn-primary' : ''} onClick={() => setMode('create')}>Criar grupo</button>
            <button className={mode === 'join' ? 'btn-primary' : ''} onClick={() => setMode('join')}>Entrar com código</button>
          </div>

          {error && <div className="alert alert-error">{error}</div>}

          {mode === 'create' ? (
            <form onSubmit={doCreate}>
              <div className="field">
                <label>Nome do grupo</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Equipe TI — Cartório" autoFocus required />
              </div>
              <button className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>Criar grupo</button>
            </form>
          ) : (
            <form onSubmit={doJoin}>
              <div className="field">
                <label>Código de convite da equipe</label>
                <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Ex.: A1B2C3" autoFocus required />
                <div className="hint">Peça ao suporte do grupo o código de convite de técnicos.</div>
              </div>
              <button className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>Entrar no grupo</button>
            </form>
          )}

          <div className="divider" />
          <button className="btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'center' }} onClick={logout}>Sair</button>
        </div>
      </div>
    </div>
  );
}
