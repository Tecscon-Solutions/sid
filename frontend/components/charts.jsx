/* Charts v2 — comprehensive, multi-period ready */

/* ===== DONUT ===== */
function ActionDonut({ data, mode = 'predicted' }) {
  const act = (d) => fcAction(d, mode);
  const deliver = data.filter(d => act(d) === 'Deliver').length;
  const ret = data.filter(d => act(d) === 'Return').length;
  const nc = data.filter(d => act(d) === 'No Change').length;
  const total = data.length || 1;
  const [hov, setHov] = React.useState(null);
  const segs = [
    { label: 'Deliver', count: deliver, color: '#059669', pct: deliver / total },
    { label: 'Return', count: ret, color: '#DC2626', pct: ret / total },
    { label: 'No Change', count: nc, color: '#D97706', pct: nc / total },
  ];
  const r = 56, cx = 72, cy = 72, sw = 17, circ = 2 * Math.PI * r;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
      <svg width={144} height={144} viewBox="0 0 144 144" style={{ flexShrink: 0 }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#F3F4F6" strokeWidth={sw} />
        {(() => { let acc = 0; return segs.map((s, i) => { const start = acc; acc += s.pct; if (s.pct < .005) return null; const len = s.pct * circ - 2; return <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={s.color} strokeWidth={hov === i ? sw + 5 : sw} strokeLinecap="round" strokeDasharray={`${len} ${circ - len}`} strokeDashoffset={-(start * circ)} style={{ transition: 'stroke-width .2s, opacity .2s', cursor: 'pointer', opacity: hov != null && hov !== i ? .65 : 1, transform: 'rotate(-90deg)', transformOrigin: `${cx}px ${cy}px` }} onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)} />; }); })()}
        <text x={cx} y={cy - 1} textAnchor="middle" dominantBaseline="central" fill="var(--text)" fontSize="24" fontWeight="800" fontFamily="var(--mono)">{total}</text>
        <text x={cx} y={cy + 15} textAnchor="middle" fill="var(--text-3)" fontSize="9">items</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {segs.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9, opacity: hov != null && hov !== i ? .65 : 1, transition: 'opacity .15s', cursor: 'pointer' }}
            onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)}>
            <div style={{ width: 11, height: 11, borderRadius: 3, background: s.color }}></div>
            <div><div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 500 }}>{s.label}</div><div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--mono)' }}>{s.count} <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 400 }}>({Math.round(s.pct * 100)}%)</span></div></div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ===== TOP N HORIZONTAL BARS ===== */
function TopItemsBar({ data, action, maxItems = 15, color, mode = 'predicted' }) {
  const items = data.filter(d => fcAction(d, mode) === action)
    .map(d => ({ ...d, _q: fcQty(d, mode) }))
    .sort((a, b) => b._q - a._q).slice(0, maxItems);
  const maxQ = items.length ? (items[0]._q || 1) : 1;
  const [hIdx, setHIdx] = React.useState(null);
  if (!items.length) return <div style={{ padding: 24, color: 'var(--text-3)', fontSize: 13, textAlign: 'center' }}>No {action.toLowerCase()} items</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {items.map((item, i) => (
        <div key={item.itemCode + i} style={{ display: 'flex', alignItems: 'center', gap: 0, opacity: hIdx != null && hIdx !== i ? .65 : 1, transition: 'opacity .12s', height: 26, cursor: 'default' }}
          onMouseEnter={() => setHIdx(i)} onMouseLeave={() => setHIdx(null)}>
          <div style={{ width: 130, fontSize: 11, color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 450, paddingRight: 8, textAlign: 'right', flexShrink: 0 }} title={item.description}>{item.description}</div>
          <div style={{ flex: 1, height: 18, borderRadius: 4, background: '#F3F4F6', overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 4, width: `${(item._q || 0) / maxQ * 100}%`, background: color, transition: 'width .4s ease' }}></div>
          </div>
          <div style={{ width: 54, fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text)', textAlign: 'right', fontWeight: 600, paddingLeft: 6, flexShrink: 0 }}>{Math.round(item._q || 0).toLocaleString()}</div>
        </div>
      ))}
    </div>
  );
}

/* ===== HV vs STANDARD STACKED BAR ===== */
function HVBreakdown({ data, allData, mode = 'predicted' }) {
  // Dormant = the Dormant Items page's list (a year or more with no movement or
  // an unchanged count, from the full actual history). It is an extra bar: a
  // dormant item is also counted in its High Value or Standard bar.
  const dormantCodes = React.useMemo(() => {
    let latest = null;
    (allData || []).forEach(d => { if (d.actualClosingBal != null && (!latest || d.period > latest)) latest = d.period; });
    if (!latest || !window.computeDormantRuns) return null;
    const r = window.computeDormantRuns(allData, latest);
    return new Set([...r.zeroTxn, ...r.constCount].map(x => x.code));
  }, [allData]);
  const groups = [{ label: 'High Value', items: data.filter(d => d.isHV) }, { label: 'Standard', items: data.filter(d => !d.isHV) }];
  if (dormantCodes) groups.push({ label: 'Dormant', items: data.filter(d => dormantCodes.has(d.itemCode)) });
  const actions = ['Deliver', 'No Change', 'Return'];
  const colors = { Deliver: '#059669', 'No Change': '#D97706', Return: '#DC2626' };
  const maxStack = Math.max(...groups.map(g => g.items.length), 1);
  const barW = 72, chartH = 130, padL = 44, padT = 8, padB = 28;
  const svgW = padL + groups.length * (barW + 40) + 20, svgH = padT + chartH + padB;

  return (
    <div>
      <svg width="100%" height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} style={{ overflow: 'visible' }}>
        {[0, .5, 1].map((p, i) => { const y = padT + chartH - chartH * p; return <g key={i}><line x1={padL - 4} y1={y} x2={svgW - 10} y2={y} stroke="#F3F4F6" /><text x={padL - 8} y={y + 3.5} textAnchor="end" fontSize="9" fill="var(--text-3)" fontFamily="var(--mono)">{Math.round(maxStack * p)}</text></g>; })}
        {groups.map((g, gi) => {
          const counts = actions.map(a => g.items.filter(d => fcAction(d, mode) === a).length);
          let y = padT + chartH;
          const x = padL + 10 + gi * (barW + 50);
          // Decide which side the small-count callout lives on (outside the chart)
          const calloutSide = gi === 0 ? 'left' : 'right';
          return (
            <g key={gi}>
              {counts.map((c, ci) => {
                if (c === 0) return null;
                const trueH = (c / maxStack) * chartH;
                // Force a minimum visible height so tiny slivers (e.g. 9 of 460) are still discernible
                const h = Math.max(trueH, 4);
                y -= h;
                const yMid = y + h / 2;
                const showInside = h > 16;
                const calloutX = calloutSide === 'right' ? x + barW + 6 : x - 6;
                const calloutAnchor = calloutSide === 'right' ? 'start' : 'end';
                const lineX1 = calloutSide === 'right' ? x + barW : x - 5;
                const lineX2 = calloutSide === 'right' ? x + barW + 4 : x;
                return (
                  <g key={ci}>
                    <rect x={x} y={y} width={barW} height={h} rx={ci === 2 ? 5 : 0} fill={colors[actions[ci]]} opacity={.85} />
                    {showInside ? (
                      <text x={x + barW / 2} y={yMid + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff" fontFamily="var(--mono)">{c}</text>
                    ) : (
                      <g>
                        <line x1={lineX1} y1={yMid} x2={lineX2} y2={yMid} stroke={colors[actions[ci]]} strokeWidth={1} />
                        <text x={calloutX} y={yMid + 3.5} textAnchor={calloutAnchor} fontSize="10" fontWeight="700" fill="var(--text)" fontFamily="var(--mono)">{c}</text>
                      </g>
                    )}
                  </g>
                );
              })}
              <text x={x + barW / 2} y={padT + chartH + 16} textAnchor="middle" fontSize="11" fill="var(--text-2)" fontWeight="500">{g.label}</text>
            </g>
          );
        })}
      </svg>
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 2 }}>
        {actions.map(a => <div key={a} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-2)' }}><div style={{ width: 10, height: 10, borderRadius: 3, background: colors[a] }}></div>{a}</div>)}
      </div>
    </div>
  );
}

/* ===== CLOSING BALANCE PORTFOLIO ===== */
function ClosingBalancePortfolio({ data, mode = 'predicted' }) {
  const isActual = mode === 'actual';
  const prev = data.reduce((s, d) => s + (d.prevClosingBal || 0), 0);
  const cur = data.reduce((s, d) => s + (fcBal(d, mode) || 0), 0);
  const max = Math.max(prev, cur, 1);
  const fmtK = v => v >= 1e6 ? (v/1e6).toFixed(1)+'M' : v >= 1e3 ? Math.round(v/1e3)+'K' : Math.round(v);
  const w = 420, h = 110;
  const curLabel = isActual ? 'Actual Closing' : 'Predicted Closing';
  const curColor = isActual ? '#F59E0B' : 'var(--accent)';
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 10 }}>Aggregate previous vs {isActual ? 'actual' : 'predicted'} closing balance for all filtered items.</div>
      <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`}>
        <text x={8} y={14} fontSize="10" fill="var(--text-3)" fontWeight="500">Previous Closing</text>
        <rect x={8} y={20} width={(prev/max)*(w-100)} height={32} rx={6} fill="#D1D5DB" />
        <text x={(prev/max)*(w-100)+16} y={42} fontSize="14" fontWeight="700" fill="var(--text-2)" fontFamily="var(--mono)">{fmtK(prev)}</text>
        <text x={8} y={72} fontSize="10" fill="var(--text-3)" fontWeight="500">{curLabel}</text>
        <rect x={8} y={78} width={(cur/max)*(w-100)} height={32} rx={6} fill={curColor} opacity=".75" />
        <text x={(cur/max)*(w-100)+16} y={100} fontSize="14" fontWeight="700" fill={curColor} fontFamily="var(--mono)">{fmtK(cur)}</text>
      </svg>
    </div>
  );
}


/* ===== ACTION FLOW BETWEEN PERIODS ===== */
function ActionFlowSankey({ janData, febData, fromPeriod, toPeriod, mode = 'predicted' }) {
  const janMap = {};
  janData.forEach(d => { janMap[d.itemCode] = fcAction(d, mode); });

  const actions = ['Deliver', 'Return', 'No Change'];
  const colors  = { Deliver: '#059669', Return: '#DC2626', 'No Change': '#D97706' };
  const bgLight  = { Deliver: 'rgba(5,150,105,.07)', Return: 'rgba(220,38,38,.06)', 'No Change': 'rgba(217,119,6,.07)' };
  const fmtP = p => { if (!p) return ''; const [y, m] = p.split('-'); const ns = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']; return `${ns[parseInt(m)-1]} ${y}`; };

  // Build one group per "from" action: total + breakdown of where they went
  const groups = actions.map(from => {
    const total = janData.filter(d => fcAction(d, mode) === from).length;
    const breakdown = actions.map(to => ({
      to,
      count: febData.filter(d => janMap[d.itemCode] === from && fcAction(d, mode) === to).length,
      stayed: from === to,
    }));
    return { from, total, breakdown };
  }).filter(g => g.total > 0);

  const maxTotal = Math.max(...groups.map(g => g.total), 1);
  const totalChanged = groups.reduce((s, g) => s + g.breakdown.filter(b => !b.stayed).reduce((ss, b) => ss + b.count, 0), 0);
  const totalItems = groups.reduce((s, g) => s + g.total, 0);

  const fromLabel = fmtP(fromPeriod) || 'From';
  const toLabel   = fmtP(toPeriod)   || 'To';

  return (
    <div>
      {/* Summary line */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
          Items in <strong style={{ color: 'var(--text-2)' }}>{fromLabel}</strong> and where their forecast action moved to in <strong style={{ color: 'var(--text-2)' }}>{toLabel}</strong>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 12 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'var(--mono)', color: totalChanged > 0 ? '#D97706' : '#059669', lineHeight: 1 }}>{totalChanged}</div>
            <div style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 600 }}>changed action</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'var(--mono)', color: 'var(--text)', lineHeight: 1 }}>{totalItems - totalChanged}</div>
            <div style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 600 }}>stayed same</div>
          </div>
        </div>
      </div>

      {/* Column headers */}
      <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: 12, marginBottom: 6, paddingLeft: 4 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.05em' }}>In {fromLabel}</div>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Moved to in {toLabel}</div>
      </div>

      {/* One row per "from" action */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {groups.map(g => {
          const stayedCount   = g.breakdown.find(b => b.stayed)?.count || 0;
          const changedCount  = g.total - stayedCount;
          const changedParts  = g.breakdown.filter(b => !b.stayed && b.count > 0);
          return (
            <div key={g.from} style={{ background: bgLight[g.from], borderRadius: 10, padding: '12px 14px', border: `1px solid ${colors[g.from]}22` }}>
              {/* Row header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: colors[g.from], minWidth: 80 }}>{g.from}</span>
                <span style={{ fontSize: 12, color: 'var(--text-2)', fontFamily: 'var(--mono)', fontWeight: 600 }}>{g.total} items</span>
                {changedCount > 0
                  ? <span style={{ fontSize: 11, color: '#D97706', fontWeight: 600, background: 'rgba(217,119,6,.1)', padding: '2px 8px', borderRadius: 5 }}>⇌ {changedCount} changed</span>
                  : <span style={{ fontSize: 11, color: '#059669', fontWeight: 600, background: 'rgba(5,150,105,.1)', padding: '2px 8px', borderRadius: 5 }}>✓ all stayed</span>}
              </div>

              {/* Stacked proportion bar */}
              <div style={{ display: 'flex', height: 30, borderRadius: 6, overflow: 'hidden', width: `${(g.total / maxTotal) * 100}%`, minWidth: 60, marginBottom: 8 }}>
                {g.breakdown.filter(b => b.count > 0).map(b => {
                  const pct = (b.count / g.total) * 100;
                  return (
                    <div key={b.to} title={`${b.count} items → ${b.to}`}
                      style={{ width: `${pct}%`, background: colors[b.to], opacity: b.stayed ? 0.9 : 0.65,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        borderLeft: b.stayed ? 'none' : '2px solid rgba(255,255,255,0.4)',
                        transition: 'width .3s' }}>
                      {pct >= 6 && <span style={{ fontSize: 11, fontWeight: 800, color: '#fff', fontFamily: 'var(--mono)' }}>{b.count}</span>}
                    </div>
                  );
                })}
              </div>

              {/* Breakdown pills */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {g.breakdown.filter(b => b.count > 0).map(b => (
                  <span key={b.to} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600,
                    color: colors[b.to], background: '#fff', border: `1px solid ${colors[b.to]}33`,
                    padding: '3px 9px', borderRadius: 20 }}>
                    {b.stayed
                      ? <span title="Same action as before">↺ Stayed {b.to}</span>
                      : <span>→ {b.to}</span>}
                    <span style={{ fontFamily: 'var(--mono)', fontWeight: 800 }}>{b.count}</span>
                    <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>({Math.round(b.count / g.total * 100)}%)</span>
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ===== BALANCE SCATTER ===== */
function BalanceScatter({ data }) {
  const items = data.filter(d => d.prevClosingBal != null && d.predictedClosingBal != null && (d.prevClosingBal > 0 || d.predictedClosingBal > 0));
  const maxVal = Math.max(...items.map(d => Math.max(d.prevClosingBal, d.predictedClosingBal)), 100);
  const w = 760, h = 360, pad = 50;
  const [hd, setHd] = React.useState(null);
  const ac = (a) => a === 'Deliver' ? '#059669' : a === 'Return' ? '#DC2626' : '#D97706';
  return (
    <div style={{ position: 'relative' }}>
      <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 8 }}>Each dot = one item. Above diagonal = balance increase (deliver). Below = decrease (return).</div>
      <svg width="100%" height={h + 20} viewBox={`0 0 ${w + 20} ${h + 20}`}>
        <line x1={pad} y1={10} x2={pad} y2={h - 4} stroke="#E5E7EB" /><line x1={pad} y1={h - 4} x2={w + 10} y2={h - 4} stroke="#E5E7EB" />
        <line x1={pad} y1={h - 4} x2={w - 10} y2={14} stroke="#E5E7EB" strokeDasharray="4,4" />
        <text x={w / 2 + pad / 2} y={h + 16} textAnchor="middle" fontSize="10" fill="var(--text-3)">Previous Balance</text>
        <text x={14} y={h / 2} textAnchor="middle" fontSize="10" fill="var(--text-3)" transform={`rotate(-90,14,${h / 2})`}>Predicted</text>
        {items.slice(0, 200).map((it, i) => {
          const x = pad + (it.prevClosingBal / maxVal) * (w - pad - 20);
          const y = h - 4 - (it.predictedClosingBal / maxVal) * (h - 18);
          return <circle key={i} cx={x} cy={y} r={hd === i ? 6 : it.isHV ? 4.5 : 3} fill={ac(it.predictedAction)} opacity={hd === i ? 1 : .4} style={{ transition: 'r .12s', cursor: 'pointer' }} onMouseEnter={() => setHd(i)} onMouseLeave={() => setHd(null)} />;
        })}
      </svg>
      {hd != null && items[hd] && <div style={{ position: 'absolute', top: 8, right: 8, background: '#fff', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', fontSize: 11, boxShadow: '0 4px 16px rgba(0,0,0,.08)', maxWidth: 200, zIndex: 5 }}>
        <div style={{ fontWeight: 700, marginBottom: 3 }}>{items[hd].description}</div>
        <div style={{ color: 'var(--text-3)' }}>Prev: {Math.round(items[hd].prevClosingBal).toLocaleString()} → Pred: {Math.round(items[hd].predictedClosingBal).toLocaleString()}</div>
      </div>}
    </div>
  );
}

/* ===== MODEL ACCURACY TABLE — wired to real MAPE summary ===== */
function ModelAccuracyTable({ periodGroups, modelLabel, allData, metric = 'mape' }) {
  const isApe = metric === 'ape';
  const metricLabel = isApe ? 'APE' : 'MAPE';
  // Per-period APE = mean of that month's individual item forecast errors (all
  // items + HV items). MAPE mode keeps the model's reported MAPE_Summary values.
  const apeByPeriod = React.useMemo(() => {
    const m = {};
    (allData || []).forEach(d => { if (d.ape == null) return; const k = d.period; if (!m[k]) m[k] = { all: [], hv: [] }; m[k].all.push(d.ape); if (d.isHV) m[k].hv.push(d.ape); });
    const out = {};
    Object.keys(m).forEach(k => { const a = m[k].all, h = m[k].hv; out[k] = { all: a.length ? a.reduce((s, v) => s + v, 0) / a.length : null, hv: h.length ? h.reduce((s, v) => s + v, 0) / h.length : null }; });
    return out;
  }, [allData]);
  // Filter to Monthly only — quarterly/half-yearly not used in this app
  const mapeData = (window.__MAPE_SUMMARY || []).filter(r => (r.model || '').toLowerCase().startsWith('month'));
  // Tighter cell sizing + smaller font so the table can fit a long list of
  // periods at the height of the chart next to it on Model Accuracy.
  const thS = { padding: '6px 10px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '.06em', borderBottom: '2px solid var(--border)', background: '#FAFBFC', whiteSpace: 'nowrap', position: 'sticky', top: 0, zIndex: 1 };
  const tdS = { padding: '6px 10px', fontSize: 11, borderBottom: '1px solid #F3F4F6', whiteSpace: 'nowrap' };
  const mapeColor = (v) => v == null ? 'var(--text-3)' : v > 100 ? '#DC2626' : v > 50 ? '#D97706' : '#059669';

  // Latest month first (client asked) — sort a copy, the summary itself stays
  // oldest-first for the charts that read it.
  const rows = (mapeData.length > 0 ? mapeData : periodGroups.map(pg => ({
    period: pg.period, model: modelLabel || 'Forecast',
    mapeAll: null, mapeHV: null,
    itemsPredicted: pg.data.length,
    itemsDeliver: pg.data.filter(d => d.predictedAction === 'Deliver').length,
    itemsReturn: pg.data.filter(d => d.predictedAction === 'Return').length,
    tier: '—',
  }))).slice().sort((a, b) => String(b.period).localeCompare(String(a.period)));

  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 10 }}>
        {isApe
          ? 'Average APE (absolute % error) of each month’s individual item forecasts — all items and HV. Lower = better.'
          : 'Model accuracy summary from the MAPE_Summary sheet. Lower MAPE = better accuracy.'}
      </div>
      {/* Both axes scroll. Height is matched to the Portfolio chart next to
          us (~340px usable: SVG padT 14 + cH 280 + padB 44 + chrome). */}
      <div className="h-scroller" style={{ borderRadius: 10, border: '1px solid var(--border)', maxHeight: 348, overflowY: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', minWidth: '100%' }}>
          <thead>
            <tr>
              <th style={thS}>Period</th>
              <th style={thS}>Model</th>
              <th style={{ ...thS, textAlign: 'right' }}>{metricLabel} All (%)</th>
              <th style={{ ...thS, textAlign: 'right' }}>{metricLabel} HV (%)</th>
              <th style={{ ...thS, textAlign: 'right' }}>Predicted</th>
              <th style={{ ...thS, textAlign: 'right' }}>Deliver</th>
              <th style={{ ...thS, textAlign: 'right' }}>Return</th>
              <th style={thS}>Tier</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const ap = apeByPeriod[r.period];
              const eAll = isApe ? (ap ? ap.all : null) : r.mapeAll;
              const eHV = isApe ? (ap ? ap.hv : null) : r.mapeHV;
              return (
              <tr key={i}>
                <td style={{ ...tdS, fontFamily: 'var(--mono)', fontWeight: 700 }}>{r.period}</td>
                <td style={{ ...tdS, fontWeight: 500 }}>{r.model}</td>
                <td style={{ ...tdS, textAlign: 'right', fontFamily: 'var(--mono)', fontWeight: 700, color: mapeColor(eAll) }}>
                  {eAll != null ? eAll.toFixed(1) + '%' : '—'}
                </td>
                <td style={{ ...tdS, textAlign: 'right', fontFamily: 'var(--mono)', fontWeight: 700, color: mapeColor(eHV) }}>
                  {eHV != null ? eHV.toFixed(1) + '%' : '—'}
                </td>
                <td style={{ ...tdS, textAlign: 'right', fontFamily: 'var(--mono)', fontWeight: 600 }}>{r.itemsPredicted ?? '—'}</td>
                <td style={{ ...tdS, textAlign: 'right', fontFamily: 'var(--mono)', fontWeight: 600, color: '#059669' }}>{r.itemsDeliver ?? '—'}</td>
                <td style={{ ...tdS, textAlign: 'right', fontFamily: 'var(--mono)', fontWeight: 600, color: '#DC2626' }}>{r.itemsReturn ?? '—'}</td>
                <td style={tdS}>{r.tier}</td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ===== ITEM FORECAST CARD — actual vs predicted bars per period (like PDF charts) ===== */
/* Colors matching the PDF reference */
const ACT_COL = '#6366F1';   /* indigo-500 — Actual Closing Balance (matches brand) */
const PRED_COL = '#F59E0B';  /* amber-500  — Predicted Closing Balance */
const MAPE_GREEN = '#10B981', MAPE_AMBER = '#D97706', MAPE_RED = '#EF4444';
const mapeColor = v => v == null ? 'var(--text-3)' : v < 30 ? MAPE_GREEN : v <= 100 ? MAPE_AMBER : MAPE_RED;

function ItemForecastCard({ item }) {
  const [expanded, setExpanded] = React.useState(false);
  const [zoom, setZoom] = React.useState(1);
  const cardRef = React.useRef(null);
  const ZSTEP = 0.1, ZMIN = 0.6, ZMAX = 2.0;
  const zoomIn  = () => setZoom(z => Math.min(ZMAX, Math.round((z + ZSTEP) * 10) / 10));
  const zoomOut = () => setZoom(z => Math.max(ZMIN, Math.round((z - ZSTEP) * 10) / 10));
  // Newest month first, left to right (client asked for descending order).
  const periods = React.useMemo(() => item.periods.slice().sort((a, b) => (a.period < b.period ? 1 : a.period > b.period ? -1 : 0)), [item.periods]);
  // Chart renders eagerly. We used to lazy-mount on scroll-into-view, but
  // the scroll-root detection was unreliable inside the components iframe
  // and visible cards would sit on a spinner until the user nudged the
  // wheel. The browser-native `content-visibility: auto` on the card wrapper
  // (set inline below) gives us the off-screen render skip for free
  // without the JS coordination.

  const fmtMon = p => { const m = p.split('-')[1]; const ns = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']; return ns[parseInt(m)] || p; };
  const fmtK  = v => v == null ? '—' : v >= 1e6 ? (v/1e6).toFixed(1)+'M' : v >= 1e3 ? (v/1e3).toFixed(1)+'K' : Math.round(v).toString();
  const fmtY  = v => v >= 1e6 ? (v/1e6).toFixed(1)+'M' : v >= 1e3 ? Math.round(v/1e3)+'K' : Math.round(v);

  const hasActuals = periods.some(p => p.actualClosingBal != null);
  const hasDir     = periods.some(p => p.directionCorrect != null);
  const maxVal = Math.max(...periods.flatMap(p => [p.predictedClosingBal || 0, p.actualClosingBal || 0]), 1);
  const years  = [...new Set(periods.map(p => p.period.split('-')[0]))];
  const multiYear = years.length > 1;
  const nMape = periods.filter(p => p.itemMape != null).length;

  const [hoverIdx, setHoverIdx] = React.useState(null);

  function renderChart(opts = {}) {
    const xZoom = opts.xZoom || 1;
    const barW  = (opts.barW  || 38) * xZoom;
    const barGap = 4 * xZoom;
    const groupGap = (opts.groupGap || 22) * xZoom;
    const cH   = opts.cH   || 200;
    const padL = opts.padL || 60;
    const padT = opts.padT || 52;
    // Year label is always shown under every month now, so the bottom
    // padding always needs room for two label rows (month + year).
    const padB = opts.padB || (hasDir ? 60 : 48);
    const fs   = opts.fs   || 12;
    const groupW = (hasActuals ? barW * 2 + barGap : barW) + groupGap;
    const chartW = padL + periods.length * groupW + 16;
    const svgH  = padT + cH + padB;
    const fmtFull = (v) => v == null ? '—' : v >= 1e6 ? (v/1e6).toFixed(2)+'M' : v >= 1e3 ? (v/1e3).toFixed(1)+'K' : Math.round(v).toLocaleString();
    const fmtSigned = (v) => v == null ? '—' : (v > 0 ? '+' : '') + fmtFull(v);
    const fmtPeriodFull = (p) => { const m = p.split('-')[1]; const y = p.split('-')[0]; const ns = ['','January','February','March','April','May','June','July','August','September','October','November','December']; return `${ns[parseInt(m)] || ''} ${y}`; };

    return (
      // h-scroller: themed horizontal scrollbar (defined in main HTML).
      // Scroll kicks in cleanly whenever a run has more periods than the
      // card width can hold.
      <div className="h-scroller">
        {/* HTML hover tooltip — pinned at top, free to extend past SVG bounds */}
        {hoverIdx != null && periods[hoverIdx] && (() => {
          const p = periods[hoverIdx];
          const groupCenterX = padL + hoverIdx * groupW + (hasActuals ? barW + barGap / 2 : barW / 2);
          const ttW = 240;
          const ttX = Math.max(4, Math.min(chartW - ttW - 4 < 4 ? 4 : chartW - ttW - 4, groupCenterX - ttW / 2));
          return (
            <div style={{
              position: 'absolute', top: 4, left: ttX, width: ttW,
              background: '#111827', color: '#fff', borderRadius: 7,
              padding: '7px 11px', pointerEvents: 'none', zIndex: 10,
              boxShadow: '0 6px 16px rgba(0,0,0,.18)',
              fontFamily: 'var(--font)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 700 }}>{fmtPeriodFull(p.period)}</span>
                <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {p.directionCorrect != null && <span style={{ color: p.directionCorrect ? MAPE_GREEN : MAPE_RED, fontSize: 12, fontWeight: 800, lineHeight: 1 }}>{p.directionCorrect ? '✓' : '✗'}</span>}
                  {(p.ape != null || p.itemMape != null) && (() => {
                    const v = p.ape != null ? p.ape : p.itemMape;
                    const lbl = p.ape != null ? 'APE' : 'MAPE';
                    return <span style={{ color: mapeColor(v), fontFamily: 'var(--mono)', fontSize: 10.5, fontWeight: 700 }}>{lbl} {v.toFixed(1)}%</span>;
                  })()}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'var(--mono)', fontSize: 10.5, fontWeight: 600, color: '#D1D5DB' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 7, height: 7, borderRadius: 2, background: ACT_COL, display: 'inline-block' }}></span>
                  A <strong style={{ color: '#fff', marginLeft: 1 }}>{fmtFull(p.actualClosingBal)}</strong>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 7, height: 7, borderRadius: 2, background: PRED_COL, display: 'inline-block' }}></span>
                  P <strong style={{ color: '#fff', marginLeft: 1 }}>{fmtFull(p.predictedClosingBal)}</strong>
                </span>
                {p.error != null && <span style={{ marginLeft: 'auto', color: p.error >= 0 ? '#34D399' : '#F87171', fontWeight: 700 }}>Δ {fmtSigned(p.error)}</span>}
              </div>
            </div>
          );
        })()}
        <svg width={chartW} height={svgH} viewBox={`0 0 ${chartW} ${svgH}`} style={{ display: 'block' }}>
          {/* Rotated Y-axis label */}
          <text x={10} y={padT + cH / 2} textAnchor="middle" fontSize={fs - 2} fill="var(--text-3)"
            transform={`rotate(-90, 10, ${padT + cH / 2})`} fontFamily="var(--mono)">Units (closing balance)</text>
          {/* Y axis line */}
          <line x1={padL} y1={padT - 4} x2={padL} y2={padT + cH} stroke="#D1D5DB" strokeWidth={1} />
          {/* Y grid lines + labels */}
          {[0, 0.25, 0.5, 0.75, 1].map((t, i) => {
            const yy = padT + cH - cH * t;
            return (
              <g key={i}>
                <line x1={padL} y1={yy} x2={chartW - 6} y2={yy} stroke={t === 0 ? '#D1D5DB' : '#F0F1F3'} strokeWidth={t === 0 ? 1 : 0.8} />
                <text x={padL - 5} y={yy + 3.5} textAnchor="end" fontSize={fs - 1} fill="var(--text-3)" fontFamily="var(--mono)">{fmtY(maxVal * t)}</text>
              </g>
            );
          })}

          {/* Bars per period */}
          {periods.map((p, i) => {
            const gx  = padL + i * groupW;
            const actH  = p.actualClosingBal != null ? Math.max((p.actualClosingBal / maxVal) * cH, 2) : 0;
            const predH = Math.max(((p.predictedClosingBal || 0) / maxVal) * cH, 2);
            // Use per-period APE if present (v4 schema), fall back to item-level MAPE for older data.
            const mape  = p.ape != null ? p.ape : p.itemMape;
            const isNewYear = multiYear && (i === 0 || p.period.split('-')[0] !== periods[i-1].period.split('-')[0]);
            /* center of group for MAPE label & X label */
            const groupCx = hasActuals ? gx + barW + barGap / 2 : gx + barW / 2;
            /* label the taller bar */
            const topY = padT + cH - Math.max(predH, actH > 0 ? actH : predH);
            const yr = p.period.split('-')[0];

            const dim = hoverIdx != null && hoverIdx !== i;
            const hoverPx = hasActuals ? gx + barW + barGap + barW : gx + barW;
            return (
              <g key={p.period} style={{ opacity: dim ? 0.88 : 1, transition: 'opacity .12s', cursor: 'pointer' }}
                onMouseEnter={() => setHoverIdx(i)} onMouseLeave={() => setHoverIdx(null)}>
                {/* Hover hit area covering the whole group */}
                <rect x={gx - groupGap / 2 + 1} y={padT} width={(hasActuals ? barW * 2 + barGap : barW) + groupGap - 2} height={cH} fill="transparent" />
                {/* Year separator */}
                {isNewYear && i > 0 && <line x1={gx - groupGap / 2} y1={padT} x2={gx - groupGap / 2} y2={padT + cH + 1} stroke="#E5E7EB" strokeWidth={1} strokeDasharray="4 3" />}

                {/* Actual bar (left, indigo) */}
                {actH > 0 && (
                  <g>
                    <rect x={gx} y={padT + cH - actH} width={barW} height={actH} rx={2} fill={ACT_COL} opacity={hoverIdx === i ? 1 : 0.88} />
                    {actH > 22 && <text x={gx + barW / 2} y={padT + cH - 4} textAnchor="middle" fontSize={fs - 1} fill="#fff" fontWeight="700" fontFamily="var(--mono)">{fmtK(p.actualClosingBal)}</text>}
                  </g>
                )}

                {/* Predicted bar (right if actuals exist, center otherwise — amber) */}
                {(() => {
                  const px = hasActuals ? gx + barW + barGap : gx;
                  return (
                    <g>
                      <rect x={px} y={padT + cH - predH} width={barW} height={predH} rx={2} fill={PRED_COL} opacity={hoverIdx === i ? 1 : 0.88} />
                      {predH > 22 && <text x={px + barW / 2} y={padT + cH - 4} textAnchor="middle" fontSize={fs - 1} fill="#fff" fontWeight="700" fontFamily="var(--mono)">{fmtK(p.predictedClosingBal)}</text>}
                    </g>
                  );
                })()}

                {/* MAPE% above tallest bar */}
                {mape != null && (
                  <text x={groupCx} y={topY - 5} textAnchor="middle" fontSize={fs - 1} fontWeight="800"
                    fill={mapeColor(mape)} fontFamily="var(--mono)">{mape.toFixed(0)}%</text>
                )}

                {/* X axis — month label */}
                <text x={groupCx} y={padT + cH + 14} textAnchor="middle" fontSize={fs} fontWeight="600" fill="var(--text-2)" fontFamily="var(--mono)">{fmtMon(p.period)}</text>
                {/* X axis — year shown under every month (lighter so the
                   month name stays the primary label).  Year-boundary months
                   are slightly bolder so the eye still picks up the
                   25 -> 26 transition at a glance. */}
                <text x={groupCx} y={padT + cH + 26} textAnchor="middle" fontSize={fs - 1}
                  fill={isNewYear ? 'var(--text-2)' : 'var(--text-3)'}
                  fontWeight={isNewYear ? 700 : 500}
                  fontFamily="var(--mono)">{yr}</text>

                {/* Direction indicator ✓ / ✗ — always below the (now always
                    shown) year row */}
                {p.directionCorrect != null && (
                  <text x={groupCx} y={padT + cH + 40} textAnchor="middle"
                    fontSize={fs} fontWeight="700"
                    fill={p.directionCorrect ? MAPE_GREEN : MAPE_RED}
                    fontFamily="var(--font)">{p.directionCorrect ? '✓' : '✗'}</text>
                )}
              </g>
            );
          })}

          {/* X axis label */}
          <text x={padL + (periods.length * groupW) / 2} y={svgH - 2} textAnchor="middle" fontSize={fs - 1} fill="var(--text-3)" fontFamily="var(--mono)">Month</text>

        </svg>
      </div>
    );
  }

  /* Legend matching PDF exactly */
  function Legend({ fs = 10 }) {
    const items = [
      { col: ACT_COL, label: 'Actual Closing Balance', show: hasActuals },
      { col: PRED_COL, label: 'Predicted Closing Balance', show: true },
      { col: MAPE_GREEN, label: 'MAPE < 30% — reliable', text: true, show: true },
      { col: MAPE_AMBER, label: 'MAPE 30–100% — directional', text: true, show: true },
      { col: MAPE_RED,   label: 'MAPE > 100% — unreliable', text: true, show: true },
      { sym: '✗', col: MAPE_RED,   label: 'Direction wrong', show: hasDir },
      { sym: '✓', col: MAPE_GREEN, label: 'Direction correct', show: hasDir },
    ].filter(x => x.show);
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', marginTop: 10 }}>
        {items.map((it, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: fs, color: 'var(--text-3)' }}>
            {it.sym
              ? <span style={{ fontSize: fs + 1, fontWeight: 700, color: it.col }}>{it.sym}</span>
              : <span style={{ width: fs, height: fs, borderRadius: 2, background: it.col, opacity: .9, display: 'inline-block', flexShrink: 0 }}></span>}
            {it.label}
          </span>
        ))}
      </div>
    );
  }

  const avgMapeLabel = item.avgMape != null
    ? `Avg MAPE (÷ ${nMape}): ${item.avgMape.toFixed(1)}%`
    : null;
  const avgMapeCol = mapeColor(item.avgMape);

  return (
    <>
      {/* minWidth: 0 lets the card honour the grid column's width even when
          the SVG inside has a larger natural width — the chart wrapper
          (h-scroller) then handles the horizontal overflow.
          content-visibility:auto + contain-intrinsic-size let the browser
          skip rendering work for cards that are off-screen, so we can
          mount all charts eagerly without paying the layout cost upfront. */}
      <div ref={cardRef} style={{
        background: '#fff', border: '1px solid var(--border)', borderRadius: 12,
        padding: '14px 16px', minWidth: 0,
        contentVisibility: 'auto', containIntrinsicSize: '400px 360px',
      }}>
        {/* Card header */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
            <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text-2)', fontWeight: 600 }}>{item.code}</span>
            {item.isHV && <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-surface)', padding: '2px 7px', borderRadius: 4, letterSpacing: '.02em' }}>HV</span>}
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
              <button onClick={zoomOut} disabled={zoom <= ZMIN + 0.001} title={`Zoom out (${Math.round(zoom*100)}%)`} aria-label="Zoom out"
                style={{ padding: '3px 5px', background: 'none', border: '1px solid var(--border)', borderRadius: 5, cursor: zoom <= ZMIN + 0.001 ? 'default' : 'pointer', color: zoom <= ZMIN + 0.001 ? 'var(--text-3)' : 'var(--text-2)', opacity: zoom <= ZMIN + 0.001 ? .45 : 1, display: 'flex', alignItems: 'center' }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
              </button>
              <span style={{ fontSize: 9, fontFamily: 'var(--mono)', color: 'var(--text-3)', minWidth: 30, textAlign: 'center' }}>{Math.round(zoom*100)}%</span>
              <button onClick={zoomIn} disabled={zoom >= ZMAX - 0.001} title={`Zoom in (${Math.round(zoom*100)}%)`} aria-label="Zoom in"
                style={{ padding: '3px 5px', background: 'none', border: '1px solid var(--border)', borderRadius: 5, cursor: zoom >= ZMAX - 0.001 ? 'default' : 'pointer', color: zoom >= ZMAX - 0.001 ? 'var(--text-3)' : 'var(--text-2)', opacity: zoom >= ZMAX - 0.001 ? .45 : 1, display: 'flex', alignItems: 'center' }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
              </button>
              <button onClick={() => setExpanded(true)} title="Expand chart" aria-label="Expand"
                style={{ padding: '3px 6px', background: 'none', border: '1px solid var(--border)', borderRadius: 5, cursor: 'pointer', color: 'var(--text-2)', display: 'flex', alignItems: 'center', transition: 'background .12s, color .12s' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--hover)'; e.currentTarget.style.color = 'var(--accent)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-2)'; }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
              </button>
            </div>
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', lineHeight: 1.3 }}>{item.desc}</div>
          {avgMapeLabel && <div style={{ fontSize: 11, fontWeight: 600, color: avgMapeCol, marginTop: 3 }}>{avgMapeLabel}</div>}
        </div>
        {renderChart({ xZoom: zoom })}
        {/* Inline legend so Actual (indigo) vs Predicted (amber) is labelled
            without having to expand the card. */}
        <Legend fs={9} />
      </div>

      {/* Expanded modal */}
      {expanded && ReactDOM.createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={() => setExpanded(false)}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '22px 26px', maxWidth: '92vw', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 24px 72px rgba(0,0,0,.28)', minWidth: 520 }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <span style={{ fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--text-3)', fontWeight: 600 }}>{item.code}</span>
              {item.isHV && <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-surface)', padding: '2px 7px', borderRadius: 4 }}>HV</span>}
              <button onClick={() => setExpanded(false)} style={{ marginLeft: 'auto', padding: '4px 12px', background: 'none', border: '1px solid var(--border)', borderRadius: 7, cursor: 'pointer', fontSize: 12, color: 'var(--text-2)', fontFamily: 'var(--font)' }}>✕ Close</button>
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 4, lineHeight: 1.3 }}>{item.desc}</div>
            {avgMapeLabel && <div style={{ fontSize: 12, fontWeight: 600, color: avgMapeCol, marginBottom: 14 }}>{avgMapeLabel}</div>}
            {renderChart({ barW: 44, groupGap: 28, cH: 320, padL: 72, padT: 32, padB: 64, fs: 12 })}
            <Legend fs={11} />
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

/* ===== ITEM FORECASTS GRID — scrollable 2-column grid of forecast charts ===== */
function ItemForecastsGrid({ allData }) {
  const [search, setSearch] = React.useState('');
  // Exact item code chosen from the dropdown (null = free-text search).
  const [exactItem, setExactItem] = React.useState(null);
  const [hvOnly, setHvOnly] = React.useState(false);
  const gridRef = React.useRef(null);
  const [gridWidth, setGridWidth] = React.useState(0);
  // Track the grid container width so we can switch between a 2-column and
  // 1-column layout based on whether one card can hold the full chart
  // without horizontal scroll.
  React.useEffect(() => {
    if (!gridRef.current) return;
    const ro = new ResizeObserver(entries => {
      for (const e of entries) setGridWidth(e.contentRect.width);
    });
    ro.observe(gridRef.current);
    return () => ro.disconnect();
  }, []);

  const items = React.useMemo(() => {
    const byItem = {};
    allData.forEach(d => {
      if (!byItem[d.itemCode]) byItem[d.itemCode] = { code: d.itemCode, desc: d.description, isHV: d.isHV, periods: [] };
      byItem[d.itemCode].periods.push(d);
    });
    return Object.values(byItem).map(it => {
      it.periods.sort((a, b) => a.period.localeCompare(b.period));
      const mapes = it.periods.map(p => p.itemMape).filter(m => m != null);
      it.avgMape = mapes.length ? mapes.reduce((s, m) => s + m, 0) / mapes.length : null;
      return it;
    }).sort((a, b) => {
      if (a.isHV !== b.isHV) return a.isHV ? -1 : 1;
      return (a.avgMape ?? Infinity) - (b.avgMape ?? Infinity);
    });
  }, [allData]);

  const filtered = React.useMemo(() => {
    let rows = items;
    if (hvOnly) rows = rows.filter(it => it.isHV);
    if (exactItem) {
      rows = rows.filter(it => it.code === exactItem);
    } else if (search) {
      const s = search.toLowerCase();
      rows = rows.filter(it => (it.desc || '').toLowerCase().includes(s) || (it.code || '').toLowerCase().includes(s));
    }
    return rows;
  }, [items, hvOnly, search, exactItem]);

  // Each card is a full chart (a bar group, labels and markers per month), so
  // drawing every item at once meant tens of thousands of SVG nodes and a tab
  // that took seconds to open. Draw a first batch and add more as the list is
  // scrolled; a new search or filter starts again from the top.
  const BATCH = 10;
  const [shown, setShown] = React.useState(BATCH);
  React.useEffect(() => {
    setShown(BATCH);
    if (gridRef.current) gridRef.current.scrollTop = 0;
  }, [filtered]);
  const onGridScroll = e => {
    const el = e.currentTarget;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 800) setShown(n => (n < filtered.length ? n + BATCH : n));
  };

  // Unique items for the search dropdown.
  const searchOptions = React.useMemo(() =>
    items.map(it => ({ label: it.desc || it.code, sub: it.code, code: it.code, isHV: it.isHV })),
    [items]);

  const hvCount = items.filter(i => i.isHV).length;
  const hasAnyActuals = items.some(it => it.periods.some(p => p.actualClosingBal != null));
  const hasAnyDir     = items.some(it => it.periods.some(p => p.directionCorrect != null));

  /* Global legend items — same as PDF page header */
  const globalLegendItems = [
    { col: ACT_COL,    label: 'Actual Closing Balance',    show: hasAnyActuals },
    { col: PRED_COL,   label: 'Predicted Closing Balance', show: true },
    { col: MAPE_GREEN, label: 'MAPE < 30% — reliable',     show: true },
    { col: MAPE_AMBER, label: 'MAPE 30–100% — directional',show: true },
    { col: MAPE_RED,   label: 'MAPE > 100% — unreliable',  show: true },
    { sym: '✗', col: MAPE_RED,   label: 'Direction wrong',   show: hasAnyDir },
    { sym: '✓', col: MAPE_GREEN, label: 'Direction correct', show: hasAnyDir },
  ].filter(x => x.show);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Global legend + formula bar — matches PDF page header */}
      <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', marginBottom: 10, flexShrink: 0 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', marginBottom: 6 }}>
          {globalLegendItems.map((it, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-2)' }}>
              {it.sym
                ? <span style={{ fontSize: 13, fontWeight: 800, color: it.col, lineHeight: 1 }}>{it.sym}</span>
                : <span style={{ width: 11, height: 11, borderRadius: 2, background: it.col, opacity: .9, display: 'inline-block', flexShrink: 0 }}></span>}
              {it.label}
            </span>
          ))}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--mono)', borderTop: '1px solid #F3F4F6', paddingTop: 6 }}>
          MAPE = |Actual − Predicted| ÷ Actual × 100 &nbsp;·&nbsp; Avg MAPE = Σ(period MAPE) ÷ n &nbsp;·&nbsp; ✓/✗ = direction of balance change predicted correctly
        </div>
      </div>

      {/* Controls — search + filter + count */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10, flexShrink: 0, flexWrap: 'wrap' }}>
        <SearchBox
          value={search}
          onType={(v) => { setSearch(v); setExactItem(null); }}
          onPick={(opt) => { setSearch(opt.label); setExactItem(opt.code); }}
          onClear={() => { setSearch(''); setExactItem(null); }}
          options={searchOptions}
          placeholder="Search items…"
          width="0 0 300px"
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600,
          color: hvOnly ? 'var(--accent)' : 'var(--text-2)', cursor: 'pointer', userSelect: 'none',
          padding: '5px 10px', border: '1px solid', borderColor: hvOnly ? 'var(--accent)' : 'var(--border)',
          borderRadius: 6, background: hvOnly ? 'var(--accent-surface)' : '#fff' }}>
          <input type="checkbox" checked={hvOnly} onChange={e => setHvOnly(e.target.checked)} style={{ accentColor: 'var(--accent)', margin: 0 }} />
          HV Only ({hvCount})
        </label>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-3)' }}>
          {filtered.length} of {items.length} items
        </span>
      </div>

      {/* Scrollable grid — vertical scroll only; chart inside each card
          handles its own horizontal overflow when periods are too dense. */}
      <div ref={gridRef} onScroll={onGridScroll} style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        {filtered.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
            No items found{search ? ` for "${search}"` : ''}
          </div>
        ) : (() => {
          // Decide column count from measured width vs the natural chart width.
          // Chart natural width: padL(60) + N * groupW(102) + 16, plus card
          // padding (~32). 2-col fits when gridWidth >= 2 * cardW + gap.
          const periodCount = filtered[0]?.periods?.length || 0;
          const cardNeeded = 60 + periodCount * 102 + 16 + 32;
          const twoColFits = gridWidth > 0 && gridWidth >= cardNeeded * 2 + 16;
          const cols = twoColFits ? 2 : 1;
          return (
            <div style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
              gap: 16, paddingBottom: 16,
            }}>
              {filtered.slice(0, shown).map(it => <ItemForecastCard key={it.code} item={it} />)}
              {shown < filtered.length && (
                <button onClick={() => setShown(n => n + BATCH)} style={{ gridColumn: '1 / -1', padding: '10px', borderRadius: 8, border: '1px dashed var(--border)', background: '#fff', color: 'var(--text-2)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                  Showing {shown} of {filtered.length} — scroll or click for more
                </button>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}


/* ===== ACTION COUNT BARS — grouped bars across all periods ===== */
// Month-by-month charts run newest month first, left to right (client asked for
// descending order), and scroll sideways once there are many periods. Keep them
// opened at the left-hand end, where the latest month is.
const newestFirst = (a, b) => (a.period < b.period ? 1 : a.period > b.period ? -1 : 0);
function useScrollToLatest(dep) {
  const ref = React.useRef(null);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (el) el.scrollLeft = 0;
  }, [dep]);
  return ref;
}

function ActionCountBars({ periodGroups, mode = 'predicted' }) {
  const latestRef = useScrollToLatest(periodGroups.length);
  const actions = ['Deliver', 'Return', 'No Change'];
  const colors = { Deliver: '#059669', Return: '#DC2626', 'No Change': '#D97706' };
  const data = periodGroups.slice().sort(newestFirst).map(pg => ({
    period: pg.period,
    counts: actions.map(a => pg.data.filter(d => fcAction(d, mode) === a).length),
  }));
  const max = Math.max(...data.flatMap(d => d.counts), 1);
  const fmt = p => { const [y, m] = p.split('-'); const names = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']; return `${names[parseInt(m)]} ${y.slice(-2)}`; };
  const periodCount = data.length;
  const groupW = 96;
  const gapBetween = 24;
  const barW = (groupW - 12) / 3;
  const cH = 240, pL = 56, pT = 18, pB = 44;
  const tW = pL + periodCount * (groupW + gapBetween) + 16;
  const sH = pT + cH + pB;
  const [hg, setHg] = React.useState(null);

  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 8 }}>Item count per action across {periodCount} period{periodCount === 1 ? '' : 's'}.</div>
      <div className="h-scroller" ref={latestRef}>
      <svg width={tW} height={sH} viewBox={`0 0 ${tW} ${sH}`} style={{ display: 'block' }}>
        {[0,.25,.5,.75,1].map((p,i) => { const y = pT + cH - cH * p; return <g key={i}><line x1={pL} y1={y} x2={tW-12} y2={y} stroke="#F3F4F6"/><text x={pL-8} y={y+3.5} textAnchor="end" fontSize="10" fill="var(--text-3)" fontFamily="var(--mono)">{Math.round(max*p)}</text></g>; })}
        {data.map((row, gi) => {
          const x0 = pL + 6 + gi * (groupW + gapBetween);
          const dim = hg != null && hg !== gi;
          return (
            <g key={row.period} style={{ opacity: dim ? 0.88 : 1, transition: 'opacity .15s', cursor: 'pointer' }}
              onMouseEnter={() => setHg(gi)} onMouseLeave={() => setHg(null)}>
              {row.counts.map((c, ci) => {
                const h = (c / max) * cH;
                const x = x0 + ci * (barW + 4);
                return (
                  <g key={ci}>
                    <rect x={x} y={pT + cH - h} width={barW} height={Math.max(h, 2)} rx={4} fill={colors[actions[ci]]} opacity={.85} />
                    {c > 0 && <text x={x + barW/2} y={pT + cH - h - 4} textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--text)" fontFamily="var(--mono)">{c}</text>}
                  </g>
                );
              })}
              <text x={x0 + groupW/2 - 6} y={pT + cH + 18} textAnchor="middle" fontSize="11" fill="var(--text-2)" fontWeight="500" fontFamily="var(--mono)">{fmt(row.period)}</text>
            </g>
          );
        })}
      </svg>
      </div>
      <div style={{ display: 'flex', gap: 14, justifyContent: 'center', marginTop: 6 }}>
        {actions.map(a => <div key={a} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-2)' }}><div style={{ width: 10, height: 10, borderRadius: 3, background: colors[a], opacity: .85 }}></div>{a}</div>)}
      </div>
    </div>
  );
}

/* ===== TOP HIGH-VELOCITY ITEMS — most-moved items across all periods ===== */
function HighVelocityItems({ allData, periodGroups, mode = 'predicted' }) {
  const rows = allData || (periodGroups ? periodGroups.flatMap(pg => pg.data) : []);
  const byItem = {};
  rows.forEach(d => {
    if (!d.itemCode) return;
    const q = fcQty(d, mode);
    const act = fcAction(d, mode);
    if (!byItem[d.itemCode]) byItem[d.itemCode] = { code: d.itemCode, desc: d.description, isHV: d.isHV, totalQty: 0, deliverQty: 0, returnQty: 0, periods: 0 };
    byItem[d.itemCode].totalQty += q;
    byItem[d.itemCode].periods += 1;
    if (act === 'Deliver') byItem[d.itemCode].deliverQty += q;
    else if (act === 'Return') byItem[d.itemCode].returnQty += q;
  });
  const items = Object.values(byItem).sort((a, b) => b.totalQty - a.totalQty).slice(0, 12);
  if (!items.length) return <div style={{ padding: 24, color: 'var(--text-3)', fontSize: 13, textAlign: 'center' }}>No items with movement</div>;
  const maxTotal = items[0].totalQty || 1;
  const fmtK = v => v >= 1e3 ? (v / 1e3).toFixed(1) + 'K' : Math.round(v);
  const [h, setH] = React.useState(null);

  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 12 }}>Top items by cumulative movement quantity across all periods. Bar split shows deliver vs return contribution.</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map((it, i) => {
          const moveable = it.deliverQty + it.returnQty || 1;
          const delPct = (it.deliverQty / moveable) * 100;
          const retPct = (it.returnQty / moveable) * 100;
          const totalPct = (it.totalQty / maxTotal) * 100;
          return (
            <div key={it.code} onMouseEnter={() => setH(i)} onMouseLeave={() => setH(null)}
              style={{ display: 'grid', gridTemplateColumns: '180px 1fr 96px', alignItems: 'center', gap: 12, minHeight: 28, opacity: h != null && h !== i ? .65 : 1, transition: 'opacity .12s', cursor: 'default' }}>
              <div style={{ fontSize: 11, color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5 }}>
                {it.isHV && <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-surface)', padding: '1px 5px', borderRadius: 4, flexShrink: 0 }}>HV</span>}
                <span title={`${it.desc} · ${it.periods} period${it.periods === 1 ? '' : 's'}`}>{it.desc}</span>
              </div>
              {/* Bar: deliver (green) + return (red), with % labels inside segments */}
              <div style={{ display: 'flex', height: 22, borderRadius: 5, background: '#F3F4F6', overflow: 'hidden', width: `${totalPct}%`, minWidth: 40 }}>
                {delPct > 0 && (
                  <div style={{ width: `${delPct}%`, background: '#059669', opacity: .88, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                    {delPct >= 14 && <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', fontFamily: 'var(--mono)', whiteSpace: 'nowrap' }}>{Math.round(delPct)}%</span>}
                  </div>
                )}
                {retPct > 0 && (
                  <div style={{ width: `${retPct}%`, background: '#DC2626', opacity: .88, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                    {retPct >= 14 && <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', fontFamily: 'var(--mono)', whiteSpace: 'nowrap' }}>{Math.round(retPct)}%</span>}
                  </div>
                )}
              </div>
              {/* Total qty + split summary */}
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 12, fontFamily: 'var(--mono)', fontWeight: 800, color: 'var(--text)' }}>{fmtK(it.totalQty)}</div>
                <div style={{ fontSize: 9, fontFamily: 'var(--mono)', color: 'var(--text-3)', marginTop: 1 }}>
                  <span style={{ color: '#059669' }}>D {Math.round(delPct)}%</span>
                  {' · '}
                  <span style={{ color: '#DC2626' }}>R {Math.round(retPct)}%</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 12, fontSize: 11, color: 'var(--text-2)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: '#059669', opacity: .85 }}></span>Deliver share</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: '#DC2626', opacity: .85 }}></span>Return share</span>
      </div>
    </div>
  );
}

/* ===== HV vs STANDARD MOVEMENT BY PERIOD ===== */
function HVMovementByPeriod({ periodGroups, mode = 'predicted' }) {
  const latestRef = useScrollToLatest(periodGroups.length);
  const fmt = p => { const [y, m] = p.split('-'); const names = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']; return `${names[parseInt(m)]} ${y.slice(-2)}`; };
  const data = periodGroups.slice().sort(newestFirst).map(pg => {
    const hv = pg.data.filter(d => d.isHV);
    const std = pg.data.filter(d => !d.isHV);
    return {
      period: pg.period,
      hvDel: hv.filter(d => fcAction(d, mode) === 'Deliver').length,
      hvRet: hv.filter(d => fcAction(d, mode) === 'Return').length,
      stdDel: std.filter(d => fcAction(d, mode) === 'Deliver').length,
      stdRet: std.filter(d => fcAction(d, mode) === 'Return').length,
    };
  });
  const max = Math.max(...data.flatMap(d => [d.hvDel + d.stdDel, d.hvRet + d.stdRet]), 1);
  const periodCount = data.length;
  const groupW = 80;
  const gapBetween = 20;
  const barW = (groupW - 8) / 2;
  // Geometry matched to ActionCountBars (cH 240, pT 18, pB 44) so the two
  // charts sitting side-by-side share the same x-axis baseline height.
  const cH = 240, pL = 56, pT = 18, pB = 44;
  const tW = pL + periodCount * (groupW + gapBetween) + 16;
  const sH = pT + cH + pB;

  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 8 }}>Deliver and Return counts per period, stacked by HV (dark) vs Standard (light).</div>
      <div className="h-scroller" ref={latestRef}>
      <svg width={tW} height={sH} viewBox={`0 0 ${tW} ${sH}`} style={{ display: 'block' }}>
        {[0,.25,.5,.75,1].map((p,i) => { const y = pT + cH - cH * p; return <g key={i}><line x1={pL} y1={y} x2={tW-12} y2={y} stroke="#F3F4F6"/><text x={pL-8} y={y+3.5} textAnchor="end" fontSize="10" fill="var(--text-3)" fontFamily="var(--mono)">{Math.round(max*p)}</text></g>; })}
        {data.map((row, gi) => {
          const x0 = pL + 6 + gi * (groupW + gapBetween);
          // Deliver bar (left) — stacked: HV (dark) on bottom, Standard (light) on top
          const delTotal = row.hvDel + row.stdDel;
          const delH = (delTotal / max) * cH;
          const delHvH = (row.hvDel / max) * cH;
          const delStdH = (row.stdDel / max) * cH;
          // Return bar (right) — stacked
          const retTotal = row.hvRet + row.stdRet;
          const retH = (retTotal / max) * cH;
          const retHvH = (row.hvRet / max) * cH;
          const retStdH = (row.stdRet / max) * cH;
          const xDel = x0;
          const xRet = x0 + barW + 8;
          return (
            <g key={row.period}>
              {/* Deliver group — total label on top, HV count inside the dark base */}
              <rect x={xDel} y={pT + cH - delHvH - delStdH} width={barW} height={delStdH} rx={3} fill="#34D399" opacity={.85} />
              <rect x={xDel} y={pT + cH - delHvH} width={barW} height={delHvH} fill="#047857" opacity={.95} />
              {delTotal > 0 && delH > 14 && <text x={xDel + barW/2} y={pT + cH - delH - 4} textAnchor="middle" fontSize="10" fontWeight="700" fill="#047857" fontFamily="var(--mono)">{delTotal}</text>}
              {row.hvDel > 0 && delHvH >= 12 && <text x={xDel + barW/2} y={pT + cH - delHvH/2 + 3.5} textAnchor="middle" fontSize="9.5" fontWeight="800" fill="#fff" fontFamily="var(--mono)">{row.hvDel}</text>}
              {/* Return group */}
              <rect x={xRet} y={pT + cH - retHvH - retStdH} width={barW} height={retStdH} rx={3} fill="#FCA5A5" opacity={.85} />
              <rect x={xRet} y={pT + cH - retHvH} width={barW} height={retHvH} fill="#B91C1C" opacity={.95} />
              {retTotal > 0 && retH > 14 && <text x={xRet + barW/2} y={pT + cH - retH - 4} textAnchor="middle" fontSize="10" fontWeight="700" fill="#B91C1C" fontFamily="var(--mono)">{retTotal}</text>}
              {row.hvRet > 0 && retHvH >= 12 && <text x={xRet + barW/2} y={pT + cH - retHvH/2 + 3.5} textAnchor="middle" fontSize="9.5" fontWeight="800" fill="#fff" fontFamily="var(--mono)">{row.hvRet}</text>}
              <text x={x0 + (groupW - 8)/2} y={pT + cH + 18} textAnchor="middle" fontSize="11" fill="var(--text-2)" fontWeight="500" fontFamily="var(--mono)">{fmt(row.period)}</text>
              <text x={xDel + barW/2} y={pT + cH + 32} textAnchor="middle" fontSize="10" fill="#059669">Del</text>
              <text x={xRet + barW/2} y={pT + cH + 32} textAnchor="middle" fontSize="10" fill="#DC2626">Ret</text>
            </g>
          );
        })}
      </svg>
      </div>
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 4, fontSize: 11, color: 'var(--text-2)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: '#047857' }}></span>Deliver · HV</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: '#34D399' }}></span>Deliver · Standard</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: '#B91C1C' }}></span>Return · HV</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: '#FCA5A5' }}></span>Return · Standard</span>
      </div>
    </div>
  );
}

/* ===== ACTION × MAGNITUDE HEATMAP ===== */
function ActionMagnitudeHeatmap({ data, mode = 'predicted' }) {
  const buckets = [
    { label: '0–10', min: 0, max: 10 },
    { label: '10–50', min: 10, max: 50 },
    { label: '50–100', min: 50, max: 100 },
    { label: '100–500', min: 100, max: 500 },
    { label: '500–1K', min: 500, max: 1000 },
    { label: '1K–5K', min: 1000, max: 5000 },
    { label: '5K+', min: 5000, max: Infinity },
  ];
  const actions = ['Deliver', 'Return', 'No Change'];
  const colors = { Deliver: [5, 150, 105], Return: [220, 38, 38], 'No Change': [217, 119, 6] };
  const matrix = actions.map(a => buckets.map(b => data.filter(d => { const q = fcQty(d, mode); return fcAction(d, mode) === a && q >= b.min && q <= b.max; }).length));
  const maxCell = Math.max(...matrix.flat(), 1);
  const cellW = 78, cellH = 44, pL = 84, pT = 26;
  const tW = pL + buckets.length * cellW + 20;
  const tH = pT + actions.length * cellH + 8;
  const [hover, setHover] = React.useState(null);

  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 10 }}>Counts of items by {mode === 'actual' ? 'actual' : 'predicted'} action × quantity magnitude. Darker = more items in cell.</div>
      <svg width="100%" height={tH} viewBox={`0 0 ${tW} ${tH}`} style={{ overflow: 'visible' }}>
        {/* Column headers */}
        {buckets.map((b, i) => (
          <text key={i} x={pL + i * cellW + cellW / 2} y={pT - 8} textAnchor="middle" fontSize="10" fill="var(--text-3)" fontFamily="var(--mono)">{b.label}</text>
        ))}
        {/* Row labels + cells */}
        {actions.map((a, ai) => {
          const [r, g, bl] = colors[a];
          return (
            <g key={a}>
              <text x={pL - 10} y={pT + ai * cellH + cellH / 2 + 4} textAnchor="end" fontSize="11" fontWeight="600" fill={`rgb(${r},${g},${bl})`}>{a}</text>
              {matrix[ai].map((c, ci) => {
                const intensity = c / maxCell;
                const alpha = c === 0 ? 0 : 0.12 + intensity * 0.78;
                const isHover = hover && hover.r === ai && hover.c === ci;
                return (
                  <g key={ci} style={{ cursor: 'pointer' }} onMouseEnter={() => setHover({ r: ai, c: ci })} onMouseLeave={() => setHover(null)}>
                    <rect x={pL + ci * cellW + 2} y={pT + ai * cellH + 2} width={cellW - 4} height={cellH - 4} rx={6}
                      fill={c === 0 ? '#F3F4F6' : `rgba(${r},${g},${bl},${alpha})`}
                      stroke={isHover ? `rgb(${r},${g},${bl})` : 'transparent'} strokeWidth={isHover ? 2 : 0} />
                    <text x={pL + ci * cellW + cellW / 2} y={pT + ai * cellH + cellH / 2 + 4} textAnchor="middle" fontSize="12" fontWeight="700" fill={alpha > 0.4 ? '#fff' : `rgb(${r},${g},${bl})`} fontFamily="var(--mono)">{c || ''}</text>
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ===== MAPE DISTRIBUTION HISTOGRAM ===== */
/* ===== MAPE DISTRIBUTION (single segment) ===== */
const MAPE_DEFAULT_THRESHOLDS = [20, 50, 100, 200];
const MAPE_PALETTE = ['#059669', '#10B981', '#84CC16', '#EAB308', '#D97706', '#F97316', '#DC2626', '#991B1B'];

function buildMapeBuckets(thresholds) {
  const t = [...thresholds].filter(v => Number.isFinite(v) && v > 0).sort((a, b) => a - b);
  const out = [];
  let prev = 0;
  for (const cur of t) { out.push({ label: `${prev}–${cur}%`, min: prev, max: cur }); prev = cur; }
  out.push({ label: `${prev}%+`, min: prev, max: Infinity });
  return out;
}

function MapeBucketEditor({ thresholds, onChange }) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(thresholds.join(', '));
  const [err, setErr] = React.useState(null);

  React.useEffect(() => { setDraft(thresholds.join(', ')); }, [thresholds]);

  const apply = () => {
    const parts = draft.split(/[,\s]+/).map(s => s.trim()).filter(Boolean).map(Number);
    if (parts.some(n => !Number.isFinite(n) || n <= 0)) { setErr('Use comma-separated positive numbers, e.g. 20, 50, 100, 200'); return; }
    if (!parts.length) { setErr('At least one threshold required.'); return; }
    setErr(null);
    onChange(parts.sort((a, b) => a - b));
    setEditing(false);
  };
  const reset = () => {
    setDraft(MAPE_DEFAULT_THRESHOLDS.join(', '));
    onChange(MAPE_DEFAULT_THRESHOLDS);
    setErr(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>MAPE buckets</span>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', flex: 1 }}>
          {thresholds.map((t, i) => (
            <span key={i} style={{ padding: '3px 9px', borderRadius: 999, fontSize: 10, fontWeight: 700, color: MAPE_PALETTE[i] || 'var(--text-2)', background: (MAPE_PALETTE[i] || '#9CA3AF') + '18', border: '1px solid ' + (MAPE_PALETTE[i] || '#9CA3AF') + '30', fontFamily: 'var(--mono)' }}>≤ {t}%</span>
          ))}
          <span style={{ padding: '3px 9px', borderRadius: 999, fontSize: 10, fontWeight: 700, color: MAPE_PALETTE[Math.min(thresholds.length, MAPE_PALETTE.length - 1)] || 'var(--text-2)', background: (MAPE_PALETTE[Math.min(thresholds.length, MAPE_PALETTE.length - 1)] || '#9CA3AF') + '18', border: '1px solid ' + (MAPE_PALETTE[Math.min(thresholds.length, MAPE_PALETTE.length - 1)] || '#9CA3AF') + '30', fontFamily: 'var(--mono)' }}>{'>'} {thresholds[thresholds.length - 1]}%</span>
        </div>
        <button onClick={() => setEditing(e => !e)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 7, border: '1px solid var(--border)', background: editing ? 'var(--accent-surface)' : '#fff', color: editing ? 'var(--accent)' : 'var(--text-2)', cursor: 'pointer', fontSize: 11, fontWeight: 600, fontFamily: 'var(--font)' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
          {editing ? 'Close' : 'Edit'}
        </button>
      </div>
      {editing && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'var(--accent-surface)', border: '1px solid var(--accent-border)', borderRadius: 10, flexWrap: 'wrap' }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)' }}>Thresholds (%)</label>
          <input value={draft}
            onChange={e => { setDraft(e.target.value); setErr(null); }}
            onKeyDown={e => { if (e.key === 'Enter') apply(); if (e.key === 'Escape') setEditing(false); }}
            placeholder="20, 50, 100, 200"
            style={{ flex: 1, minWidth: 160, padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 7, fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--text)', outline: 'none', background: '#fff' }} />
          <button onClick={apply} style={{ padding: '6px 14px', borderRadius: 7, border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font)' }}>Apply</button>
          <button onClick={reset} style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid var(--border)', background: '#fff', color: 'var(--text-2)', cursor: 'pointer', fontSize: 11, fontWeight: 600, fontFamily: 'var(--font)' }}>Reset</button>
          <button onClick={() => setEditing(false)} style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid var(--border)', background: '#fff', color: 'var(--text-3)', cursor: 'pointer', fontSize: 11, fontWeight: 600, fontFamily: 'var(--font)' }}>Cancel</button>
          <div style={{ flexBasis: '100%', fontSize: 10, color: err ? '#DC2626' : 'var(--text-3)', marginTop: 2 }}>
            {err || 'Comma-separated cut-points (ascending). Items below the smallest go in the lowest bucket; items above the largest go in the top bucket.'}
          </div>
        </div>
      )}
    </div>
  );
}

function MapeDistributionChart({ allData, segment = 'all', thresholds: thresholdsProp, label, metric = 'mape' }) {
  const thresholds = thresholdsProp || MAPE_DEFAULT_THRESHOLDS;
  const buckets = React.useMemo(() => buildMapeBuckets(thresholds), [thresholds]);

  // Two error views over the same % bands:
  //   mape — one point per item = that item's average error across months.
  //   ape  — one point per item-month = each forecast's own error.
  const points = React.useMemo(() => {
    if (metric === 'ape') {
      return allData.filter(d => d.ape != null).map(d => ({ val: d.ape, isHV: d.isHV }));
    }
    const byItem = {};
    allData.forEach(d => {
      if (d.itemMape == null) return;
      if (!byItem[d.itemCode]) byItem[d.itemCode] = { vals: [], isHV: d.isHV };
      byItem[d.itemCode].vals.push(d.itemMape);
    });
    return Object.values(byItem).map(it => ({ val: it.vals.reduce((s, v) => s + v, 0) / it.vals.length, isHV: it.isHV }));
  }, [allData, metric]);

  const filtered = segment === 'hv' ? points.filter(p => p.isHV)
    : segment === 'std' ? points.filter(p => !p.isHV)
    : points;

  const counts = buckets.map(b => ({
    ...b,
    count: filtered.filter(p => p.val >= b.min && p.val < b.max).length,
  }));

  const total = filtered.length;
  const max = Math.max(...counts.map(c => c.count), 1);
  const wellThreshold = thresholds[Math.min(1, thresholds.length - 1)] || 50;
  const wellCount = filtered.filter(p => p.val < wellThreshold).length;
  const pctWell = total ? Math.round(wellCount / total * 100) : 0;
  const metricLabel = metric === 'ape' ? 'APE' : 'MAPE';
  const unit = metric === 'ape' ? 'monthly forecast' : 'item';

  const bW = 56, cH = 200, padL = 44, padT = 14, padB = 44, gap = 16;
  const tW = padL + counts.length * (bW + gap) + 20;
  const sH = padT + cH + padB;
  const [hb, setHb] = React.useState(null);

  if (total === 0) {
    return <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>No {label || segment} items with {metricLabel} data.</div>;
  }

  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 8 }}>
        {total.toLocaleString()} {label || (segment === 'hv' ? 'high-value' : segment === 'std' ? 'standard' : '')} {unit}{total === 1 ? '' : 's'}.{' '}
        <strong style={{ color: pctWell >= 60 ? '#059669' : pctWell >= 30 ? '#D97706' : '#DC2626' }}>{pctWell}%</strong> have {metricLabel} &lt; {wellThreshold}%.
      </div>
      <svg width="100%" height={sH} viewBox={`0 0 ${tW} ${sH}`} style={{ overflow: 'visible' }}>
        {[0, .25, .5, .75, 1].map((p, i) => {
          const y = padT + cH - cH * p;
          return <g key={i}><line x1={padL} y1={y} x2={tW - 10} y2={y} stroke="#F3F4F6" />{p > 0 && <text x={padL - 6} y={y + 3.5} textAnchor="end" fontSize="10" fill="var(--text-3)" fontFamily="var(--mono)">{Math.round(max * p)}</text>}</g>;
        })}
        {counts.map((b, i) => {
          const x = padL + 4 + i * (bW + gap);
          const h = Math.max((b.count / max) * cH, b.count > 0 ? 3 : 0);
          const dim = hb != null && hb !== i;
          const tint = MAPE_PALETTE[Math.min(i, MAPE_PALETTE.length - 1)];
          const opacity = segment === 'hv' ? 0.95 : 0.65;
          return (
            <g key={i} style={{ opacity: dim ? 0.88 : 1, transition: 'opacity .15s', cursor: 'pointer' }}
              onMouseEnter={() => setHb(i)} onMouseLeave={() => setHb(null)}>
              <rect x={x} y={padT + cH - h} width={bW} height={h} rx={4} fill={tint} opacity={opacity} />
              {b.count > 0 && <text x={x + bW / 2} y={padT + cH - h - 5} textAnchor="middle" fontSize="11" fontWeight="700" fill={tint} fontFamily="var(--mono)">{b.count}</text>}
              <text x={x + bW / 2} y={padT + cH + 16} textAnchor="middle" fontSize="10" fill="var(--text-2)" fontWeight="600">{b.label}</text>
              {b.count > 0 && total > 0 && <text x={x + bW / 2} y={padT + cH + 30} textAnchor="middle" fontSize="9" fill="var(--text-3)" fontFamily="var(--mono)">{Math.round(b.count / total * 100)}%</text>}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ===== DIRECTION ACCURACY RING ===== */
function DirectionAccuracyByMonth({ allData }) {
  const latestRef = useScrollToLatest((allData || []).length);
  // All items vs High-value only (Sonu asked for an HV filter here — the chart
  // was always showing all items).
  const [segment, setSegment] = React.useState('all');
  const base = (allData || []).filter(d => d.directionCorrect != null);
  const withActuals = segment === 'hv' ? base.filter(d => d.isHV) : segment === 'std' ? base.filter(d => !d.isHV) : base;
  const total = withActuals.length;
  const correct = withActuals.filter(d => d.directionCorrect).length;
  const overallPct = total > 0 ? correct / total : 0;

  const fmt = p => { if (!p) return ''; const [y, m] = p.split('-'); const ns = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']; return `${ns[parseInt(m)] || ''} '${y.slice(2)}`; };
  const colorFor = pct => pct >= 0.8 ? '#059669' : pct >= 0.6 ? '#D97706' : '#DC2626';

  // Month-wise: % of items whose predicted direction matched the actual move.
  const byMonth = React.useMemo(() => {
    const m = {};
    withActuals.forEach(d => {
      const k = d.period || '—';
      if (!m[k]) m[k] = { period: k, correct: 0, total: 0 };
      m[k].total++;
      if (d.directionCorrect) m[k].correct++;
    });
    return Object.values(m)
      .sort(newestFirst)
      .map(r => ({ ...r, pct: r.total ? r.correct / r.total : 0 }));
  }, [withActuals]);

  // Secondary cut: overall accuracy by predicted action.
  const actions = ['Deliver', 'Return', 'No Change'];
  const ac = (a) => a === 'Deliver' ? '#059669' : a === 'Return' ? '#DC2626' : '#D97706';
  const byAction = actions.map(a => {
    const sub = withActuals.filter(d => d.predictedAction === a);
    const cor = sub.filter(d => d.directionCorrect).length;
    return { action: a, total: sub.length, correct: cor, pct: sub.length ? cor / sub.length : 0 };
  });

  if (total === 0) return (
    <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>No actual data available to compute direction accuracy.</div>
  );

  // SVG month bars
  const slot = 46, pL = 26, pR = 10, pT = 16, plotH = 150;
  const baseY = pT + plotH, lblH = 26, svgH = baseY + lblH;
  const minW = Math.max(pL + byMonth.length * slot + pR, 320);

  return (
    <div>
      {/* All / High-value toggle */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Items</span>
        <div style={{ display: 'inline-flex', background: 'var(--surface-2)', borderRadius: 9, padding: 3, gap: 3 }}>
          {[['all', 'All'], ['std', 'Standard'], ['hv', 'High value']].map(([k, lbl]) => {
            const on = segment === k;
            return <button key={k} onClick={() => setSegment(k)} style={{ padding: '4px 13px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font)', background: on ? 'var(--accent)' : 'transparent', color: on ? '#fff' : 'var(--text-2)', transition: 'background .12s, color .12s' }}>{lbl}</button>;
          })}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 20, alignItems: 'stretch', flexWrap: 'wrap' }}>
        {/* Month-wise trend (the hero) */}
      <div style={{ flex: '1 1 440px', minWidth: 0 }}>
        <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 8 }}>
          Share of {segment === 'hv' ? 'high-value items' : segment === 'std' ? 'standard items' : 'items'} whose predicted direction matched the actual move, each month. Dashed line = overall average.
        </div>
        <div className="h-scroller" ref={latestRef}>
          <svg width="100%" height={svgH} viewBox={`0 0 ${minW} ${svgH}`} preserveAspectRatio="xMinYMid meet" style={{ display: 'block', minWidth: minW }}>
            {/* y gridlines 0 / 50 / 100 */}
            {[0, 0.5, 1].map((g, i) => {
              const y = baseY - g * plotH;
              return <g key={i}>
                <line x1={pL} y1={y} x2={minW - pR} y2={y} stroke="#F3F4F6" />
                <text x={pL - 5} y={y + 3} textAnchor="end" fontSize="8" fill="var(--text-3)" fontFamily="var(--mono)">{Math.round(g * 100)}</text>
              </g>;
            })}
            {/* overall average reference */}
            {(() => {
              const y = baseY - overallPct * plotH;
              return <g>
                <line x1={pL} y1={y} x2={minW - pR} y2={y} stroke="var(--text-3)" strokeWidth="1" strokeDasharray="3 3" opacity="0.65" />
                <text x={minW - pR} y={y - 3} textAnchor="end" fontSize="8" fill="var(--text-3)" fontFamily="var(--mono)">avg {Math.round(overallPct * 100)}%</text>
              </g>;
            })()}
            {/* bars */}
            {byMonth.map((r, i) => {
              const bw = slot - 14, x = pL + i * slot + 6;
              const h = Math.max(r.pct * plotH, r.total ? 1 : 0), y = baseY - h;
              return (
                <g key={r.period}>
                  <rect x={x} y={y} width={bw} height={h} rx={3} fill={colorFor(r.pct)} opacity={0.9}>
                    <title>{fmt(r.period)} · {r.correct}/{r.total} correct ({Math.round(r.pct * 100)}%)</title>
                  </rect>
                  <text x={x + bw / 2} y={y - 4} textAnchor="middle" fontSize="9" fontWeight="700" fill={colorFor(r.pct)} fontFamily="var(--mono)">{Math.round(r.pct * 100)}</text>
                  <text x={x + bw / 2} y={baseY + 12} textAnchor="middle" fontSize="8" fill="var(--text-3)" fontFamily="var(--mono)">{fmt(r.period)}</text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>
      {/* Overall + per-action summary (context) */}
      <div style={{ flex: '0 0 196px', display: 'flex', flexDirection: 'column', gap: 10, borderLeft: '1px solid var(--border)', paddingLeft: 18 }}>
        <div>
          <div style={{ fontSize: 30, fontWeight: 800, fontFamily: 'var(--mono)', color: colorFor(overallPct), lineHeight: 1 }}>{Math.round(overallPct * 100)}%</div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3 }}>overall · {correct}/{total} correct</div>
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.04em', fontWeight: 700, marginTop: 2 }}>By predicted action</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {byAction.filter(b => b.total > 0).map(b => (
            <div key={b.action} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 9, height: 9, borderRadius: 2, background: ac(b.action), flexShrink: 0 }}></div>
              <div style={{ fontSize: 11, color: 'var(--text-2)', fontWeight: 500, flex: '0 0 auto', minWidth: 58 }}>{b.action}</div>
              <div style={{ flex: 1, height: 6, background: '#F3F4F6', borderRadius: 3, overflow: 'hidden', minWidth: 20 }}>
                <div style={{ height: '100%', borderRadius: 3, width: `${b.pct * 100}%`, background: colorFor(b.pct) }}></div>
              </div>
              <span style={{ fontSize: 11, fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--text-2)', flexShrink: 0 }}>{Math.round(b.pct * 100)}%</span>
            </div>
          ))}
        </div>
      </div>
      </div>
    </div>
  );
}

/* ===== PORTFOLIO ACTUAL VS PREDICTED ===== */
function PortfolioActualVsPredicted({ periodGroups }) {
  const bars = periodGroups.slice().sort(newestFirst).map(pg => {
    const predicted = pg.data.reduce((s, d) => s + (d.predictedClosingBal || 0), 0);
    const actual = pg.data.filter(d => d.actualClosingBal != null).reduce((s, d) => s + (d.actualClosingBal || 0), 0);
    const hasActual = pg.data.some(d => d.actualClosingBal != null && d.actualClosingBal > 0);
    const error = hasActual ? actual - predicted : null;
    const errorPct = hasActual && predicted > 0 ? ((actual - predicted) / predicted * 100) : null;
    return { period: pg.period, predicted, actual, hasActual, error, errorPct };
  }).filter(b => b.predicted > 0);

  if (!bars.length) return <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>No balance data available.</div>;

  const hasAnyActual = bars.some(b => b.hasActual);
  const maxVal = Math.max(...bars.flatMap(b => [b.predicted, b.actual || 0]), 1);
  const fmtK = v => v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : v >= 1e3 ? Math.round(v / 1e3) + 'K' : Math.round(v).toLocaleString();
  const fmt = p => { const [y, m] = p.split('-'); const names = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']; return `${names[parseInt(m)]} '${y.slice(2)}`; };

  // Taller chart area (cH) so the bars match the height of the MAPE summary
  // table next to it on the Model Accuracy page.
  const barW = 30, barGap = 6, groupGap = 28, cH = 280, padL = 56, padT = 14, padB = 44;
  const groupW = barW * 2 + barGap + groupGap;
  const tW = padL + bars.length * groupW + 20;
  const sH = padT + cH + padB;
  const [hi, setHi] = React.useState(null);

  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 10 }}>
        Aggregate closing balance: predicted (indigo) vs actual (amber) per period.
        {!hasAnyActual && ' Actual data not yet available.'}
      </div>
      <div className="h-scroller">
      <svg width={tW} height={sH} viewBox={`0 0 ${tW} ${sH}`} style={{ display: 'block' }}>
        {[0, .25, .5, .75, 1].map((p, i) => {
          const y = padT + cH - cH * p;
          return <g key={i}><line x1={padL} y1={y} x2={tW - 10} y2={y} stroke="#F3F4F6" /><text x={padL - 6} y={y + 3.5} textAnchor="end" fontSize="10" fill="var(--text-3)" fontFamily="var(--mono)">{fmtK(maxVal * p)}</text></g>;
        })}
        {bars.map((b, i) => {
          const gx = padL + 6 + i * groupW;
          const predH = Math.max((b.predicted / maxVal) * cH, 3);
          const actH = b.hasActual ? Math.max((b.actual / maxVal) * cH, 3) : 0;
          const dim = hi != null && hi !== i;
          return (
            <g key={b.period} style={{ opacity: dim ? 0.88 : 1, transition: 'opacity .15s', cursor: 'pointer' }}
              onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(null)}>
              {/* Predicted bar */}
              <rect x={gx} y={padT + cH - predH} width={barW} height={predH} rx={4} fill="var(--accent)" opacity={.75} />
              <text x={gx + barW / 2} y={padT + cH - predH - 5} textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--accent)" fontFamily="var(--mono)">{fmtK(b.predicted)}</text>
              {/* Actual bar */}
              {b.hasActual && <>
                <rect x={gx + barW + barGap} y={padT + cH - actH} width={barW} height={actH} rx={4} fill="#F59E0B" opacity={.85} />
                <text x={gx + barW + barGap + barW / 2} y={padT + cH - actH - 5} textAnchor="middle" fontSize="10" fontWeight="700" fill="#B45309" fontFamily="var(--mono)">{fmtK(b.actual)}</text>
              </>}
              {/* Error label below */}
              {b.errorPct != null && (
                <text x={gx + barW + barGap / 2} y={padT + cH + 28} textAnchor="middle" fontSize="10" fontWeight="700"
                  fill={b.errorPct > 0 ? '#059669' : '#DC2626'} fontFamily="var(--mono)">
                  {b.errorPct > 0 ? '+' : ''}{b.errorPct.toFixed(1)}%
                </text>
              )}
              {/* Period label */}
              <text x={gx + (hasAnyActual ? barW + barGap / 2 : barW / 2)} y={padT + cH + 16} textAnchor="middle" fontSize="11" fill="var(--text-2)" fontWeight="600">{fmt(b.period)}</text>
            </g>
          );
        })}
      </svg>
      </div>
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 4 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-2)' }}><span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--accent)', opacity: .75 }}></span>Predicted</span>
        {hasAnyActual && <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-2)' }}><span style={{ width: 10, height: 10, borderRadius: 3, background: '#F59E0B', opacity: .85 }}></span>Actual</span>}
      </div>
    </div>
  );
}

/* ===== ABC TIER × ACTION CROSS-TAB ===== */
function ABCDistributionChart({ data, abcByCode, mode = 'predicted' }) {
  const tiers = ['A', 'B', 'C'];
  const actions = ['Deliver', 'Return', 'No Change'];
  const colors = { Deliver: '#059669', Return: '#DC2626', 'No Change': '#D97706' };
  const tierColors = { A: '#059669', B: '#D97706', C: '#9CA3AF' };

  const matrix = tiers.map(tier =>
    actions.map(a => data.filter(d => abcByCode[d.itemCode] === tier && fcAction(d, mode) === a).length)
  );
  const totals = tiers.map((_, i) => matrix[i].reduce((s, c) => s + c, 0));
  const maxTotal = Math.max(...totals, 1);

  const barH = 28, gap = 14, padL = 42, padR = 60, padT = 8, padB = 32;
  const chartW = 420;
  const svgH = padT + tiers.length * (barH + gap) + padB;

  const [hov, setHov] = React.useState(null);

  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 8 }}>
        Item count per ABC tier, stacked by {mode === 'actual' ? 'actual' : 'predicted'} action. A = high-value, C = low-value items.
      </div>
      <svg width="100%" height={svgH} viewBox={`0 0 ${chartW} ${svgH}`} style={{ overflow: 'visible' }}>
        {tiers.map((tier, ti) => {
          const y = padT + ti * (barH + gap);
          const total = totals[ti];
          let xOff = padL;
          return (
            <g key={tier}>
              <text x={padL - 8} y={y + barH / 2 + 4} textAnchor="end" fontSize="12" fontWeight="800"
                fill={tierColors[tier]} fontFamily="var(--mono)">{tier}</text>
              {total === 0
                ? <rect x={padL} y={y} width={chartW - padL - padR} height={barH} rx={6} fill="#F3F4F6" />
                : matrix[ti].map((count, ci) => {
                  const w = (count / maxTotal) * (chartW - padL - padR);
                  const rx0 = ci === 0 ? 6 : 0;
                  const rx1 = ci === matrix[ti].length - 1 ? 6 : 0;
                  const isHov = hov && hov.t === ti && hov.a === ci;
                  const el = (
                    <g key={ci} style={{ cursor: 'pointer' }}
                      onMouseEnter={() => setHov({ t: ti, a: ci, count })}
                      onMouseLeave={() => setHov(null)}>
                      <rect x={xOff} y={y} width={Math.max(w, 0)} height={barH}
                        fill={colors[actions[ci]]} opacity={isHov ? 1 : 0.82}
                        rx={0}
                        style={{ transition: 'opacity .15s' }}
                      />
                      {w > 22 && <text x={xOff + w / 2} y={y + barH / 2 + 4} textAnchor="middle"
                        fontSize="11" fontWeight="700" fill="#fff" fontFamily="var(--mono)">{count}</text>}
                    </g>
                  );
                  xOff += w;
                  return el;
                })
              }
              <text x={padL + (total / maxTotal) * (chartW - padL - padR) + 8} y={y + barH / 2 + 4}
                fontSize="11" fill="var(--text-3)" fontFamily="var(--mono)">{total} items</text>
            </g>
          );
        })}
        {/* x-axis grid lines */}
        {[0, .25, .5, .75, 1].map((p, i) => {
          const x = padL + p * (chartW - padL - padR);
          return <g key={i}>
            <line x1={x} y1={padT - 4} x2={x} y2={padT + tiers.length * (barH + gap) - gap} stroke="#F3F4F6" />
            {i > 0 && <text x={x} y={padT + tiers.length * (barH + gap) - gap + 14}
              textAnchor="middle" fontSize="9" fill="var(--text-3)" fontFamily="var(--mono)">{Math.round(maxTotal * p)}</text>}
          </g>;
        })}
      </svg>
      <div style={{ display: 'flex', gap: 14, justifyContent: 'center', marginTop: 4 }}>
        {actions.map(a => (
          <span key={a} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-2)' }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: colors[a] }}></span>{a}
          </span>
        ))}
      </div>
      {hov && (
        <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-2)', marginTop: 6 }}>
          Tier <b>{tiers[hov.t]}</b> · {actions[hov.a]}: <b style={{ color: colors[actions[hov.a]] }}>{hov.count} items</b>
        </div>
      )}
    </div>
  );
}

/* ===== BALANCE BRACKET CHART ===== */
function BalanceBracketChart({ data, mode = 'predicted' }) {
  const brackets = [
    { label: '< 1K',     min: 0,      max: 1000   },
    { label: '1K–10K',   min: 1000,   max: 10000  },
    { label: '10K–50K',  min: 10000,  max: 50000  },
    { label: '50K–200K', min: 50000,  max: 200000 },
    { label: '200K+',    min: 200000, max: Infinity },
  ];
  const actions = ['Deliver', 'Return', 'No Change'];
  const colors = { Deliver: '#059669', Return: '#DC2626', 'No Change': '#D97706' };
  const [hov, setHov] = React.useState(null);

  const matrix = brackets.map(br =>
    actions.map(a =>
      data.filter(d => {
        const bal = fcBal(d, mode) || 0;
        return fcAction(d, mode) === a && bal >= br.min && bal < br.max;
      }).length
    )
  );
  const totals = brackets.map((_, i) => matrix[i].reduce((s, c) => s + c, 0));
  const maxTotal = Math.max(...totals, 1);

  const barH = 26, gap = 10, padL = 76, padR = 56, padT = 8, padB = 12;
  const chartW = 420;
  const svgH = padT + brackets.length * (barH + gap) + padB;

  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 8 }}>
        Items grouped by {mode === 'actual' ? 'actual' : 'predicted'} closing balance. Shows where action decisions concentrate.
      </div>
      <svg width="100%" height={svgH} viewBox={`0 0 ${chartW} ${svgH}`} style={{ overflow: 'visible' }}>
        {brackets.map((br, bi) => {
          const y = padT + bi * (barH + gap);
          const total = totals[bi];
          let xOff = padL;
          return (
            <g key={bi}>
              <text x={padL - 8} y={y + barH / 2 + 4} textAnchor="end" fontSize="10"
                fill="var(--text-2)" fontWeight="600">{br.label}</text>
              {total === 0
                ? <rect x={padL} y={y} width={chartW - padL - padR} height={barH} rx={6} fill="#F3F4F6" />
                : matrix[bi].map((count, ci) => {
                  const w = (count / maxTotal) * (chartW - padL - padR);
                  const isHov = hov && hov.b === bi && hov.a === ci;
                  const el = (
                    <g key={ci} style={{ cursor: 'pointer' }}
                      onMouseEnter={() => setHov({ b: bi, a: ci, count, label: br.label })}
                      onMouseLeave={() => setHov(null)}>
                      <rect x={xOff} y={y} width={Math.max(w, 0)} height={barH}
                        fill={colors[actions[ci]]} opacity={isHov ? 1 : 0.8}
                        style={{ transition: 'opacity .15s' }} />
                      {w > 20 && <text x={xOff + w / 2} y={y + barH / 2 + 4} textAnchor="middle"
                        fontSize="10" fontWeight="700" fill="#fff" fontFamily="var(--mono)">{count}</text>}
                    </g>
                  );
                  xOff += w;
                  return el;
                })
              }
              <text x={padL + (total / maxTotal) * (chartW - padL - padR) + 8} y={y + barH / 2 + 4}
                fontSize="10" fill="var(--text-3)" fontFamily="var(--mono)">{total}</text>
            </g>
          );
        })}
      </svg>
      <div style={{ display: 'flex', gap: 14, justifyContent: 'center', marginTop: 6 }}>
        {actions.map(a => (
          <span key={a} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-2)' }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: colors[a] }}></span>{a}
          </span>
        ))}
      </div>
      {hov && (
        <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-2)', marginTop: 4 }}>
          Balance <b>{hov.label}</b> · {actions[hov.a]}: <b style={{ color: colors[actions[hov.a]] }}>{hov.count} items</b>
        </div>
      )}
    </div>
  );
}

Object.assign(window, { ActionDonut, TopItemsBar, HVBreakdown, ClosingBalancePortfolio, ActionFlowSankey, BalanceScatter, ModelAccuracyTable, ActionMagnitudeHeatmap, ActionCountBars, HighVelocityItems, HVMovementByPeriod, ItemForecastCard, ItemForecastsGrid, MapeDistributionChart, MapeBucketEditor, MAPE_DEFAULT_THRESHOLDS, DirectionAccuracyByMonth, PortfolioActualVsPredicted, ABCDistributionChart, BalanceBracketChart });
