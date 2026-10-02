/* Item Explorer v2 — per-item rows, cohort tabs, period scope, rich detail panel */

function ItemExplorerPage({ allData, period, mode = 'predicted' }) {
  const [search, setSearch] = React.useState('');
  // Exact item code chosen from the search dropdown (null = free-text search).
  const [exactItem, setExactItem] = React.useState(null);
  const [hvFilter, setHvFilter] = React.useState('All');
  const [cohort, setCohort] = React.useState('all');
  const [scope, setScope] = React.useState('all'); // 'all' | 'last12' | 'last6' | 'last3' | 'single'
  const [singlePeriod, setSinglePeriod] = React.useState(period);
  const [sortCol, setSortCol] = React.useState('totalQty');
  const [sortDir, setSortDir] = React.useState('desc');
  const [selectedCode, setSelectedCode] = React.useState(null);
  const [page, setPage] = React.useState(0);
  const PAGE_SIZE = 18;

  // Track horizontal scroll on the table so the sticky Item column can
  // extend its visible occlusion when scrolled. Without this, partial
  // content from columns sliding under the sticky cell bleeds out past
  // the cell's right edge (visible to the right of the frozen column).
  const tableScrollerRef = React.useRef(null);
  const [tableScrolled, setTableScrolled] = React.useState(false);
  React.useEffect(() => {
    const el = tableScrollerRef.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setTableScrolled(el.scrollLeft > 0));
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => { el.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); };
  }, []);
  // Solid color extends the sticky cell's apparent right edge by this much when
  // the table is scrolled, masking partial content from columns that slide under
  // the frozen column. 40px covers ABC (42px) entirely + most of Behavior bleed.
  const STICKY_MASK = 40;

  React.useEffect(() => { setSinglePeriod(period); }, [period]);
  React.useEffect(() => { setPage(0); }, [search, exactItem, hvFilter, cohort, scope, singlePeriod, sortCol, sortDir]);

  const allPeriods = React.useMemo(() => [...new Set(allData.map(d => d.period))].sort(), [allData]);

  // Determine periods in scope
  const scopedPeriods = React.useMemo(() => {
    if (scope === 'all') return allPeriods;
    if (scope === 'last12') return allPeriods.slice(-12);
    if (scope === 'last6') return allPeriods.slice(-6);
    if (scope === 'last3') return allPeriods.slice(-3);
    if (scope === 'single') return [singlePeriod];
    return allPeriods;
  }, [scope, allPeriods, singlePeriod]);

  // Per-item aggregation: ALWAYS computed against full history for stable cohort assignment,
  // but stats use the scoped window
  const itemSummaries = React.useMemo(() => {
    const byItem = {};
    allData.forEach(d => {
      const k = d.itemCode;
      if (!byItem[k]) byItem[k] = { itemCode: k, description: d.description, isHV: d.isHV, all: [] };
      byItem[k].all.push(d);
    });
    Object.values(byItem).forEach(it => it.all.sort((a, b) => a.period.localeCompare(b.period)));

    const isActual = mode === 'actual';
    return Object.values(byItem).map(it => {
      const inScope = it.all.filter(d => scopedPeriods.includes(d.period));
      const last = it.all[it.all.length - 1];
      // In actual mode the behavioural views only make sense over months that
      // actually have an outcome; future months (no actuals) are excluded.
      const behaviorAll = isActual ? it.all.filter(d => d.actualAction != null) : it.all;
      const inScopeB = isActual ? inScope.filter(d => d.actualAction != null) : inScope;
      const latestRow = isActual ? (behaviorAll[behaviorAll.length - 1] || last) : last;
      // Cohort window: last 6 (mode-usable) periods
      const cWin = behaviorAll.slice(-6);
      const acts = cWin.map(d => fcAction(d, mode));
      const flips = acts.reduce((s, a, i) => s + (i > 0 && a !== acts[i-1] ? 1 : 0), 0);
      const delPct = acts.filter(a => a === 'Deliver').length / Math.max(acts.length, 1);
      const retPct = acts.filter(a => a === 'Return').length / Math.max(acts.length, 1);
      const ncPct = acts.filter(a => a === 'No Change').length / Math.max(acts.length, 1);
      // Recent activity (mode-aware movement magnitude)
      const recentQty = behaviorAll.slice(-3).reduce((s, d) => s + fcQty(d, mode), 0);
      // Determine cohort. "At Risk" is always prediction-based — it's a
      // forward-looking depletion risk with no actual equivalent — so it is
      // evaluated on the predicted closing balance regardless of the mode.
      let cohortTag = 'mixed';
      if (last && last.predictedClosingBal != null && last.predictedClosingBal <= 0) cohortTag = 'atRisk';
      else if (acts.length === 0) cohortTag = 'dormant';
      else if (recentQty === 0 && behaviorAll.length >= 3) cohortTag = 'dormant';
      else if (delPct >= 0.8) cohortTag = 'alwaysDeliver';
      else if (retPct >= 0.8) cohortTag = 'alwaysReturn';
      else if (flips >= 4) cohortTag = 'volatile';
      else if (flips === 0 && ncPct >= 0.8) cohortTag = 'stable';
      else if (flips <= 1) cohortTag = 'stable';

      // Scoped stats (mode-aware)
      const totalQty = inScopeB.reduce((s, d) => s + fcQty(d, mode), 0);
      // MAPE: average of non-null itemMape values across scoped records
      const mapeVals = inScope.map(d => d.itemMape).filter(v => v != null);
      const avgMape = mapeVals.length ? mapeVals.reduce((s, v) => s + v, 0) / mapeVals.length : null;
      // Error: latest error value (actualClosingBal - predictedClosingBal) if available
      const latestWithActual = [...inScope].reverse().find(d => d.actualClosingBal != null);
      const latestError = latestWithActual ? latestWithActual.error : null;
      const latestActualBal = latestWithActual ? latestWithActual.actualClosingBal : null;
      // Error %: signed percentage of actual balance (positive = over-predicted, negative = under-predicted)
      const latestErrorPct = (latestError != null && latestActualBal != null && latestActualBal !== 0)
        ? (latestError / latestActualBal) * 100 : null;
      // Direction correct rate (always predicted-vs-actual — a forecast metric)
      const scopedWithActual = inScope.filter(d => d.directionCorrect != null);
      const dirCorrectRate = scopedWithActual.length ? scopedWithActual.filter(d => d.directionCorrect).length / scopedWithActual.length : null;
      const scopedActs = inScopeB.map(d => fcAction(d, mode));
      const scopedFlips = scopedActs.reduce((s, a, i) => s + (i > 0 && a !== scopedActs[i-1] ? 1 : 0), 0);
      // Streak: trailing run of the same action in scope
      let streak = 0, streakAction = null;
      if (scopedActs.length > 0) {
        const lastA = scopedActs[scopedActs.length - 1];
        streakAction = lastA;
        for (let i = scopedActs.length - 1; i >= 0; i--) {
          if (scopedActs[i] === lastA) streak++; else break;
        }
      }
      // Volatility: flips per period
      const volatility = scopedActs.length > 1 ? scopedFlips / (scopedActs.length - 1) : 0;
      // Predominant action (mode-aware)
      const counts = { Deliver: 0, Return: 0, 'No Change': 0 };
      scopedActs.forEach(a => { if (counts[a] != null) counts[a]++; });
      const predominant = scopedActs.length > 0 ? Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] : null;
      // ABC class based on totalQty across full history
      const fullTotal = it.all.reduce((s, d) => s + (d.quantity || 0), 0);

      return {
        itemCode: it.itemCode,
        description: it.description,
        isHV: it.isHV,
        cohort: cohortTag,
        latestAction: latestRow ? fcAction(latestRow, mode) : null,
        latestBal: latestRow ? fcBal(latestRow, mode) : null,
        latestDiff: last?.difference,
        totalQty,
        streak,
        streakAction,
        volatility,
        predominant,
        scopedCount: inScope.length,
        fullTotal,
        all: it.all,
        inScope,
        avgMape,
        latestError,
        latestErrorPct,
        latestActualBal,
        dirCorrectRate,
      };
    });
  }, [allData, scopedPeriods, mode]);

  // ABC class assignment: computed once over full history
  const abcByCode = React.useMemo(() => {
    const sorted = [...itemSummaries].sort((a, b) => b.fullTotal - a.fullTotal);
    const total = sorted.reduce((s, x) => s + x.fullTotal, 0) || 1;
    let cum = 0; const map = {};
    sorted.forEach(it => { cum += it.fullTotal; const cumPct = cum / total; map[it.itemCode] = cumPct <= 0.8 ? 'A' : cumPct <= 0.95 ? 'B' : 'C'; });
    return map;
  }, [itemSummaries]);

  // Unique items for the search dropdown.
  const searchOptions = React.useMemo(() =>
    [...itemSummaries]
      .map(d => ({ label: d.description || d.itemCode, sub: d.itemCode, code: d.itemCode, isHV: d.isHV }))
      .sort((a, b) => (a.label || '').localeCompare(b.label || '')),
    [itemSummaries]);

  // Type → Dormant: the Dormant Items page's rule (no movement or an unchanged
  // count), so with the scope on all periods the two lists agree, apart from
  // items whose quiet stretch only reaches a year once the forecast months are
  // counted.
  // It follows the Scope: only the scoped months are looked at, and an item is
  // dormant when it sits still for a year of them — or for all of them when the
  // scope is shorter than a year (e.g. Last 6 months = no movement in those 6).
  // The scope can reach into months that have no actuals yet (Last 12 months
  // includes the forecast months), so those months go by the forecast.
  const { dormantCodes, dormantMonths, dormantFuture } = React.useMemo(() => {
    const inScope = new Set(scopedPeriods);
    let latest = null;
    const seen = new Set(), futureSeen = new Set();
    const rows = (allData || []).filter(d => inScope.has(d.period)).map(d => {
      seen.add(d.period);
      if (!latest || d.period > latest) latest = d.period;
      if (d.actualClosingBal != null) return d;
      futureSeen.add(d.period);
      return { ...d, actualClosingBal: d.predictedClosingBal, actualAction: d.predictedAction };
    });
    const need = Math.min(12, seen.size);
    if (!latest || !need || !window.computeDormantRuns) return { dormantCodes: new Set(), dormantMonths: 0, dormantFuture: 0 };
    const r = window.computeDormantRuns(rows, latest, need);
    // An unchanged count needs at least two months to mean anything; with a
    // single month in scope only a No Change month counts.
    const hits = need >= 2 ? [...r.zeroTxn, ...r.constCount] : r.zeroTxn;
    return { dormantCodes: new Set(hits.map(x => x.code)), dormantMonths: need, dormantFuture: futureSeen.size };
  }, [allData, scopedPeriods]);

  const filtered = React.useMemo(() => {
    let rows = itemSummaries;
    if (exactItem) {
      rows = rows.filter(d => d.itemCode === exactItem);
    } else if (search) {
      const s = search.toLowerCase();
      rows = rows.filter(d => (d.description || '').toLowerCase().includes(s) || (d.itemCode || '').toLowerCase().includes(s));
    }
    if (hvFilter === 'HV') rows = rows.filter(d => d.isHV);
    else if (hvFilter === 'Standard') rows = rows.filter(d => !d.isHV);
    else if (hvFilter === 'Dormant') rows = rows.filter(d => dormantCodes.has(d.itemCode));
    if (cohort !== 'all') rows = rows.filter(d => d.cohort === cohort);
    return rows;
  }, [itemSummaries, search, exactItem, hvFilter, cohort, dormantCodes]);

  const sorted = React.useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let va = a[sortCol], vb = b[sortCol];
      if (typeof va === 'string') { va = va.toLowerCase(); vb = (vb || '').toLowerCase(); }
      if (va == null) va = -Infinity; if (vb == null) vb = -Infinity;
      return sortDir === 'asc' ? (va < vb ? -1 : va > vb ? 1 : 0) : (va > vb ? -1 : va < vb ? 1 : 0);
    });
    return arr;
  }, [filtered, sortCol, sortDir]);

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const pageRows = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Cohort counts for tabs
  const cohortCounts = React.useMemo(() => {
    const c = { all: itemSummaries.length, alwaysDeliver: 0, alwaysReturn: 0, volatile: 0, stable: 0, atRisk: 0, dormant: 0, mixed: 0 };
    itemSummaries.forEach(it => { c[it.cohort]++; });
    return c;
  }, [itemSummaries]);

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('desc'); }
  };

  const ac = (a) => a === 'Deliver' ? '#059669' : a === 'Return' ? '#DC2626' : '#D97706';
  const abg = (a) => a === 'Deliver' ? 'rgba(5,150,105,.08)' : a === 'Return' ? 'rgba(220,38,38,.07)' : 'rgba(217,119,6,.08)';
  // Whole numbers only (client asked to round all qty/cost displays).
  const fmt = (v) => { if (v == null) return '—'; if (typeof v === 'number') return (Math.round(v) || 0).toLocaleString('en-US'); return v; };

  const totalQty = filtered.reduce((s, d) => s + (d.totalQty || 0), 0);
  const hvCount = filtered.filter(d => d.isHV).length;

  const selectedItem = React.useMemo(() => sorted.find(it => it.itemCode === selectedCode) || itemSummaries.find(it => it.itemCode === selectedCode), [selectedCode, sorted, itemSummaries]);

  const cohorts = [
    { id: 'all', label: 'All Items', color: 'var(--text-2)' },
    { id: 'atRisk', label: 'At Risk', color: '#DC2626' },
    { id: 'volatile', label: 'Volatile', color: '#D97706' },
    { id: 'alwaysDeliver', label: 'Always Deliver', color: '#059669' },
    { id: 'alwaysReturn', label: 'Always Return', color: '#DC2626' },
    { id: 'stable', label: 'Stable', color: 'var(--accent)' },
    { id: 'dormant', label: 'Dormant', color: 'var(--text-3)' },
    { id: 'mixed', label: 'Mixed', color: 'var(--text-3)' },
  ];

  const thStyle = (col, align) => ({
    padding: '8px 10px', textAlign: align || 'left', fontSize: 10, fontWeight: 600,
    color: sortCol === col ? 'var(--accent)' : 'var(--text-2)',
    cursor: col ? 'pointer' : 'default', userSelect: 'none', textTransform: 'uppercase', letterSpacing: '.05em',
    borderBottom: '2px solid var(--border)', whiteSpace: 'nowrap', position: 'sticky', top: 0, zIndex: 2, background: '#FAFBFC',
  });
  // Sort caret shown in headers (Item Explorer had no sort indicator before).
  const sortCaret = (col) => !col ? null : (sortCol === col
    ? <span style={{ fontSize: 11, marginLeft: 3, color: 'var(--accent)' }}>{sortDir === 'asc' ? '▲' : '▼'}</span>
    : <span style={{ fontSize: 9, marginLeft: 3, color: 'var(--text-3)', opacity: .6 }}>↕</span>);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', padding: '14px 24px 0' }}>
      {/* Top: search + KPIs */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12, flexShrink: 0 }}>
        <SearchBox
          value={search}
          onType={(v) => { setSearch(v); setExactItem(null); }}
          onPick={(opt) => { setSearch(opt.label); setExactItem(opt.code); setSelectedCode(opt.code); }}
          onClear={() => { setSearch(''); setExactItem(null); }}
          options={searchOptions}
          placeholder="Search code or description…"
          width="0 0 320px"
        />
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          <MiniStat label="Items" value={filtered.length} color="var(--accent)" />
          <MiniStat label="High Value" value={hvCount} color="var(--accent)" pct={Math.round(hvCount/Math.max(filtered.length,1)*100)} />
          <MiniStat label="Total Qty" value={Math.round(totalQty).toLocaleString()} color="var(--text-2)" />
          <MiniStat label="Periods in Scope" value={scopedPeriods.length} color="var(--text-2)" />
        </div>
      </div>

      {/* Cohort tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 10, flexShrink: 0, alignItems: 'center', overflowX: 'auto' }}>
        {cohorts.map(c => (
          <button key={c.id} onClick={() => setCohort(c.id)} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 7,
            border: '1px solid', borderColor: cohort === c.id ? c.color : 'var(--border)',
            background: cohort === c.id ? c.color + '12' : '#fff', color: cohort === c.id ? c.color : 'var(--text-2)',
            fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)', whiteSpace: 'nowrap', flexShrink: 0,
          }}>{c.label}<span style={{ fontSize: 10, fontFamily: 'var(--mono)', opacity: .7, fontWeight: 700 }}>{cohortCounts[c.id]}</span></button>
        ))}
      </div>

      {/* Filters row */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap', flexShrink: 0 }}>
        <FilterGroup label="Scope">
          <ScopePicker value={scope} onChange={setScope} singlePeriod={singlePeriod} onSinglePeriodChange={setSinglePeriod} allPeriods={allPeriods} totalPeriods={allPeriods.length} />
        </FilterGroup>
        <FilterGroup label="Type">{['All', 'HV', 'Standard', 'Dormant'].map(o => (
          <button key={o} onClick={() => setHvFilter(o)}
            title={o === 'Dormant' ? 'Items with no movement, or an unchanged count, for a year or more (same list as the Dormant Items page)' : undefined}
            style={{
            padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font)',
            border: '1px solid', borderColor: hvFilter === o ? 'var(--accent)' : 'var(--border)',
            background: hvFilter === o ? 'rgba(79,70,229,.06)' : 'transparent',
            color: hvFilter === o ? 'var(--accent)' : 'var(--text-2)',
          }}>{o === 'HV' ? 'High Value' : o}</button>
        ))}</FilterGroup>
        {(cohort !== 'all' || hvFilter !== 'All' || search) && (
          <button onClick={() => { setCohort('all'); setHvFilter('All'); setSearch(''); setExactItem(null); }} style={{ padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)', border: '1px solid var(--border)', background: '#fff', color: 'var(--text-2)', marginLeft: 'auto' }}>Clear filters</button>
        )}
      </div>

      {/* Comment for the active Type filter — what the list is showing. */}
      {hvFilter !== 'All' && (
        <div style={{ fontSize: 11, color: 'var(--text-3)', margin: '-4px 0 10px', flexShrink: 0 }}>
          {hvFilter === 'HV' && <>Showing <b style={{ color: 'var(--text-2)' }}>High Value</b> items only — the SKUs flagged high value in the forecast.</>}
          {hvFilter === 'Standard' && <>Showing <b style={{ color: 'var(--text-2)' }}>Standard</b> items only — everything not flagged high value.</>}
          {hvFilter === 'Dormant' && <>Showing <b style={{ color: 'var(--text-2)' }}>Dormant</b> items only — {dormantMonths ? <>no movement, or an unchanged count, for {dormantMonths >= 12 ? 'a year or more' : `all ${dormantMonths} month${dormantMonths === 1 ? '' : 's'}`} in the selected scope ({dormantCodes.size} item{dormantCodes.size === 1 ? '' : 's'}){dormantFuture > 0 ? ` — actual history where it exists, the forecast for the ${dormantFuture} month${dormantFuture === 1 ? '' : 's'} with no actuals yet` : ''}. Change the Scope and the list follows.</> : <>the selected scope has no data.</>} This is separate from the Dormant behaviour tab above, which looks only at the most recent periods.</>}
        </div>
      )}

      {/* Body: table + side panel */}
      <div style={{ flex: 1, display: 'flex', gap: 12, overflow: 'hidden', paddingBottom: 14 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#fff', border: '1px solid var(--border)', borderRadius: 12 }}>
          <div ref={tableScrollerRef} style={{ flex: 1, overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{
                    ...thStyle('description'), minWidth: 180,
                    position: 'sticky', left: 0, zIndex: 3,
                    background: '#FAFBFC',
                    boxShadow: tableScrolled ? '2px 0 6px rgba(0,0,0,.10)' : '2px 0 4px rgba(0,0,0,.06)',
                  }} onClick={() => handleSort('description')}>
                    {/* Solid mask absolutely-positioned past the cell's right edge.
                        Inside the sticky stacking context (zIndex:3), so it occludes
                        partial content from columns that slide under during scroll.
                        Box-shadow doesn't reliably do this in border-collapse tables. */}
                    {tableScrolled && (
                      <div style={{
                        position: 'absolute', top: 0, bottom: 0, left: '100%',
                        width: STICKY_MASK, background: '#FAFBFC', pointerEvents: 'none',
                      }} />
                    )}
                    Item{sortCaret('description')}
                  </th>
                  <th style={{ ...thStyle(null), width: 36, textAlign: 'center' }}>ABC</th>
                  <th style={thStyle('cohort')} onClick={() => handleSort('cohort')}>Behavior{sortCaret('cohort')}</th>
                  <th style={thStyle('latestAction')} onClick={() => handleSort('latestAction')}>Action{sortCaret('latestAction')}</th>
                  <th style={{ ...thStyle('latestBal', 'right'), minWidth: 110 }} onClick={() => handleSort('latestBal')}>Balance{sortCaret('latestBal')}</th>
                  <th style={{ ...thStyle('avgMape', 'right'), minWidth: 100 }} onClick={() => handleSort('avgMape')}>Accuracy{sortCaret('avgMape')}</th>
                  <th style={{ ...thStyle('dirCorrectRate', 'right'), minWidth: 72 }} onClick={() => handleSort('dirCorrectRate')}>Dir. Match{sortCaret('dirCorrectRate')}</th>
                  <th style={{ ...thStyle(null), minWidth: 72, textAlign: 'right' }}>Trend</th>
                  <th style={{ ...thStyle('totalQty', 'right') }} onClick={() => handleSort('totalQty')}>Movement{sortCaret('totalQty')}</th>
                  <th style={{ ...thStyle('volatility', 'right'), minWidth: 96 }} onClick={() => handleSort('volatility')}>Volatility{sortCaret('volatility')}</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map(row => {
                  const isSel = selectedCode === row.itemCode;
                  const cohortMeta = cohorts.find(c => c.id === row.cohort);
                  const cls = abcByCode[row.itemCode];
                  const clsCol = cls === 'A' ? '#059669' : cls === 'B' ? '#D97706' : '#9CA3AF';
                  const mapeCol = row.avgMape == null ? 'var(--text-3)' : row.avgMape > 100 ? '#DC2626' : row.avgMape > 50 ? '#D97706' : '#059669';
                  const errCol = row.latestErrorPct == null ? 'var(--text-3)' : Math.abs(row.latestErrorPct) > 50 ? '#DC2626' : Math.abs(row.latestErrorPct) > 20 ? '#D97706' : '#059669';
                  const balNeg = row.latestBal != null && row.latestBal <= 0;
                  const dirPct = row.dirCorrectRate != null ? Math.round(row.dirCorrectRate * 100) : null;
                  const dirCol = dirPct == null ? 'var(--text-3)' : dirPct >= 80 ? '#059669' : dirPct >= 60 ? '#D97706' : '#DC2626';
                  return (
                    <tr key={row.itemCode} onClick={() => setSelectedCode(isSel ? null : row.itemCode)}
                      style={{ cursor: 'pointer', borderBottom: '1px solid #F3F4F6', background: isSel ? 'rgba(79,70,229,.05)' : 'transparent' }}
                      onMouseEnter={e => {
                        if (isSel) return;
                        e.currentTarget.style.background = '#F9FAFB';
                        // Keep sticky first cell + its right-side mask in sync with the
                        // row's hover bg so it doesn't render as a white strip against
                        // the hovered row.
                        const stickyTd = e.currentTarget.querySelector('td');
                        if (stickyTd) {
                          stickyTd.style.background = '#F9FAFB';
                          const mask = stickyTd.firstElementChild;
                          if (mask && mask.style.position === 'absolute') {
                            mask.style.background = '#F9FAFB';
                          }
                        }
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = isSel ? 'rgba(79,70,229,.05)' : 'transparent';
                        const stickyTd = e.currentTarget.querySelector('td');
                        if (stickyTd) {
                          const bg = isSel ? '#F6F6FE' : '#FFFFFF';
                          stickyTd.style.background = bg;
                          const mask = stickyTd.firstElementChild;
                          if (mask && mask.style.position === 'absolute') {
                            mask.style.background = bg;
                          }
                        }
                      }}>

                      {/* Item: name + code + HV — sticky frozen column.
                          Background MUST be opaque so other cells don't bleed through
                          when the user scrolls horizontally. #F6F6FE is the opaque
                          equivalent of rgba(79,70,229,.05) flattened over white,
                          matching the selected-row tint exactly. */}
                      <td style={{
                        padding: '8px 10px', maxWidth: 220,
                        position: 'sticky', left: 0, zIndex: 2,
                        background: isSel ? '#F6F6FE' : '#FFFFFF',
                        boxShadow: tableScrolled ? '2px 0 6px rgba(0,0,0,.10)' : '2px 0 4px rgba(0,0,0,.06)',
                      }}>
                        {/* Mask: extends the cell's apparent right edge so partial
                            content from BEHAVIOR/ABC columns sliding under the sticky
                            doesn't peek out past it. Box-shadow doesn't work reliably
                            for this in border-collapse tables — absolute child does. */}
                        {tableScrolled && (
                          <div style={{
                            position: 'absolute', top: 0, bottom: 0, left: '100%',
                            width: STICKY_MASK, background: isSel ? '#F6F6FE' : '#FFFFFF',
                            pointerEvents: 'none',
                          }} />
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden' }}>
                          {row.isHV && <span style={{ fontSize: 10, color: 'var(--accent)', flexShrink: 0 }}>★</span>}
                          <span style={{ fontWeight: 550, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.description}>{row.description}</span>
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--mono)', marginTop: 1 }}>{row.itemCode}</div>
                      </td>

                      {/* ABC badge */}
                      <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: 5, background: clsCol, color: '#fff', fontSize: 10, fontWeight: 800 }}>{cls}</span>
                      </td>

                      {/* Behavior / cohort */}
                      <td style={{ padding: '8px 10px' }}>
                        <span style={{ padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 600, color: cohortMeta?.color, background: (cohortMeta?.color || '#888') + '14', whiteSpace: 'nowrap' }}>{cohortMeta?.label}</span>
                      </td>

                      {/* Latest action */}
                      <td style={{ padding: '8px 10px' }}>
                        {row.latestAction
                          ? <span style={{ padding: '2px 9px', borderRadius: 20, fontSize: 10, fontWeight: 600, color: ac(row.latestAction), background: abg(row.latestAction), whiteSpace: 'nowrap' }}>{row.latestAction}</span>
                          : <span style={{ color: 'var(--text-3)' }}>—</span>}
                        {row.streak > 1 && <span style={{ marginLeft: 5, fontSize: 9, color: ac(row.streakAction), fontWeight: 700, fontFamily: 'var(--mono)' }}>{row.streak}×</span>}
                      </td>

                      {/* Balance: predicted + actual below */}
                      <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, color: balNeg ? '#DC2626' : 'var(--text)' }}>
                          {fmt(row.latestBal)}
                        </div>
                        {row.latestActualBal != null && (
                          <div style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--mono)', marginTop: 1 }}>
                            act {fmt(row.latestActualBal)}
                          </div>
                        )}
                      </td>

                      {/* Accuracy: MAPE + Error% below */}
                      <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, color: mapeCol }}>
                          {row.avgMape != null ? row.avgMape.toFixed(1) + '%' : '—'}
                          <span style={{ fontWeight: 500, fontSize: 9.5, color: 'var(--text-2)', fontFamily: 'var(--font)', marginLeft: 2 }}>MAPE</span>
                        </div>
                        {row.latestErrorPct != null && (
                          <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: errCol, marginTop: 1 }}>
                            {row.latestErrorPct > 0 ? '+' : ''}{row.latestErrorPct.toFixed(1)}% err
                          </div>
                        )}
                      </td>

                      {/* Direction match */}
                      <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                        {dirPct != null ? (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, color: dirCol }}>{dirPct}%</span>
                            <div style={{ width: 40, height: 3, background: '#F3F4F6', borderRadius: 2, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${dirPct}%`, background: dirCol, borderRadius: 2 }} />
                            </div>
                          </div>
                        ) : <span style={{ color: 'var(--text-3)' }}>—</span>}
                      </td>

                      {/* Trend sparkline */}
                      <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4, alignItems: 'center' }}>
                          <MiniSparkline data={row.all} mode={mode} />
                          <MiniActionDots data={row.all} ac={ac} mode={mode} />
                        </div>
                      </td>

                      {/* Movement qty */}
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600, color: 'var(--text-2)' }}>{fmt(row.totalQty)}</td>

                      {/* Volatility */}
                      <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                        <VolatilityBar value={row.volatility} />
                      </td>
                    </tr>
                  );
                })}
                {pageRows.length === 0 && <tr><td colSpan={10} style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>No items match filters</td></tr>}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderTop: '1px solid var(--border)', background: '#FAFBFC' }}>
            <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
              {sorted.length === 0 ? 0 : page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, sorted.length)} of {sorted.length} items
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <SmallPgBtn label="←" disabled={page === 0} onClick={() => setPage(p => p - 1)} />
              {(() => { const btns = []; const start = Math.max(0, Math.min(page - 2, totalPages - 5)); const end = Math.min(totalPages, start + 5);
                for (let i = start; i < end; i++) btns.push(<SmallPgBtn key={i} label={i + 1} active={i === page} onClick={() => setPage(i)} />); return btns; })()}
              <SmallPgBtn label="→" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} />
            </div>
          </div>
        </div>

        {/* Side panel */}
        <div style={{ width: 380, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10, overflow: 'auto' }}>
          {selectedItem ? (
            <RichDetailPanel item={selectedItem} abc={abcByCode[selectedItem.itemCode]} onClose={() => setSelectedCode(null)} ac={ac} abg={abg} fmt={fmt} cohortMeta={cohorts.find(c => c.id === selectedItem.cohort)} mode={mode} />
          ) : (
            <CohortBreakdownPanel itemSummaries={filtered} cohorts={cohorts} cohortCounts={cohortCounts} onCohortClick={setCohort} ac={ac} />
          )}
        </div>
      </div>
    </div>
  );
}

/* ===== Rich Detail Panel ===== */
function RichDetailPanel({ item, abc, onClose, ac, abg, fmt, cohortMeta, mode = 'predicted' }) {
  const series = item.all;
  // Month under the mouse on the Closing Balance chart (index into series).
  const [hoverIdx, setHoverIdx] = React.useState(null);
  React.useEffect(() => { setHoverIdx(null); }, [item.itemCode]);
  // The chart and the Action History strip share the hovered month. When the
  // hover comes from the chart the strip scrolls to bring that month's box into
  // view; when it comes from the strip itself it must not move under the mouse.
  const hoverSrc = React.useRef(null);
  const ribbonRef = React.useRef(null);
  React.useEffect(() => {
    const el = ribbonRef.current;
    if (hoverIdx == null || hoverSrc.current !== 'chart' || !el || el.scrollWidth <= el.clientWidth) return;
    const cw = el.scrollWidth / series.length;
    el.scrollLeft = (hoverIdx + 0.5) * cw - el.clientWidth / 2;
  }, [hoverIdx]);
  const isActual = mode === 'actual';
  const fmtPeriod = p => {
    if (!p) return '';
    const mM = p.match(/^(\d{4})-(\d{2})$/);
    if (mM) { const ns = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']; return `${ns[parseInt(mM[2])-1]} '${mM[1].slice(2)}`; }
    const qM = p.match(/^(\d{4})-Q(\d)$/); if (qM) return `Q${qM[2]} '${qM[1].slice(2)}`;
    const hM = p.match(/^(\d{4})-H(\d)$/); if (hM) return `H${hM[2]} '${hM[1].slice(2)}`;
    return p;
  };
  const fmtK = v => v >= 1e6 ? (v/1e6).toFixed(1)+'M' : v >= 1e3 ? (v/1e3).toFixed(1)+'K' : Math.round(v).toLocaleString();

  // Chart dimensions with generous left padding for Y-axis labels
  const w = 352, h = 150, padL = 46, padR = 8, padT = 12, padB = 32;
  const cW = w - padL - padR, cH = h - padT - padB;
  const maxVal = Math.max(...series.flatMap(p => [p.prevClosingBal || 0, p.predictedClosingBal || 0, p.actualClosingBal || 0]), 1);
  const minVal = Math.min(...series.flatMap(p => [p.predictedClosingBal || 0, p.actualClosingBal || 0].filter(v => v != null)), 0);
  const range = maxVal - minVal || 1;
  const cx = i => padL + (series.length === 1 ? cW / 2 : (i / (series.length - 1)) * cW);
  const cy = v => padT + cH - ((v - minVal) / range) * cH;
  const predPath = series.map((p, i) => `${i === 0 ? 'M' : 'L'} ${cx(i).toFixed(1)} ${cy(p.predictedClosingBal || 0).toFixed(1)}`).join(' ');
  const area = predPath + ` L ${cx(series.length - 1).toFixed(1)} ${(padT + cH).toFixed(1)} L ${cx(0).toFixed(1)} ${(padT + cH).toFixed(1)} Z`;
  const hasActuals = series.some(p => p.actualClosingBal != null);
  const actualPath = series.filter(p => p.actualClosingBal != null).map((p, i, arr) => {
    const origIdx = series.indexOf(p);
    return `${i === 0 ? 'M' : 'L'} ${cx(origIdx).toFixed(1)} ${cy(p.actualClosingBal).toFixed(1)}`;
  }).join(' ');

  // Y-axis ticks: 4 levels
  const yTicks = [0, 0.33, 0.67, 1].map(t => ({ pct: t, val: minVal + t * range }));

  // X-axis: show first, mid-ish, last — adaptive
  const xLabels = series.reduce((acc, p, i) => {
    if (i === 0 || i === series.length - 1 || (series.length > 4 && i === Math.floor(series.length / 2))) acc.push(i);
    return acc;
  }, []);

  // Action ribbon
  const ribbonH = 24;
  const cellW = w / series.length;

  // Stats describe the action history in the selected mode (Predicted or
  // Actual), matching the ribbon below and the header toggle. In actual mode
  // we restrict to the months that actually have an outcome.
  const statRows = isActual ? series.filter(d => d.actualAction != null) : series;
  const acts = statRows.map(d => fcAction(d, mode));
  const statHint = isActual
    ? `${acts.length} period${acts.length === 1 ? '' : 's'} w/ actuals`
    : `${acts.length} forecast period${acts.length === 1 ? '' : 's'}`;
  // Total moved = real units that changed hands (|actual − previous| closing
  // balance) in actual mode, else the predicted action quantity.
  const totalMoved = isActual
    ? statRows.reduce((s, d) => s + Math.abs((d.actualClosingBal || 0) - (d.prevClosingBal || 0)), 0)
    : series.reduce((s, d) => s + (d.quantity || 0), 0);
  const flips = acts.reduce((s, a, i) => s + (i > 0 && a !== acts[i-1] ? 1 : 0), 0);
  let longestStreak = acts.length ? 1 : 0, longestAction = acts[0], cur = 1;
  for (let i = 1; i < acts.length; i++) {
    if (acts[i] === acts[i-1]) { cur++; if (cur > longestStreak) { longestStreak = cur; longestAction = acts[i]; } }
    else cur = 1;
  }
  const counts = { Deliver: 0, Return: 0, 'No Change': 0 };
  acts.forEach(a => { if (counts[a] != null) counts[a]++; });
  const predominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];

  return (
    <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 800, lineHeight: 1.3 }}>{item.description}</div>
          <div style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--mono)', marginTop: 2 }}>{item.itemCode}</div>
        </div>
        <button onClick={onClose} style={{ background: '#F3F4F6', border: 'none', color: 'var(--text-3)', cursor: 'pointer', width: 22, height: 22, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>×</button>
      </div>

      {/* Tags */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {item.isHV && <span style={{ padding: '2px 9px', borderRadius: 20, fontSize: 10, fontWeight: 600, color: 'var(--accent)', background: 'rgba(79,70,229,.06)' }}>★ High Value</span>}
        <span style={{ padding: '2px 9px', borderRadius: 20, fontSize: 10, fontWeight: 600, color: cohortMeta?.color, background: (cohortMeta?.color || '#888') + '14' }}>{cohortMeta?.label}</span>
        {abc && (() => { const col = abc === 'A' ? '#059669' : abc === 'B' ? '#D97706' : '#9CA3AF'; return <span style={{ padding: '2px 9px', borderRadius: 20, fontSize: 10, fontWeight: 600, color: col, background: col + '14' }}>Class {abc}</span>; })()}
      </div>

      {/* Closing Balance trajectory */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)' }}>Closing Balance · {series.length} period{series.length === 1 ? '' : 's'}</span>
          {hasActuals && (
            <div style={{ display: 'flex', gap: 10, fontSize: 10, color: 'var(--text-3)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 12, height: 2, background: 'var(--accent)', display: 'inline-block', borderRadius: 1 }}></span>Predicted</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 12, height: 2, background: '#F59E0B', display: 'inline-block', borderRadius: 1, borderTop: '2px dashed #F59E0B' }}></span>Actual</span>
            </div>
          )}
        </div>
        <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block', overflow: 'visible' }}
          onMouseMove={e => {
            const r = e.currentTarget.getBoundingClientRect();
            const x = (e.clientX - r.left) / r.width * w;
            const i = series.length === 1 ? 0 : Math.round((x - padL) / cW * (series.length - 1));
            hoverSrc.current = 'chart';
            setHoverIdx(Math.max(0, Math.min(series.length - 1, i)));
          }}
          onMouseLeave={() => setHoverIdx(null)}>
          {/* Y-axis grid lines + labels */}
          {yTicks.map((t, i) => {
            const yy = cy(t.val);
            return (
              <g key={i}>
                <line x1={padL} y1={yy} x2={w - padR} y2={yy} stroke="#F0F1F3" strokeDasharray={i === 0 ? '' : '3,3'} />
                <text x={padL - 5} y={yy + 3.5} textAnchor="end" fontSize="10" fill="#9CA3AF" fontFamily="var(--mono)">{fmtK(t.val)}</text>
              </g>
            );
          })}
          {/* Y-axis line */}
          <line x1={padL} y1={padT} x2={padL} y2={padT + cH} stroke="#E5E7EB" />
          {/* Gradient area + predicted line */}
          <defs><linearGradient id={`grad-${item.itemCode}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--accent)" stopOpacity=".18" /><stop offset="100%" stopColor="var(--accent)" stopOpacity="0" /></linearGradient></defs>
          <path d={area} fill={`url(#grad-${item.itemCode})`} />
          <path d={predPath} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {/* Actual line (dashed amber) */}
          {hasActuals && actualPath && <path d={actualPath} fill="none" stroke="#F59E0B" strokeWidth={1.8} strokeDasharray="4,3" strokeLinejoin="round" />}
          {/* Data points + X-axis labels */}
          {series.map((p, i) => {
            const showLabel = xLabels.includes(i);
            const anchor = i === 0 ? 'start' : i === series.length - 1 ? 'end' : 'middle';
            return (
              <g key={i}>
                <circle cx={cx(i)} cy={cy(p.predictedClosingBal || 0)} r={2.5} fill="var(--accent)" />
                {p.actualClosingBal != null && <circle cx={cx(i)} cy={cy(p.actualClosingBal)} r={2.5} fill="#F59E0B" />}
                {showLabel && (
                  <text x={cx(i)} y={padT + cH + 18} textAnchor={anchor} fontSize="10" fill="#9CA3AF" fontFamily="var(--mono)">{fmtPeriod(p.period)}</text>
                )}
              </g>
            );
          })}
          {/* Hover: guide line + the month and its balances */}
          {hoverIdx != null && series[hoverIdx] && (() => {
            const p = series[hoverIdx], x = cx(hoverIdx);
            const hasA = p.actualClosingBal != null;
            const bw = 118, bh = hasA ? 50 : 36;
            // Keep the label off the points: beside the guide line (whichever side
            // has room), and in the half of the chart the hovered points are not in.
            const bx = x + 10 + bw <= w - padR ? x + 10 : x - 10 - bw;
            const ys = [cy(p.predictedClosingBal || 0)].concat(hasA ? [cy(p.actualClosingBal)] : []);
            const yMid = (Math.min(...ys) + Math.max(...ys)) / 2;
            const by = yMid < padT + cH / 2 ? padT + cH - bh - 2 : padT + 2;
            return (
              <g style={{ pointerEvents: 'none' }}>
                <line x1={x} y1={padT} x2={x} y2={padT + cH} stroke="#9CA3AF" strokeDasharray="3,3" />
                <circle cx={x} cy={cy(p.predictedClosingBal || 0)} r={4} fill="var(--accent)" stroke="#fff" strokeWidth={1.5} />
                {hasA && <circle cx={x} cy={cy(p.actualClosingBal)} r={4} fill="#F59E0B" stroke="#fff" strokeWidth={1.5} />}
                <rect x={bx} y={by} width={bw} height={bh} rx={6} fill="#111827" opacity=".93" />
                <text x={bx + 8} y={by + 14} fontSize="10.5" fontWeight="700" fill="#fff">{fmtPeriod(p.period)}</text>
                <text x={bx + 8} y={by + 28} fontSize="10" fill="#C7D2FE" fontFamily="var(--mono)">Predicted {Math.round(p.predictedClosingBal || 0).toLocaleString('en-US')}</text>
                {hasA && <text x={bx + 8} y={by + 42} fontSize="10" fill="#FCD34D" fontFamily="var(--mono)">Actual {Math.round(p.actualClosingBal).toLocaleString('en-US')}</text>}
              </g>
            );
          })()}
        </svg>
      </div>

      {/* Action ribbon — follows the Predicted/Actual mode. In actual mode a
          neutral cell is shown for months with no actual yet. Each cell is at
          least 20px wide so the D/R/N letter stays legible even on multi-year
          backtests; it scrolls horizontally via the themed h-scroller. */}
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)' }}>Action History <span style={{ fontWeight: 500, color: 'var(--text-3)', fontSize: 10 }}>· {isActual ? 'actual' : 'predicted'}</span></div>
          {hoverIdx != null && series[hoverIdx] && (() => {
            const a = fcAction(series[hoverIdx], mode);
            return <div style={{ fontSize: 10.5, fontWeight: 700, color: a ? ac(a) : 'var(--text-3)' }}><span style={{ color: 'var(--text)', fontFamily: 'var(--mono)' }}>{fmtPeriod(series[hoverIdx].period)}</span> · {a || 'no actual yet'}</div>;
          })()}
        </div>
        {(() => {
          const cellMin = 20;
          const ribbonW = Math.max(w, series.length * cellMin);
          const cw = ribbonW / series.length;
          return (
            <div className="h-scroller" ref={ribbonRef} onMouseLeave={() => setHoverIdx(null)}>
              <svg width={ribbonW} height={ribbonH} viewBox={`0 0 ${ribbonW} ${ribbonH}`} style={{ display: 'block' }}>
                {series.map((p, i) => {
                  const xp = i * cw;
                  const a = fcAction(p, mode);
                  const hasActual = a != null;
                  const letter = a === 'Deliver' ? 'D' : a === 'Return' ? 'R' : a === 'No Change' ? 'N' : '—';
                  const fill = hasActual ? ac(a) : '#E5E7EB';
                  const op = !hasActual ? 1 : (a === 'No Change' ? .3 : .85);
                  const textCol = hasActual ? '#fff' : 'var(--text-3)';
                  return (
                    <g key={p.period} onMouseEnter={() => { hoverSrc.current = 'ribbon'; setHoverIdx(i); }}>
                      <title>{`${fmtPeriod(p.period)}: ${hasActual ? a : 'no actual yet'}`}</title>
                      <rect x={xp + 0.5} y={0} width={Math.max(cw - 1, 1)} height={ribbonH} fill={fill} opacity={hoverIdx === i && hasActual ? 1 : op} rx={2} />
                      {hoverIdx === i && <rect x={xp + 1.25} y={1} width={Math.max(cw - 2.5, 1)} height={ribbonH - 2} fill="none" stroke="#111827" strokeWidth={2} rx={2} />}
                      {cw >= 16 && <text x={xp + cw / 2} y={ribbonH / 2 + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill={textCol}>{letter}</text>}
                    </g>
                  );
                })}
              </svg>
            </div>
          );
        })()}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--mono)', marginTop: 4 }}>
          <span>{fmtPeriod(series[0].period)}</span>
          {series.length > 4 && <span>{fmtPeriod(series[Math.floor(series.length / 2)].period)}</span>}
          <span>{fmtPeriod(series[series.length - 1].period)}</span>
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 5, fontSize: 10, color: 'var(--text-3)' }}>
          {[['D','Deliver','#059669'],['R','Return','#DC2626'],['N','No Change','#D97706']].map(([l,lbl,col]) => (
            <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 14, height: 14, borderRadius: 3, background: col, opacity: .85, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff' }}>{l}</span>
              {lbl}
            </span>
          ))}
        </div>
      </div>

      {/* Stats grid */}
      <div style={{ borderTop: '1px solid #F3F4F6', paddingTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 11 }}>
        <DetailStat label="Total Moved" value={fmtK(totalMoved)} hint={isActual ? 'actual units moved' : 'predicted units'} />
        <DetailStat label="Direction Changes" value={flips} hint={statHint} />
        <DetailStat label="Longest Streak" value={`${longestStreak}×`} hint={longestAction} hintColor={ac(longestAction)} />
        <DetailStat label="Predominant Action" value={predominant[0]} valueColor={ac(predominant[0])} hint={`${Math.round(predominant[1] / acts.length * 100)}% of time`} />
        {(() => {
          const mapeVals = series.map(p => p.itemMape).filter(v => v != null);
          const avgMape = mapeVals.length ? (mapeVals.reduce((s, v) => s + v, 0) / mapeVals.length).toFixed(1) + '%' : '—';
          const mapeColor = mapeVals.length ? (parseFloat(avgMape) > 100 ? '#DC2626' : parseFloat(avgMape) > 50 ? '#D97706' : '#059669') : undefined;
          const lastWithActual = [...series].reverse().find(p => p.actualClosingBal != null);
          const errVal = lastWithActual?.error;
          const errPct = (errVal != null && lastWithActual.actualClosingBal != null && lastWithActual.actualClosingBal !== 0)
            ? (errVal / lastWithActual.actualClosingBal) * 100 : null;
          const errPctColor = errPct == null ? undefined : Math.abs(errPct) > 50 ? '#DC2626' : Math.abs(errPct) > 20 ? '#D97706' : '#059669';
          return (<>
            <DetailStat label="Avg MAPE" value={avgMape} valueColor={mapeColor} hint={mapeVals.length ? `${mapeVals.length} periods with actuals` : 'no actuals yet'} />
            <DetailStat label="Error %" value={errPct != null ? (errPct > 0 ? '+' : '') + errPct.toFixed(1) + '%' : '—'} valueColor={errPctColor} hint={lastWithActual ? `actual: ${Math.round(lastWithActual.actualClosingBal).toLocaleString()}` : 'no actuals yet'} />
          </>);
        })()}
        {(() => {
          const withActual = series.filter(p => p.directionCorrect != null);
          const dirRate = withActual.length ? Math.round(withActual.filter(p => p.directionCorrect).length / withActual.length * 100) : null;
          const dirCol = dirRate == null ? undefined : dirRate >= 80 ? '#059669' : dirRate >= 60 ? '#D97706' : '#DC2626';
          return <DetailStat label="Dir. Match" value={dirRate != null ? dirRate + '%' : '—'} valueColor={dirCol} hint={withActual.length ? `${withActual.length} periods w/ actuals` : 'no actuals yet'} />;
        })()}
        <DetailStat label="First Activity" value={fmtPeriod(series[0].period)} hint="" />
        <DetailStat label="Latest Period" value={fmtPeriod(series[series.length - 1].period)} hint="" />
      </div>
    </div>
  );
}

function DetailStat({ label, value, valueColor, hint, hintColor }) {
  return (
    <div style={{ background: '#FAFBFC', borderRadius: 7, padding: '7px 10px' }}>
      <div style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 800, fontFamily: 'var(--mono)', color: valueColor || 'var(--text)', marginTop: 1 }}>{value}</div>
      {hint && <div style={{ fontSize: 10, color: hintColor || 'var(--text-3)', fontWeight: 500, marginTop: 1 }}>{hint}</div>}
    </div>
  );
}

/* ===== Cohort Breakdown Panel (default side panel state) ===== */
function CohortBreakdownPanel({ itemSummaries, cohorts, cohortCounts, onCohortClick, ac }) {
  const total = itemSummaries.length || 1;
  const visibleCohorts = cohorts.filter(c => c.id !== 'all' && cohortCounts[c.id] > 0);
  const max = Math.max(...visibleCohorts.map(c => cohortCounts[c.id]), 1);
  // Compact balance formatter for the inline "bal N" labels below. (Without
  // this local definition the At-Risk list throws "fmt is not defined" and
  // takes the whole Item Explorer page down with it.)
  const fmt = v => v == null ? '—' : v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : v >= 1e3 ? (v / 1e3).toFixed(1) + 'K' : Math.round(v).toLocaleString();

  // Top volatile, top at-risk
  const volatile = [...itemSummaries].filter(it => it.cohort === 'volatile').slice(0, 4);
  const atRisk = [...itemSummaries].filter(it => it.cohort === 'atRisk').slice(0, 4);

  return (
    <>
      <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10 }}>Behavior Cohorts</div>
        <div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 10 }}>Computed from each item's last-6-periods action sequence.</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {visibleCohorts.map(c => {
            const cnt = cohortCounts[c.id];
            return (
              <button key={c.id} onClick={() => onCohortClick(c.id)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', background: 'transparent', border: 'none', borderRadius: 6, cursor: 'pointer', textAlign: 'left' }}
                onMouseEnter={e => e.currentTarget.style.background = '#FAFBFC'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <div style={{ width: 9, height: 9, borderRadius: 2, background: c.color, flexShrink: 0 }}></div>
                <div style={{ flex: 1, fontSize: 11, fontWeight: 600, color: 'var(--text-2)' }}>{c.label}</div>
                <div style={{ flex: 1.5, height: 8, background: '#F3F4F6', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${cnt / max * 100}%`, background: c.color, opacity: .85, borderRadius: 2 }}></div>
                </div>
                <div style={{ width: 38, fontSize: 11, fontWeight: 700, fontFamily: 'var(--mono)', textAlign: 'right' }}>{cnt}</div>
                <div style={{ width: 32, fontSize: 9, fontFamily: 'var(--mono)', color: 'var(--text-3)', textAlign: 'right' }}>{Math.round(cnt / total * 100)}%</div>
              </button>
            );
          })}
        </div>
      </div>

      {atRisk.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#DC2626' }}>⚠ Top At-Risk Items</div>
            <button onClick={() => onCohortClick('atRisk')} style={{ fontSize: 10, color: 'var(--accent)', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 600 }}>See all →</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {atRisk.map(it => (
              <div key={it.itemCode} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, padding: '4px 0', borderBottom: '1px solid #F3F4F6' }}>
                <div style={{ flex: 1, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={it.description}>{it.description}</div>
                <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: '#DC2626', fontWeight: 700 }}>bal {fmt(it.latestBal)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {volatile.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#D97706' }}>⇌ Most Volatile</div>
            <button onClick={() => onCohortClick('volatile')} style={{ fontSize: 10, color: 'var(--accent)', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 600 }}>See all →</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {volatile.map(it => (
              <div key={it.itemCode} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, padding: '4px 0', borderBottom: '1px solid #F3F4F6' }}>
                <div style={{ flex: 1, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={it.description}>{it.description}</div>
                <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: '#D97706', fontWeight: 700 }}>{Math.round(it.volatility * 100)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ background: 'var(--accent-surface)', border: '1px solid var(--accent-border)', borderRadius: 10, padding: '10px 12px', fontSize: 11, color: 'var(--accent)', lineHeight: 1.5 }}>
        <strong>Tip:</strong> Click a cohort or any row to dive in. Each item shows its full trajectory and action history.
      </div>
    </>
  );
}

/* ===== Scope Picker ===== */
function ScopePicker({ value, onChange, singlePeriod, onSinglePeriodChange, allPeriods, totalPeriods }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    const fn = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', fn); return () => document.removeEventListener('mousedown', fn);
  }, []);
  const fmt = p => {
    if (!p) return '';
    const mM = p.match(/^(\d{4})-(\d{2})$/); if (mM) { const ns = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']; return `${ns[parseInt(mM[2])-1]} ${mM[1]}`; }
    const qM = p.match(/^(\d{4})-Q(\d)$/); if (qM) return `Q${qM[2]} ${qM[1]}`;
    const hM = p.match(/^(\d{4})-H(\d)$/); if (hM) return `H${hM[2]} ${hM[1]}`;
    return p;
  };
  const labels = {
    all: `All ${totalPeriods} periods`,
    last12: 'Last 12 months',
    last6: 'Last 6 months',
    last3: 'Last 3 months',
    single: `Single: ${fmt(singlePeriod)}`,
  };
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(!open)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: '#fff', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font)' }}>
        <span>{labels[value]}</span><span style={{ fontSize: 9, color: 'var(--text-3)' }}>▼</span>
      </button>
      {open && <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, background: '#fff', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,.08)', zIndex: 100, minWidth: 200, padding: 4 }}>
        {[
          { id: 'all', label: `All ${totalPeriods} periods` },
          { id: 'last12', label: 'Last 12 months' },
          { id: 'last6', label: 'Last 6 months' },
          { id: 'last3', label: 'Last 3 months' },
          { id: 'single', label: 'Single period…' },
        ].map(o => (
          <button key={o.id} onClick={() => { onChange(o.id); if (o.id !== 'single') setOpen(false); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 10px', border: 'none', background: value === o.id ? 'var(--accent-surface)' : 'transparent', color: value === o.id ? 'var(--accent)' : 'var(--text-2)', cursor: 'pointer', fontSize: 11, fontWeight: value === o.id ? 700 : 500, fontFamily: 'var(--font)', borderRadius: 5 }}>{o.label}</button>
        ))}
        {value === 'single' && (
          <div style={{ padding: 6, borderTop: '1px solid var(--border)', marginTop: 4 }}>
            <select value={singlePeriod} onChange={e => onSinglePeriodChange(e.target.value)} style={{ width: '100%', padding: '5px 8px', borderRadius: 5, border: '1px solid var(--border)', background: '#fff', fontSize: 11, fontFamily: 'var(--font)' }}>
              {allPeriods.map(p => <option key={p} value={p}>{fmt(p)}</option>)}
            </select>
          </div>
        )}
      </div>}
    </div>
  );
}

/* ===== Mini Sparkline (last 8 periods predicted closing balance) ===== */
function MiniSparkline({ data, w = 52, h = 18, mode = 'predicted' }) {
  const last8 = (data || []).filter(d => fcBal(d, mode) != null).slice(-8);
  if (last8.length < 2) return null;
  const vals = last8.map(d => fcBal(d, mode) || 0);
  const min = Math.min(...vals, 0);
  const max = Math.max(...vals, min + 1);
  const range = max - min;
  const px = i => (i / (last8.length - 1)) * w;
  const py = v => h - 2 - ((v - min) / range) * (h - 4);
  const pts = last8.map((d, i) => `${px(i).toFixed(1)},${py(fcBal(d, mode) || 0).toFixed(1)}`).join(' ');
  const last = vals[vals.length - 1];
  const prev = vals[vals.length - 2];
  const color = last > prev * 1.01 ? '#059669' : last < prev * 0.99 ? '#DC2626' : '#D97706';
  const lx = px(last8.length - 1);
  const ly = py(last);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block', flexShrink: 0 }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lx.toFixed(1)} cy={ly.toFixed(1)} r="2" fill={color} />
    </svg>
  );
}

/* ===== Mini Action Dots (last 6 periods' actions as colored squares) ===== */
function MiniActionDots({ data, ac, mode = 'predicted' }) {
  const last6 = (data || []).filter(d => fcAction(d, mode) != null).slice(-6);
  if (!last6.length) return null;
  return (
    <div style={{ display: 'flex', gap: 2, alignItems: 'center', flexShrink: 0 }}>
      {last6.map((d, i) => { const a = fcAction(d, mode); return (
        <div key={i} title={`${d.period}: ${a}`}
          style={{ width: 5, height: 10, borderRadius: 1.5, background: ac(a), opacity: 0.5 + 0.5 * (i / (last6.length - 1 || 1)) }} />
      ); })}
    </div>
  );
}

/* ===== Volatility Bar (mini) ===== */
function VolatilityBar({ value }) {
  const pct = Math.min(value, 1);
  const color = pct < 0.2 ? '#059669' : pct < 0.5 ? '#D97706' : '#DC2626';
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end', width: '100%' }}>
      <div style={{ width: 50, height: 5, background: '#F3F4F6', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct * 100}%`, background: color, borderRadius: 2 }}></div>
      </div>
      <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text-3)', minWidth: 22, textAlign: 'right' }}>{Math.round(pct * 100)}%</span>
    </div>
  );
}

/* ===== Reused components ===== */
function MiniStat({ label, value, color, pct }) {
  return (
    <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', display: 'flex', flexDirection: 'column', gap: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</span>
        {pct != null && <span style={{ fontSize: 9, fontFamily: 'var(--mono)', color: 'var(--text-3)' }}>{pct}%</span>}
      </div>
      <div style={{ fontSize: 16, fontWeight: 800, fontFamily: 'var(--mono)', color }}>{value}</div>
    </div>
  );
}

function SmallPgBtn({ label, active, disabled, onClick }) {
  return (
    <button onClick={disabled ? undefined : onClick} style={{
      width: typeof label === 'number' ? 26 : 24, height: 24, borderRadius: 5, border: '1px solid',
      borderColor: active ? 'var(--accent)' : 'var(--border)',
      background: active ? 'var(--accent)' : '#fff',
      color: active ? '#fff' : disabled ? 'var(--text-3)' : 'var(--text-2)',
      fontSize: 10, fontWeight: 600, cursor: disabled ? 'default' : 'pointer',
      fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      opacity: disabled ? .55 : 1,
    }}>{label}</button>
  );
}

function FilterGroup({ label, children }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</span>{children}</div>;
}

Object.assign(window, { ItemExplorerPage });
