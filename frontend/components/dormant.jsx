/* ============================================================
   Dormant Items — products that have sat inactive for a year or more.

   Sonu asked for two views:
     1. Items with ZERO transactions for 12+ consecutive months
        (no Deliver and no Return — they just sat).
     2. Items whose COUNT (closing balance) stayed constant for 12+
        consecutive months (the on-hand number never moved).

   Both are computed from ACTUAL movements over the available history
   (months that have actuals); predicted/Future-only months are ignored,
   since dormancy is a fact about the observed past. Each row carries a
   sparkline of the item's balance with the dormant stretch highlighted.
   ============================================================ */
// The dormancy rule, shared with the Item Explorer's Dormant filter: an item is
// dormant when it has MIN or more consecutive months of No Change, or of an
// unchanged actual count.
function computeDormantRuns(allData, latestActual, MIN = 12) {
  const ymConsec = (a, b) => { const A = (+a.slice(0, 4)) * 12 + (+a.slice(5, 7)); const B = (+b.slice(0, 4)) * 12 + (+b.slice(5, 7)); return B - A === 1; };
  const byItem = {};
  (allData || []).forEach(d => { (byItem[d.itemCode] = byItem[d.itemCode] || []).push(d); });
  const zero = [], cons = [], seriesByItem = {};
  for (const code in byItem) {
    const rows = byItem[code].slice().sort((a, b) => (a.period < b.period ? -1 : a.period > b.period ? 1 : 0));
    const first = rows[0];
    seriesByItem[code] = rows.map(r => ({ p: r.period, b: r.actualClosingBal != null ? r.actualClosingBal : r.predictedClosingBal }));

    let zBest = 0, zStart = null, zEnd = null, zCur = 0, zCurStart = null, zPrev = null;
    let cBest = 0, cStart = null, cEnd = null, cVal = null, cCur = 0, cCurStart = null, cCurVal = null, cPrev = null, cPrevVal = null;
    for (const r of rows) {
      const p = r.period;
      const noChange = r.actualAction === 'No Change';
      if (noChange && (zPrev === null || ymConsec(zPrev, p))) { if (zCur === 0) zCurStart = p; zCur++; }
      else if (noChange) { zCur = 1; zCurStart = p; }
      else { zCur = 0; zCurStart = null; }
      if (zCur > zBest) { zBest = zCur; zStart = zCurStart; zEnd = p; }
      zPrev = p;

      const v = r.actualClosingBal;
      if (v == null) { cCur = 0; cPrev = p; cPrevVal = null; }
      else {
        if (cPrevVal != null && cPrev != null && ymConsec(cPrev, p) && Math.abs(v - cPrevVal) < 0.5) cCur++;
        else { cCur = 1; cCurStart = p; cCurVal = v; }
        if (cCur > cBest) { cBest = cCur; cStart = cCurStart; cEnd = p; cVal = cCurVal; }
        cPrev = p; cPrevVal = v;
      }
    }
    const base = { code, desc: first.description || code, isHV: !!first.isHV };
    if (zBest >= MIN) zero.push({ ...base, months: zBest, start: zStart, end: zEnd, ongoing: zEnd === latestActual });
    if (cBest >= MIN) cons.push({ ...base, months: cBest, start: cStart, end: cEnd, value: cVal, ongoing: cEnd === latestActual });
  }
  return { zeroTxn: zero, constCount: cons, seriesByItem };
}
window.computeDormantRuns = computeDormantRuns;

function DormantItemsPage({ allData }) {
  const MIN = 12; // "1 year"

  const ns = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const fmtShort = p => { if (!p) return ''; const [y, m] = p.split('-'); return `${ns[+m]} '${y.slice(2)}`; };
  const ymConsec = (a, b) => { const A = (+a.slice(0, 4)) * 12 + (+a.slice(5, 7)); const B = (+b.slice(0, 4)) * 12 + (+b.slice(5, 7)); return B - A === 1; };
  // Whole numbers only (client asked to round all qty/cost displays).
  const fmtNum = v => v == null ? '—' : (Math.round(v) || 0).toLocaleString('en-US');

  const meta = React.useMemo(() => {
    let latest = null, earliest = null;
    (allData || []).forEach(d => {
      if (d.actualClosingBal == null) return;
      if (!latest || d.period > latest) latest = d.period;
      if (!earliest || d.period < earliest) earliest = d.period;
    });
    return { latestActual: latest, firstActual: earliest };
  }, [allData]);

  const { zeroTxn, constCount, seriesByItem } = React.useMemo(
    () => computeDormantRuns(allData, meta.latestActual, MIN), [allData, meta.latestActual]);

  const [q1, setQ1] = React.useState('');
  const [q2, setQ2] = React.useState('');
  const [sort1, setSort1] = React.useState('months');
  const [sort2, setSort2] = React.useState('months');
  const [info1, setInfo1] = React.useState(false);
  const [info2, setInfo2] = React.useState(false);
  const [hvOnly, setHvOnly] = React.useState(false);
  const [itemSel, setItemSel] = React.useState(null);

  const itemDetail = React.useMemo(() => {
    if (!itemSel) return null;
    const rows = (allData || []).filter(d => d.itemCode === itemSel).sort((a, b) => (a.period < b.period ? -1 : a.period > b.period ? 1 : 0));
    if (!rows.length) return null;
    return { itemCode: itemSel, description: rows[0].description || itemSel, isHV: rows[0].isHV, periods: rows };
  }, [itemSel, allData]);

  if (!meta.latestActual) {
    return <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-3)', fontSize: 14, lineHeight: 1.6 }}>No actual history yet — dormancy is measured from observed movements, which appear once a month has actuals.</div>;
  }

  const filt = (arr, q) => { const s = q.trim().toLowerCase(); return s ? arr.filter(x => (x.desc + ' ' + x.code).toLowerCase().includes(s)) : arr; };
  const sortItems = (arr, mode) => {
    const a = arr.slice();
    if (mode === 'name') a.sort((x, y) => (x.desc || '').localeCompare(y.desc || ''));
    else if (mode === 'held') a.sort((x, y) => (y.value || 0) - (x.value || 0) || y.months - x.months);
    else a.sort((x, y) => y.months - x.months || (x.desc || '').localeCompare(y.desc || ''));
    return a;
  };

  // HV-only toggle filters both sections (and their counts).
  const zeroView = hvOnly ? zeroTxn.filter(x => x.isHV) : zeroTxn;
  const constView = hvOnly ? constCount.filter(x => x.isHV) : constCount;

  // Sparkline of the item's balance over its whole history, with the dormant
  // stretch shaded + drawn in amber. Flat amber line = a year-long plateau.
  const spark = (series, startP, endP) => {
    const pts = (series || []).filter(s => s.b != null);
    const w = 116, h = 30, pad = 4;
    if (pts.length < 2) return <div style={{ width: w, height: h, flexShrink: 0 }} />;
    const vals = pts.map(s => s.b);
    const min = Math.min(...vals), max = Math.max(...vals), range = (max - min) || 1;
    const px = i => pad + (i / (pts.length - 1)) * (w - 2 * pad);
    const py = v => h - pad - ((v - min) / range) * (h - 2 * pad);
    const line = pts.map((s, i) => `${px(i).toFixed(1)},${py(s.b).toFixed(1)}`).join(' ');
    const si = pts.findIndex(s => s.p === startP), ei = pts.findIndex(s => s.p === endP);
    const hi = (si >= 0 && ei >= 0);
    const x0 = hi ? px(si) : 0, x1 = hi ? px(ei) : w;
    return (
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block', flexShrink: 0 }}>
        {hi && <rect x={x0.toFixed(1)} y={pad - 1} width={Math.max(2, x1 - x0).toFixed(1)} height={h - 2 * pad + 2} fill="rgba(217,119,6,.10)" rx="2" />}
        <polyline points={line} fill="none" stroke="#C4C9D2" strokeWidth="1.3" strokeLinejoin="round" strokeLinecap="round" />
        {hi && <polyline points={pts.slice(si, ei + 1).map((s, i) => `${px(si + i).toFixed(1)},${py(s.b).toFixed(1)}`).join(' ')} fill="none" stroke="#D97706" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}
      </svg>
    );
  };

  const infoBtn = (open, toggle) => (
    <button onClick={toggle} title="What is this?" aria-label="What is this?"
      style={{ background: open ? 'var(--accent-surface)' : 'none', border: '1px solid ' + (open ? 'var(--accent-border)' : 'var(--border)'), borderRadius: 6, padding: '3px 5px', cursor: 'pointer', color: open ? 'var(--accent)' : 'var(--text-2)', display: 'flex', alignItems: 'center', flexShrink: 0, transition: 'all .12s' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
      onMouseLeave={e => { if (!open) { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-2)'; } }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="11" x2="12" y2="16" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
    </button>
  );

  const seg = active => ({ padding: '4px 9px', fontSize: 10.5, fontWeight: active ? 700 : 600, border: 'none', borderRadius: 6, cursor: 'pointer', fontFamily: 'var(--font)', background: active ? '#fff' : 'transparent', color: active ? 'var(--accent)' : 'var(--text-2)', boxShadow: active ? '0 1px 2px rgba(0,0,0,.06)' : 'none', transition: 'all .12s' });
  const sortCtl = (sort, setSort, withHeld) => (
    <div style={{ display: 'inline-flex', gap: 2, padding: 3, background: 'var(--surface-2,#F3F4F7)', borderRadius: 8, flexShrink: 0 }}>
      <button style={seg(sort === 'months')} onClick={() => setSort('months')}>Longest</button>
      <button style={seg(sort === 'name')} onClick={() => setSort('name')}>A–Z</button>
      {withHeld && <button style={seg(sort === 'held')} onClick={() => setSort('held')}>Held</button>}
    </div>
  );

  const row = (it, showValue) => (
    <button key={it.code} onClick={() => setItemSel(it.code)} title="View item history"
      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: '1px solid #F3F4F6', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'var(--font)' }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--hover)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {it.isHV && <span title="High value" style={{ fontSize: 10, color: 'var(--accent)', flexShrink: 0 }}>★</span>}
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={it.desc}>{it.desc}</div>
        </div>
        <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text-3)', marginTop: 2, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <span>{it.code}</span>
          {showValue && <span style={{ color: 'var(--text-2)' }}>held <strong style={{ color: 'var(--text)' }}>{fmtNum(it.value)}</strong></span>}
        </div>
      </div>
      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
        {spark(seriesByItem[it.code], it.start, it.end)}
        <div style={{ fontSize: 8.5, color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>{fmtShort(it.start)} → {fmtShort(it.end)}</div>
      </div>
      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, width: 80 }}>
        <span style={{ fontSize: 14, fontWeight: 800, fontFamily: 'var(--mono)', color: 'var(--accent)', lineHeight: 1 }}>{it.months}<span style={{ fontSize: 9.5, fontWeight: 600, color: 'var(--text-3)', marginLeft: 2 }}>mo</span></span>
        {it.ongoing
          ? <span style={{ fontSize: 8.5, fontWeight: 700, color: '#B45309', background: 'rgba(217,119,6,.12)', padding: '2px 7px', borderRadius: 10, letterSpacing: '.03em', whiteSpace: 'nowrap' }}>STILL IDLE</span>
          : <span style={{ fontSize: 8.5, fontWeight: 600, color: 'var(--text-3)', background: 'var(--surface-2,#F3F4F7)', padding: '2px 7px', borderRadius: 10, whiteSpace: 'nowrap' }}>ENDED</span>}
      </div>
    </button>
  );

  const panel = (cfg) => {
    const list = sortItems(filt(cfg.items, cfg.q), cfg.sort);
    return (
      <div style={{ flex: 1, minWidth: 0, background: '#fff', border: '1px solid var(--border)', borderRadius: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '13px 16px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{ width: 26, height: 26, borderRadius: 7, background: 'var(--accent-surface)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{cfg.icon}</span>
            <div style={{ fontSize: 13.5, fontWeight: 700, flex: 1, minWidth: 0 }}>{cfg.title}</div>
            <span style={{ fontSize: 13, fontWeight: 800, fontFamily: 'var(--mono)', color: 'var(--accent)' }}>{cfg.items.length}</span>
            {infoBtn(cfg.infoOpen, () => cfg.setInfoOpen(!cfg.infoOpen))}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 4, lineHeight: 1.45 }}>{cfg.subtitle}</div>
          {cfg.infoOpen && <div style={{ background: 'var(--accent-surface)', border: '1px solid var(--accent-border)', borderRadius: 9, padding: '10px 12px', marginTop: 10, fontSize: 11.5, color: 'var(--text-2)', lineHeight: 1.55 }}>{cfg.info}</div>}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
            <input value={cfg.q} onChange={e => cfg.setQ(e.target.value)} placeholder="Filter items…"
              style={{ flex: 1, minWidth: 0, padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 7, fontSize: 11.5, fontFamily: 'var(--font)', color: 'var(--text)', outline: 'none', background: '#fff', boxSizing: 'border-box' }}
              onFocus={e => e.target.style.borderColor = 'var(--accent)'} onBlur={e => e.target.style.borderColor = 'var(--border)'} />
            {sortCtl(cfg.sort, cfg.setSort, cfg.withHeld)}
          </div>
        </div>
        <div className="h-scroller" style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {list.length ? list.map(it => row(it, cfg.showValue))
            : <div style={{ padding: 28, textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>No matching items.</div>}
        </div>
      </div>
    );
  };

  const pauseIcon = <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1.2" /><rect x="14" y="5" width="4" height="14" rx="1.2" /></svg>;
  const flatIcon = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="8.5" x2="4" y2="15.5" /><line x1="20" y1="8.5" x2="20" y2="15.5" /></svg>;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '14px 24px 0', minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', flexShrink: 0, marginBottom: 8 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {[
            { label: 'No transactions ≥ 1yr', value: zeroView.length, sub: hvOnly ? 'high-value, idle 12+ mo' : 'items idle 12+ months' },
            { label: 'Constant count ≥ 1yr', value: constView.length, sub: hvOnly ? 'high-value, unchanged 12+ mo' : 'balance unchanged 12+ months' },
            { label: 'Observed window', value: `${fmtShort(meta.firstActual)} → ${fmtShort(meta.latestActual)}`, sub: 'from actual movements' },
          ].map(c => (
            <div key={c.label} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 10, padding: '9px 16px', minWidth: 132 }}>
              <div style={{ fontSize: 19, fontWeight: 800, fontFamily: 'var(--mono)', color: 'var(--text)', lineHeight: 1.1 }}>{c.value}</div>
              <div style={{ fontSize: 9, color: 'var(--text-2)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em', marginTop: 3 }}>{c.label}</div>
              <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 1 }}>{c.sub}</div>
            </div>
          ))}
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', color: hvOnly ? 'var(--accent)' : 'var(--text-2)', padding: '7px 12px', border: '1px solid', borderColor: hvOnly ? 'var(--accent)' : 'var(--border)', borderRadius: 8, background: hvOnly ? 'rgba(79,70,229,.06)' : '#fff', flexShrink: 0, transition: 'all .12s' }}>
          <input type="checkbox" checked={hvOnly} onChange={e => setHvOnly(e.target.checked)} style={{ accentColor: 'var(--accent)', margin: 0 }} />
          <span style={{ color: 'var(--accent)' }}>★</span> HV items only
        </label>
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginBottom: 10, lineHeight: 1.45, flexShrink: 0 }}>
        Items that have gone quiet — no movement, or an unchanged count — for a year or more, from actual history. The sparkline traces each item's balance; the <span style={{ color: '#B45309', fontWeight: 600 }}>amber</span> stretch is the dormant window. Click any item for its full history.
      </div>

      <div style={{ flex: 1, display: 'flex', gap: 14, overflow: 'hidden', paddingBottom: 14, minHeight: 0 }}>
        {panel({
          icon: pauseIcon, title: 'No transactions for 12+ months',
          subtitle: 'Zero deliveries or returns — the item just sat in place for a full year or more.',
          info: 'These items recorded no Deliver and no Return for at least 12 consecutive months. They are sitting untouched — candidates to redeploy, sell off, or stop tracking. “Still idle” means the run continues right up to the latest month with actuals; “ended” means activity resumed afterwards.',
          items: zeroView, q: q1, setQ: setQ1, sort: sort1, setSort: setSort1, withHeld: false, showValue: false,
          infoOpen: info1, setInfoOpen: setInfo1,
        })}
        {panel({
          icon: flatIcon, title: 'Constant count for 12+ months',
          subtitle: 'On-hand closing balance never changed for a full year or more.',
          info: 'These items held the exact same closing balance for at least 12 consecutive months (the held quantity is shown on each row). A flat count means stock that never moved in or out — often the same items, seen from the balance side rather than the transaction side.',
          items: constView, q: q2, setQ: setQ2, sort: sort2, setSort: setSort2, withHeld: true, showValue: true,
          infoOpen: info2, setInfoOpen: setInfo2,
        })}
      </div>

      {itemDetail && (
        <div onClick={() => setItemSel(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={e => e.stopPropagation()} className="h-scroller" style={{ background: '#fff', borderRadius: 14, width: 'min(920px, 94vw)', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,.28)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '14px 18px', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: '#fff', zIndex: 2 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{itemDetail.isHV && <span style={{ color: 'var(--accent)' }}>★ </span>}{itemDetail.description}</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--mono)', marginTop: 2 }}>{itemDetail.itemCode} · {itemDetail.periods.length} month{itemDetail.periods.length === 1 ? '' : 's'} tracked</div>
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
window.DormantItemsPage = DormantItemsPage;
