// Gráficos leves em SVG/flex, sem dependências externas.
import { useRef, useState, useEffect } from 'react';

// arredonda o topo do eixo Y para um número "redondo"
function niceCeil(v) {
  if (v <= 5) return Math.max(2, Math.ceil(v / 2) * 2);
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return nice * pow;
}

// Gráfico de ÁREA com linha e tooltip (crosshair) — ideal para série temporal.
export function AreaChart({ data, height = 220, color = 'var(--primary)' }) {
  const wrapRef = useRef(null);
  const [w, setW] = useState(680);
  const [hover, setHover] = useState(null);

  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const cw = entries[0].contentRect.width;
      if (cw) setW(cw);
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  const padL = 32, padR = 14, padT = 12, padB = 24;
  const H = height;
  const innerW = Math.max(1, w - padL - padR);
  const innerH = H - padT - padB;
  const n = data.length;
  const maxV = Math.max(1, ...data.map((d) => d.value));
  const niceMax = niceCeil(maxV);

  const x = (i) => padL + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v) => padT + innerH - (v / niceMax) * innerH;

  const linePts = data.map((d, i) => `${x(i)},${y(d.value)}`).join(' ');
  const areaPts = `${padL},${padT + innerH} ${linePts} ${padL + innerW},${padT + innerH}`;
  const ticks = [0, niceMax / 2, niceMax];
  const labelStep = Math.max(1, Math.ceil(n / 7));

  const onMove = (e) => {
    const rect = wrapRef.current.getBoundingClientRect();
    let idx = Math.round(((e.clientX - rect.left - padL) / innerW) * (n - 1));
    idx = Math.max(0, Math.min(n - 1, idx));
    setHover(idx);
  };

  const hv = hover != null ? data[hover] : null;
  const gid = `grad-${Math.round(innerW)}`; // id estável o suficiente por instância

  return (
    <div className="areachart" ref={wrapRef} style={{ position: 'relative' }} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
      <svg width={w} height={H} style={{ display: 'block' }}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.26" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={padL} x2={padL + innerW} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth="1" />
            <text x={padL - 7} y={y(t) + 3} textAnchor="end" fontSize="10" fill="var(--muted)">{Math.round(t)}</text>
          </g>
        ))}
        <polygon points={areaPts} fill={`url(#${gid})`} />
        <polyline points={linePts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {data.map((d, i) => ((i % labelStep === 0 || i === n - 1) && d.label ? (
          <text key={i} x={x(i)} y={H - 6} textAnchor="middle" fontSize="10" fill="var(--muted)">{d.label}</text>
        ) : null))}
        {hv && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={padT} y2={padT + innerH} stroke={color} strokeWidth="1" strokeDasharray="3 3" opacity="0.55" />
            <circle cx={x(hover)} cy={y(hv.value)} r="4.5" fill="var(--surface)" stroke={color} strokeWidth="2" />
          </g>
        )}
      </svg>
      {hv && (
        <div className="chart-tip" style={{ left: Math.min(Math.max(x(hover), 52), w - 52), top: Math.max(y(hv.value) - 14, 4) }}>
          <b>{hv.value}</b> {hv.value === 1 ? 'chamado' : 'chamados'}
          <div className="muted small">{hv.full}</div>
        </div>
      )}
    </div>
  );
}

// Gráfico de colunas (contagens discretas).
export function ColumnChart({ data, color = 'var(--primary)', height = 160 }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const gap = data.length > 45 ? 2 : data.length > 20 ? 4 : 6;
  return (
    <div className="colchart" style={{ height, gap }}>
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
