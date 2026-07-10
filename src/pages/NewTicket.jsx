import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  createTicket, categoriesForGroup, servicesForGroup, systemsForGroup,
  groupMembers, isTech, URGENCY, TICKET_TYPES,
} from '../lib/domain';
import { db } from '../lib/store';
import RichText from '../components/RichText';

export default function NewTicket() {
  const { user, activeGroup, refresh } = useAuth();
  const navigate = useNavigate();
  const tech = isTech(user.role);

  const categories = categoriesForGroup(activeGroup.id);
  const services = servicesForGroup(activeGroup.id);
  const systems = systemsForGroup(activeGroup.id);
  const techs = groupMembers(activeGroup).filter((m) => m.role !== 'solicitante');
  const requesters = groupMembers(activeGroup).filter((m) => m.role === 'solicitante');

  const [step, setStep] = useState('choose');       // 'choose' | 'form'
  const [serviceId, setServiceId] = useState('');
  const [error, setError] = useState('');

  // dados de quem solicita (só para técnico abrindo em nome de alguém)
  const [reqMode, setReqMode] = useState('registered'); // 'registered' | 'other'
  const [requesterId, setRequesterId] = useState(requesters[0]?.userId || '');
  const [requesterName, setRequesterName] = useState('');

  const [form, setForm] = useState({
    title: '', description: '', type: 'Solicitação',
    categoryId: '', systemId: '', urgency: 'media',
    cidade: user.cidade || '', assignTo: '',
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const chooseService = (id) => {
    setServiceId(id);
    const svc = id ? db.byId('services', id) : null;
    if (svc) {
      setForm((f) => ({
        ...f,
        title: svc.defaultTitle || f.title,
        type: svc.ticketType || f.type,
        categoryId: svc.categoryId || f.categoryId,
        urgency: svc.urgency || f.urgency,
        assignTo: svc.assignTo || f.assignTo,
      }));
    }
    setStep('form');
  };

  // cidade preenchida automaticamente conforme o solicitante escolhido
  const selectedRequester = requesterId ? db.byId('users', requesterId) : null;
  const effectiveCidade = user.role === 'solicitante'
    ? user.cidade
    : (reqMode === 'registered' ? (selectedRequester?.cidade || '') : form.cidade);

  const submit = (e) => {
    e.preventDefault();
    setError('');
    if (!form.title.trim()) return setError('Informe um título.');

    const data = { ...form, cidade: effectiveCidade };
    if (tech) {
      if (reqMode === 'registered') {
        if (!requesterId) return setError('Selecione o solicitante do chamado.');
        data.requesterId = requesterId;
      } else {
        if (!requesterName.trim()) return setError('Informe o nome do solicitante.');
        data.requesterName = requesterName.trim();
        data.requesterId = null;
      }
    }
    const t = createTicket(activeGroup.id, data, user, serviceId || null);
    refresh();
    navigate(`/tickets/${t.id}`);
  };

  // ---------- Passo 1: escolher serviço ou avulso ----------
  if (step === 'choose') {
    return (
      <div style={{ maxWidth: 720 }}>
        <div className="page-head">
          <h1>Abrir chamado</h1>
          <p className="muted">Comece por um serviço padronizado ou abra um chamado avulso.</p>
        </div>

        <div className="choose-grid">
          <button type="button" className="choose-card" onClick={() => chooseService('')}>
            <div className="choose-ico">📝</div>
            <b>Chamado avulso</b>
            <span className="muted small">Preencha os campos manualmente.</span>
          </button>
          {services.map((s) => {
            const cat = s.categoryId ? db.byId('categories', s.categoryId) : null;
            return (
              <button type="button" key={s.id} className="choose-card" onClick={() => chooseService(s.id)}>
                <div className="choose-ico">🧩</div>
                <b>{s.name}</b>
                <span className="muted small">{s.ticketType}{cat ? ` · ${cat.name}` : ''}</span>
              </button>
            );
          })}
        </div>
        {services.length === 0 && (
          <p className="muted small mt">Nenhum serviço cadastrado ainda — use o chamado avulso.</p>
        )}
      </div>
    );
  }

  // ---------- Passo 2: formulário ----------
  const svc = serviceId ? db.byId('services', serviceId) : null;
  return (
    <div style={{ maxWidth: 720 }}>
      <div className="row between page-head">
        <div>
          <h1>Abrir chamado</h1>
          <p className="muted">{svc ? <>Serviço: <b>{svc.name}</b></> : 'Chamado avulso'}</p>
        </div>
        <button type="button" onClick={() => setStep('choose')}>← Trocar</button>
      </div>

      <form onSubmit={submit} className="card card-pad">
        {error && <div className="alert alert-error">{error}</div>}

        {/* solicitante (só técnico) */}
        {tech && (
          <div className="field">
            <label>Solicitante do chamado</label>
            <div className="row" style={{ gap: 8, marginBottom: 8 }}>
              <button type="button" className={reqMode === 'registered' ? 'btn-primary btn-sm' : 'btn-sm'} onClick={() => setReqMode('registered')}>Cadastrado</button>
              <button type="button" className={reqMode === 'other' ? 'btn-primary btn-sm' : 'btn-sm'} onClick={() => setReqMode('other')}>Não cadastrado</button>
            </div>
            {reqMode === 'registered' ? (
              requesters.length ? (
                <select value={requesterId} onChange={(e) => setRequesterId(e.target.value)}>
                  {requesters.map((m) => <option key={m.userId} value={m.userId}>{m.user.name}{m.user.cidade ? ` — ${m.user.cidade}` : ''}</option>)}
                </select>
              ) : (
                <div className="hint">Nenhum solicitante cadastrado no grupo. Use “Não cadastrado”.</div>
              )
            ) : (
              <input value={requesterName} onChange={(e) => setRequesterName(e.target.value)} placeholder="Nome do solicitante (ex.: Cliente da Prefeitura X)" />
            )}
            <div className="hint">Você está registrando este chamado em nome deste solicitante.</div>
          </div>
        )}

        <div className="field">
          <label>Título *</label>
          <input value={form.title} onChange={set('title')} placeholder="Resumo do problema" autoFocus />
        </div>

        <div className="field">
          <label>Descrição</label>
          <RichText value={form.description} onChange={(html) => setField('description', html)} placeholder="Descreva o problema. Você pode formatar o texto e inserir imagens." />
        </div>

        <div className="row" style={{ gap: 12 }}>
          <div className="field" style={{ flex: 1 }}>
            <label>Sistema afetado</label>
            <select value={form.systemId} onChange={set('systemId')}>
              <option value="">— Nenhum —</option>
              {systems.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Categoria</label>
            <select value={form.categoryId} onChange={set('categoryId')}>
              <option value="">— Sem categoria —</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>

        <div className="row" style={{ gap: 12 }}>
          <div className="field" style={{ flex: 1 }}>
            <label>Tipo</label>
            <select value={form.type} onChange={set('type')}>
              {TICKET_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Urgência</label>
            <select value={form.urgency} onChange={set('urgency')}>
              {Object.entries(URGENCY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
        </div>

        <div className="row" style={{ gap: 12 }}>
          {/* técnico responsável (só técnico) */}
          {tech && (
            <div className="field" style={{ flex: 1 }}>
              <label>Técnico responsável</label>
              <select value={form.assignTo} onChange={set('assignTo')}>
                <option value="">— Sem atribuição (vai para o pool) —</option>
                {techs.map((m) => <option key={m.userId} value={m.userId}>{m.user.name} ({m.role})</option>)}
              </select>
            </div>
          )}
          <div className="field" style={{ flex: 1 }}>
            <label>Cidade</label>
            <input
              value={effectiveCidade}
              onChange={set('cidade')}
              readOnly={user.role === 'solicitante' || (tech && reqMode === 'registered')}
              placeholder="Cidade do solicitante"
            />
            {user.role === 'solicitante' && <div className="hint">Vinculada ao seu cadastro.</div>}
          </div>
        </div>

        <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" onClick={() => navigate(-1)}>Cancelar</button>
          <button className="btn-primary">Criar chamado</button>
        </div>
      </form>
    </div>
  );
}
