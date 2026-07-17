import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/store';
import {
  categoriesForGroup, createCategory, updateCategory, deleteCategory, systemsForCategory,
} from '../lib/domain';
import { Modal, Empty, ConfirmModal } from '../components/ui';

export default function Categories() {
  const { user, activeGroup, refresh } = useAuth();
  const [, setLocal] = useState(0);
  const [editing, setEditing] = useState(null); // {id?, name}
  const [confirm, setConfirm] = useState(null);
  const [error, setError] = useState('');
  const bump = () => { refresh(); setLocal((n) => n + 1); };

  const categories = categoriesForGroup(activeGroup.id);

  const save = () => {
    setError('');
    try {
      if (editing.id) updateCategory(editing.id, { name: editing.name }, user);
      else createCategory(activeGroup.id, { name: editing.name }, user);
      setEditing(null); bump();
    } catch (err) { setError(err.message); }
  };

  const askDelete = (c) => {
    const tickets = db.filter('tickets', (t) => t.categoryId === c.id).length;
    const systems = systemsForCategory(c.id).length;
    setConfirm({
      category: c,
      detail: [
        tickets > 0 && `${tickets} chamado(s) ficarão sem categoria`,
        systems > 0 && `${systems} sistema(s) ficarão sem categoria`,
      ].filter(Boolean).join(' e ') || 'Nenhum registro depende dela.',
    });
  };

  return (
    <div>
      <div className="row between page-head">
        <div>
          <h1>Categorias de desenvolvedor</h1>
          <p className="muted">Áreas de atuação (Web, Desktop, Infra…). Classificam chamados e definem o que cada dev atende.</p>
        </div>
        <button className="btn-primary" onClick={() => { setError(''); setEditing({ name: '' }); }}>➕ Nova categoria</button>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
        {categories.length === 0 && <div className="card"><Empty>Nenhuma categoria. Crie a primeira.</Empty></div>}
        {categories.map((c) => {
          const count = db.filter('tickets', (t) => t.categoryId === c.id).length;
          const systems = systemsForCategory(c.id);
          return (
            <div key={c.id} className="card card-pad">
              <div className="row between">
                <div className="row" style={{ gap: 8, minWidth: 0 }}>
                  <span className="dot" style={{ background: c.color, width: 12, height: 12, flexShrink: 0 }} />
                  <b>{c.name}</b>
                </div>
                <div className="row" style={{ gap: 2 }}>
                  <button className="btn-ghost btn-sm" title="Editar" onClick={() => { setError(''); setEditing({ id: c.id, name: c.name }); }}>✏️</button>
                  <button className="btn-ghost btn-sm btn-danger" title="Excluir" onClick={() => askDelete(c)}>🗑️</button>
                </div>
              </div>

              <div className="muted small mt">Sistemas desta categoria:</div>
              <div className="row wrap" style={{ gap: 6, marginTop: 6 }}>
                {systems.length
                  ? systems.map((s) => <span key={s.id} className="chip">🖥️ {s.name}</span>)
                  : <span className="muted small">Nenhum — cadastre em <b>Sistemas</b>.</span>}
              </div>
              <div className="muted small mt">{count} chamado(s)</div>
            </div>
          );
        })}
      </div>

      {editing && (
        <Modal
          title={editing.id ? 'Editar categoria' : 'Nova categoria'}
          onClose={() => setEditing(null)}
          footer={<>
            <button onClick={() => setEditing(null)}>Cancelar</button>
            <button className="btn-primary" onClick={save}>Salvar</button>
          </>}
        >
          {error && <div className="alert alert-error">{error}</div>}
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Nome</label>
            <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              placeholder="Ex.: Desenvolvimento Web" autoFocus />
            <div className="hint">Os sistemas são vinculados à categoria na página <b>Sistemas</b>.</div>
          </div>
        </Modal>
      )}

      {confirm && (
        <ConfirmModal
          title="Excluir categoria"
          danger
          message={<>Excluir a categoria <b>{confirm.category.name}</b>? {confirm.detail}</>}
          confirmLabel="Excluir"
          onCancel={() => setConfirm(null)}
          onConfirm={() => { deleteCategory(confirm.category.id, user); setConfirm(null); bump(); }}
        />
      )}
    </div>
  );
}
