import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  groupMembers, categoriesForGroup, updateMemberCategories, regenerateCode,
  createInvitation, invitationsForGroup, updateGroup,
  leaveGroup, deleteGroup,
} from '../lib/domain';
import { RoleBadge, Avatar, Modal } from '../components/ui';

export default function Team() {
  const { user, activeGroup, refresh, selectGroup, groups } = useAuth();
  const navigate = useNavigate();
  const [, setLocal] = useState(0);
  const bump = () => { refresh(); setLocal((n) => n + 1); };

  const isSuporte = user.role === 'suporte';
  const isOwner = activeGroup.ownerId === user.id;
  const members = groupMembers(activeGroup);
  const categories = categoriesForGroup(activeGroup.id);

  const copy = (code) => { navigator.clipboard?.writeText(code); };

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

  const doLeave = () => {
    if (!confirm('Deseja realmente sair deste grupo? Você perderá o acesso às informações dele.')) return;
    try { leaveGroup(activeGroup.id, user); afterExit(); }
    catch (err) { alert(err.message); }
  };

  return (
    <div>
      <div className="row between page-head">
        <div>
          <h1>Membros{isSuporte ? ' & convites' : ''}</h1>
          <p className="muted">{activeGroup.description || 'Integrantes do grupo de trabalho.'}</p>
        </div>
        {!isSuporte && (
          <button className="btn-danger" onClick={doLeave}>🚪 Sair do grupo</button>
        )}
      </div>

      {isSuporte && <SuporteAdmin group={activeGroup} user={user} bump={bump} copy={copy}
        isOwner={isOwner} onDeleted={afterExit} onLeft={doLeave} />}

      {/* ---- lista de membros (RP05: todos, exceto solicitante) ---- */}
      <h2>Membros ({members.length})</h2>
      <div className="card">
        {members.map((m) => (
          <div key={m.userId} className="ticket-row" style={{ cursor: 'default', alignItems: 'flex-start' }}>
            <Avatar name={m.user.name} />
            <div style={{ flex: 1 }}>
              <div className="row" style={{ gap: 8 }}>
                <b>{m.user.name}</b>
                <RoleBadge role={m.role} />
                {m.userId === activeGroup.ownerId && <span className="chip">dono</span>}
              </div>
              <div className="muted small">{m.user.email || m.user.login} · {m.user.cidade || 'sem cidade'}</div>

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
    </div>
  );
}

// -------------------------------------------------------------
//  Bloco de administração — só suporte
// -------------------------------------------------------------
function SuporteAdmin({ group, user, bump, copy, isOwner, onDeleted, onLeft }) {
  const [inviteLogin, setInviteLogin] = useState('');
  const [inviteMsg, setInviteMsg] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [gName, setGName] = useState(group.name);
  const [gDesc, setGDesc] = useState(group.description || '');
  const [delOpen, setDelOpen] = useState(false);
  const [delStep, setDelStep] = useState(0);

  const pending = invitationsForGroup(group.id).filter((i) => i.status === 'pendente');

  const sendInvite = (e) => {
    e.preventDefault();
    setInviteMsg('');
    try {
      const u = createInvitation(group.id, inviteLogin, user);
      setInviteLogin('');
      setInviteMsg(`Convite enviado (${u.inviteeLogin}).`);
      bump();
    } catch (err) { setInviteMsg(err.message); }
  };

  const saveGroup = () => {
    updateGroup(group.id, { name: gName.trim() || group.name, description: gDesc.trim() }, user);
    setEditOpen(false); bump();
  };

  const confirmDelete = () => {
    deleteGroup(group.id, user);
    onDeleted();
  };

  return (
    <>
      {/* códigos de convite */}
      <div className="grid mb" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="card card-pad">
          <h3>👨‍💻 Convite de técnicos</h3>
          <p className="muted small">Para suporte/devs entrarem no grupo.</p>
          <div className="row" style={{ gap: 8 }}>
            <span className="code-box">{group.techInviteCode}</span>
            <button className="btn-sm" onClick={() => copy(group.techInviteCode)}>Copiar</button>
            <button className="btn-sm" onClick={() => { regenerateCode(group.id, 'tech', user); bump(); }}>↺</button>
          </div>
        </div>
        <div className="card card-pad">
          <h3>🙋 Cadastro de solicitantes</h3>
          <p className="muted small">Solicitantes usam este código ao criar a conta (RC05).</p>
          <div className="row" style={{ gap: 8 }}>
            <span className="code-box">{group.requesterCode}</span>
            <button className="btn-sm" onClick={() => copy(group.requesterCode)}>Copiar</button>
            <button className="btn-sm" onClick={() => { regenerateCode(group.id, 'requester', user); bump(); }}>↺</button>
          </div>
        </div>
      </div>

      {/* convidar por login (RP02) */}
      <div className="card card-pad mb">
        <h3>✉️ Convidar técnico por usuário</h3>
        <p className="muted small">Envia um convite que o suporte/dev aceita ou recusa (RP06).</p>
        {inviteMsg && <div className="alert alert-info">{inviteMsg}</div>}
        <form className="row" onSubmit={sendInvite} style={{ gap: 8 }}>
          <input value={inviteLogin} onChange={(e) => setInviteLogin(e.target.value)} placeholder="login ou e-mail do técnico" />
          <button className="btn-primary">Convidar</button>
        </form>
        {pending.length > 0 && (
          <div className="mt">
            <div className="muted small mb">Convites pendentes:</div>
            <div className="row wrap" style={{ gap: 6 }}>
              {pending.map((i) => (
                <span key={i.id} className="chip">{i.invitee?.name || i.inviteeLogin} · aguardando</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* configurações do grupo (RP09 / RP13) */}
      <div className="card card-pad mb">
        <div className="row between">
          <div>
            <h3>⚙️ Configurações do grupo</h3>
            <p className="muted small" style={{ margin: 0 }}>Nome e descrição do grupo.</p>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn-sm" onClick={() => setEditOpen(true)}>✏️ Editar</button>
            {!isOwner && <button className="btn-sm btn-danger" onClick={onLeft}>🚪 Sair</button>}
            <button className="btn-sm btn-danger" onClick={() => { setDelStep(0); setDelOpen(true); }}>🗑️ Apagar grupo</button>
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
          <div className="field"><label>Descrição</label><textarea value={gDesc} onChange={(e) => setGDesc(e.target.value)} /></div>
        </Modal>
      )}

      {/* RP13 — apagar grupo com vários avisos */}
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
              <button className="btn-danger" onClick={confirmDelete}>Apagar definitivamente</button>
            </>
          )}>
          {delStep === 0 && (
            <div className="alert alert-error" style={{ margin: 0 }}>
              Você está prestes a apagar <b>{group.name}</b>. Todos os chamados, categorias,
              serviços, chats e registros serão <b>permanentemente removidos</b>.
            </div>
          )}
          {delStep === 1 && (
            <div className="alert alert-error" style={{ margin: 0 }}>
              Esta ação <b>não pode ser desfeita</b>. Todos os membros perderão o acesso a este grupo.
              Tem certeza absoluta?
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
