import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  createTicket, categoriesForGroup, servicesForSystem, systemsForGroup,
  groupMembers, isTech, URGENCY, TICKET_TYPES,
} from '../lib/domain';
import { db } from '../lib/store';
import RichText from '../components/RichText';

// Fluxo (v0.0.3): 1) sistema afetado → 2) serviço do sistema → 3) formulário
export default function NewTicket() {
  const { user, activeGroup, refresh } = useAuth();
  const navigate = useNavigate();
  const tech = isTech(user.role);

  const categories = categoriesForGroup(activeGroup.id);
  const systems = systemsForGroup(activeGroup.id);
  const techs = groupMembers(activeGroup).filter((m) => m.role !== 'solicitante');
  const requesters = groupMembers(activeGroup).filter((m) => m.role === 'solicitante');

  const [step, setStep] = useState(systems.length ? 'system' : 'service');
  const [systemId, setSystemId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [error, setError] = useState('');

  const [reqMode, setReqMode] = useState(requesters.length ? 'registered' : 'other');
  const [requesterId, setRequesterId] = useState(requesters[0]?.userId || '');
  const [requesterName, setRequesterName] = useState('');

  const [form, setForm] = useState({
    title: '', description: '', type: 'Solicitação',
    categoryId: '', urgency: 'media', cidade: user.cidade || '', assignTo: '',
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const services = servicesForSystem(activeGroup.id, systemId);

  const chooseSystem = (id) => {
    setSystemId(id);
    const sys = id ? db.byId('systems', id) : null;
    if (sys?.categoryId) setField('categoryId', sys.categoryId);
    setStep('service');
  };

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
      }));
    }
    setStep('form');
  };

  const selectedRequester = requesterId ? db.byId('users', requesterId) : null;
  const effectiveCidade = user.role === 'solicitante'
    ? user.cidade
    : (reqMode === 'registered' ? (selectedRequester?.cidade || '') : form.cidade);

  const submit = (e) => {
    e.preventDefault();
    setError('');
    if (!form.title.trim()) return setError('Informe um título.');

    const data = { ...form, systemId, cidade: effectiveCidade };
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

  const sysObj = systemId ? db.byId('systems', systemId) : null;
  const svcObj = serviceId ? db.byId('services', serviceId) : null;

  // ---------- Passo 1: sistema afetado ----------
  if (step === 'system') {
    return (
      <div>
        <div className="page-head">
          <h1>Abrir chamado</h1>
          <p className="muted">Passo 1 de 3 — qual <b>sistema</b> está com problema?</p>
        </div>
        <div className="choose-grid">
          {systems.map((s) => {
            const cat = s.categoryId ? db.byId('categories', s.categoryId) : null;
            const n = servicesForSystem(activeGroup.id, s.id).length;
            return (
              <button type="button" key={s.id} className="choose-card" onClick={() => chooseSystem(s.id)}>
                <div className="choose-ico">🖥️</div>
                <b>{s.name}</b>
                <span className="muted small">{cat ? `${cat.name} · ` : ''}{n} serviço(s)</span>
              </button>
            );
          })}
          <button type="button" className="choose-card" onClick={() => chooseSystem('')}>
            <div className="choose-ico">❓</div>
            <b>Não sei / outro</b>
            <span className="muted small">Seguir sem informar o sistema.</span>
          </button>
        </div>
      </div>
    );
  }

  // ---------- Passo 2: serviço ----------
  if (step === 'service') {
    return (
      <div style={{ maxWidth: 760 }}>
        <div className="row between page-head">
          <div>
            <h1>Abrir chamado</h1>
            <p className="muted">
              Passo 2 de 3 — escolha o <b>serviço</b>{sysObj ? <> para <b>{sysObj.name}</b></> : ''} ou siga como avulso.
            </p>
          </div>
          {systems.length > 0 && <button type="button" onClick={() => setStep('system')}>← Trocar sistema</button>}
        </div>
        <div className="choose-grid">
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
          <button type="button" className="choose-card" onClick={() => chooseService('')}>
            <div className="choose-ico">📝</div>
            <b>Chamado avulso</b>
            <span className="muted small">Preencher os campos manualmente.</span>
          </button>
        </div>
        {services.length === 0 && (
          <p className="muted small mt">
            Nenhum serviço cadastrado {sysObj ? `para ${sysObj.name}` : 'sem sistema'} — siga com o chamado avulso.
          </p>
        )}
      </div>
    );
  }

  // ---------- Passo 3: formulário ----------
  return (
    <div style={{ maxWidth: 720 }}>
      <div className="row between page-head">
        <div>
          <h1>Abrir chamado</h1>
          <p className="muted">
            Passo 3 de 3 · {sysObj ? <>🖥️ <b>{sysObj.name}</b></> : 'sem sistema'} · {svcObj ? <>🧩 <b>{svcObj.name}</b></> : 'chamado avulso'}
          </p>
        </div>
        <button type="button" onClick={() => setStep('service')}>← Voltar</button>
      </div>

      <form onSubmit={submit} className="card card-pad">
        {error && <div className="alert alert-error">{error}</div>}

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
                  {requesters.map((m) => (
                    <option key={m.userId} value={m.userId}>{m.user.name}{m.user.cidade ? ` — ${m.user.cidade}` : ''}</option>
                  ))}
                </select>
              ) : (
                <div className="hint">Nenhum solicitante cadastrado. Use “Não cadastrado”.</div>
              )
            ) : (
              <input value={requesterName} onChange={(e) => setRequesterName(e.target.value)} placeholder="Nome do solicitante" />
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
          <RichText value={form.description} onChange={(html) => setField('description', html)}
            placeholder="Descreva o problema. Você pode formatar o texto e inserir imagens." />
        </div>

        <div className="row" style={{ gap: 12 }}>
          <div className="field" style={{ flex: 1 }}>
            <label>Categoria</label>
            <select value={form.categoryId} onChange={set('categoryId')}>
              <option value="">— Sem categoria —</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Tipo</label>
            <select value={form.type} onChange={set('type')}>
              {TICKET_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <div className="row" style={{ gap: 12 }}>
          <div className="field" style={{ flex: 1 }}>
            <label>Urgência</label>
            <select value={form.urgency} onChange={set('urgency')}>
              {Object.entries(URGENCY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
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

        {tech && (
          <div className="field">
            <label>Técnico responsável</label>
            <select value={form.assignTo} onChange={set('assignTo')}>
              <option value="">
                {svcObj && (svcObj.assignMode === 'category' || svcObj.assignMode === 'user')
                  ? '— Usar a atribuição do serviço —'
                  : '— Sem atribuição (vai para o pool) —'}
              </option>
              {techs.map((m) => <option key={m.userId} value={m.userId}>{m.user.name} ({m.role})</option>)}
            </select>
            {svcObj?.assignMode === 'category' && (
              <div className="hint">O serviço distribui automaticamente para o dev da categoria com menos chamados.</div>
            )}
          </div>
        )}

        <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" onClick={() => navigate(-1)}>Cancelar</button>
          <button className="btn-primary">Criar chamado</button>
        </div>
      </form>
    </div>
  );
}
