// Gráficos leves em SVG/flex, sem dependências externas.

// Gráfico de colunas (série temporal / contagens).
export function ColumnChart({ data, color = 'var(--primary)', height = 160 }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="colchart" style={{ height }}>
      {data.map((d, i) => (
        <div key={i} className="colchart-col" title={`${d.full || d.label}: ${d.value}`}>
          <div className="colchart-track">
            <div className="colchart-bar" style={{ height: `${(d.value / max) * 100}%`, background: color }}>
              {d.value > 0 && <span className="colchart-val">{d.value}</span>}
            </div>
          </div>
          <div className="colchart-label">{d.label}</div>
        </div>
      ))}
    </div>
  );
}

// Barras horizontais coloridas (por status / urgência / categoria).
export function BarList({ items, empty = 'Sem dados.' }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (items.every((i) => i.value === 0)) return <p className="muted small">{empty}</p>;
  return (
    <div className="col" style={{ gap: 11 }}>
      {items.map((it) => (
        <div key={it.key} className="row" style={{ gap: 10 }}>
          <span className="small" style={{ width: 116, flexShrink: 0, color: 'var(--text-soft)' }}>{it.label}</span>
          <div className="progress" style={{ flex: 1, height: 10 }}>
            <div className="progress-fill" style={{ width: `${(it.value / max) * 100}%`, background: it.color || 'var(--primary)' }} />
          </div>
          <b className="small" style={{ width: 26, textAlign: 'right' }}>{it.value}</b>
        </div>
      ))}
    </div>
  );
}

// Rosca (donut) para distribuição — ex.: status dos chamados.
export function Donut({ segments, size = 150, thickness = 20 }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const cx = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={thickness} />
      <g transform={`rotate(-90 ${cx} ${cx})`}>
        {total > 0 && segments.filter((s) => s.value > 0).map((s) => {
          const len = (s.value / total) * c;
          const el = (
            <circle key={s.key} cx={cx} cy={cx} r={r} fill="none"
              stroke={s.color} strokeWidth={thickness}
              strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset} strokeLinecap="butt" />
          );
          offset += len;
          return el;
        })}
      </g>
      <text x={cx} y={cx - 4} textAnchor="middle" style={{ fontSize: 26, fontWeight: 700, fill: 'var(--text)', fontFamily: 'var(--font-serif)' }}>{total}</text>
      <text x={cx} y={cx + 16} textAnchor="middle" style={{ fontSize: 11, fill: 'var(--muted)' }}>chamados</text>
    </svg>
  );
}
