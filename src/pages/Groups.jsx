import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { createGroup, joinGroupByCode, isTech, groupMembers } from '../lib/domain';
import { Modal, Empty } from '../components/ui';

// Página de grupos: alternar entre grupos, criar novo, entrar por código.
export default function Groups() {
  const { user, groups, activeGroupId, selectGroup, refresh } = useAuth();
  const [, setLocal] = useState(0);
  const [modal, setModal] = useState(null); // 'create' | 'join' | null
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const bump = () => { refresh(); setLocal((n) => n + 1); };
  const tech = isTech(user.role);

  const open = (which) => { setError(''); setName(''); setDescription(''); setCode(''); setModal(which); };

  const doCreate = () => {
    setError('');
    try { const g = createGroup({ name, description }, user); bump(); selectGroup(g.id); setModal(null); }
    catch (err) { setError(err.message); }
  };
  const doJoin = () => {
    setError('');
    try { const g = joinGroupByCode(user, code); bump(); selectGroup(g.id); setModal(null); }
    catch (err) { setError(err.message); }
  };

  return (
    <div>
      <div className="row between page-head">
        <div>
          <h1>Meus grupos</h1>
          <p className="muted">Alterne entre grupos para ver conteúdos diferentes. Cada grupo é isolado.</p>
        </div>
        {tech && (
          <div className="row" style={{ gap: 8 }}>
            <button onClick={() => open('join')}>🔑 Entrar com código</button>
            <button className="btn-primary" onClick={() => open('create')}>➕ Criar grupo</button>
          </div>
        )}
      </div>

      {groups.length === 0 && (
        <div className="card"><Empty>Você ainda não participa de nenhum grupo.</Empty></div>
      )}

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
        {groups.map((g) => {
          const active = g.id === activeGroupId;
          const members = groupMembers(g);
          const isOwner = g.ownerId === user.id;
          return (
            <div key={g.id} className="card card-pad" style={active ? { borderColor: 'var(--primary)', boxShadow: '0 0 0 1px var(--primary)' } : undefined}>
              <div className="row between">
                <b style={{ fontSize: 15 }}>{g.name}</b>
                {active && <span className="badge" style={{ background: 'var(--primary-soft)', color: 'var(--primary-dark)' }}><span className="dot" style={{ background: 'var(--primary)' }} />ativo</span>}
              </div>
              <p className="muted small" style={{ minHeight: 32 }}>{g.description || 'Sem descrição.'}</p>
              <div className="row between mt">
                <span className="muted small">👥 {members.length} · {isOwner ? 'você é o dono' : 'membro'}</span>
                {active ? (
                  <span className="chip">em uso</span>
                ) : (
                  <button className="btn-primary btn-sm" onClick={() => { selectGroup(g.id); bump(); }}>Acessar</button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {modal === 'create' && (
        <Modal title="Criar novo grupo" onClose={() => setModal(null)}
          footer={<><button onClick={() => setModal(null)}>Cancelar</button><button className="btn-primary" onClick={doCreate}>Criar</button></>}>
          {error && <div className="alert alert-error">{error}</div>}
          <div className="field"><label>Nome do grupo</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Equipe TI — Cartório" autoFocus /></div>
          <div className="field"><label>Descrição</label><textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Para que serve este grupo?" /></div>
        </Modal>
      )}
      {modal === 'join' && (
        <Modal title="Entrar em um grupo" onClose={() => setModal(null)}
          footer={<><button onClick={() => setModal(null)}>Cancelar</button><button className="btn-primary" onClick={doJoin}>Entrar</button></>}>
          {error && <div className="alert alert-error">{error}</div>}
          <div className="field"><label>Código de convite da equipe</label><input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Ex.: A1B2C3" autoFocus /><div className="hint">Peça ao suporte do grupo o código de convite de técnicos.</div></div>
        </Modal>
      )}
    </div>
  );
}
