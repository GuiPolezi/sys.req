import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/store';
import { categoriesForGroup, createCategory, deleteCategory } from '../lib/domain';
import { Modal, Empty } from '../components/ui';

export default function Categories() {
  const { user, activeGroup, refresh } = useAuth();
  const [, setLocal] = useState(0);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [systems, setSystems] = useState('');
  const bump = () => { refresh(); setLocal((n) => n + 1); };

  const categories = categoriesForGroup(activeGroup.id);

  const save = () => {
    if (!name.trim()) return;
    createCategory(activeGroup.id, { name, systems: systems.split(',') }, user);
    setName(''); setSystems(''); setOpen(false); bump();
  };

  const remove = (id) => {
    const count = db.filter('tickets', (t) => t.categoryId === id).length;
    if (count > 0 && !confirm(`Esta categoria tem ${count} chamado(s). Eles ficarão sem categoria. Excluir mesmo assim?`)) return;
    deleteCategory(id, user); bump();
  };

  return (
    <div>
      <div className="row between page-head">
        <div>
          <h1>Categorias de desenvolvedor</h1>
          <p className="muted">Definem áreas de atuação (Web, Desktop, Infra…). Classificam chamados e o que cada dev atende. RP14</p>
        </div>
        <button className="btn-primary" onClick={() => setOpen(true)}>➕ Nova categoria</button>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
        {categories.length === 0 && <div className="card"><Empty>Nenhuma categoria. Crie a primeira.</Empty></div>}
        {categories.map((c) => {
          const count = db.filter('tickets', (t) => t.categoryId === c.id).length;
          return (
            <div key={c.id} className="card card-pad">
              <div className="row between">
                <div className="row" style={{ gap: 8 }}>
                  <span className="dot" style={{ background: c.color, width: 12, height: 12 }} />
                  <b>{c.name}</b>
                </div>
                <button className="btn-ghost btn-sm btn-danger" onClick={() => remove(c.id)}>🗑️</button>
              </div>
              <div className="row wrap mt" style={{ gap: 6 }}>
                {c.systems.length ? c.systems.map((s) => <span key={s} className="chip">{s}</span>)
                  : <span className="muted small">Sem sistemas</span>}
              </div>
              <div className="muted small mt">{count} chamado(s)</div>
            </div>
          );
        })}
      </div>

      {open && (
        <Modal
          title="Nova categoria de serviço"
          onClose={() => setOpen(false)}
          footer={<>
            <button onClick={() => setOpen(false)}>Cancelar</button>
            <button className="btn-primary" onClick={save}>Salvar</button>
          </>}
        >
          <div className="field">
            <label>Nome</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Siscam" autoFocus />
          </div>
          <div className="field">
            <label>Sistemas (separados por vírgula)</label>
            <input value={systems} onChange={(e) => setSystems(e.target.value)} placeholder="Ex.: Siscam 8, Siscam 9" />
            <div className="hint">Aparecem como etiquetas no chamado.</div>
          </div>
        </Modal>
      )}
    </div>
  );
}
