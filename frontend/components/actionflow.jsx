/* ============================================================
   Action Flow — dedicated page.

   Shows how every item's recommended (or actual) action moves between
   two months: Deliver / Return / No Change in month A → the same three
   in month B. Rendered as a clickable two-layer Sankey. Click any flow
   ribbon (or a node) and the right-hand panel lists the exact items in
   that selection — e.g. "the 23 items that went Deliver → Return".
   ============================================================ */
function ActionFlowPage({ allData }) {
  const ACTIONS = ['Deliver', 'Return', 'No Change'];
  const COL = { Deliver: '#059669', Return: '#DC2626', 'No Change': '#D97706' };
  const COLBG = { Deliver: 'rgba(5,150,105,.10)', Return: 'rgba(220,38,38,.09)', 'No Change': 'rgba(217,119,6,.10)' };
  const abbr = { Deliver: 'Deliver', Return: 'Return', 'No Change': 'No Chg' };

  const periods = React.useMemo(() => [...new Set((allData || []).map(d => d.period))].sort(), [allData]);
  const [fromP, setFromP] = React.useState(null);
  const [toP, setToP] = React.useState(null);
  React.useEffect(() => {
    if (!periods.length) return;
    setFromP(p => (p && periods.includes(p)) ? p : periods[Math.max(0, periods.length - 2)]);
    setToP(p => (p && periods.includes(p)) ? p : periods[periods.length - 1]);
  }, [periods]);

  const fmtP = p => { if (!p) return ''; const [y, m] = p.split('-'); const ns = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']; return `${ns[parseInt(m) - 1]} ${y}`; };

  const fromRows = React.useMemo(() => (allData || []).filter(d => d.period === fromP), [allData, fromP]);
  const toRows = React.useMemo(() => (allData || []).filter(d => d.period === toP), [allData, toP]);

  // Predicted / Actual toggle — only when both chosen months have actuals.
  const [mode, setMode] = React.useState('predicted');
  const hasA = rows => rows.some(d => d.actualClosingBal != null);
  const canToggle = hasA(fromRows) && hasA(toRows);
  const viewMode = canToggle ? mode : 'predicted';
  const fmtK = v => v == null ? '—' : v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : v >= 1e3 ? (v / 1e3).toFixed(1) + 'K' : Math.round(v).toLocaleString();

  // Build the transition matrix between the two months.
  const { byCell, srcTotals, tgtTotals, total } = React.useMemo(() => {
    const fromMap = {};
    fromRows.forEach(d => { fromMap[d.itemCode] = fcAction(d, viewMode); });
    const byCell = {};
    const srcTotals = { Deliver: 0, Return: 0, 'No Change': 0 };
    const tgtTotals = { Deliver: 0, Return: 0, 'No Change': 0 };
    let total = 0;
    toRows.forEach(d => {
      const from = fromMap[d.itemCode];
      const to = fcAction(d, viewMode);
      if (!from || !to) return;
      total++;
      srcTotals[from]++; tgtTotals[to]++;
      const k = from + '||' + to;
      (byCell[k] = byCell[k] || []).push({ itemCode: d.itemCode, desc: d.description, isHV: d.isHV, qty: fcQty(d, viewMode), from, to });
    });
    return { byCell, srcTotals, tgtTotals, total };
  }, [fromRows, toRows, viewMode]);

  const changed = React.useMemo(() => ACTIONS.reduce((s, f) => s + ACTIONS.reduce((ss, t) => ss + (f !== t ? (byCell[f + '||' + t]?.length || 0) : 0), 0), 0), [byCell]);

  const [sel, setSel] = React.useState(null); // {kind:'flow',from,to} | {kind:'src',action} | {kind:'tgt',action}
  React.useEffect(() => { setSel(null); }, [fromP, toP, viewMode]);

  // Items for the current selection.
  const selItems = React.useMemo(() => {
    let items = [];
    if (!sel) return items;
    if (sel.kind === 'flow') items = byCell[sel.from + '||' + sel.to] || [];
    else if (sel.kind === 'src') items = ACTIONS.flatMap(t => byCell[sel.action + '||' + t] || []);
    else if (sel.kind === 'tgt') items = ACTIONS.flatMap(f => byCell[f + '||' + sel.action] || []);
    return [...items].sort((a, b) => (b.qty || 0) - (a.qty || 0));
  }, [sel, byCell]);

  // Item drill-down: clicking a row in the list opens that item's full
  // forecast history (the same card used on the Item Forecasts page).
  const [itemSel, setItemSel] = React.useState(null);
  React.useEffect(() => { setItemSel(null); }, [fromP, toP, viewMode, sel]);
  const itemDetail = React.useMemo(() => {
    if (!itemSel) return null;
    const rows = (allData || []).filter(d => d.itemCode === itemSel)
      .sort((a, b) => (a.period < b.period ? -1 : a.period > b.period ? 1 : 0));
    if (!rows.length) return null;
    return { itemCode: itemSel, description: rows[0].description, isHV: rows[0].isHV, periods: rows };
  }, [itemSel, allData]);

  // ---- Sankey geometry -----------------------------------------------------
  const W = 540, H = 460, padY = 14, nodeW = 16, nodeGap = 26;
  const availH = H - padY * 2 - nodeGap * 2;
  const per = total > 0 ? availH / total : 0;
  const minNode = 3;
  // Node y-positions (top) for each side, stacked in ACTIONS order.
  const layout = (totals) => {
    const out = {}; let y = padY;
    ACTIONS.forEach(a => {
      const h = totals[a] > 0 ? Math.max(totals[a] * per, minNode) : 0;
      out[a] = { y, h, count: totals[a] };
      if (totals[a] > 0) y += h + nodeGap;
    });
    return out;
  };
  const srcL = layout(srcTotals), tgtL = layout(tgtTotals);
  const srcX = 92, tgtX = W - 92 - nodeW;

  // Build ribbons with running offsets per node.
  const ribbons = React.useMemo(() => {
    const sOff = {}; ACTIONS.forEach(a => sOff[a] = 0);
    const tOff = {}; ACTIONS.forEach(a => tOff[a] = 0);
    const out = [];
    ACTIONS.forEach(from => {
      ACTIONS.forEach(to => {
        const c = byCell[from + '||' + to]?.length || 0;
        if (!c) return;
        const th = Math.max(c * per, 1.5);
        const sy = srcL[from].y + sOff[from];
        const ty = tgtL[to].y + tOff[to];
        sOff[from] += th; tOff[to] += th;
        out.push({ from, to, count: c, sy, ty, th });
      });
    });
    return out;
  }, [byCell, total]);

  const ribbonPath = (r) => {
    const x0 = srcX + nodeW, x1 = tgtX;
    const cx0 = x0 + (x1 - x0) * 0.5, cx1 = x1 - (x1 - x0) * 0.5;
    const y0t = r.sy, y0b = r.sy + r.th, y1t = r.ty, y1b = r.ty + r.th;
    return `M ${x0} ${y0t} C ${cx0} ${y0t}, ${cx1} ${y1t}, ${x1} ${y1t} L ${x1} ${y1b} C ${cx1} ${y1b}, ${cx0} ${y0b}, ${x0} ${y0b} Z`;
  };

  const isRibbonActive = (r) => {
    if (!sel) return true;
    if (sel.kind === 'flow') return sel.from === r.from && sel.to === r.to;
    if (sel.kind === 'src') return sel.action === r.from;
    if (sel.kind === 'tgt') return sel.action === r.to;
    return true;
  };

  if (periods.length < 2) {
    return <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-3)', fontSize: 14 }}>Action Flow needs at least two months of data to compare.</div>;
  }

  // ---- Right-panel header text ---------------------------------------------
  const selTitle = () => {
    if (!sel) return null;
    if (sel.kind === 'flow') return <span><b style={{ color: COL[sel.from] }}>{sel.from}</b> <span style={{ color: 'var(--text-3)' }}>→</span> <b style={{ color: COL[sel.to] }}>{sel.to}</b></span>;
    if (sel.kind === 'src') return <span>Was <b style={{ color: COL[sel.action] }}>{sel.action}</b> in {fmtP(fromP)}</span>;
    return <span>Became <b style={{ color: COL[sel.action] }}>{sel.action}</b> in {fmtP(toP)}</span>;
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '14px 24px 0', minHeight: 0 }}>
      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', flexShrink: 0, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '.06em' }}>From</span>
          <AFPeriodPicker value={fromP} onChange={setFromP} options={periods} fmt={fmtP} />
          <span style={{ fontSize: 16, color: 'var(--text-3)' }}>→</span>
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '.06em' }}>To</span>
          <AFPeriodPicker value={toP} onChange={setToP} options={periods} fmt={fmtP} />
        </div>
        {canToggle && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginLeft: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Showing</span>
            <div style={{ display: 'inline-flex', background: '#fff', border: '1px solid var(--border)', borderRadius: 9, padding: 3, gap: 3 }}>
              {[['predicted', 'Predicted', 'var(--accent)'], ['actual', 'Actual', '#F59E0B']].map(([m, lbl, c]) => {
                const on = mode === m;
                return <button key={m} onClick={() => setMode(m)} style={{ padding: '5px 14px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font)', background: on ? c : 'transparent', color: on ? '#fff' : 'var(--text-2)', boxShadow: on ? `0 2px 6px ${c}55` : 'none', transition: 'background .12s, color .12s' }}>{lbl}</button>;
              })}
            </div>
          </div>
        )}
        {/* Summary chips */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {[
            { label: 'Items tracked', value: total, color: 'var(--text)' },
            { label: 'Changed action', value: changed, color: '#D97706' },
            { label: 'Churn', value: total > 0 ? Math.round(changed / total * 100) + '%' : '—', color: 'var(--accent)' },
          ].map(c => (
            <div key={c.label} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 10, padding: '6px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 800, fontFamily: 'var(--mono)', color: c.color, lineHeight: 1.1 }}>{c.value}</div>
              <div style={{ fontSize: 9, color: 'var(--text-2)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em', marginTop: 2 }}>{c.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Body: flow diagram (left) + detail panel (right) */}
      <div style={{ flex: 1, display: 'flex', gap: 14, overflow: 'hidden', paddingBottom: 14, minHeight: 0 }}>
        {/* Flow diagram */}
        <div style={{ flex: 1, background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Action Flow · {fmtP(fromP)} → {fmtP(toP)}</div>
            {sel && <button onClick={() => setSel(null)} style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', background: 'var(--accent-surface)', border: '1px solid var(--accent-border)', borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontFamily: 'var(--font)' }}>Clear selection</button>}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 8 }}>Click any flow band — or a left/right action block — to list those items on the right.</div>
          <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ maxHeight: H }}>
              {/* Column headers */}
              <text x={srcX + nodeW / 2} y={10} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--text-2)" fontFamily="var(--mono)">{fmtP(fromP)}</text>
              <text x={tgtX + nodeW / 2} y={10} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--text-2)" fontFamily="var(--mono)">{fmtP(toP)}</text>

              {/* Ribbons */}
              {ribbons.map((r, i) => {
                const active = isRibbonActive(r);
                const selectedExact = sel && sel.kind === 'flow' && sel.from === r.from && sel.to === r.to;
                return (
                  <path key={i} d={ribbonPath(r)} fill={COL[r.from]}
                    opacity={active ? (selectedExact ? 0.78 : 0.42) : 0.08}
                    style={{ cursor: 'pointer', transition: 'opacity .12s' }}
                    onClick={() => setSel({ kind: 'flow', from: r.from, to: r.to })}>
                    <title>{r.from} → {r.to}: {r.count} item{r.count === 1 ? '' : 's'}</title>
                  </path>
                );
              })}

              {/* Source nodes (left) */}
              {ACTIONS.map(a => {
                const n = srcL[a]; if (!n.count) return null;
                const on = !sel || (sel.kind === 'src' && sel.action === a) || (sel.kind === 'flow' && sel.from === a);
                return (
                  <g key={'s' + a} style={{ cursor: 'pointer' }} onClick={() => setSel({ kind: 'src', action: a })} opacity={on ? 1 : 0.4}>
                    <rect x={srcX} y={n.y} width={nodeW} height={n.h} rx={3} fill={COL[a]} />
                    <text x={srcX - 8} y={n.y + n.h / 2 - 4} textAnchor="end" fontSize="11.5" fontWeight="700" fill="var(--text)">{abbr[a]}</text>
                    <text x={srcX - 8} y={n.y + n.h / 2 + 10} textAnchor="end" fontSize="10" fill="var(--text-2)" fontFamily="var(--mono)">{n.count} · {total > 0 ? Math.round(n.count / total * 100) : 0}%</text>
                  </g>
                );
              })}

              {/* Target nodes (right) */}
              {ACTIONS.map(a => {
                const n = tgtL[a]; if (!n.count) return null;
                const on = !sel || (sel.kind === 'tgt' && sel.action === a) || (sel.kind === 'flow' && sel.to === a);
                return (
                  <g key={'t' + a} style={{ cursor: 'pointer' }} onClick={() => setSel({ kind: 'tgt', action: a })} opacity={on ? 1 : 0.4}>
                    <rect x={tgtX} y={n.y} width={nodeW} height={n.h} rx={3} fill={COL[a]} />
                    <text x={tgtX + nodeW + 8} y={n.y + n.h / 2 - 4} textAnchor="start" fontSize="11.5" fontWeight="700" fill="var(--text)">{abbr[a]}</text>
                    <text x={tgtX + nodeW + 8} y={n.y + n.h / 2 + 10} textAnchor="start" fontSize="10" fill="var(--text-2)" fontFamily="var(--mono)">{n.count} · {total > 0 ? Math.round(n.count / total * 100) : 0}%</text>
                  </g>
                );
              })}
            </svg>
          </div>
          {/* Legend */}
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 4 }}>
            {ACTIONS.map(a => <span key={a} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-2)' }}><span style={{ width: 10, height: 10, borderRadius: 3, background: COL[a] }}></span>{a}</span>)}
          </div>
        </div>

        {/* Detail panel */}
        <div style={{ width: 380, flexShrink: 0, background: '#fff', border: '1px solid var(--border)', borderRadius: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            {sel ? (
              <>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 3 }}>{selTitle()}</div>
                <div style={{ fontSize: 11, color: 'var(--text-2)' }}>{selItems.length} item{selItems.length === 1 ? '' : 's'} · {fmtP(fromP)} → {fmtP(toP)}</div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 3 }}>Flow summary</div>
                <div style={{ fontSize: 11, color: 'var(--text-2)' }}>Click a flow or action block to drill in.</div>
              </>
            )}
          </div>
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }} className="h-scroller">
            {!sel ? (
              <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {/* All transitions as a quick-pick matrix */}
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '.05em' }}>All transitions</div>
                {ACTIONS.flatMap(from => ACTIONS.map(to => {
                  const c = byCell[from + '||' + to]?.length || 0;
                  if (!c) return null;
                  const stayed = from === to;
                  return (
                    <button key={from + to} onClick={() => setSel({ kind: 'flow', from, to })} style={{
                      display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', cursor: 'pointer',
                      background: stayed ? '#FAFBFC' : COLBG[to], border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', fontFamily: 'var(--font)',
                    }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: COL[from], minWidth: 52 }}>{abbr[from]}</span>
                      <span style={{ color: 'var(--text-3)', fontSize: 11 }}>→</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: COL[to], minWidth: 52 }}>{abbr[to]}</span>
                      {stayed && <span style={{ fontSize: 9, color: 'var(--text-3)', fontWeight: 600 }}>stable</span>}
                      <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 800, fontFamily: 'var(--mono)', color: 'var(--text)' }}>{c}</span>
                    </button>
                  );
                }))}
              </div>
            ) : selItems.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>No items in this flow.</div>
            ) : (
              selItems.map((it, i) => (
                <button key={it.itemCode + i} onClick={() => setItemSel(it.itemCode)} title="View item insights"
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderBottom: '1px solid #F3F4F6', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'var(--font)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  {it.isHV && <span style={{ fontSize: 9, color: 'var(--accent)', flexShrink: 0 }}>★</span>}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={it.desc}>{it.desc}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                      <span style={{ fontSize: 9.5, fontFamily: 'var(--mono)', color: 'var(--text-3)' }}>{it.itemCode}</span>
                      <span style={{ fontSize: 9, fontWeight: 700, color: COL[it.from] }}>{abbr[it.from]}</span>
                      <span style={{ fontSize: 9, color: 'var(--text-3)' }}>→</span>
                      <span style={{ fontSize: 9, fontWeight: 700, color: COL[it.to] }}>{abbr[it.to]}</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 11, fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--text-2)', textAlign: 'right', flexShrink: 0 }}>{fmtK(it.qty)}<div style={{ fontSize: 8, color: 'var(--text-3)', fontWeight: 500 }}>units</div></div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><polyline points="9 18 15 12 9 6" /></svg>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Item drill-down: full forecast history for the clicked item */}
      {itemDetail && (
        <div onClick={() => setItemSel(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={e => e.stopPropagation()} className="h-scroller" style={{ background: '#fff', borderRadius: 14, width: 'min(920px, 94vw)', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,.28)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '14px 18px', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: '#fff', zIndex: 2 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{itemDetail.isHV && <span style={{ color: 'var(--accent)' }}>★ </span>}{itemDetail.description}</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--mono)', marginTop: 2 }}>{itemDetail.itemCode} · {itemDetail.periods.length} month{itemDetail.periods.length === 1 ? '' : 's'} of history</div>
              </div>
              <button onClick={() => setItemSel(null)} title="Close" style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 7, border: '1px solid var(--border)', background: '#fff', cursor: 'pointer', color: 'var(--text-2)', fontSize: 15, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>
            <div style={{ padding: '16px 18px' }}>
              <ItemForecastCard item={itemDetail} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* Compact period dropdown for the Action Flow controls. */
function AFPeriodPicker({ value, onChange, options, fmt }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    const fn = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 7, border: '1px solid var(--border)', background: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font)', minWidth: 96, justifyContent: 'space-between' }}
        onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'} onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
        <span>{fmt(value)}</span>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--text-2)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}><polyline points="6 9 12 15 18 9"></polyline></svg>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, background: '#fff', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,.10)', maxHeight: 280, overflowY: 'auto', zIndex: 100, minWidth: 120 }}>
          {options.slice().reverse().map(p => (
            <button key={p} onClick={() => { onChange(p); setOpen(false); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 14px', border: 'none', background: value === p ? 'var(--accent-surface)' : 'transparent', color: value === p ? 'var(--accent)' : 'var(--text-2)', cursor: 'pointer', fontSize: 12, fontWeight: value === p ? 700 : 500, fontFamily: 'var(--font)' }}
              onMouseEnter={e => { if (value !== p) e.currentTarget.style.background = 'var(--hover)'; }}
              onMouseLeave={e => { if (value !== p) e.currentTarget.style.background = 'transparent'; }}>{fmt(p)}</button>
          ))}
        </div>
      )}
    </div>
  );
}

window.ActionFlowPage = ActionFlowPage;
