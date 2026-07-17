import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { invitationsForUser, respondInvitation, cityList } from '../lib/domain';
import { Empty, Modal } from '../components/ui';

// Convites de grupos. Ao aceitar, o usuário entra como SOLICITANTE
// (informando a cidade); a equipe pode promover o acesso depois (v0.0.6).
export default function Invites() {
  const { user, refresh, selectGroup } = useAuth();
  const [, setLocal] = useState(0);
  const [accepting, setAccepting] = useState(null); // convite aguardando cidade
  const [cidade, setCidade] = useState(user?.cidade || '');
  const [error, setError] = useState('');
  const bump = () => { refresh(); setLocal((n) => n + 1); };
  const invites = invitationsForUser(user.id);

  const decline = (inv) => {
    respondInvitation(inv.id, false);
    bump();
  };

  const confirmAccept = () => {
    setError('');
    try {
      respondInvitation(accepting.id, true, cidade);
      const groupId = accepting.groupId;
      setAccepting(null);
      bump();
      selectGroup(groupId);
    } catch (err) { setError(err.message); }
  };

  const acceptCities = accepting ? cityList(accepting.groupId) : [];

  return (
    <div style={{ maxWidth: 640 }}>
      <div className="page-head">
        <h1>Convites</h1>
        <p className="muted">Convites de grupos aguardando sua resposta.</p>
      </div>

      <div className="card">
        {invites.length === 0 ? (
          <Empty>Nenhum convite pendente.</Empty>
        ) : (
          invites.map((inv) => (
            <div key={inv.id} className="ticket-row" style={{ cursor: 'default' }}>
              <div style={{ flex: 1 }}>
                <div className="t-title">{inv.group.name}</div>
                <div className="t-meta">{inv.group.description || 'Sem descrição'}</div>
              </div>
              <button className="btn-primary btn-sm" onClick={() => { setError(''); setCidade(user?.cidade || ''); setAccepting(inv); }}>Aceitar</button>
              <button className="btn-sm btn-danger" onClick={() => decline(inv)}>Recusar</button>
            </div>
          ))
        )}
      </div>

      {accepting && (
        <Modal title={`Entrar em ${accepting.group.name}`} onClose={() => setAccepting(null)}
          footer={<>
            <button onClick={() => setAccepting(null)}>Cancelar</button>
            <button className="btn-primary" onClick={confirmAccept}>Entrar no grupo</button>
          </>}>
          {error && <div className="alert alert-error">{error}</div>}
          <p className="muted small" style={{ marginTop: 0 }}>
            Você entra como <b>solicitante</b> — a equipe do grupo pode promover seu acesso depois.
          </p>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Sua cidade *</label>
            {acceptCities.length ? (
              <select value={cidade} onChange={(e) => setCidade(e.target.value)}>
                <option value="">Selecione sua cidade</option>
                {acceptCities.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            ) : (
              <input value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="Sua cidade" autoFocus />
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
