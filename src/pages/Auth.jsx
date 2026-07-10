import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { createUser, joinGroupByCode } from '../lib/domain';
import { forceReseed } from '../lib/seed';

export default function Auth() {
  const [tab, setTab] = useState('login');
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="card card-pad">
          <div className="brand" style={{ color: 'var(--text)', fontSize: 22, justifyContent: 'center', marginBottom: 8 }}>
            🛟 HelpDesk <span className="muted small" style={{ fontWeight: 400 }}>alpha</span>
          </div>
          <div className="auth-tabs">
            <button className={tab === 'login' ? 'btn-primary' : ''} onClick={() => setTab('login')}>Entrar</button>
            <button className={tab === 'register' ? 'btn-primary' : ''} onClick={() => setTab('register')}>Criar conta</button>
          </div>
          {tab === 'login' ? <LoginForm /> : <RegisterForm />}
        </div>
        <p className="muted small" style={{ textAlign: 'center', marginTop: 14, color: '#94a3b8' }}>
          Contas demo: <b>ana</b> (suporte), <b>bruno</b> (dev), <b>davi</b> (solicitante) — senha <b>123</b>
          <br />
          <button className="btn-sm btn-ghost" style={{ color: '#cbd5e1', marginTop: 6 }} onClick={() => { forceReseed(); location.reload(); }}>
            ↺ Recarregar dados demo
          </button>
        </p>
      </div>
    </div>
  );
}

function LoginForm() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [loginStr, setLoginStr] = useState('ana');
  const [password, setPassword] = useState('123');
  const [error, setError] = useState('');

  const submit = (e) => {
    e.preventDefault();
    setError('');
    try {
      login(loginStr, password);
      navigate('/');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <form onSubmit={submit}>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="field">
        <label>Login ou e-mail</label>
        <input value={loginStr} onChange={(e) => setLoginStr(e.target.value)} autoFocus />
      </div>
      <div className="field">
        <label>Senha</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <button className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>Entrar</button>
    </form>
  );
}

function RegisterForm() {
  const { loginUser } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState('suporte');
  const [form, setForm] = useState({ name: '', login: '', email: '', password: '', cidade: '', code: '' });
  const [error, setError] = useState('');

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const isRequester = role === 'solicitante';

  const submit = (e) => {
    e.preventDefault();
    setError('');
    try {
      const user = createUser({ ...form, role });
      if (isRequester) {
        // solicitante precisa entrar num grupo pelo código
        if (!form.code.trim()) throw new Error('Informe o código de acesso fornecido pelo suporte.');
        joinGroupByCode(user, form.code);
      }
      loginUser(user);
      navigate('/');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <form onSubmit={submit}>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="field">
        <label>Tipo de conta</label>
        <div className="role-pick" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
          {[
            { k: 'suporte', label: 'Suporte', desc: 'Gerencia' },
            { k: 'dev', label: 'Dev', desc: 'Resolve' },
            { k: 'solicitante', label: 'Solicitante', desc: 'Abre chamado' },
          ].map((o) => (
            <div key={o.k} className={`role-opt ${role === o.k ? 'sel' : ''}`} onClick={() => setRole(o.k)}>
              <div className="r-name">{o.label}</div>
              <div className="muted small">{o.desc}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="field">
        <label>Nome</label>
        <input value={form.name} onChange={set('name')} required />
      </div>
      <div className="row" style={{ gap: 10 }}>
        <div className="field" style={{ flex: 1 }}>
          <label>Login</label>
          <input value={form.login} onChange={set('login')} required />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>Cidade{isRequester ? ' *' : ''}</label>
          <input value={form.cidade} onChange={set('cidade')} required={isRequester} placeholder={isRequester ? 'Obrigatória' : ''} />
        </div>
      </div>
      <div className="field">
        <label>E-mail</label>
        <input type="email" value={form.email} onChange={set('email')} />
      </div>
      <div className="field">
        <label>Senha</label>
        <input type="password" value={form.password} onChange={set('password')} required />
      </div>

      {isRequester && (
        <div className="field">
          <label>Código de acesso do grupo</label>
          <input value={form.code} onChange={set('code')} placeholder="Ex.: A1B2C3" />
          <div className="hint">Fornecido pelo suporte da equipe que você vai atender.</div>
        </div>
      )}

      <button className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
        {isRequester ? 'Cadastrar e entrar no grupo' : 'Criar conta'}
      </button>
      {!isRequester && (
        <div className="hint" style={{ textAlign: 'center', marginTop: 8 }}>
          No próximo passo você cria um grupo ou entra em um com código.
        </div>
      )}
    </form>
  );
}
