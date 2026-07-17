import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  groupMembers, categoriesForGroup, updateMemberCategories, regenerateCode,
  createInvitation, invitationsForGroup, updateGroup, leaveGroup, deleteGroup,
} from '../lib/domain';
import { RoleBadge, Avatar, Modal, ConfirmModal, Empty } from '../components/ui';

export default function Team() {
  const { user, activeGroup, refresh, selectGroup, groups } = useAuth();
  const navigate = useNavigate();
  const [, setLocal] = useState(0);
  const [tab, setTab] = useState('tecnicos');
  const [q, setQ] = useState('');
  const bump = () => { refresh(); setLocal((n) => n + 1); };

  const isSuporte = user.role === 'suporte';
  const members = groupMembers(activeGroup);
  const categories = categoriesForGroup(activeGroup.id);
  const tecnicos = members.filter((m) => m.role !== 'solicitante');
  const solicitantes = members.filter((m) => m.role === 'solicitante');

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

      <div className="auth-tabs" style={{ maxWidth: 560 }}>
        <button className={tab === 'tecnicos' ? 'btn-primary' : ''} onClick={() => setTab('tecnicos')}>
          Técnicos ({tecnicos.length})
        </button>
        <button className={tab === 'solicitantes' ? 'btn-primary' : ''} onClick={() => setTab('solicitantes')}>
          Solicitantes ({solicitantes.length})
        </button>
        <button className={tab === 'config' ? 'btn-primary' : ''} onClick={() => setTab('config')}>
          ⚙️ Configurações
        </button>
      </div>

      {tab === 'tecnicos' && (
        <div className="card">
          {tecnicos.map((m) => (
            <div key={m.userId} className="ticket-row" style={{ cursor: 'default', alignItems: 'flex-start' }}>
              <Avatar name={m.user.name} />
              <div style={{ flex: 1 }}>
                <div className="row wrap" style={{ gap: 8 }}>
                  <b>{m.user.name}</b>
                  <RoleBadge role={m.role} />
                  {m.userId === activeGroup.ownerId && <span className="chip">dono</span>}
                </div>
                <div className="muted small">{m.user.email || m.user.login}</div>

                {m.role === 'dev' && (
                  <div className="mt">
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
      )}

      {tab === 'solicitantes' && (
        <div>
          <div className="card card-pad mb">
            <input placeholder="🔍 Buscar solicitante por nome ou cidade..." value={q} onChange={(e) => setQ(e.target.value)} />
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
                <div key={m.userId} className="ticket-row" style={{ cursor: 'default' }}>
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

      {tab === 'config' && (
        <Settings group={activeGroup} user={user} isSuporte={isSuporte} bump={bump} onExit={afterExit} />
      )}
    </div>
  );
}

// -------------------------------------------------------------
//  Aba de Configurações do grupo (v0.0.3)
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

      {/* códigos de acesso */}
      <div className="grid grid-2 mb">
        <div className="card card-pad">
          <h3>👨‍💻 Código de técnicos</h3>
          <p className="muted small">Suporte e devs entram no grupo com este código.</p>
          <div className="row wrap" style={{ gap: 8 }}>
            <span className="code-box">{group.techInviteCode}</span>
            <button className="btn-sm" onClick={() => copy(group.techInviteCode)}>Copiar</button>
            <button className="btn-sm" title="Gerar novo" onClick={() => { regenerateCode(group.id, 'tech', user); bump(); }}>↺</button>
          </div>
        </div>
        <div className="card card-pad">
          <h3>🙋 Código de solicitantes</h3>
          <p className="muted small">Obrigatório no cadastro do solicitante — sem ele, a conta não é criada.</p>
          <div className="row wrap" style={{ gap: 8 }}>
            <span className="code-box">{group.requesterCode}</span>
            <button className="btn-sm" onClick={() => copy(group.requesterCode)}>Copiar</button>
            <button className="btn-sm" title="Gerar novo" onClick={() => { regenerateCode(group.id, 'requester', user); bump(); }}>↺</button>
          </div>
        </div>
      </div>

      {/* convites */}
      <div className="card card-pad mb">
        <h3>✉️ Convidar técnico</h3>
        <p className="muted small">O convidado aceita ou recusa na página de Convites.</p>
        {inviteMsg && <div className="alert alert-info">{inviteMsg}</div>}
        <form className="row wrap" onSubmit={sendInvite} style={{ gap: 8 }}>
          <input value={inviteLogin} onChange={(e) => setInviteLogin(e.target.value)}
            placeholder="login ou e-mail do técnico" style={{ flex: 1, minWidth: 200 }} />
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
