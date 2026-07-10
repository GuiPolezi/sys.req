import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { requesterRanking, citiesInGroup } from '../lib/domain';
import { Avatar, RoleBadge, Empty } from '../components/ui';

// RCS09 — usuários que mais criam solicitações, com filtro por cidade
export default function Ranking() {
  const { activeGroup } = useAuth();
  const [cidade, setCidade] = useState('');
  const cities = citiesInGroup(activeGroup.id);
  const ranking = requesterRanking(activeGroup.id, cidade);
  const max = ranking[0]?.count || 1;

  return (
    <div style={{ maxWidth: 760 }}>
      <div className="page-head">
        <h1>🏆 Ranking de solicitantes</h1>
        <p className="muted">Quem mais abre chamados no grupo. Filtre por cidade se quiser.</p>
      </div>

      <div className="card card-pad mb">
        <div className="field" style={{ marginBottom: 0, maxWidth: 260 }}>
          <label>Cidade</label>
          <select value={cidade} onChange={(e) => setCidade(e.target.value)}>
            <option value="">Todas as cidades</option>
            {cities.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div className="card">
        {ranking.length === 0 ? (
          <Empty>Nenhum chamado{cidade ? ` em ${cidade}` : ''} ainda.</Empty>
        ) : (
          ranking.map((r, i) => (
            <div key={r.user.id} className="ticket-row" style={{ cursor: 'default' }}>
              <div className="rank-pos">{i + 1}º</div>
              <Avatar name={r.user.name} size="sm" />
              <div style={{ flex: 1 }}>
                <div className="row" style={{ gap: 8 }}>
                  <b>{r.user.name}</b>
                  <RoleBadge role={r.user.role} />
                  {r.user.cidade && <span className="muted small">📍 {r.user.cidade}</span>}
                </div>
                <div className="progress" style={{ marginTop: 6 }}>
                  <div className="progress-fill" style={{ width: `${(r.count / max) * 100}%` }} />
                </div>
              </div>
              <b style={{ fontSize: 18 }}>{r.count}</b>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
