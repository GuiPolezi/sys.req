import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  groupMembers, categoriesForGroup, updateMemberCategories, regenerateCode,
} from '../lib/domain';
import { RoleBadge, Avatar } from '../components/ui';

export default function Team() {
  const { activeGroup, refresh } = useAuth();
  const [, setLocal] = useState(0);
  const bump = () => { refresh(); setLocal((n) => n + 1); };

  const members = groupMembers(activeGroup);
  const categories = categoriesForGroup(activeGroup.id);

  const copy = (code) => { navigator.clipboard?.writeText(code); };

  const toggleCat = (userId, catId, current) => {
    const next = current.includes(catId) ? current.filter((c) => c !== catId) : [...current, catId];
    updateMemberCategories(activeGroup.id, userId, next);
    bump();
  };

  return (
    <div>
      <div className="page-head">
        <h1>Membros & convites</h1>
        <p className="muted">Compartilhe os códigos para técnicos e solicitantes entrarem no grupo.</p>
      </div>

      {/* ---- códigos de convite ---- */}
      <div className="grid mb" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="card card-pad">
          <h3>👨‍💻 Convite de técnicos</h3>
          <p className="muted small">Para suporte/devs entrarem no grupo.</p>
          <div className="row" style={{ gap: 8 }}>
            <span className="code-box">{activeGroup.techInviteCode}</span>
            <button className="btn-sm" onClick={() => copy(activeGroup.techInviteCode)}>Copiar</button>
            <button className="btn-sm" onClick={() => { regenerateCode(activeGroup.id, 'tech'); bump(); }}>↺ Gerar novo</button>
          </div>
        </div>
        <div className="card card-pad">
          <h3>🙋 Cadastro de solicitantes</h3>
          <p className="muted small">Solicitantes usam este código ao criar a conta.</p>
          <div className="row" style={{ gap: 8 }}>
            <span className="code-box">{activeGroup.requesterCode}</span>
            <button className="btn-sm" onClick={() => copy(activeGroup.requesterCode)}>Copiar</button>
            <button className="btn-sm" onClick={() => { regenerateCode(activeGroup.id, 'requester'); bump(); }}>↺ Gerar novo</button>
          </div>
        </div>
      </div>

      {/* ---- lista de membros ---- */}
      <h2>Membros ({members.length})</h2>
      <div className="card">
        {members.map((m) => (
          <div key={m.userId} className="ticket-row" style={{ cursor: 'default', alignItems: 'flex-start' }}>
            <Avatar name={m.user.name} />
            <div style={{ flex: 1 }}>
              <div className="row" style={{ gap: 8 }}>
                <b>{m.user.name}</b>
                <RoleBadge role={m.role} />
                {m.userId === activeGroup.ownerId && <span className="chip">dono</span>}
              </div>
              <div className="muted small">{m.user.email || m.user.login} · {m.user.cidade || 'sem cidade'}</div>

              {m.role === 'dev' && (
                <div className="mt">
                  <div className="muted small mb">Categorias que atende:</div>
                  <div className="row wrap" style={{ gap: 6 }}>
                    {categories.length === 0 && <span className="muted small">Crie categorias primeiro.</span>}
                    {categories.map((c) => {
                      const on = (m.categoryIds || []).includes(c.id);
                      return (
                        <button
                          key={c.id}
                          className={on ? 'btn-primary btn-sm' : 'btn-sm'}
                          onClick={() => toggleCat(m.userId, c.id, m.categoryIds || [])}
                        >
                          {on ? '✓ ' : ''}{c.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
