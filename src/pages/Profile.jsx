import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  ROLES, updateUser, membership, categoriesForGroup, updateMemberCategories,
  devStats, supportStats, requesterStats, can,
} from '../lib/domain';
import { Avatar, RoleBadge } from '../components/ui';

export default function Profile() {
  const { user, activeGroup, refresh } = useAuth();
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState({ name: user.name, email: user.email, cidade: user.cidade });
  const [msg, setMsg] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = () => {
    updateUser(user.id, { name: form.name.trim(), email: form.email.trim(), cidade: form.cidade.trim() });
    setEdit(false); setMsg('Perfil atualizado.'); refresh();
  };

  return (
    <div style={{ maxWidth: 720 }}>
      <div className="page-head">
        <h1>Meu perfil</h1>
        <p className="muted">Seus dados e, dentro de um grupo, suas estatísticas.</p>
      </div>

      {msg && <div className="alert alert-info">{msg}</div>}

      <div className="card card-pad mb">
        <div className="row" style={{ gap: 14 }}>
          <Avatar name={user.name} />
          <div style={{ flex: 1 }}>
            <div className="row" style={{ gap: 8 }}>
              <b style={{ fontSize: 16 }}>{user.name}</b>
              <RoleBadge role={user.role} />
            </div>
            <div className="muted small">@{user.login}</div>
          </div>
          {!edit && <button className="btn-sm" onClick={() => setEdit(true)}>✏️ Editar</button>}
        </div>

        <div className="divider" />

        {edit ? (
          <>
            <div className="field"><label>Nome</label><input value={form.name} onChange={set('name')} /></div>
            <div className="field"><label>E-mail</label><input value={form.email} onChange={set('email')} /></div>
            {user.role === 'solicitante' && (
              <div className="field">
                <label>Cidade</label>
                <input value={form.cidade} readOnly />
                <div className="hint">A cidade do solicitante não pode ser alterada.</div>
              </div>
            )}
            <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => { setEdit(false); setForm({ name: user.name, email: user.email, cidade: user.cidade }); }}>Cancelar</button>
              <button className="btn-primary" onClick={save}>Salvar</button>
            </div>
          </>
        ) : (
          <div className="grid grid-2">
            <div><div className="muted small">E-mail</div><div>{user.email || '—'}</div></div>
            {user.role === 'solicitante' && (
              <div><div className="muted small">Cidade</div><div>{user.cidade || '—'}</div></div>
            )}
            <div><div className="muted small">Papel</div><div>{ROLES[user.role].label}</div></div>
            <div><div className="muted small">Membro desde</div><div>{new Date(user.createdAt).toLocaleDateString('pt-BR')}</div></div>
          </div>
        )}
      </div>

      {activeGroup && user.role === 'dev' && <DevPanel user={user} group={activeGroup} refresh={refresh} />}
      {activeGroup && user.role === 'suporte' && <SupportPanel user={user} group={activeGroup} />}
      {activeGroup && user.role === 'solicitante' && <RequesterPanel user={user} group={activeGroup} />}
    </div>
  );
}

// Solicitante — total de solicitações e concluídas
function RequesterPanel({ user, group }) {
  const stats = requesterStats(group.id, user.id);
  const pct = stats.total ? Math.round((stats.concluido / stats.total) * 100) : 0;
  return (
    <div className="card card-pad mb">
      <h3>📋 Minhas solicitações — {group.name}</h3>
      <div className="stats mb" style={{ marginTop: 10 }}>
        <div className="stat"><div className="n">{stats.total}</div><div className="l">Total abertas</div></div>
        <div className="stat"><div className="n" style={{ color: '#4F8A5B' }}>{stats.concluido}</div><div className="l">Concluídas</div></div>
        <div className="stat"><div className="n" style={{ color: '#C08A3E' }}>{stats.emAndamento}</div><div className="l">Em andamento</div></div>
      </div>
      <div className="muted small">Taxa de conclusão: {pct}%</div>
      <div className="progress"><div className="progress-fill" style={{ width: `${pct}%`, background: '#4F8A5B' }} /></div>
    </div>
  );
}

// RCS10 — gamificação + RP15 (dev escolhe categoria)
function DevPanel({ user, group, refresh }) {
  const stats = devStats(group.id, user.id);
  const mem = membership(group, user.id);
  const cats = categoriesForGroup(group.id);
  const mine = mem?.categoryIds || [];
  const pct = Math.min(100, Math.round((stats.xp / stats.nextLevelXp) * 100));

  const toggle = (catId) => {
    const next = mine.includes(catId) ? mine.filter((c) => c !== catId) : [...mine, catId];
    updateMemberCategories(group.id, user.id, next, user);
    refresh();
  };

  return (
    <div className="card card-pad mb">
      <h3>🎮 Progresso no grupo — {group.name}</h3>
      <div className="stats mb" style={{ marginTop: 10 }}>
        <div className="stat"><div className="n" style={{ color: '#6A62A8' }}>Nível {stats.level}</div><div className="l">{stats.xp} XP</div></div>
        <div className="stat"><div className="n" style={{ color: '#4F8A5B' }}>{stats.finished}</div><div className="l">Finalizados</div></div>
        <div className="stat"><div className="n" style={{ color: '#C08A3E' }}>{stats.active}</div><div className="l">Ativos</div></div>
        <div className="stat"><div className="n">{stats.assigned}</div><div className="l">Total atribuídos</div></div>
      </div>
      <div className="muted small">Progresso p/ o nível {stats.level + 1}</div>
      <div className="progress"><div className="progress-fill" style={{ width: `${pct}%` }} /></div>

      {can.chooseOwnCategory(user.role) && (
        <>
          <div className="divider" />
          <h3>Minhas categorias de atuação</h3>
          <p className="muted small">Escolha as categorias que você atende (o suporte também pode ajustar). RP15</p>
          <div className="row wrap" style={{ gap: 6 }}>
            {cats.length === 0 && <span className="muted small">O suporte ainda não criou categorias.</span>}
            {cats.map((c) => {
              const on = mine.includes(c.id);
              return (
                <button key={c.id} className={on ? 'btn-primary btn-sm' : 'btn-sm'} onClick={() => toggle(c.id)}>
                  {on ? '✓ ' : ''}{c.name}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// RCS11 — atendimentos por dia e total
function SupportPanel({ user, group }) {
  const stats = supportStats(group.id, user.id);
  return (
    <div className="card card-pad mb">
      <h3>📈 Atendimentos — {group.name}</h3>
      <div className="stats mb" style={{ marginTop: 10 }}>
        <div className="stat"><div className="n">{stats.total}</div><div className="l">Total</div></div>
        <div className="stat"><div className="n" style={{ color: 'var(--primary)' }}>{stats.today}</div><div className="l">Hoje</div></div>
        <div className="stat"><div className="n">{stats.days.length}</div><div className="l">Dias com atendimento</div></div>
      </div>
      <h3>Por dia</h3>
      {stats.days.length === 0 ? (
        <p className="muted small">Nenhum atendimento registrado ainda.</p>
      ) : (
        <div className="col" style={{ gap: 6 }}>
          {stats.days.slice(0, 14).map((d) => (
            <div key={d.day} className="row" style={{ gap: 10 }}>
              <span className="small" style={{ width: 90 }}>{new Date(d.day).toLocaleDateString('pt-BR')}</span>
              <div className="progress" style={{ flex: 1 }}>
                <div className="progress-fill" style={{ width: `${Math.min(100, d.count * 20)}%`, background: 'var(--primary)' }} />
              </div>
              <b className="small">{d.count}</b>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
