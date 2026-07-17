import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { registerUser, groupForCode, cityList } from '../lib/domain';
import { forceReseed } from '../lib/seed';
import { getTheme, toggleTheme } from '../lib/theme';

export default function Auth() {
  const [tab, setTab] = useState('login');
  const [theme, setThemeState] = useState(getTheme());
  return (
    <div className="auth-wrap" style={{ position: 'relative' }}>
      <button className="theme-btn" style={{ position: 'absolute', top: 18, right: 18 }}
        onClick={() => setThemeState(toggleTheme())}
        title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}>
        {theme === 'dark' ? '☀︎' : '☾'}
      </button>
      <div className="auth-card">
        <div className="card card-pad">
          <div style={{ textAlign: 'center', marginBottom: 14, fontSize: 24, fontWeight: 300, letterSpacing: '0.05em' }}>
            Help<b style={{ fontWeight: 650, color: 'var(--primary)' }}>Desk</b>{' '}
            <span className="muted small" style={{ fontWeight: 300 }}>alpha</span>
          </div>
          <div className="auth-tabs">
            <button className={tab === 'login' ? 'btn-primary' : ''} onClick={() => setTab('login')}>Entrar</button>
            <button className={tab === 'register' ? 'btn-primary' : ''} onClick={() => setTab('register')}>Criar conta</button>
          </div>
          {tab === 'login' ? <LoginForm /> : <RegisterForm />}
        </div>
        <p className="muted small" style={{ textAlign: 'center', marginTop: 14, color: 'var(--muted)' }}>
          Contas demo: <b>ana</b> (suporte), <b>bruno</b> (dev), <b>davi</b> (solicitante) — senha <b>123</b>
          <br />
          <button className="btn-sm btn-ghost" style={{ color: 'var(--primary)', marginTop: 6 }} onClick={() => { forceReseed(); location.reload(); }}>
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

// v0.0.5 — cadastro ÚNICO: sem escolher papel. O código de acesso (opcional)
// define como a pessoa entra no grupo; o suporte ajusta papéis depois.
function RegisterForm() {
  const { loginUser } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', login: '', email: '', password: '', cidade: '', code: '' });
  const [error, setError] = useState('');

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  // detecta em tempo real o grupo do código digitado
  const match = groupForCode(form.code);
  const groupCities = match ? cityList(match.group.id) : [];

  const submit = (e) => {
    e.preventDefault();
    setError('');
    try {
      // registro ATÔMICO: valida o código antes de criar o usuário — nada é gravado se falhar
      const user = registerUser(form, form.code);
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
        <label>Nome</label>
        <input value={form.name} onChange={set('name')} required />
      </div>
      <div className="row" style={{ gap: 10 }}>
        <div className="field" style={{ flex: 1 }}>
          <label>Login</label>
          <input value={form.login} onChange={set('login')} required />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>Senha</label>
          <input type="password" value={form.password} onChange={set('password')} required />
        </div>
      </div>
      <div className="field">
        <label>E-mail</label>
        <input type="email" value={form.email} onChange={set('email')} />
      </div>

      <div className="field">
        <label>Código de acesso (opcional)</label>
        <input value={form.code} onChange={set('code')} placeholder="Ex.: A1B2C3" />
        {match ? (
          <div className="hint">
            ✓ Código do grupo <b>{match.group.name}</b> — você entra como <b>solicitante</b>;
            a equipe pode promover seu acesso depois.
          </div>
        ) : (
          <div className="hint">Com código você já entra num grupo. Sem código, crie ou entre num grupo depois.</div>
        )}
      </div>

      {match && (
        <div className="field">
          <label>Cidade *</label>
          {groupCities.length ? (
            <select value={form.cidade} onChange={set('cidade')} required>
              <option value="">Selecione sua cidade</option>
              {groupCities.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          ) : (
            <input value={form.cidade} onChange={set('cidade')} required placeholder="Sua cidade" />
          )}
          <div className="hint">Solicitantes veem os chamados da própria cidade.</div>
        </div>
      )}

      <button className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
        {match ? `Cadastrar e entrar em ${match.group.name}` : 'Criar conta'}
      </button>
    </form>
  );
}
