/* ============================================================
   Most Moving Items — which products change hands the most.

   Sonu asked for a tab that identifies the most moving items. Movement is
   measured from actual history: each month an item's units moved is the
   change in its closing balance (|actual − previous|), split into delivered
   (balance up) and returned (balance down). Items are ranked over a window
   counted back from the latest month with actuals, either by total units
   moved or by how many of those months they moved in.
   ============================================================ */
function MostMovingPage({ allData }) {
  const ns = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const fmtP = p => { if (!p) return ''; const [y, m] = p.split('-'); return `${ns[+m]} '${y.slice(2)}`; };
  // Whole numbers only (client asked to round all qty displays).
  const fmtNum = v => v == null ? '—' : (Math.round(v) || 0).toLocaleString('en-US');

  const [win, setWin] = React.useState(12);          // months back from the latest actual; 0 = all
  const [rankBy, setRankBy] = React.useState('moved'); // moved | months
  const [hvOnly, setHvOnly] = React.useState(false);
  const [q, setQ] = React.useState('');
  const [itemSel, setItemSel] = React.useState(null);

  // Months that have actuals, oldest first.
  const actualPeriods = React.useMemo(() => {
    const s = new Set();
    (allData || []).forEach(d => { if (d.actualClosingBal != null && d.prevClosingBal != null) s.add(d.period); });
    return [...s].sort();
  }, [allData]);
  const scope = React.useMemo(() => win ? actualPeriods.slice(-win) : actualPeriods, [actualPeriods, win]);

  const items = React.useMemo(() => {
    const inScope = new Set(scope);
    const by = {};
    (allData || []).forEach(d => {
      if (!inScope.has(d.period) || d.actualClosingBal == null || d.prevClosingBal == null) return;
      const it = by[d.itemCode] || (by[d.itemCode] = { code: d.itemCode, desc: d.description || d.itemCode, isHV: !!d.isHV, moved: 0, delivered: 0, returned: 0, months: 0, tracked: 0 });
      const delta = d.actualClosingBal - d.prevClosingBal;
      it.tracked++;
      if (Math.abs(delta) >= 0.5) {
        it.months++;
        it.moved += Math.abs(delta);
        if (delta > 0) it.delivered += delta; else it.returned += -delta;
      }
    });
    return Object.values(by).filter(it => it.moved > 0);
  }, [allData, scope]);

  const ranked = React.useMemo(() => {
    const a = items.slice();
    if (rankBy === 'months') a.sort((x, y) => y.months - x.months || y.moved - x.moved);
    else a.sort((x, y) => y.moved - x.moved || y.months - x.months);
    return a.map((it, i) => ({ ...it, rank: i + 1 }));
  }, [items, rankBy]);

  const view = React.useMemo(() => {
    let a = ranked;
    if (hvOnly) a = a.filter(x => x.isHV);
    const s = q.trim().toLowerCase();
    if (s) a = a.filter(x => (x.desc + ' ' + x.code).toLowerCase().includes(s));
    return a;
  }, [ranked, hvOnly, q]);

  const itemDetail = React.useMemo(() => {
    if (!itemSel) return null;
    const rows = (allData || []).filter(d => d.itemCode === itemSel).sort((a, b) => (a.period < b.period ? -1 : a.period > b.period ? 1 : 0));
    if (!rows.length) return null;
    return { itemCode: itemSel, description: rows[0].description || itemSel, isHV: rows[0].isHV, periods: rows };
  }, [itemSel, allData]);

  if (!actualPeriods.length) {
    return <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-3)', fontSize: 14, lineHeight: 1.6 }}>No actual history yet — movement is measured from observed balances, which appear once a month has actuals.</div>;
  }

  const totalMoved = items.reduce((s, x) => s + x.moved, 0);
  const top10 = ranked.slice(0, 10).reduce((s, x) => s + x.moved, 0);
  const maxMoved = Math.max(...view.map(x => x.moved), 1);
  const SHOWN = 100;
  const rows = view.slice(0, SHOWN);

  const exportCsv = () => {
    const head = ['Rank', 'Item Code', 'Item', 'High Value', 'Units Moved', 'Delivered', 'Returned', 'Months Moved', 'Months Tracked', 'Avg per Moving Month'];
    const body = view.map(x => [x.rank, x.code, x.desc, x.isHV ? 'Yes' : 'No', Math.round(x.moved), Math.round(x.delivered), Math.round(x.returned), x.months, x.tracked, Math.round(x.moved / Math.max(x.months, 1))]);
    downloadCsv([head, ...body], `most_moving_items_${scope[0]}_to_${scope[scope.length - 1]}.csv`);
  };

  const pill = (active) => ({
    padding: '5px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)',
    border: '1px solid', borderColor: active ? 'var(--accent)' : 'var(--border)',
    background: active ? 'rgba(79,70,229,.06)' : '#fff', color: active ? 'var(--accent)' : 'var(--text-2)',
  });
  const th = (align) => ({ padding: '8px 10px', textAlign: align || 'left', fontSize: 10, fontWeight: 600, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '2px solid var(--border)', whiteSpace: 'nowrap', position: 'sticky', top: 0, zIndex: 2, background: '#FAFBFC' });
  const td = (align) => ({ padding: '7px 10px', textAlign: align || 'left', fontSize: 11, borderBottom: '1px solid #F3F4F6', whiteSpace: 'nowrap' });
  const stat = (label, value, hint) => (
    <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px' }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--mono)', marginTop: 2 }}>{value}</div>
      {hint && <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 1 }}>{hint}</div>}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', padding: '14px 24px 14px' }}>
      <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 10, lineHeight: 1.5, flexShrink: 0 }}>
        The items that change hands the most, from actual history over <b style={{ color: 'var(--text-2)' }}>{fmtP(scope[0])} – {fmtP(scope[scope.length - 1])}</b> ({scope.length} month{scope.length === 1 ? '' : 's'}). Units moved = the change in an item's balance each month, <span style={{ color: '#059669', fontWeight: 600 }}>delivered</span> plus <span style={{ color: '#DC2626', fontWeight: 600 }}>returned</span>. Click any item for its full history.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12, flexShrink: 0 }}>
        {stat('Items that moved', fmtNum(items.length), `${items.filter(x => x.isHV).length} high value`)}
        {stat('Total units moved', fmtNum(totalMoved), 'delivered + returned')}
        {stat('Top 10 share', (totalMoved ? Math.round(top10 / totalMoved * 100) : 0) + '%', 'of all units moved')}
        {stat('Most moving', ranked[0] ? fmtNum(ranked[0].moved) : '—', ranked[0] ? ranked[0].desc : '')}
      </div>

      <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12, flexShrink: 0 }}>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search code or description…"
          style={{ flex: '0 0 260px', padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 12, fontFamily: 'var(--font)', outline: 'none' }} />
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Window</span>
          {[[3, 'Last 3 months'], [6, 'Last 6'], [12, 'Last 12'], [0, `All ${actualPeriods.length}`]].map(([n, label]) => (
            <button key={n} onClick={() => setWin(n)} style={pill(win === n)}>{label}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Rank by</span>
          <button onClick={() => setRankBy('moved')} style={pill(rankBy === 'moved')}>Units moved</button>
          <button onClick={() => setRankBy('months')} style={pill(rankBy === 'months')}>Months moved</button>
        </div>
        <button onClick={() => setHvOnly(v => !v)} style={pill(hvOnly)}>★ HV only</button>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{view.length > SHOWN ? `top ${SHOWN} of ${view.length}` : `${view.length} item${view.length === 1 ? '' : 's'}`}</span>
          <button onClick={exportCsv} disabled={!view.length} title="Download the ranked list as CSV (opens in Excel)" style={{ ...pill(false), color: 'var(--accent)', borderColor: 'var(--accent)' }}>Download CSV</button>
        </div>
      </div>

      <div className="h-scroller" style={{ flex: 1, minHeight: 0, overflow: 'auto', background: '#fff', border: '1px solid var(--border)', borderRadius: 12 }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={th('right')}>#</th>
              <th style={th()}>Item</th>
              <th style={{ ...th(), width: '28%' }}>Delivered / Returned</th>
              <th style={th('right')}>Units moved</th>
              <th style={th('right')}>Delivered</th>
              <th style={th('right')}>Returned</th>
              <th style={th('right')}>Months moved</th>
              <th style={th('right')}>Avg / moving month</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(x => (
              <tr key={x.code} onClick={() => setItemSel(x.code)} style={{ cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.background = '#FAFBFC'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <td style={{ ...td('right'), fontFamily: 'var(--mono)', color: 'var(--text-3)', fontWeight: 600 }}>{x.rank}</td>
                <td style={{ ...td(), whiteSpace: 'normal' }}>
                  <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: 12 }}>{x.isHV && <span style={{ color: 'var(--accent)' }}>★ </span>}{x.desc}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>{x.code}</div>
                </td>
                <td style={td()}>
                  <div style={{ display: 'flex', height: 12, width: `${Math.max(2, x.moved / maxMoved * 100)}%`, borderRadius: 4, overflow: 'hidden', background: '#F3F4F6' }}>
                    <div style={{ width: `${x.delivered / x.moved * 100}%`, background: '#059669' }} title={`Delivered ${fmtNum(x.delivered)}`}></div>
                    <div style={{ flex: 1, background: '#DC2626' }} title={`Returned ${fmtNum(x.returned)}`}></div>
                  </div>
                </td>
                <td style={{ ...td('right'), fontFamily: 'var(--mono)', fontWeight: 700 }}>{fmtNum(x.moved)}</td>
                <td style={{ ...td('right'), fontFamily: 'var(--mono)', fontWeight: 600, color: '#059669' }}>{fmtNum(x.delivered)}</td>
                <td style={{ ...td('right'), fontFamily: 'var(--mono)', fontWeight: 600, color: '#DC2626' }}>{fmtNum(x.returned)}</td>
                <td style={{ ...td('right'), fontFamily: 'var(--mono)' }}>{x.months} <span style={{ color: 'var(--text-3)' }}>/ {x.tracked}</span></td>
                <td style={{ ...td('right'), fontFamily: 'var(--mono)', color: 'var(--text-2)' }}>{fmtNum(x.moved / Math.max(x.months, 1))}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>No items match the filters</td></tr>}
          </tbody>
        </table>
      </div>

      {itemDetail && (
        <div onClick={() => setItemSel(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={e => e.stopPropagation()} className="h-scroller" style={{ background: '#fff', borderRadius: 14, width: 'min(920px, 94vw)', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,.25)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '14px 18px', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: '#fff', zIndex: 3 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{itemDetail.isHV && <span style={{ color: 'var(--accent)' }}>★ </span>}{itemDetail.description}</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--mono)', marginTop: 2 }}>{itemDetail.itemCode} · {itemDetail.periods.length} month{itemDetail.periods.length === 1 ? '' : 's'} tracked</div>
              </div>
              <button onClick={() => setItemSel(null)} title="Close" style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 7, border: '1px solid var(--border)', background: '#fff', cursor: 'pointer', color: 'var(--text-2)', fontSize: 15 }}>×</button>
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
window.MostMovingPage = MostMovingPage;
