import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { createGroup, joinGroupByCode, isTech, groupMembers, groupForCode, cityList } from '../lib/domain';
import { Modal, Empty } from '../components/ui';

// Página de grupos: alternar entre grupos, criar novo, entrar por código.
export default function Groups() {
  const { user, groups, activeGroupId, selectGroup, refresh } = useAuth();
  const [, setLocal] = useState(0);
  const [modal, setModal] = useState(null); // 'create' | 'join' | null
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [code, setCode] = useState('');
  const [cidade, setCidade] = useState(user?.cidade || '');
  const [error, setError] = useState('');
  const bump = () => { refresh(); setLocal((n) => n + 1); };
  const tech = isTech(user.role);

  const match = groupForCode(code);
  const joinCities = match ? cityList(match.group.id) : [];

  const open = (which) => { setError(''); setName(''); setDescription(''); setCode(''); setCidade(user?.cidade || ''); setModal(which); };

  const doCreate = () => {
    setError('');
    try { const g = createGroup({ name, description }, user); bump(); selectGroup(g.id); setModal(null); }
    catch (err) { setError(err.message); }
  };
  const doJoin = () => {
    setError('');
    try { const g = joinGroupByCode(user, code, cidade); bump(); selectGroup(g.id); setModal(null); }
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
          <div className="field">
            <label>Código de acesso do grupo</label>
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Ex.: A1B2C3" autoFocus />
            {match ? (
              <div className="hint">✓ Grupo <b>{match.group.name}</b> — você entra como solicitante; a equipe pode promover depois.</div>
            ) : (
              <div className="hint">Peça o código de acesso à equipe do grupo.</div>
            )}
          </div>
          {match && (
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Sua cidade *</label>
              {joinCities.length ? (
                <select value={cidade} onChange={(e) => setCidade(e.target.value)}>
                  <option value="">Selecione sua cidade</option>
                  {joinCities.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              ) : (
                <input value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="Sua cidade" />
              )}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
