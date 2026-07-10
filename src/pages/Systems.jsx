import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/store';
import { systemsForGroup, createSystem, deleteSystem, categoriesForGroup } from '../lib/domain';
import { Modal, Empty } from '../components/ui';

// Sistemas do grupo — selecionáveis no chamado para identificar o que está com problema.
export default function Systems() {
  const { user, activeGroup, refresh } = useAuth();
  const [, setLocal] = useState(0);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', categoryId: '' });
  const bump = () => { refresh(); setLocal((n) => n + 1); };

  const systems = systemsForGroup(activeGroup.id);
  const categories = categoriesForGroup(activeGroup.id);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = () => {
    if (!form.name.trim()) return;
    createSystem(activeGroup.id, form, user);
    setForm({ name: '', categoryId: '' }); setOpen(false); bump();
  };

  const remove = (id) => {
    const count = db.filter('tickets', (t) => t.systemId === id).length;
    if (count > 0 && !confirm(`${count} chamado(s) usam este sistema. Eles ficarão sem sistema. Remover mesmo assim?`)) return;
    deleteSystem(id, user); bump();
  };

  return (
    <div>
      <div className="row between page-head">
        <div>
          <h1>Sistemas do grupo</h1>
          <p className="muted">Cadastre os sistemas atendidos. Aparecem na abertura do chamado para identificar o que está com problema.</p>
        </div>
        <button className="btn-primary" onClick={() => setOpen(true)}>➕ Novo sistema</button>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
        {systems.length === 0 && <div className="card"><Empty>Nenhum sistema cadastrado.</Empty></div>}
        {systems.map((s) => {
          const cat = s.categoryId ? db.byId('categories', s.categoryId) : null;
          const count = db.filter('tickets', (t) => t.systemId === s.id).length;
          return (
            <div key={s.id} className="card card-pad">
              <div className="row between">
                <div className="row" style={{ gap: 8 }}>
                  <span style={{ fontSize: 18 }}>🖥️</span>
                  <b>{s.name}</b>
                </div>
                <button className="btn-ghost btn-sm btn-danger" onClick={() => remove(s.id)}>🗑️</button>
              </div>
              <div className="row wrap mt" style={{ gap: 6 }}>
                {cat ? <span className="chip" style={{ borderColor: cat.color, color: cat.color }}>{cat.name}</span> : <span className="muted small">Sem categoria</span>}
              </div>
              <div className="muted small mt">{count} chamado(s)</div>
            </div>
          );
        })}
      </div>

      {open && (
        <Modal title="Novo sistema" onClose={() => setOpen(false)}
          footer={<><button onClick={() => setOpen(false)}>Cancelar</button><button className="btn-primary" onClick={save}>Salvar</button></>}>
          <div className="field"><label>Nome do sistema</label><input value={form.name} onChange={set('name')} placeholder="Ex.: Siscam 9" autoFocus /></div>
          <div className="field">
            <label>Categoria responsável (opcional)</label>
            <select value={form.categoryId} onChange={set('categoryId')}>
              <option value="">— Nenhuma —</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <div className="hint">Vincula o sistema a uma área de desenvolvimento.</div>
          </div>
        </Modal>
      )}
    </div>
  );
}
