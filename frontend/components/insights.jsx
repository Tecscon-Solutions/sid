/* Insights & analytics derived purely from the data */

/* ===== 1. ABC PARETO ANALYSIS ===== */
function ABCPareto({ data }) {
  const [showClass, setShowClass] = React.useState('A');
  const fmtK = v => v >= 1e6 ? (v/1e6).toFixed(1)+'M' : v >= 1e3 ? (v/1e3).toFixed(1)+'K' : Math.round(v).toLocaleString();

  const byItem = {};
  data.forEach(d => {
    const k = d.itemCode;
    if (!byItem[k]) byItem[k] = { itemCode: k, description: d.description, isHV: d.isHV, totalQty: 0 };
    byItem[k].totalQty += (d.quantity || 0);
  });
  const sorted = Object.values(byItem).filter(x => x.totalQty > 0).sort((a, b) => b.totalQty - a.totalQty);
  const totalQty = sorted.reduce((s, x) => s + x.totalQty, 0) || 1;
  const totalItems = sorted.length || 1;

  let cum = 0;
  const points = sorted.map((it, i) => {
    cum += it.totalQty;
    const cumPct = cum / totalQty;
    return { ...it, rank: i + 1, qty: it.totalQty, cumPct, class: cumPct <= 0.8 ? 'A' : cumPct <= 0.95 ? 'B' : 'C' };
  });

  const aItems = points.filter(p => p.class === 'A');
  const bItems = points.filter(p => p.class === 'B');
  const cItems = points.filter(p => p.class === 'C');
  const aVol = aItems.reduce((s, p) => s + p.qty, 0);
  const bVol = bItems.reduce((s, p) => s + p.qty, 0);
  const cVol = cItems.reduce((s, p) => s + p.qty, 0);

  const classes = [
    { id: 'A', label: 'Class A', color: '#059669', items: aItems, vol: aVol, desc: 'drives 80% of volume' },
    { id: 'B', label: 'Class B', color: '#D97706', items: bItems, vol: bVol, desc: '80–95% of volume' },
    { id: 'C', label: 'Class C', color: '#9CA3AF', items: cItems, vol: cVol, desc: 'long tail' },
  ];
  const activeClass = classes.find(c => c.id === showClass);
  const maxBarQty = activeClass?.items[0]?.qty || 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── KPI badges ── */}
      <div style={{ display: 'flex', gap: 10 }}>
        {classes.map(c => (
          <ABCBadge key={c.id} label={c.id} pct={c.desc}
            count={c.items.length} pctOfItems={((c.items.length / totalItems) * 100).toFixed(1)}
            color={c.color} />
        ))}
      </div>

      {/* ── The 80/20 story ── two stacked contrast bars ── */}
      <div style={{ background: '#FAFBFC', borderRadius: 10, padding: '14px 16px', border: '1px solid var(--border)' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', marginBottom: 12 }}>
          The 80 / 20 Rule — how concentrated is your volume?
        </div>
        {[
          { label: 'SKU count', values: classes.map(c => ({ pct: c.items.length / totalItems, count: c.items.length, color: c.color, id: c.id })) },
          { label: 'Volume share', values: classes.map(c => ({ pct: c.vol / totalQty, count: c.vol, color: c.color, id: c.id, fmt: true })) },
        ].map((row, ri) => (
          <div key={ri} style={{ marginBottom: ri === 0 ? 10 : 0 }}>
            <div style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 600, marginBottom: 4 }}>{row.label}</div>
            <div style={{ display: 'flex', height: 28, borderRadius: 6, overflow: 'hidden', gap: 1 }}>
              {row.values.map((v, vi) => (
                <div key={vi} style={{ flex: v.pct, background: v.color, opacity: 0.82, display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: v.pct > 0.06 ? 0 : 0, overflow: 'hidden', transition: 'flex .4s' }}
                  title={`${v.id}: ${(v.pct * 100).toFixed(1)}%`}>
                  {v.pct > 0.09 && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap' }}>
                      {v.id} · {(v.pct * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
          {classes.map(c => (
            <span key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-2)' }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: c.color, opacity: .85 }}></span>
              Class {c.id} — {c.items.length} items, {((c.vol / totalQty) * 100).toFixed(0)}% of volume
            </span>
          ))}
        </div>
      </div>

      {/* ── Top items drill-down per class ── */}
      <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
        {/* Tab selector */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: '#FAFBFC' }}>
          {classes.map(c => (
            <button key={c.id} onClick={() => setShowClass(c.id)}
              style={{ flex: 1, padding: '10px 0', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                background: showClass === c.id ? '#fff' : 'transparent',
                color: showClass === c.id ? c.color : 'var(--text-3)',
                borderBottom: showClass === c.id ? `2px solid ${c.color}` : '2px solid transparent',
                transition: 'all .15s' }}>
              {c.label}
              <span style={{ fontSize: 10, fontWeight: 500, marginLeft: 5, color: 'var(--text-3)' }}>({c.items.length})</span>
            </button>
          ))}
        </div>
        {/* Bar list for active class */}
        <div style={{ padding: '12px 16px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 10 }}>
            Top items in Class {activeClass?.id} — ranked by movement quantity.
            Showing {Math.min(activeClass?.items.length, 15)} of {activeClass?.items.length}.
          </div>
          {(activeClass?.items || []).slice(0, 15).map((it, i) => (
            <div key={it.itemCode} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--mono)', width: 24, textAlign: 'right', flexShrink: 0 }}>#{it.rank}</span>
              <div style={{ width: 160, fontSize: 11, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0, color: 'var(--text)' }} title={it.description}>
                {it.isHV && <span style={{ color: 'var(--accent)', marginRight: 3 }}>★</span>}{it.description}
              </div>
              <div style={{ flex: 1, height: 16, borderRadius: 4, background: '#F3F4F6', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 4, width: `${(it.qty / maxBarQty) * 100}%`, background: activeClass.color, opacity: .75, transition: 'width .4s' }} />
              </div>
              <span style={{ width: 54, fontSize: 10, fontFamily: 'var(--mono)', fontWeight: 700, color: activeClass.color, textAlign: 'right', flexShrink: 0 }}>{fmtK(it.qty)}</span>
              <span style={{ width: 40, fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text-3)', textAlign: 'right', flexShrink: 0 }}>{((it.qty / totalQty) * 100).toFixed(1)}%</span>
            </div>
          ))}
          {(activeClass?.items.length || 0) === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: 12, padding: 20 }}>No items in this class</div>
          )}
        </div>
      </div>

    </div>
  );
}

function ABCBadge({ label, pct, count, pctOfItems, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderRadius: 10, background: '#fff', border: '1px solid var(--border)', borderLeft: `4px solid ${color}` }}>
      <div style={{ width: 26, height: 26, borderRadius: 7, background: color, color: '#fff', fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{label}</div>
      <div>
        <div style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 500 }}>{pct}</div>
        <div style={{ fontSize: 13, fontWeight: 700, color, fontFamily: 'var(--mono)' }}>{count} items{pctOfItems && <span style={{ fontWeight: 500, color: 'var(--text-3)', fontSize: 10 }}> · {pctOfItems}% of SKUs</span>}</div>
      </div>
    </div>
  );
}


/* ===== 2. STOCK-OUT & EXCESS RISK WATCH ===== */
function RiskWatchlist({ data, allData, currentPeriod }) {
  // Build per-item series, sorted by period
  const byItem = {};
  allData.forEach(d => { if (!byItem[d.itemCode]) byItem[d.itemCode] = []; byItem[d.itemCode].push(d); });
  Object.values(byItem).forEach(arr => arr.sort((a, b) => a.period.localeCompare(b.period)));

  const stockOuts = [];
  const excess = [];
  const consecutive = []; // 3+ consecutive same action

  Object.entries(byItem).forEach(([code, series]) => {
    const last = series[series.length - 1];
    if (!last) return;
    // Stock-out risk: predicted closing <= 0 or trending strongly down
    if (last.predictedClosingBal != null && last.predictedClosingBal <= 0) {
      stockOuts.push({ ...last, severity: 'critical', reason: 'Projected balance ≤ 0' });
    } else if (series.length >= 3) {
      const recent = series.slice(-3);
      const trend = recent[2].predictedClosingBal - recent[0].predictedClosingBal;
      const avgQty = recent.reduce((s, x) => s + (x.quantity || 0), 0) / 3;
      if (trend < 0 && Math.abs(trend) > avgQty * 2 && last.predictedClosingBal < Math.abs(trend)) {
        stockOuts.push({ ...last, severity: 'warning', reason: `Falling fast (Δ${Math.round(trend)} in 3 mo)` });
      }
    }
    // Excess: balance growing for 4+ consecutive periods AND predominantly Return action
    if (series.length >= 4) {
      const last4 = series.slice(-4);
      const allGrowing = last4.every((d, i) => i === 0 || d.predictedClosingBal >= last4[i - 1].predictedClosingBal);
      const returnCount = last4.filter(d => d.predictedAction === 'Return').length;
      if (allGrowing && returnCount >= 2 && last.predictedClosingBal > (series[0]?.predictedClosingBal || 0) * 1.2) {
        const growth = ((last.predictedClosingBal - last4[0].predictedClosingBal) / Math.max(last4[0].predictedClosingBal, 1) * 100).toFixed(0);
        excess.push({ ...last, severity: 'warning', reason: `Balance up ${growth}% over 4 mo` });
      }
    }
    // Consecutive same action ≥ 4 periods
    if (series.length >= 4) {
      let count = 1, lastAction = series[series.length - 1].predictedAction;
      for (let i = series.length - 2; i >= 0; i--) {
        if (series[i].predictedAction === lastAction) count++; else break;
      }
      if (count >= 4 && lastAction !== 'No Change') {
        consecutive.push({ ...last, severity: 'info', reason: `${count} consecutive ${lastAction.toLowerCase()}s`, action: lastAction });
      }
    }
  });

  stockOuts.sort((a, b) => (a.severity === 'critical' ? -1 : b.severity === 'critical' ? 1 : 0));
  excess.sort((a, b) => (b.predictedClosingBal || 0) - (a.predictedClosingBal || 0));

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
      <RiskColumn title="Stock-out Risk" subtitle="Items projected to deplete" items={stockOuts.slice(0, 8)} color="#DC2626" icon="↓" emptyMsg="No stock-out risks detected" />
      <RiskColumn title="Excess Inventory" subtitle="Growing balances · candidates for return" items={excess.slice(0, 8)} color="#D97706" icon="↑" emptyMsg="No excess inventory flagged" />
      <RiskColumn title="Persistent Pattern" subtitle="Same action ≥ 4 months running" items={consecutive.slice(0, 8)} color="var(--accent)" icon="↻" emptyMsg="No persistent patterns" />
    </div>
  );
}

function RiskColumn({ title, subtitle, items, color, icon, emptyMsg }) {
  return (
    <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
      {/* Coloured header band */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: color + '08' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 24, height: 24, borderRadius: 6, background: color + '20', color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800 }}>{icon}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{title}</div>
            <div style={{ fontSize: 10, color: 'var(--text-3)' }}>{subtitle}</div>
          </div>
          <div style={{ fontSize: 13, fontWeight: 800, color, fontFamily: 'var(--mono)', background: color + '15', padding: '2px 8px', borderRadius: 6 }}>{items.length}</div>
        </div>
      </div>
      {/* Items list */}
      <div style={{ padding: '6px 16px 10px' }}>
        {items.length === 0 ? (
          <div style={{ fontSize: 11, color: 'var(--text-3)', padding: '16px 4px', textAlign: 'center' }}>{emptyMsg}</div>
        ) : items.map((item, i) => (
          <div key={item.itemCode + i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: i < items.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.description}>{item.description}</div>
              <div style={{ fontSize: 10, color: 'var(--text-2)', marginTop: 1 }}>{item.reason}</div>
            </div>
            {item.severity === 'critical'
              ? <span style={{ padding: '2px 6px', borderRadius: 5, fontSize: 9.5, fontWeight: 700, background: '#DC2626', color: '#fff', flexShrink: 0 }}>CRITICAL</span>
              : <span style={{ padding: '2px 7px', borderRadius: 5, fontSize: 9.5, fontWeight: 700, background: color + '22', color, flexShrink: 0 }}>WATCH</span>
            }
          </div>
        ))}
      </div>
    </div>
  );
}

/* ===== 3. ACTION CALENDAR HEATMAP ===== */
function ActionCalendarHeatmap({ data }) {
  const [hvOnly, setHvOnly] = React.useState(false);
  const [sortBy, setSortBy] = React.useState('qty');
  const [hover, setHover] = React.useState(null);
  const [mousePos, setMousePos] = React.useState({ x: 0, y: 0 });

  const MO = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const ac  = a => a === 'Deliver' ? '#059669' : a === 'Return' ? '#DC2626' : a === 'No Change' ? '#D97706' : null;
  const acBg= a => a === 'Deliver' ? 'rgba(5,150,105,.12)' : a === 'Return' ? 'rgba(220,38,38,.1)' : 'rgba(217,119,6,.1)';
  const fmtPeriod = p => { const m = p.match(/^(\d{4})-(\d{2})$/); return m ? MO[parseInt(m[2])-1] + " '" + m[1].slice(2) : p; };
  const yearOf = p => p.split('-')[0];

  // Newest month first, left to right (client asked for descending order).
  const periods = [...new Set(data.map(d => d.period))].sort().reverse();

  const byItem = React.useMemo(() => {
    const map = {};
    data.forEach(d => {
      if (!map[d.itemCode]) map[d.itemCode] = { itemCode: d.itemCode, description: d.description, isHV: d.isHV, totalQty: 0, byPeriod: {}, actions: [] };
      map[d.itemCode].totalQty += (d.quantity || 0);
      map[d.itemCode].byPeriod[d.period] = d;
      map[d.itemCode].actions.push(d.predictedAction);
    });
    return map;
  }, [data]);

  const items = React.useMemo(() => {
    let arr = Object.values(byItem);
    if (hvOnly) arr = arr.filter(it => it.isHV);
    // streak: count of consecutive same action at the end (the latest months).
    // `periods` is newest-first for display, so walk it oldest-first here.
    arr = arr.map(it => {
      const sortedActions = periods.slice().reverse().map(p => it.byPeriod[p]?.predictedAction).filter(Boolean);
      let streak = 0;
      const last = sortedActions[sortedActions.length - 1];
      for (let i = sortedActions.length - 1; i >= 0; i--) { if (sortedActions[i] === last) streak++; else break; }
      // dominant action
      const counts = {};
      sortedActions.forEach(a => { counts[a] = (counts[a] || 0) + 1; });
      const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
      return { ...it, streak, lastAction: last, dominant, dominantCount: counts[dominant] || 0, totalPeriods: sortedActions.length };
    });
    if (sortBy === 'qty') arr.sort((a, b) => b.totalQty - a.totalQty);
    else if (sortBy === 'streak') arr.sort((a, b) => b.streak - a.streak);
    else if (sortBy === 'hv') arr.sort((a, b) => (b.isHV ? 1 : 0) - (a.isHV ? 1 : 0) || b.totalQty - a.totalQty);
    return arr.slice(0, 35);
  }, [byItem, hvOnly, sortBy, periods]);

  const colW = Math.max(28, Math.min(44, Math.floor(760 / periods.length)));
  const rowH = 26;


  const handleMouseMove = (e) => setMousePos({ x: e.clientX, y: e.clientY });

  return (
    <div onMouseMove={handleMouseMove}>
      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 8, fontSize: 11 }}>
          {[['Deliver','#059669'],['Return','#DC2626'],['No Change','#D97706']].map(([a,c]) => (
            <span key={a} style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-2)' }}>
              <span style={{ width: 12, height: 12, borderRadius: 3, background: c, opacity: .85 }}></span>{a}
            </span>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Sort:</span>
          {[['qty','By Volume'],['streak','By Streak'],['hv','HV First']].map(([v,l]) => (
            <button key={v} onClick={() => setSortBy(v)} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 6, border: '1px solid', borderColor: sortBy === v ? 'var(--accent)' : 'var(--border)', background: sortBy === v ? 'var(--accent)' : '#fff', color: sortBy === v ? '#fff' : 'var(--text-2)', cursor: 'pointer', fontFamily: 'var(--font)', fontWeight: 600 }}>{l}</button>
          ))}
          <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, cursor: 'pointer', fontWeight: 600, color: hvOnly ? 'var(--accent)' : 'var(--text-3)' }}>
            <input type="checkbox" checked={hvOnly} onChange={e => setHvOnly(e.target.checked)} style={{ accentColor: 'var(--accent)', margin: 0 }} />HV Only
          </label>
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{items.length} items × {periods.length} periods</span>
      </div>

      {/* Grid — themed scroller so horizontal overflow with many periods is obvious */}
      <div className="h-scroller" style={{ maxHeight: 660, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
        <table style={{ borderCollapse: 'separate', borderSpacing: 2, fontSize: 11, tableLayout: 'fixed' }}>
          <thead>
            <tr>
              {/* sticky item name col header */}
              <th style={{ position: 'sticky', left: 0, top: 0, background: '#FAFBFC', zIndex: 4, width: 190, padding: '6px 10px', borderBottom: '2px solid var(--border)', fontSize: 10, color: 'var(--text-3)', textAlign: 'left', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', whiteSpace: 'nowrap' }}>Item</th>
              {periods.map((p, i) => {
                const mo = MO[parseInt(p.split('-')[1]) - 1];
                const yr = p.split('-')[0].slice(2);
                const isYearStart = i === 0 || yearOf(p) !== yearOf(periods[i-1]);
                return (
                  <th key={p} style={{ width: colW, position: 'sticky', top: 0, background: '#FAFBFC', zIndex: 3, padding: '4px 0', textAlign: 'center', borderBottom: '2px solid var(--border)', borderLeft: isYearStart && i > 0 ? '2px solid var(--accent)' : 'none' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-2)', fontFamily: 'var(--mono)' }}>{mo}</div>
                    {isYearStart && <div style={{ fontSize: 9, color: 'var(--accent)', fontWeight: 700, lineHeight: 1 }}>{yr}</div>}
                  </th>
                );
              })}
              <th style={{ position: 'sticky', right: 0, top: 0, background: '#FAFBFC', zIndex: 4, width: 90, padding: '6px 8px', borderBottom: '2px solid var(--border)', fontSize: 10, color: 'var(--text-3)', textAlign: 'center', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', whiteSpace: 'nowrap', borderLeft: '1px solid var(--border)' }}>Pattern</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, ri) => (
              <tr key={it.itemCode} style={{ background: ri % 2 === 0 ? '#fff' : '#FAFBFC' }}>
                {/* Sticky item label */}
                <td style={{ position: 'sticky', left: 0, background: ri % 2 === 0 ? '#fff' : '#FAFBFC', zIndex: 2, padding: '0 10px', borderRight: '1px solid var(--border)', whiteSpace: 'nowrap', maxWidth: 190, overflow: 'hidden', textOverflow: 'ellipsis', height: rowH }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden' }}>
                    {it.isHV && <span style={{ fontSize: 10, color: 'var(--accent)', flexShrink: 0 }}>★</span>}
                    <span style={{ fontSize: 11, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text)' }} title={it.description}>{it.description}</span>
                  </div>
                </td>
                {/* Action cells */}
                {periods.map((p, pi) => {
                  const cell = it.byPeriod[p];
                  const action = cell?.predictedAction;
                  const col = ac(action);
                  const isHov = hover?.code === it.itemCode && hover?.period === p;
                  const isYearStart = pi > 0 && yearOf(p) !== yearOf(periods[pi-1]);
                  return (
                    <td key={p}
                      onMouseEnter={() => setHover({ code: it.itemCode, period: p, item: it, cell })}
                      onMouseLeave={() => setHover(null)}
                      style={{ width: colW, height: rowH, padding: 1, cursor: cell ? 'pointer' : 'default', borderLeft: isYearStart ? '2px solid var(--accent)' : 'none' }}>
                      <div style={{
                        height: '100%', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: col ? col : '#fff',
                        opacity: col ? (isHov ? 1 : 0.92) : 1,
                        border: col ? 'none' : '1px solid #E5E7EB',
                        transition: 'opacity .1s',
                        boxShadow: isHov ? `0 0 0 2px ${col}` : 'none',
                      }}>
                        {col && (
                          /* Always render the D/R/N letter (scale font down on
                             narrow cells) so the grid isn't color-only. */
                          <span style={{ fontSize: colW >= 36 ? 9 : 8, fontWeight: 800, color: '#fff', letterSpacing: '.02em', userSelect: 'none' }}>
                            {action === 'Deliver' ? 'D' : action === 'Return' ? 'R' : 'N'}
                          </span>
                        )}
                      </div>
                    </td>
                  );
                })}
                {/* Pattern summary */}
                <td style={{ position: 'sticky', right: 0, background: ri % 2 === 0 ? '#fff' : '#FAFBFC', zIndex: 2, padding: '0 8px', textAlign: 'center', borderLeft: '1px solid var(--border)', height: rowH }}>
                  {it.dominant && (
                    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: ac(it.dominant), background: acBg(it.dominant), padding: '1px 6px', borderRadius: 4, whiteSpace: 'nowrap' }}>
                        {it.dominantCount}× {it.dominant === 'No Change' ? 'NC' : it.dominant.slice(0,3)}
                      </span>
                      {it.streak >= 3 && (
                        <span style={{ fontSize: 9, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>{it.streak} streak</span>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mouse-tracking tooltip */}
      {hover?.cell && (
        <div style={{
          position: 'fixed', pointerEvents: 'none', zIndex: 9999,
          left: mousePos.x + 14, top: mousePos.y + 14,
          background: '#1F2937', color: '#fff', borderRadius: 8,
          padding: '10px 14px', fontSize: 11, boxShadow: '0 8px 24px rgba(0,0,0,.2)',
          maxWidth: 240, lineHeight: 1.5,
        }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>{hover.item.description}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, color: '#D1D5DB' }}>
            <span>{fmtPeriod(hover.period)}</span>
            <span style={{ color: ac(hover.cell.predictedAction), fontWeight: 700 }}>{hover.cell.predictedAction}</span>
            {hover.cell.quantity != null && <span>Qty: {Math.round(hover.cell.quantity).toLocaleString()}</span>}
            {hover.cell.predictedClosingBal != null && <span>Pred. Bal: {Math.round(hover.cell.predictedClosingBal).toLocaleString()}</span>}
            {hover.cell.actualClosingBal != null && <span>Actual Bal: {Math.round(hover.cell.actualClosingBal).toLocaleString()}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

/* ===== 4. YEAR-OVER-YEAR COMPARISON ===== */
function YearOverYearComparison({ allData }) {
  const periods = [...new Set(allData.map(d => d.period))].sort();
  const years = [...new Set(periods.map(p => p.split('-')[0]))].sort();
  if (years.length < 2) return <div style={{ fontSize: 12, color: 'var(--text-3)', padding: 24, textAlign: 'center' }}>Year-over-year requires data spanning ≥2 calendar years.</div>;

  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  // Metrics worth comparing the same month across years. All are monthly
  // movement aggregates (closing-balance style metrics don't layer cleanly),
  // so the y-axis stays a clean units scale. "Net movement" is the magnitude
  // |Deliver − Return| in the chart; the table keeps the signed net.
  const METRICS = [
    { key: 'net',     label: 'Net movement',   desc: '|Deliver − Return| units', value: m => Math.abs(m.net), tableSigned: true,  tableValue: m => m.net,     color: 'var(--accent)' },
    { key: 'deliver', label: 'Deliver',        desc: 'units delivered',          value: m => m.deliver,      tableSigned: false, tableValue: m => m.deliver, color: '#059669' },
    { key: 'return',  label: 'Return',         desc: 'units returned',           value: m => m.return,       tableSigned: false, tableValue: m => m.return,  color: '#DC2626' },
    { key: 'total',   label: 'Total movement', desc: 'Deliver + Return units',   value: m => m.total,        tableSigned: false, tableValue: m => m.total,   color: '#7C3AED' },
  ];
  const [metricKey, setMetricKey] = React.useState('net');
  const [showInfo, setShowInfo] = React.useState(false);
  const [hoverM, setHoverM] = React.useState(null);
  const metric = METRICS.find(x => x.key === metricKey) || METRICS[0];

  const series = years.map(y => ({
    year: y,
    months: months.map((_, mIdx) => {
      const period = `${y}-${String(mIdx + 1).padStart(2, '0')}`;
      const rows = allData.filter(d => d.period === period);
      const del = rows.filter(d => d.predictedAction === 'Deliver').reduce((s, d) => s + (d.quantity || 0), 0);
      const ret = rows.filter(d => d.predictedAction === 'Return').reduce((s, d) => s + (d.quantity || 0), 0);
      return { deliver: del, return: ret, net: del - ret, total: del + ret, hasData: rows.length > 0 };
    })
  }));

  const valOf = m => metric.value(m);
  const allValues = series.flatMap(s => s.months.filter(m => m.hasData).map(valOf));
  const max = Math.max(...allValues, 1);
  const fmtK = v => { const a = Math.abs(v), sg = v < 0 ? '-' : ''; return a >= 1e6 ? sg + (a / 1e6).toFixed(1) + 'M' : a >= 1e3 ? sg + (a / 1e3).toFixed(1) + 'K' : sg + Math.round(a); };

  // Distinct hue per calendar year (no more opacity fading).
  const YEAR_PALETTE = ['#4F46E5', '#059669', '#DC2626', '#D97706', '#0891B2', '#DB2777', '#7C3AED', '#0D9488'];
  const yearColor = idx => YEAR_PALETTE[idx % YEAR_PALETTE.length];

  const w = 880, h = 240, padL = 50, padR = 16, padT = 16, padB = 30;
  const cW = w - padL - padR, cH = h - padT - padB;
  const x = i => padL + ((i + 0.5) / 12) * cW;
  const y = v => padT + cH - (v / max) * cH;

  const segBtn = (on, c) => ({ padding: '5px 12px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 11.5, fontWeight: 700, fontFamily: 'var(--font)', background: on ? (c || 'var(--accent)') : 'transparent', color: on ? '#fff' : 'var(--text-2)', transition: 'background .12s, color .12s' });
  const thYoY = align => ({ padding: align === 'center' ? '8px 4px' : '8px 10px', textAlign: align, fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.04em', fontWeight: 600 });

  return (
    <div>
      {/* Metric selector + info toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Metric</span>
        <div style={{ display: 'inline-flex', background: 'var(--surface-2)', borderRadius: 9, padding: 3, gap: 3 }}>
          {METRICS.map(mt => <button key={mt.key} onClick={() => setMetricKey(mt.key)} style={segBtn(mt.key === metricKey, mt.color)}>{mt.label}</button>)}
        </div>
        <button onClick={() => setShowInfo(s => !s)} title="What is this chart?" style={{ marginLeft: 'auto', width: 26, height: 26, borderRadius: 6, border: '1px solid var(--border)', background: showInfo ? 'var(--accent-surface)' : '#fff', color: showInfo ? 'var(--accent)' : 'var(--text-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><line x1="12" y1="11.5" x2="12" y2="16.5" /><circle cx="12" cy="7.6" r="0.7" fill="currentColor" stroke="none" /></svg>
        </button>
      </div>

      {showInfo && (
        <div style={{ background: 'var(--accent-surface)', border: '1px solid var(--accent-border)', borderRadius: 8, padding: '10px 12px', fontSize: 11.5, color: 'var(--text-2)', lineHeight: 1.55, marginBottom: 12 }}>
          <b style={{ color: 'var(--accent)' }}>How to read this chart.</b> Each coloured line is one calendar year, drawn across the months Jan–Dec. Because every year shares the same x-axis, you can line up the same month across years and instantly see whether this year is running ahead of or behind the years before it — useful for spotting seasonality and growth. The y-axis is whichever metric you pick above — currently <b>{metric.label}</b> ({metric.desc}). Hover over any month to read every year's value side by side. The table underneath lists the exact monthly figures and a per-year total for the selected metric.
        </div>
      )}

      {/* Year legend (distinct colour per year) */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 8, fontSize: 11, flexWrap: 'wrap' }}>
        {series.map((s, i) => <span key={s.year} style={{ display: 'flex', alignItems: 'center', gap: 5, fontWeight: 600, color: 'var(--text-2)' }}><span style={{ width: 14, height: 3, borderRadius: 2, background: yearColor(i) }}></span>{s.year}</span>)}
      </div>

      <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ overflow: 'visible' }} onMouseLeave={() => setHoverM(null)}>
        {[0, .25, .5, .75, 1].map((p, i) => { const yy = padT + cH - cH * p; return <g key={i}><line x1={padL} y1={yy} x2={w - padR} y2={yy} stroke="#F3F4F6" /><text x={padL - 6} y={yy + 3.5} textAnchor="end" fontSize="10" fill="var(--text-3)" fontFamily="var(--mono)">{fmtK(max * p)}</text></g>; })}
        {hoverM != null && <line x1={x(hoverM)} y1={padT} x2={x(hoverM)} y2={padT + cH} stroke="var(--text-3)" strokeWidth="1" strokeDasharray="3 3" opacity=".5" />}
        {series.map((s, sIdx) => {
          const c = yearColor(sIdx);
          const path = s.months.map((m, i) => m.hasData ? `${i === 0 || !s.months[i - 1].hasData ? 'M' : 'L'} ${x(i)} ${y(valOf(m))}` : '').filter(Boolean).join(' ');
          return <g key={s.year}>
            <path d={path} fill="none" stroke={c} strokeWidth={2} strokeLinejoin="round" />
            {s.months.map((m, i) => m.hasData && <circle key={i} cx={x(i)} cy={y(valOf(m))} r={hoverM === i ? 4.5 : 3} fill={c} stroke="#fff" strokeWidth={hoverM === i ? 1.5 : 0} />)}
          </g>;
        })}
        {months.map((m, i) => <text key={m} x={x(i)} y={padT + cH + 16} textAnchor="middle" fontSize="10" fill={hoverM === i ? 'var(--text)' : 'var(--text-3)'} fontWeight={hoverM === i ? 700 : 400} fontFamily="var(--mono)">{m}</text>)}
        {months.map((m, i) => <rect key={'h' + i} x={padL + (i / 12) * cW} y={padT} width={cW / 12} height={cH} fill="transparent" style={{ cursor: 'crosshair' }} onMouseEnter={() => setHoverM(i)} />)}
        {hoverM != null && (() => {
          const rowsForM = series.map((s, sIdx) => ({ year: s.year, color: yearColor(sIdx), m: s.months[hoverM] })).filter(r => r.m.hasData);
          if (!rowsForM.length) return null;
          const boxW = 132, lineH = 15, boxH = 22 + rowsForM.length * lineH;
          let bx = x(hoverM) + 12; if (bx + boxW > w - padR) bx = x(hoverM) - 12 - boxW;
          const by = padT + 2;
          return <g style={{ pointerEvents: 'none' }}>
            <rect x={bx} y={by} width={boxW} height={boxH} rx={7} fill="#fff" stroke="var(--border)" style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,.10))' }} />
            <text x={bx + 10} y={by + 15} fontSize="10.5" fontWeight="800" fill="var(--text)">{months[hoverM]} · {metric.label}</text>
            {rowsForM.map((r, ri) => (
              <g key={r.year} transform={`translate(${bx + 10}, ${by + 21 + ri * lineH})`}>
                <rect x={0} y={1} width={8} height={8} rx={2} fill={r.color} />
                <text x={13} y={8} fontSize="10" fill="var(--text-2)">{r.year}</text>
                <text x={boxW - 20} y={8} textAnchor="end" fontSize="10" fontWeight="700" fontFamily="var(--mono)" fill="var(--text)">{fmtK(valOf(r.m))}</text>
              </g>
            ))}
          </g>;
        })()}
      </svg>
      <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>{metric.label} ({metric.desc}) by month, one line per year. Hover a month for values.</div>

      {/* Metric table — header names the metric being shown */}
      <div style={{ marginTop: 18 }}>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 2 }}>YoY {metric.label} by month</div>
        <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 8 }}>Metric: <b style={{ color: 'var(--text-2)' }}>{metric.label}</b> · {metric.desc}{metric.tableSigned ? ' · sign shows direction (+ net delivered out, − net returned)' : ''}.</div>
        <div style={{ borderRadius: 8, border: '1px solid var(--border)', overflow: 'auto' }} className="h-scroller">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, minWidth: 640 }}>
            <thead>
              <tr style={{ background: '#FAFBFC' }}>
                <th style={thYoY('left')}>Year</th>
                {months.map(m => <th key={m} style={thYoY('center')}>{m}</th>)}
                <th style={thYoY('right')}>Total</th>
              </tr>
            </thead>
            <tbody>
              {series.map((s, sIdx) => {
                const total = s.months.reduce((sum, m) => sum + (m.hasData ? metric.tableValue(m) : 0), 0);
                return (
                  <tr key={s.year} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 10px', fontFamily: 'var(--mono)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                      <span style={{ display: 'inline-block', width: 10, height: 3, borderRadius: 2, background: yearColor(sIdx), marginRight: 6, verticalAlign: 'middle' }}></span>{s.year}
                    </td>
                    {s.months.map((m, i) => {
                      const v = metric.tableValue(m);
                      const color = !m.hasData ? 'var(--text-3)' : metric.tableSigned ? (v > 0 ? '#059669' : v < 0 ? '#DC2626' : 'var(--text-3)') : 'var(--text-2)';
                      return <td key={i} style={{ padding: '8px 4px', textAlign: 'center', fontFamily: 'var(--mono)', fontSize: 10, color, fontWeight: 600 }}>{!m.hasData ? '—' : (metric.tableSigned && v > 0 ? '+' : '') + fmtK(v)}</td>;
                    })}
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'var(--mono)', fontWeight: 700, color: metric.tableSigned ? (total > 0 ? '#059669' : total < 0 ? '#DC2626' : 'var(--text-3)') : metric.color }}>{(metric.tableSigned && total > 0 ? '+' : '') + fmtK(total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ===== 5. AUTO-INSIGHTS PANEL ===== */
function AutoInsights({ allData, currentPeriod }) {
  const fmtQty = v => v >= 1e6 ? (v/1e6).toFixed(1)+'M' : v >= 1000 ? (v/1000).toFixed(1)+'K' : Math.round(v).toLocaleString();
  const periods = [...new Set(allData.map(d => d.period))].sort();
  const insights = [];

  // Insight 1: Net inventory direction
  const curr = allData.filter(d => d.period === currentPeriod);
  const delQ = curr.filter(d => d.predictedAction === 'Deliver').reduce((s, d) => s + (d.quantity || 0), 0);
  const retQ = curr.filter(d => d.predictedAction === 'Return').reduce((s, d) => s + (d.quantity || 0), 0);
  const net = delQ - retQ;
  insights.push({
    severity: net >= 0 ? 'positive' : 'negative', icon: net >= 0 ? '↑' : '↓',
    title: `Net inventory ${net >= 0 ? 'expanding' : 'contracting'} this period`,
    body: `${fmtQty(Math.abs(net))} units net ${net >= 0 ? 'inflow' : 'outflow'} (${fmtQty(delQ)} deliver vs ${fmtQty(retQ)} return).`,
  });

  // Insight 2: HV concentration
  const hv = curr.filter(d => d.isHV);
  const hvDeliver = hv.filter(d => d.predictedAction === 'Deliver').length;
  if (hv.length > 0) {
    const pct = Math.round((hvDeliver / hv.length) * 100);
    insights.push({
      severity: 'info', icon: '★',
      title: `${pct}% of HV items flagged for delivery`,
      body: `${hvDeliver} of ${hv.length} high-value SKUs need to ship out this period.`,
    });
  }

  // Insight 3: Persistent action pattern
  const byItem = {};
  allData.forEach(d => { if (!byItem[d.itemCode]) byItem[d.itemCode] = []; byItem[d.itemCode].push(d); });
  Object.values(byItem).forEach(arr => arr.sort((a, b) => a.period.localeCompare(b.period)));
  let persistentReturn = 0, persistentDeliver = 0;
  const minStreak = Math.min(6, periods.length);
  Object.values(byItem).forEach(series => {
    if (series.length < minStreak) return;
    const last = series.slice(-minStreak);
    if (last.every(d => d.predictedAction === 'Return')) persistentReturn++;
    if (last.every(d => d.predictedAction === 'Deliver')) persistentDeliver++;
  });
  if ((persistentReturn + persistentDeliver) > 0) {
    insights.push({
      severity: 'warning', icon: '↻',
      title: `Persistent patterns: ${persistentReturn + persistentDeliver} items locked in one direction`,
      body: `${persistentReturn} returning and ${persistentDeliver} delivering for ${minStreak}+ consecutive months — may signal mis-allocated stock.`,
    });
  }

  // Insight 4: Stock-out risk
  const zeroBal = curr.filter(d => d.predictedClosingBal != null && d.predictedClosingBal <= 0).length;
  if (zeroBal > 0) {
    insights.push({
      severity: 'critical', icon: '!',
      title: `${zeroBal} item${zeroBal === 1 ? '' : 's'} projected to deplete`,
      body: `Predicted closing balance ≤ 0 — these need urgent replenishment.`,
    });
  }

  // Insight 5: Volatility
  const volatile = [];
  Object.entries(byItem).forEach(([code, series]) => {
    if (series.length < 4) return;
    const actions = series.slice(-6).map(d => d.predictedAction);
    const flips = actions.reduce((s, a, i) => s + (i > 0 && a !== actions[i-1] ? 1 : 0), 0);
    if (flips >= 4) volatile.push({ code, description: series[0].description });
  });
  if (volatile.length > 0) {
    insights.push({
      severity: 'info', icon: '⇌',
      title: `${volatile.length} highly volatile items detected`,
      body: `Items flipping between deliver/return ≥ 4 times in 6 months: ${volatile.slice(0, 3).map(v => v.description).join(', ')}${volatile.length > 3 ? '…' : ''}.`,
    });
  }

  // Insight 6: Concentration
  const totalQ = curr.reduce((s, d) => s + (d.quantity || 0), 0);
  if (totalQ > 0) {
    const sortedQ = [...curr].sort((a, b) => (b.quantity || 0) - (a.quantity || 0));
    let cum = 0, count = 0;
    for (const item of sortedQ) { cum += (item.quantity || 0); count++; if (cum / totalQ >= 0.8) break; }
    const pct = ((count / curr.length) * 100).toFixed(0);
    insights.push({
      severity: 'info', icon: '◐',
      title: `${pct}% of items drive 80% of movement this period`,
      body: `Concentration is ${pct < 20 ? 'high — focus operations on this short list' : pct < 40 ? 'moderate' : 'low — movement is spread thin'}.`,
    });
  }

  const sevColor = { positive: '#059669', negative: '#DC2626', warning: '#D97706', critical: '#DC2626', info: 'var(--accent)' };
  const sevBg = { positive: 'rgba(5,150,105,.08)', negative: 'rgba(220,38,38,.07)', warning: 'rgba(217,119,6,.08)', critical: 'rgba(220,38,38,.1)', info: 'rgba(79,70,229,.06)' };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
      {insights.map((ins, i) => (
        // Uniform card border — the icon + its tinted background already
        // convey severity. The previous coloured left strip read as
        // template-y and competed with the icon for attention.
        <div key={i} style={{ display: 'flex', gap: 12, padding: '14px 16px', background: '#fff', border: '1px solid var(--border)', borderRadius: 12 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: sevBg[ins.severity], color: sevColor[ins.severity], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, flexShrink: 0 }}>{ins.icon}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 3, lineHeight: 1.3 }}>{ins.title}</div>
            <div style={{ fontSize: 11, color: 'var(--text-2)', lineHeight: 1.55 }}>{ins.body}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

Object.assign(window, { ABCPareto, RiskWatchlist, ActionCalendarHeatmap, YearOverYearComparison, AutoInsights });
