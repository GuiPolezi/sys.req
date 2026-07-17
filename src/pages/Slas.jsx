import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/store';
import {
  slasForGroup, createSla, updateSla, deleteSla, slaInfo, SLA_STATUS,
  categoriesForGroup, URGENCY,
} from '../lib/domain';
import { downloadCSV, fmtDate } from '../lib/report';
import { Modal, Empty, ConfirmModal, Badge, StatusBadge } from '../components/ui';

const EMPTY = { name: '', urgency: '', categoryId: '', responseHours: 4, resolutionHours: 24 };

// SLA — configuração de prazos e relatório de cumprimento por chamado.
export default function Slas() {
  const { user, activeGroup, refresh } = useAuth();
  const navigate = useNavigate();
  const [, setLocal] = useState(0);
  const [tab, setTab] = useState('config');
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [error, setError] = useState('');
  const bump = () => { refresh(); setLocal((n) => n + 1); };

  const slas = slasForGroup(activeGroup.id);
  const categories = categoriesForGroup(activeGroup.id);
  const set = (k) => (e) => setEditing({ ...editing, [k]: e.target.value });

  const save = () => {
    setError('');
    try {
      if (editing.id) updateSla(editing.id, editing, user);
      else createSla(activeGroup.id, editing, user);
      setEditing(null); bump();
    } catch (err) { setError(err.message); }
  };

  // relatório: todos os chamados com SLA aplicável
  const tickets = db.filter('tickets', (t) => t.groupId === activeGroup.id)
    .map((t) => ({ t, info: slaInfo(t) }))
    .filter((x) => x.info);

  const counts = tickets.reduce((acc, { info }) => {
    acc[info.status] = (acc[info.status] || 0) + 1;
    return acc;
  }, {});

  const exportCSV = () => {
    downloadCSV('sla', tickets.map(({ t, info }) => ({
      'Nº': t.number || '',
      'Título': t.title,
      'SLA': info.sla.name,
      'Criado em': fmtDate(t.createdAt),
      'Prazo de solução': fmtDate(info.deadline.toISOString()),
      'Situação': SLA_STATUS[info.status]?.label || info.status,
      'Status do chamado': t.status,
      'Responsável': t.assignedTo ? (db.byId('users', t.assignedTo)?.name || '') : '',
    })));
  };

  return (
    <div>
      <div className="row between wrap page-head" style={{ gap: 10 }}>
        <div>
          <h1>SLA</h1>
          <p className="muted">Prazos de atendimento por urgência (e categoria). Aplicados automaticamente aos chamados.</p>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn-sm" onClick={exportCSV}>Gerar relatório</button>
          <button className="btn-primary" onClick={() => { setError(''); setEditing({ ...EMPTY }); }}>Novo SLA</button>
        </div>
      </div>

      <div className="auth-tabs" style={{ maxWidth: 420 }}>
        <button className={tab === 'config' ? 'btn-primary' : ''} onClick={() => setTab('config')}>Configuração</button>
        <button className={tab === 'report' ? 'btn-primary' : ''} onClick={() => setTab('report')}>Acompanhamento ({tickets.length})</button>
      </div>

      {tab === 'config' && (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))' }}>
          {slas.length === 0 && <div className="card"><Empty>Nenhum SLA configurado. Os chamados ficam sem prazo.</Empty></div>}
          {slas.map((s) => {
            const cat = s.categoryId ? db.byId('categories', s.categoryId) : null;
            return (
              <div key={s.id} className="card card-pad">
                <div className="row between">
                  <b>{s.name}</b>
                  <div className="row" style={{ gap: 2 }}>
                    <button className="btn-ghost btn-sm" onClick={() => { setError(''); setEditing({ ...EMPTY, ...s, urgency: s.urgency || '', categoryId: s.categoryId || '' }); }}>Editar</button>
                    <button className="btn-ghost btn-sm btn-danger" onClick={() => setConfirm(s)}>Excluir</button>
                  </div>
                </div>
                <div className="row wrap mt" style={{ gap: 6 }}>
                  {s.urgency
                    ? <Badge color={URGENCY[s.urgency].color}>{URGENCY[s.urgency].label}</Badge>
                    : <span className="chip">Qualquer urgência</span>}
                  {cat && <span className="chip">{cat.name}</span>}
                </div>
                <div className="muted small mt">
                  1ª resposta: <b>{s.responseHours}h</b> · Solução: <b>{s.resolutionHours}h</b>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'report' && (
        <>
          <div className="stats mb">
            {['ok', 'risco', 'estourado', 'cumprido', 'violado'].map((k) => (
              <div key={k} className="stat">
                <div className="n" style={{ color: SLA_STATUS[k].color }}>{counts[k] || 0}</div>
                <div className="l">{SLA_STATUS[k].label}</div>
              </div>
            ))}
          </div>
          <div className="card">
            {tickets.length === 0 ? (
              <Empty>Nenhum chamado com SLA aplicável.</Empty>
            ) : (
              tickets
                .sort((a, b) => a.info.remainingMs - b.info.remainingMs)
                .map(({ t, info }) => (
                  <div key={t.id} className="ticket-row" onClick={() => navigate(`/tickets/${t.id}`)}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="t-title">#{t.number || ''} · {t.title}</div>
                      <div className="t-meta">
                        SLA {info.sla.name} · prazo {info.deadline.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <Badge color={SLA_STATUS[info.status].color}>{SLA_STATUS[info.status].label}</Badge>
                    <StatusBadge status={t.status} />
                  </div>
                ))
            )}
          </div>
        </>
      )}

      {editing && (
        <Modal title={editing.id ? 'Editar SLA' : 'Novo SLA'} onClose={() => setEditing(null)}
          footer={<>
            <button onClick={() => setEditing(null)}>Cancelar</button>
            <button className="btn-primary" onClick={save}>Salvar</button>
          </>}>
          {error && <div className="alert alert-error">{error}</div>}
          <div className="field">
            <label>Nome</label>
            <input value={editing.name} onChange={set('name')} placeholder="Ex.: Crítico" autoFocus />
          </div>
          <div className="row" style={{ gap: 10 }}>
            <div className="field" style={{ flex: 1 }}>
              <label>Urgência</label>
              <select value={editing.urgency} onChange={set('urgency')}>
                <option value="">Qualquer</option>
                {Object.entries(URGENCY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Categoria (opcional)</label>
              <select value={editing.categoryId} onChange={set('categoryId')}>
                <option value="">Qualquer</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div className="row" style={{ gap: 10 }}>
            <div className="field" style={{ flex: 1 }}>
              <label>1ª resposta (horas)</label>
              <input type="number" min="0" value={editing.responseHours} onChange={set('responseHours')} />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Solução (horas)</label>
              <input type="number" min="0" value={editing.resolutionHours} onChange={set('resolutionHours')} />
            </div>
          </div>
          <div className="hint">O chamado recebe o SLA mais específico: categoria + urgência → urgência → genérico.</div>
        </Modal>
      )}

      {confirm && (
        <ConfirmModal title="Excluir SLA" danger confirmLabel="Excluir"
          message={<>Excluir o SLA <b>{confirm.name}</b>? Chamados existentes deixam de exibir este prazo.</>}
          onCancel={() => setConfirm(null)}
          onConfirm={() => { deleteSla(confirm.id, user); setConfirm(null); bump(); }} />
      )}
    </div>
  );
}
