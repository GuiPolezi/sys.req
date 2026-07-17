import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { requesterRanking, citiesInGroup } from '../lib/domain';
import { Avatar, Empty } from '../components/ui';

const MEDALS = ['🥇', '🥈', '🥉'];

// RCS09 — ranking de SOLICITANTES que mais abrem chamados, com filtro por cidade.
export default function Ranking() {
  const { activeGroup } = useAuth();
  const [cidade, setCidade] = useState('');
  const cities = citiesInGroup(activeGroup.id);
  const ranking = requesterRanking(activeGroup.id, cidade);
  const max = ranking[0]?.count || 1;
  const total = ranking.reduce((s, r) => s + r.count, 0);
  const top = ranking.slice(0, 3);
  const rest = ranking.slice(3);

  return (
    <div>
      <div className="page-head">
        <h1>🏆 Ranking de solicitantes</h1>
        <p className="muted">Quem mais abre chamados no grupo. Técnicos não entram na contagem.</p>
      </div>

      {/* resumo + filtro */}
      <div className="row between wrap mb" style={{ gap: 12 }}>
        <div className="row" style={{ gap: 12 }}>
          <div className="stat" style={{ minWidth: 130 }}>
            <div className="n">{total}</div><div className="l">Chamados</div>
          </div>
          <div className="stat" style={{ minWidth: 130 }}>
            <div className="n">{ranking.length}</div><div className="l">Solicitantes</div>
          </div>
        </div>
        <div className="field" style={{ marginBottom: 0, minWidth: 220 }}>
          <label>Filtrar por cidade</label>
          <select value={cidade} onChange={(e) => setCidade(e.target.value)}>
            <option value="">Todas as cidades</option>
            {cities.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {ranking.length === 0 ? (
        <div className="card"><Empty>Nenhum chamado{cidade ? ` em ${cidade}` : ''} ainda.</Empty></div>
      ) : (
        <>
          {/* pódio — top 3 */}
          {top.length >= 2 && (
            <div className="podium mb">
              {top.map((r, i) => (
                <div key={r.user.id} className={`podium-card p${i}`}>
                  <div className="podium-medal">{MEDALS[i]}</div>
                  <Avatar name={r.user.name} />
                  <b style={{ marginTop: 6 }}>{r.user.name}</b>
                  {r.user.cidade && <span className="muted small">📍 {r.user.cidade}</span>}
                  <div className="podium-count">{r.count}</div>
                  <span className="muted small">chamados</span>
                </div>
              ))}
            </div>
          )}

          {/* barras — lista completa */}
          <div className="card card-pad">
            <h3>Classificação completa</h3>
            <div className="col" style={{ gap: 12, marginTop: 10 }}>
              {ranking.map((r, i) => (
                <div key={r.user.id} className="row" style={{ gap: 12 }}>
                  <span className="rank-pos">{i < 3 ? MEDALS[i] : `${i + 1}º`}</span>
                  <Avatar name={r.user.name} size="sm" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="row between" style={{ gap: 8 }}>
                      <b className="small" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {r.user.name}{r.user.cidade ? ` · ${r.user.cidade}` : ''}
                      </b>
                      <b className="small">{r.count}</b>
                    </div>
                    <div className="progress"><div className="progress-fill" style={{ width: `${(r.count / max) * 100}%` }} /></div>
                  </div>
                </div>
              ))}
            </div>
            {rest.length === 0 && ranking.length <= 3 && (
              <p className="muted small mt">Poucos solicitantes até agora.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
