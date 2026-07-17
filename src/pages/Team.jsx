import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  groupMembers, categoriesForGroup, updateMemberCategories, regenerateCode,
  createInvitation, invitationsForGroup, updateGroup, leaveGroup, deleteGroup,
  setMemberRole, setMemberManager, adminUpdateUser, removeMember,
  groupPermissions, updateGroupPermissions, cityList, requesterStats, devStats,
  groupAccessCode, isOnline, lastSeen, teamLoad, attendancesByTech, isTech,
} from '../lib/domain';
import { ColumnChart } from '../components/Charts';
import { timeAgo } from '../components/ui';
import { downloadCSV } from '../lib/report';
import { RoleBadge, Avatar, Modal, ConfirmModal, Empty } from '../components/ui';

export default function Team() {
  const { user, activeGroup, refresh, selectGroup, groups } = useAuth();
  const navigate = useNavigate();
  const [, setLocal] = useState(0);
  const [tab, setTab] = useState('visao');
  const [q, setQ] = useState('');
  const bump = () => { refresh(); setLocal((n) => n + 1); };

  const isSuporte = user.role === 'suporte';
  const canManageMembers = isTech(user.role); // v0.0.6: técnicos (sup e dev) definem papéis
  const members = groupMembers(activeGroup);
  const categories = categoriesForGroup(activeGroup.id);
  const tecnicos = members.filter((m) => m.role !== 'solicitante');
  const solicitantes = members.filter((m) => m.role === 'solicitante');
  const [openMember, setOpenMember] = useState(null); // membro com perfil aberto

  const exportTecnicos = () => downloadCSV('tecnicos', tecnicos.map((m) => ({
    Nome: m.user.name, Login: m.user.login, 'E-mail': m.user.email,
    Papel: m.role, Gerente: m.isManager ? 'sim' : 'não',
    Categorias: (m.categoryIds || []).map((id) => categories.find((c) => c.id === id)?.name).filter(Boolean).join(', '),
  })));
  const exportSolicitantes = () => downloadCSV('solicitantes', solicitantes.map((m) => ({
    Nome: m.user.name, Login: m.user.login, 'E-mail': m.user.email, Cidade: m.user.cidade || '',
    'Chamados abertos': requesterStats(activeGroup.id, m.userId).total,
  })));

  const toggleCat = (userId, catId, current) => {
    const next = current.includes(catId) ? current.filter((c) => c !== catId) : [...current, catId];
    updateMemberCategories(activeGroup.id, userId, next, user);
    bump();
  };

  const afterExit = () => {
    const remaining = groups.filter((g) => g.id !== activeGroup.id);
    selectGroup(remaining[0]?.id || null);
    refresh();
    navigate('/');
  };

  return (
    <div>
      <div className="page-head">
        <h1>Equipe</h1>
        <p className="muted">{activeGroup.description || 'Integrantes e configurações do grupo.'}</p>
      </div>

      <div className="auth-tabs" style={{ maxWidth: 680 }}>
        <button className={tab === 'visao' ? 'btn-primary' : ''} onClick={() => setTab('visao')}>
          Visão geral
        </button>
        <button className={tab === 'tecnicos' ? 'btn-primary' : ''} onClick={() => setTab('tecnicos')}>
          Técnicos ({tecnicos.length})
        </button>
        <button className={tab === 'solicitantes' ? 'btn-primary' : ''} onClick={() => setTab('solicitantes')}>
          Solicitantes ({solicitantes.length})
        </button>
        <button className={tab === 'config' ? 'btn-primary' : ''} onClick={() => setTab('config')}>
          Configurações
        </button>
      </div>

      {tab === 'visao' && (
        <TeamOverview group={activeGroup} members={members} tecnicos={tecnicos}
          solicitantes={solicitantes} categories={categories} />
      )}

      {tab === 'tecnicos' && (
        <div>
          {isSuporte && (
            <div className="row between mb">
              <span className="muted small">Clique num membro para ver o perfil, editar ou configurar permissões.</span>
              <button className="btn-sm" onClick={exportTecnicos}>Gerar relatório</button>
            </div>
          )}
          <div className="card">
            {tecnicos.map((m) => (
              <div key={m.userId} className="ticket-row" style={{ alignItems: 'flex-start', cursor: canManageMembers ? 'pointer' : 'default' }}
                onClick={() => canManageMembers && setOpenMember(m)}>
                <Avatar name={m.user.name} />
                <div style={{ flex: 1 }}>
                  <div className="row wrap" style={{ gap: 8 }}>
                    <b>{m.user.name}</b>
                    <RoleBadge role={m.role} />
                    {m.isManager && <span className="chip">⭐ gerente</span>}
                    {m.userId === activeGroup.ownerId && <span className="chip">dono</span>}
                  </div>
                  <div className="muted small">{m.user.email || m.user.login}</div>

                  {m.role === 'dev' && (
                    <div className="mt" onClick={(e) => e.stopPropagation()}>
                      <div className="muted small mb">Categorias que atende:</div>
                      <div className="row wrap" style={{ gap: 6 }}>
                        {categories.length === 0 && <span className="muted small">Crie categorias primeiro.</span>}
                        {categories.map((c) => {
                          const on = (m.categoryIds || []).includes(c.id);
                          return isSuporte ? (
                            <button key={c.id} className={on ? 'btn-primary btn-sm' : 'btn-sm'}
                              onClick={() => toggleCat(m.userId, c.id, m.categoryIds || [])}>
                              {on ? '✓ ' : ''}{c.name}
                            </button>
                          ) : (
                            on && <span key={c.id} className="chip">{c.name}</span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'solicitantes' && (
        <div>
          <div className="card card-pad mb">
            <div className="row wrap" style={{ gap: 8 }}>
              <input placeholder="Buscar solicitante por nome ou cidade..." value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
              {isSuporte && <button className="btn-sm" onClick={exportSolicitantes}>Gerar relatório</button>}
            </div>
          </div>
          <div className="card">
            {solicitantes.length === 0 && <Empty>Nenhum solicitante no grupo ainda.</Empty>}
            {solicitantes
              .filter((m) => {
                const s = q.trim().toLowerCase();
                if (!s) return true;
                return m.user.name.toLowerCase().includes(s) || (m.user.cidade || '').toLowerCase().includes(s);
              })
              .map((m) => (
                <div key={m.userId} className="ticket-row" style={{ cursor: canManageMembers ? 'pointer' : 'default' }}
                  onClick={() => canManageMembers && setOpenMember(m)}>
                  <Avatar name={m.user.name} size="sm" />
                  <div style={{ flex: 1 }}>
                    <b className="small">{m.user.name}</b>
                    <div className="t-meta">{m.user.email || m.user.login}</div>
                  </div>
                  {m.user.cidade && <span className="chip">📍 {m.user.cidade}</span>}
                </div>
              ))}
          </div>
        </div>
      )}

      {openMember && (
        <MemberModal member={openMember} group={activeGroup} actor={user}
          onClose={() => setOpenMember(null)} bump={() => { setOpenMember(null); bump(); }} />
      )}

      {tab === 'config' && (
        <Settings group={activeGroup} user={user} isSuporte={isSuporte} bump={bump} onExit={afterExit} />
      )}
    </div>
  );
}

// -------------------------------------------------------------
//  Visão geral da equipe (v0.0.6) — categorias × membros, online, carga
// -------------------------------------------------------------
function TeamOverview({ group, members, tecnicos, solicitantes, categories }) {
  const online = tecnicos.filter((m) => isOnline(group.id, m.userId));
  const load = teamLoad(group);
  const todayKey = new Date().toISOString().slice(0, 10);
  const attToday = attendancesByTech(group, todayKey).reduce((s, d) => s + d.value, 0);

  const membersOfCategory = (catId) =>
    tecnicos.filter((m) => (m.categoryIds || []).includes(catId));
  const uncategorized = tecnicos.filter((m) => m.role === 'dev' && !(m.categoryIds || []).length);

  return (
    <div>
      {/* números da equipe */}
      <div className="stats mb">
        <div className="stat"><div className="n">{members.length}</div><div className="l">Membros</div></div>
        <div className="stat"><div className="n">{tecnicos.length}</div><div className="l">Técnicos</div></div>
        <div className="stat"><div className="n">{solicitantes.length}</div><div className="l">Solicitantes</div></div>
        <div className="stat"><div className="n" style={{ color: '#34B27A' }}>{online.length}</div><div className="l">Online agora</div></div>
        <div className="stat"><div className="n">{attToday}</div><div className="l">Atendimentos hoje</div></div>
      </div>

      <div className="grid grid-2 mb">
        {/* técnicos online */}
        <div className="card card-pad">
          <h3>Técnicos online</h3>
          <p className="muted small">Ativos nos últimos 5 minutos.</p>
          <div className="col" style={{ gap: 10 }}>
            {tecnicos.map((m) => {
              const on = isOnline(group.id, m.userId);
              const seen = lastSeen(group.id, m.userId);
              return (
                <div key={m.userId} className="row" style={{ gap: 10 }}>
                  <span style={{ position: 'relative' }}>
                    <Avatar name={m.user.name} size="sm" />
                    <span className={`presence-dot ${on ? 'on' : ''}`} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <b className="small">{m.user.name}</b>
                    <div className="t-meta">
                      {on ? 'online agora' : seen ? `visto ${timeAgo(seen)}` : 'nunca acessou'}
                    </div>
                  </div>
                  <RoleBadge role={m.role} />
                </div>
              );
            })}
          </div>
        </div>

        {/* categorias e seus membros */}
        <div className="card card-pad">
          <h3>Categorias e membros</h3>
          <p className="muted small">Quem atende cada área de desenvolvimento.</p>
          <div className="col" style={{ gap: 12 }}>
            {categories.length === 0 && <Empty>Nenhuma categoria criada.</Empty>}
            {categories.map((c) => {
              const mems = membersOfCategory(c.id);
              return (
                <div key={c.id}>
                  <div className="row" style={{ gap: 8 }}>
                    <span className="dot" style={{ background: c.color, width: 10, height: 10 }} />
                    <b className="small">{c.name}</b>
                    <span className="muted small">· {mems.length} membro(s)</span>
                  </div>
                  <div className="row wrap" style={{ gap: 6, marginTop: 6, paddingLeft: 18 }}>
                    {mems.length === 0
                      ? <span className="muted small">Ninguém atende esta categoria.</span>
                      : mems.map((m) => (
                        <span key={m.userId} className="chip">
                          {isOnline(group.id, m.userId) ? '🟢 ' : ''}{m.user.name}
                        </span>
                      ))}
                  </div>
                </div>
              );
            })}
            {uncategorized.length > 0 && (
              <div>
                <b className="small muted">Devs sem categoria</b>
                <div className="row wrap" style={{ gap: 6, marginTop: 6 }}>
                  {uncategorized.map((m) => <span key={m.userId} className="chip">{m.user.name}</span>)}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* carga ativa por técnico */}
      <div className="card card-pad">
        <h3>Carga ativa por técnico</h3>
        <p className="muted small">Chamados em aberto atribuídos a cada um.</p>
        {load.every((d) => d.value === 0)
          ? <Empty>Nenhum chamado ativo atribuído.</Empty>
          : <ColumnChart data={load} height={160} color="#7A74C9" />}
      </div>
    </div>
  );
}

// -------------------------------------------------------------
//  Permissões configuráveis do grupo (v0.0.5)
// -------------------------------------------------------------
function PermissionsBlock({ group, user, bump }) {
  const perms = groupPermissions(group);
  const [saved, setSaved] = useState(false);

  const change = (key, value) => {
    updateGroupPermissions(group.id, { ...perms, [key]: value }, user);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
    bump();
  };

  return (
    <div className="card card-pad mb">
      <div className="row between">
        <h3 style={{ margin: 0 }}>Permissões</h3>
        {saved && <span className="chip">✓ salvo</span>}
      </div>
      <p className="muted small">Controlam o que os usuários podem fazer nos chamados deste grupo.</p>

      <div className="grid grid-2">
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Exclusão de chamados</label>
          <select value={perms.ticketDelete} onChange={(e) => change('ticketDelete', e.target.value)}>
            <option value="off">Bloqueada para todos</option>
            <option value="suporte">Liberada para o suporte</option>
          </select>
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Alterar urgência do chamado</label>
          <select value={perms.urgencyChange} onChange={(e) => change('urgencyChange', e.target.value)}>
            <option value="owner">Responsável pelo chamado</option>
            <option value="suporte">Somente o suporte</option>
          </select>
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Atribuir chamados</label>
          <select value={perms.assignTickets} onChange={(e) => change('assignTickets', e.target.value)}>
            <option value="sup_ger">Suporte e gerentes</option>
            <option value="suporte">Somente o suporte</option>
          </select>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
//  Perfil do membro (v0.0.5) — ver, editar, papel, gerente, remover
// -------------------------------------------------------------
function MemberModal({ member, group, actor, onClose, bump }) {
  const isOwner = member.userId === group.ownerId;
  const isRequesterMember = member.role === 'solicitante';
  const actorIsSuporte = actor.role === 'suporte'; // dev só altera papel (v0.0.6)
  const cities = cityList(group.id);
  const [form, setForm] = useState({
    name: member.user.name, email: member.user.email || '',
    cidade: member.user.cidade || '', password: '',
  });
  const [role, setRole] = useState(member.role);
  const [manager, setManager] = useState(!!member.isManager);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const stats = isRequesterMember
    ? requesterStats(group.id, member.userId)
    : devStats(group.id, member.userId);

  const save = () => {
    setError('');
    try {
      if (actorIsSuporte) adminUpdateUser(group.id, member.userId, form, actor);
      if (role !== member.role) setMemberRole(group.id, member.userId, role, actor);
      if (actorIsSuporte && role !== 'solicitante' && manager !== !!member.isManager)
        setMemberManager(group.id, member.userId, manager, actor);
      bump();
    } catch (err) { setError(err.message); }
  };

  const doRemove = () => {
    try { removeMember(group.id, member.userId, actor); bump(); }
    catch (err) { setError(err.message); setConfirmRemove(false); }
  };

  return (
    <>
      <Modal title="Perfil do membro" onClose={onClose}
        footer={<>
          {actorIsSuporte && (
            <button className="btn-danger" onClick={() => setConfirmRemove(true)} disabled={isOwner}>Remover do grupo</button>
          )}
          <span style={{ flex: 1 }} />
          <button onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={save}>Salvar</button>
        </>}>
        {error && <div className="alert alert-error">{error}</div>}

        <div className="row mb" style={{ gap: 12 }}>
          <Avatar name={member.user.name} />
          <div>
            <div className="row" style={{ gap: 8 }}>
              <b>{member.user.name}</b>
              <RoleBadge role={member.role} />
              {isOwner && <span className="chip">dono</span>}
            </div>
            <div className="muted small">@{member.user.login} · no grupo desde {new Date(member.joinedAt || member.user.createdAt).toLocaleDateString('pt-BR')}</div>
          </div>
        </div>

        <div className="stats mb">
          {isRequesterMember ? (
            <>
              <div className="stat"><div className="n">{stats.total}</div><div className="l">Chamados abertos</div></div>
              <div className="stat"><div className="n" style={{ color: '#34B27A' }}>{stats.concluido}</div><div className="l">Concluídos</div></div>
            </>
          ) : (
            <>
              <div className="stat"><div className="n">{stats.active}</div><div className="l">Ativos</div></div>
              <div className="stat"><div className="n" style={{ color: '#34B27A' }}>{stats.finished}</div><div className="l">Finalizados</div></div>
            </>
          )}
        </div>

        {actorIsSuporte ? (
          <>
            <div className="field"><label>Nome</label><input value={form.name} onChange={set('name')} /></div>
            <div className="row" style={{ gap: 10 }}>
              <div className="field" style={{ flex: 1 }}><label>E-mail</label><input value={form.email} onChange={set('email')} /></div>
              <div className="field" style={{ flex: 1 }}>
                <label>Nova senha</label>
                <input type="password" value={form.password} onChange={set('password')} placeholder="Deixe vazio p/ manter" />
              </div>
            </div>

            {isRequesterMember && (
              <div className="field">
                <label>Cidade</label>
                {cities.length ? (
                  <select value={form.cidade} onChange={set('cidade')}>
                    <option value="">— Sem cidade —</option>
                    {cities.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                ) : (
                  <input value={form.cidade} onChange={set('cidade')} />
                )}
              </div>
            )}
          </>
        ) : (
          <p className="muted small">Como desenvolvedor, você pode alterar o <b>papel</b> deste membro. A edição do perfil é exclusiva do suporte.</p>
        )}

        <div className="divider" />
        <div className="row wrap" style={{ gap: 14 }}>
          <div className="field" style={{ flex: 1, minWidth: 180, marginBottom: 0 }}>
            <label>Papel no grupo</label>
            <select value={role} onChange={(e) => setRole(e.target.value)} disabled={isOwner}>
              <option value="solicitante">Solicitante</option>
              <option value="dev">Desenvolvedor</option>
              <option value="suporte">Suporte</option>
            </select>
            {isOwner
              ? <div className="hint">O dono do grupo é sempre suporte.</div>
              : <div className="hint">Todo mundo entra como solicitante; aqui a equipe promove o acesso.</div>}
          </div>
          {actorIsSuporte && role !== 'solicitante' && (
            <label className="row" style={{ gap: 8, marginBottom: 0, textTransform: 'none', fontSize: 13.5, fontWeight: 500 }}>
              <input type="checkbox" style={{ width: 'auto' }} checked={manager} onChange={(e) => setManager(e.target.checked)} />
              ⭐ Gerente (pode atribuir chamados)
            </label>
          )}
        </div>
      </Modal>

      {confirmRemove && (
        <ConfirmModal title="Remover membro" danger confirmLabel="Remover"
          message={<>Remover <b>{member.user.name}</b> do grupo? Os chamados atribuídos a essa pessoa voltam para o pool.</>}
          onCancel={() => setConfirmRemove(false)} onConfirm={doRemove} />
      )}
    </>
  );
}

// -------------------------------------------------------------
//  Aba de Configurações do grupo
// -------------------------------------------------------------
function Settings({ group, user, isSuporte, bump, onExit }) {
  const isOwner = group.ownerId === user.id;
  const [inviteLogin, setInviteLogin] = useState('');
  const [inviteMsg, setInviteMsg] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [gName, setGName] = useState(group.name);
  const [gDesc, setGDesc] = useState(group.description || '');
  const [delOpen, setDelOpen] = useState(false);
  const [delStep, setDelStep] = useState(0);
  const [leaveOpen, setLeaveOpen] = useState(false);

  const invites = invitationsForGroup(group.id);
  const pending = invites.filter((i) => i.status === 'pendente');
  const copy = (code) => navigator.clipboard?.writeText(code);

  const sendInvite = (e) => {
    e.preventDefault();
    setInviteMsg('');
    try {
      const inv = createInvitation(group.id, inviteLogin, user);
      setInviteLogin('');
      setInviteMsg(`✅ Convite enviado para ${inv.inviteeLogin}.`);
      bump();
    } catch (err) { setInviteMsg(err.message); }
  };

  const saveGroup = () => {
    updateGroup(group.id, { name: gName.trim() || group.name, description: gDesc.trim() }, user);
    setEditOpen(false); bump();
  };

  const doLeave = () => {
    try { leaveGroup(group.id, user); onExit(); }
    catch (err) { alert(err.message); }
  };

  // Técnicos não-suporte só veem informações e a opção de sair
  if (!isSuporte) {
    return (
      <>
        <div className="card card-pad mb">
          <h3>Sobre o grupo</h3>
          <div className="grid grid-2 mt">
            <div><div className="muted small">Nome</div><div>{group.name}</div></div>
            <div><div className="muted small">Descrição</div><div>{group.description || '—'}</div></div>
          </div>
        </div>
        <div className="card card-pad">
          <h3>⚠️ Zona de perigo</h3>
          <p className="muted small">Ao sair, você perde o acesso a todo o conteúdo deste grupo.</p>
          <button className="btn-danger" onClick={() => setLeaveOpen(true)}>🚪 Sair do grupo</button>
        </div>
        {leaveOpen && (
          <ConfirmModal
            title="Sair do grupo" danger confirmLabel="Sair do grupo"
            message={<>Deseja sair de <b>{group.name}</b>? Seus chamados atribuídos ficarão sem responsável.</>}
            onCancel={() => setLeaveOpen(false)} onConfirm={doLeave}
          />
        )}
      </>
    );
  }

  return (
    <>
      {/* dados do grupo */}
      <div className="card card-pad mb">
        <div className="row between">
          <h3 style={{ margin: 0 }}>📋 Dados do grupo</h3>
          <button className="btn-sm" onClick={() => setEditOpen(true)}>✏️ Editar</button>
        </div>
        <div className="grid grid-2 mt">
          <div><div className="muted small">Nome</div><div>{group.name}</div></div>
          <div><div className="muted small">Descrição</div><div>{group.description || '—'}</div></div>
        </div>
      </div>

      {/* código ÚNICO de acesso (v0.0.6) */}
      <div className="card card-pad mb">
        <h3>Código de acesso do grupo</h3>
        <p className="muted small">
          Um único código para todos: quem entra com ele vira <b>solicitante</b> (informando a cidade).
          Depois, a equipe define quem passa a ser desenvolvedor ou suporte.
        </p>
        <div className="row wrap" style={{ gap: 8 }}>
          <span className="code-box">{groupAccessCode(group)}</span>
          <button className="btn-sm" onClick={() => copy(groupAccessCode(group))}>Copiar</button>
          <button className="btn-sm" title="Gerar novo (invalida o anterior)" onClick={() => { regenerateCode(group.id, user); bump(); }}>↺ Gerar novo</button>
        </div>
      </div>

      {/* convites */}
      <div className="card card-pad mb">
        <h3>Convidar</h3>
        <p className="muted small">O convidado aceita ou recusa na página de Convites e entra como solicitante.</p>
        {inviteMsg && <div className="alert alert-info">{inviteMsg}</div>}
        <form className="row wrap" onSubmit={sendInvite} style={{ gap: 8 }}>
          <input value={inviteLogin} onChange={(e) => setInviteLogin(e.target.value)}
            placeholder="login ou e-mail de quem você quer convidar" style={{ flex: 1, minWidth: 200 }} />
          <button className="btn-primary">Convidar</button>
        </form>

        {invites.length > 0 && (
          <div className="mt">
            <div className="muted small mb">Convites ({pending.length} pendente(s)):</div>
            <div className="row wrap" style={{ gap: 6 }}>
              {invites.slice(0, 12).map((i) => (
                <span key={i.id} className="chip">
                  {i.invitee?.name || i.inviteeLogin} · {i.status}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* permissões configuráveis (v0.0.5) */}
      <PermissionsBlock group={group} user={user} bump={bump} />

      {/* zona de perigo */}
      <div className="card card-pad" style={{ borderColor: 'var(--danger-border)' }}>
        <h3>⚠️ Zona de perigo</h3>
        <div className="row wrap between" style={{ gap: 10 }}>
          <p className="muted small" style={{ margin: 0, flex: 1, minWidth: 220 }}>
            Apagar o grupo remove <b>permanentemente</b> chamados, categorias, sistemas, serviços, clientes, chats e registros.
          </p>
          <div className="row" style={{ gap: 8 }}>
            {!isOwner && <button className="btn-danger" onClick={() => setLeaveOpen(true)}>🚪 Sair</button>}
            <button className="btn-danger" onClick={() => { setDelStep(0); setDelOpen(true); }}>🗑️ Apagar grupo</button>
          </div>
        </div>
      </div>

      {editOpen && (
        <Modal title="Editar grupo" onClose={() => setEditOpen(false)}
          footer={<>
            <button onClick={() => setEditOpen(false)}>Cancelar</button>
            <button className="btn-primary" onClick={saveGroup}>Salvar</button>
          </>}>
          <div className="field"><label>Nome do grupo</label><input value={gName} onChange={(e) => setGName(e.target.value)} /></div>
          <div className="field" style={{ marginBottom: 0 }}><label>Descrição</label><textarea value={gDesc} onChange={(e) => setGDesc(e.target.value)} /></div>
        </Modal>
      )}

      {leaveOpen && (
        <ConfirmModal
          title="Sair do grupo" danger confirmLabel="Sair do grupo"
          message={<>Deseja sair de <b>{group.name}</b>? Seus chamados atribuídos ficarão sem responsável.</>}
          onCancel={() => setLeaveOpen(false)} onConfirm={doLeave}
        />
      )}

      {delOpen && (
        <Modal title="⚠️ Apagar grupo" onClose={() => setDelOpen(false)}
          footer={delStep < 2 ? (
            <>
              <button onClick={() => setDelOpen(false)}>Cancelar</button>
              <button className="btn-danger" onClick={() => setDelStep((s) => s + 1)}>Entendo, continuar</button>
            </>
          ) : (
            <>
              <button onClick={() => setDelOpen(false)}>Cancelar</button>
              <button className="btn-danger" onClick={() => { deleteGroup(group.id, user); onExit(); }}>Apagar definitivamente</button>
            </>
          )}>
          {delStep === 0 && (
            <div className="alert alert-error" style={{ margin: 0 }}>
              Você está prestes a apagar <b>{group.name}</b>. Todos os chamados, categorias, sistemas,
              serviços, clientes, chats e registros serão <b>permanentemente removidos</b>.
            </div>
          )}
          {delStep === 1 && (
            <div className="alert alert-error" style={{ margin: 0 }}>
              Esta ação <b>não pode ser desfeita</b>. Todos os membros perderão o acesso a este grupo. Tem certeza absoluta?
            </div>
          )}
          {delStep === 2 && (
            <div className="alert alert-error" style={{ margin: 0 }}>
              Última confirmação: clique em <b>“Apagar definitivamente”</b> para remover o grupo <b>{group.name}</b>.
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
