import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/store';
import { cityList, createCity, deleteCity } from '../lib/domain';
import { downloadCSV } from '../lib/report';
import { Empty, ConfirmModal } from '../components/ui';

// Cadastro de cidades — os campos "cidade" do sistema passam a ser seleção.
export default function Cities() {
  const { user, activeGroup, refresh } = useAuth();
  const [, setLocal] = useState(0);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(null);
  const bump = () => { refresh(); setLocal((n) => n + 1); };

  const cities = cityList(activeGroup.id);

  const add = (e) => {
    e.preventDefault();
    setError('');
    try { createCity(activeGroup.id, name, user); setName(''); bump(); }
    catch (err) { setError(err.message); }
  };

  const exportCSV = () => {
    downloadCSV('cidades', cities.map((c) => ({
      Cidade: c.name,
      'Solicitantes': db.filter('users', (u) => (u.cidade || '').toLowerCase() === c.name.toLowerCase()).length,
      'Clientes': db.filter('clients', (x) => x.groupId === activeGroup.id && (x.cidade || '').toLowerCase() === c.name.toLowerCase()).length,
      'Chamados': db.filter('tickets', (t) => t.groupId === activeGroup.id && (t.cidade || '').toLowerCase() === c.name.toLowerCase()).length,
    })));
  };

  return (
    <div style={{ maxWidth: 640 }}>
      <div className="row between wrap page-head" style={{ gap: 10 }}>
        <div>
          <h1>Cidades</h1>
          <p className="muted">Cadastre as cidades atendidas. Elas viram opções de seleção em clientes, chamados e cadastros.</p>
        </div>
        <button className="btn-sm" onClick={exportCSV}>Gerar relatório</button>
      </div>

      <form className="card card-pad mb row wrap" onSubmit={add} style={{ gap: 8 }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome da cidade" style={{ flex: 1, minWidth: 200 }} />
        <button className="btn-primary">Adicionar</button>
        {error && <div className="alert alert-error" style={{ width: '100%', margin: 0 }}>{error}</div>}
      </form>

      <div className="card">
        {cities.length === 0 ? (
          <Empty>Nenhuma cidade cadastrada.</Empty>
        ) : (
          cities.map((c) => {
            const nTickets = db.filter('tickets', (t) => t.groupId === activeGroup.id && (t.cidade || '').toLowerCase() === c.name.toLowerCase()).length;
            return (
              <div key={c.id} className="ticket-row" style={{ cursor: 'default' }}>
                <div style={{ flex: 1 }}>
                  <b className="small">📍 {c.name}</b>
                  <div className="t-meta">{nTickets} chamado(s)</div>
                </div>
                <button className="btn-ghost btn-sm btn-danger" onClick={() => setConfirm(c)}>Excluir</button>
              </div>
            );
          })
        )}
      </div>

      {confirm && (
        <ConfirmModal title="Excluir cidade" danger confirmLabel="Excluir"
          message={<>Excluir <b>{confirm.name}</b>? Registros existentes que usam esta cidade não são alterados.</>}
          onCancel={() => setConfirm(null)}
          onConfirm={() => { deleteCity(confirm.id, user); setConfirm(null); bump(); }} />
      )}
    </div>
  );
}
