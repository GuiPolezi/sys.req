import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/store';
import {
  systemsForGroup, createSystem, updateSystem, deleteSystem,
  categoriesForGroup, servicesForSystem,
} from '../lib/domain';
import { Modal, Empty, ConfirmModal } from '../components/ui';

// Sistemas do grupo — selecionados no chamado para identificar o que está com problema.
export default function Systems() {
  const { user, activeGroup, refresh } = useAuth();
  const [, setLocal] = useState(0);
  const [editing, setEditing] = useState(null); // {id?, name, categoryId}
  const [confirm, setConfirm] = useState(null);
  const [error, setError] = useState('');
  const bump = () => { refresh(); setLocal((n) => n + 1); };

  const systems = systemsForGroup(activeGroup.id);
  const categories = categoriesForGroup(activeGroup.id);

  const save = () => {
    setError('');
    try {
      if (editing.id) updateSystem(editing.id, editing, user);
      else createSystem(activeGroup.id, editing, user);
      setEditing(null); bump();
    } catch (err) { setError(err.message); }
  };

  const askDelete = (s) => {
    const nTickets = db.filter('tickets', (t) => t.systemId === s.id).length;
    const nServices = servicesForSystem(activeGroup.id, s.id).length;
    setConfirm({
      system: s,
      detail: [
        nTickets > 0 && `${nTickets} chamado(s) ficarão sem sistema`,
        nServices > 0 && `${nServices} serviço(s) ficarão sem sistema`,
      ].filter(Boolean).join(' e ') || 'Nenhum registro depende dele.',
    });
  };

  return (
    <div>
      <div className="row between page-head">
        <div>
          <h1>Sistemas do grupo</h1>
          <p className="muted">Os sistemas que a equipe atende. Aparecem na abertura do chamado e agrupam os serviços.</p>
        </div>
        <button className="btn-primary" onClick={() => { setError(''); setEditing({ name: '', categoryId: '' }); }}>➕ Novo sistema</button>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))' }}>
        {systems.length === 0 && <div className="card"><Empty>Nenhum sistema cadastrado.</Empty></div>}
        {systems.map((s) => {
          const cat = s.categoryId ? db.byId('categories', s.categoryId) : null;
          const nTickets = db.filter('tickets', (t) => t.systemId === s.id).length;
          const nServices = servicesForSystem(activeGroup.id, s.id).length;
          return (
            <div key={s.id} className="card card-pad">
              <div className="row between">
                <div className="row" style={{ gap: 8, minWidth: 0 }}>
                  <span style={{ fontSize: 18, flexShrink: 0 }}>🖥️</span>
                  <b>{s.name}</b>
                </div>
                <div className="row" style={{ gap: 2 }}>
                  <button className="btn-ghost btn-sm" title="Editar"
                    onClick={() => { setError(''); setEditing({ id: s.id, name: s.name, categoryId: s.categoryId || '' }); }}>✏️</button>
                  <button className="btn-ghost btn-sm btn-danger" title="Excluir" onClick={() => askDelete(s)}>🗑️</button>
                </div>
              </div>
              <div className="row wrap mt" style={{ gap: 6 }}>
                {cat
                  ? <span className="chip" style={{ borderColor: cat.color, color: cat.color }}>{cat.name}</span>
                  : <span className="muted small">Sem categoria</span>}
              </div>
              <div className="muted small mt">{nTickets} chamado(s) · {nServices} serviço(s)</div>
            </div>
          );
        })}
      </div>

      {editing && (
        <Modal
          title={editing.id ? 'Editar sistema' : 'Novo sistema'}
          onClose={() => setEditing(null)}
          footer={<>
            <button onClick={() => setEditing(null)}>Cancelar</button>
            <button className="btn-primary" onClick={save}>Salvar</button>
          </>}
        >
          {error && <div className="alert alert-error">{error}</div>}
          <div className="field">
            <label>Nome do sistema</label>
            <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              placeholder="Ex.: Siscam 9" autoFocus />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Categoria responsável</label>
            <select value={editing.categoryId} onChange={(e) => setEditing({ ...editing, categoryId: e.target.value })}>
              <option value="">— Nenhuma —</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <div className="hint">Define qual área de desenvolvimento cuida deste sistema.</div>
          </div>
        </Modal>
      )}

      {confirm && (
        <ConfirmModal
          title="Excluir sistema"
          danger
          message={<>Excluir o sistema <b>{confirm.system.name}</b>? {confirm.detail}</>}
          confirmLabel="Excluir"
          onCancel={() => setConfirm(null)}
          onConfirm={() => { deleteSystem(confirm.system.id, user); setConfirm(null); bump(); }}
        />
      )}
    </div>
  );
}
