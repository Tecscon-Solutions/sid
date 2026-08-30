/* ============================================================
   Top-level dashboard App + the page/tab components that aren't
   broken out into separate files yet (PredictionsPage, OverviewTab,
   MovementTab, DistributionTab, InsightsTab, AccuracyTab, KPI,
   ItemsTableTab, etc.).  These all share state via props from App,
   so it's not worth splitting them further until they stop
   referring to each other through closure.

   Babel-standalone concatenates every <script type="text/babel">
   block into one program, so the `useState`/`useEffect`/`useMemo`
   destructure happens once (in data.jsx, which loads first) and is
   visible here as plain identifiers. Other cross-file pieces come
   from the component files (Sidebar, charts.*, ItemExplorerPage,
   etc.).
   ============================================================ */

function PeriodSelector({ value, onChange, options }) {
  const [open, setOpen] = useState(false);
  const ref = React.useRef(null);
  useEffect(() => {
    const fn = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', fn); return () => document.removeEventListener('mousedown', fn);
  }, []);
  const fmt = p => { const [y, m] = p.split('-'); const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']; return `${names[parseInt(m)-1]} ${y}`; };
  const idx = options.indexOf(value);
  // Stepper arrow button — visible affordance: subtle filled track, darker
  // glyph, hover feedback, and an unmistakable disabled state.
  const Arrow = ({ dir, on, onClick }) => (
    <button onClick={onClick} disabled={!on} aria-label={dir === 'prev' ? 'Previous month' : 'Next month'}
      style={{
        width: 30, height: 32, borderRadius: 7,
        border: '1px solid ' + (on ? 'var(--accent)' : 'var(--accent-border)'),
        background: on ? 'var(--accent)' : 'var(--accent-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: on ? 'pointer' : 'default', color: on ? '#fff' : 'var(--accent)',
        fontSize: 15, lineHeight: 1, opacity: on ? 1 : 0.55,
        boxShadow: on ? '0 1px 3px rgba(79,70,229,.35)' : 'none',
        transition: 'background .12s, box-shadow .12s',
      }}
      onMouseEnter={e => { if (on) e.currentTarget.style.background = '#4338CA'; }}
      onMouseLeave={e => { if (on) e.currentTarget.style.background = 'var(--accent)'; }}
    >{dir === 'prev' ? '‹' : '›'}</button>
  );
  return (
    <div ref={ref} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <Arrow dir="prev" on={idx > 0} onClick={() => idx > 0 && onChange(options[idx - 1])} />
      <div style={{ position: 'relative' }}>
        <button onClick={() => setOpen(!open)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderRadius: 7, border: '1px solid var(--border)', background: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--text)', minWidth: 140, justifyContent: 'space-between', fontFamily: 'var(--font)' }}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
          <span>{fmt(value)}</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-2)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'transform .15s', transform: open ? 'rotate(180deg)' : 'none', flexShrink: 0 }}><polyline points="6 9 12 15 18 9"></polyline></svg>
        </button>
        {open && <div style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, background: '#fff', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,.08)', maxHeight: 280, overflow: 'auto', zIndex: 100, minWidth: 160 }}>
          {options.slice().reverse().map(p => (
            <button key={p} onClick={() => { onChange(p); setOpen(false); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 14px', border: 'none', background: value === p ? 'var(--accent-surface)' : 'transparent', color: value === p ? 'var(--accent)' : 'var(--text-2)', cursor: 'pointer', fontSize: 12, fontWeight: value === p ? 700 : 500, fontFamily: 'var(--font)' }}
              onMouseEnter={e => { if (value !== p) e.currentTarget.style.background = 'var(--hover)'; }}
              onMouseLeave={e => { if (value !== p) e.currentTarget.style.background = 'transparent'; }}>{fmt(p)}</button>
          ))}
        </div>}
      </div>
      <Arrow dir="next" on={idx < options.length - 1} onClick={() => idx < options.length - 1 && onChange(options[idx + 1])} />
    </div>
  );
}
// Shared with other pages (e.g. CostingPage) so their period pickers match
// Line Items exactly. app.jsx executes before the app mounts, so the global
// exists by the time any page renders.
Object.assign(window, { PeriodSelector });

/* ===== MODEL TYPE SELECTOR ===== */
function App() {
  const sb = useSupabaseData();
  const [hydrated, setHydrated] = useState(() => (window.__RAW_DATA != null));
  // Every bridge action (merge, ledger upload, job clear, reset…) makes
  // Streamlit rerun and reload this iframe, so React state — including which
  // page is open — is lost. Boot rules: an in-flight forecast job or a fresh
  // merge result forces the Upload page (that's where their panels live);
  // otherwise restore the page the user was on (sessionStorage survives the
  // reload); fall back to Line Items.
  const PAGE_IDS = ['lineitems', 'costing', 'cashflow', 'predictions', 'actionflow', 'accuracy', 'explorer', 'newitems', 'dormant', 'iteminsight', 'forecasts', 'upload'];
  const [page, setPage] = useState(() => {
    if (typeof window === 'undefined') return 'lineitems';
    if (window.__UPLOAD_JOB || window.__MERGE_RESULT) return 'upload';
    try {
      const saved = sessionStorage.getItem('fi_page');
      if (saved && PAGE_IDS.indexOf(saved) !== -1) return saved;
    } catch (e) { /* storage unavailable — default below */ }
    return 'lineitems';
  });
  useEffect(() => {
    try { sessionStorage.setItem('fi_page', page); } catch (e) { /* noop */ }
  }, [page]);
  const [period, setPeriod] = useState(null);
  const [collapsed, setCollapsed] = useState(() => typeof window !== 'undefined' && window.innerWidth < 900);
  const [dsOpen, setDsOpen] = useState(false);
  const tweaks = useTweaks(TWEAK_DEFAULTS);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let prev = window.innerWidth >= 900;
    const onResize = () => {
      const isDesktopNow = window.innerWidth >= 900;
      if (isDesktopNow !== prev) { setCollapsed(!isDesktopNow); prev = isDesktopNow; }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // First-paint hydration: if Python pre-rendered data, we're already done.
  // Otherwise wait for Streamlit's 'dataready' event.
  useEffect(() => {
    if (hydrated) return;
    const init = () => setHydrated(true);
    window.addEventListener('dataready', init, { once: true });
    return () => window.removeEventListener('dataready', init);
  }, [hydrated]);

  const data = sb.records;

  const allPeriods = useMemo(() => data ? [...new Set(data.map(d => d.period))].sort() : [], [data]);

  // Reset period when model type or periods change
  useEffect(() => {
    if (allPeriods.length > 0) setPeriod(p => allPeriods.includes(p) ? p : allPeriods[allPeriods.length - 1]);
  }, [allPeriods]);

  const activePeriod = period || allPeriods[allPeriods.length - 1] || null;
  const periodData = useMemo(() => data ? data.filter(d => d.period === activePeriod) : [], [data, activePeriod]);
  const periodGroups = useMemo(() => allPeriods.map(p => ({ period: p, data: data ? data.filter(d => d.period === p) : [] })), [data, allPeriods]);

  const stats = useMemo(() => {
    const d = periodData;
    const deliver = d.filter(x => x.predictedAction === 'Deliver');
    const ret = d.filter(x => x.predictedAction === 'Return');
    const nc = d.filter(x => x.predictedAction === 'No Change');
    const deliverQty = deliver.reduce((s, x) => s + (x.quantity || 0), 0);
    const returnQty = ret.reduce((s, x) => s + (x.quantity || 0), 0);
    const prevTotal = d.reduce((s, x) => s + (x.prevClosingBal || 0), 0);
    const predTotal = d.reduce((s, x) => s + (x.predictedClosingBal || 0), 0);
    const hvCount = d.filter(x => x.isHV).length;
    const hasActuals = d.some(x => x.actualClosingBal != null);
    return { deliver: deliver.length, return: ret.length, noChange: nc.length, total: d.length, deliverQty, returnQty, prevTotal, predTotal, hvCount, hasActuals };
  }, [periodData]);

  // Predicted ⇄ Actual view mode for the Predictions page. Lives here (not in
  // PredictionsPage) so the toggle can sit in the top header next to the month
  // picker. Only meaningful when the active month has actuals (Backtest).
  const [predMode, setPredMode] = useState('predicted');
  const predViewMode = stats.hasActuals ? predMode : 'predicted';
  // Item Explorer spans all periods, so its Predicted/Actual toggle keys off
  // whether ANY period has actuals — not just the active month.
  const anyActuals = useMemo(() => (data || []).some(d => d.actualClosingBal != null), [data]);
  const explorerMode = anyActuals ? predMode : 'predicted';
  // Error metric for the Model Accuracy page (MAPE vs APE). Lifted here so the
  // toggle can live in the top header, mirroring the Predicted/Actual control.
  const [errorMetric, setErrorMetric] = useState('mape');

  if (!hydrated) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', width: '100vw', color: 'var(--text-3)', fontSize: 14, gap: 10 }}>
      <div style={{ width: 20, height: 20, border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .6s linear infinite' }}></div>
      Loading…
      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
    </div>
  );

  const pageTitle = page === 'lineitems' ? 'Line Items'
    : page === 'predictions' ? 'Monthly Predictions'
    : page === 'actionflow' ? 'Action Flow'
    : page === 'accuracy' ? 'Model Accuracy'
    : page === 'explorer' ? 'Item Explorer'
    : page === 'newitems' ? 'New Items'
    : page === 'dormant' ? 'Dormant Items'
    : page === 'costing' ? 'Costing'
    : page === 'cashflow' ? 'Cash Flow'
    : page === 'iteminsight' ? 'Item Insights'
    : page === 'forecasts' ? 'Item Forecasts'
    : 'Upload Data';

  return (
    <>
      {/* Subtle top-of-screen loading bar — visible during async run switches. */}
      {sb.loading && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 2, background: 'transparent', zIndex: 9999, pointerEvents: 'none' }}>
          <div style={{ height: '100%', width: '40%', background: 'linear-gradient(90deg, transparent, var(--accent), transparent)', animation: 'sbBar 1.1s linear infinite' }}/>
          <style>{'@keyframes sbBar{0%{transform:translateX(-100%)}100%{transform:translateX(350%)}}'}</style>
        </div>
      )}
      <Sidebar activePage={page} onNavigate={setPage} collapsed={collapsed} onToggleCollapse={() => setCollapsed(!collapsed)} onOpenDataSource={() => setDsOpen(true)} itemCount={stats.total}
        years={sb.years} currentYear={sb.currentYear} onSwitchYear={sb.switchYear} switching={sb.loading} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Top bar */}
        <header style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--border)', flexShrink: 0, background: '#fff' }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>{pageTitle}</h1>
            {stats.hasActuals && (
              <span style={{ fontSize: 10, color: '#059669', background: 'rgba(5,150,105,.08)', padding: '2px 7px', borderRadius: 5, fontWeight: 600, whiteSpace: 'nowrap' }}>Actuals available</span>
            )}
            {!stats.hasActuals && page === 'predictions' && (
              <span style={{ fontSize: 10, color: 'var(--text-2)', background: '#EEF0F4', padding: '2px 7px', borderRadius: 5, fontWeight: 600, whiteSpace: 'nowrap' }}>Future mode</span>
            )}
          </div>
          {page === 'predictions' && allPeriods.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {/* Predicted / Actual toggle — sits just left of the month picker.
                  Only shown for months that have actuals to compare against. */}
              {stats.hasActuals && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Showing</span>
                  <div style={{ display: 'inline-flex', background: '#fff', border: '1px solid var(--border)', borderRadius: 9, padding: 3, gap: 3 }}>
                    {[['predicted', 'Predicted', 'var(--accent)'], ['actual', 'Actual', '#F59E0B']].map(([m, lbl, col]) => {
                      const on = predMode === m;
                      return (
                        <button key={m} onClick={() => setPredMode(m)} style={{
                          padding: '5px 14px', borderRadius: 7, border: 'none', cursor: 'pointer',
                          fontSize: 12, fontWeight: 700, fontFamily: 'var(--font)',
                          background: on ? col : 'transparent',
                          color: on ? '#fff' : 'var(--text-2)',
                          boxShadow: on ? `0 2px 6px ${col}55` : 'none',
                          transition: 'background .12s, color .12s',
                        }}>{lbl}</button>
                      );
                    })}
                  </div>
                </div>
              )}
              <PeriodSelector value={activePeriod} onChange={setPeriod} options={allPeriods} />
            </div>
          )}
          {page === 'accuracy' && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Error metric</span>
              <div style={{ display: 'inline-flex', background: '#fff', border: '1px solid var(--border)', borderRadius: 9, padding: 3, gap: 3 }}>
                {[['mape', 'MAPE'], ['ape', 'APE']].map(([m, lbl]) => {
                  const on = errorMetric === m;
                  return (
                    <button key={m} onClick={() => setErrorMetric(m)} style={{
                      padding: '5px 16px', borderRadius: 7, border: 'none', cursor: 'pointer',
                      fontSize: 12, fontWeight: 700, fontFamily: 'var(--font)',
                      background: on ? 'var(--accent)' : 'transparent',
                      color: on ? '#fff' : 'var(--text-2)',
                      boxShadow: on ? '0 2px 6px rgba(79,70,229,.33)' : 'none',
                      transition: 'background .12s, color .12s',
                    }}>{lbl}</button>
                  );
                })}
              </div>
            </div>
          )}
          {page === 'explorer' && anyActuals && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Showing</span>
              <div style={{ display: 'inline-flex', background: '#fff', border: '1px solid var(--border)', borderRadius: 9, padding: 3, gap: 3 }}>
                {[['predicted', 'Predicted', 'var(--accent)'], ['actual', 'Actual', '#F59E0B']].map(([m, lbl, col]) => {
                  const on = predMode === m;
                  return (
                    <button key={m} onClick={() => setPredMode(m)} style={{
                      padding: '5px 14px', borderRadius: 7, border: 'none', cursor: 'pointer',
                      fontSize: 12, fontWeight: 700, fontFamily: 'var(--font)',
                      background: on ? col : 'transparent',
                      color: on ? '#fff' : 'var(--text-2)',
                      boxShadow: on ? `0 2px 6px ${col}55` : 'none',
                      transition: 'background .12s, color .12s',
                    }}>{lbl}</button>
                  );
                })}
              </div>
            </div>
          )}
        </header>

        <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {page === 'lineitems' && <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '14px 20px 0' }}><ItemsTableTab data={data || []} allPeriods={allPeriods} standalone /></div>}
          {page === 'predictions' && <PredictionsPage data={periodData} allData={data} stats={stats} periodGroups={periodGroups} period={activePeriod} mode={predViewMode} />}
          {page === 'actionflow' && <ActionFlowPage allData={data} />}
          {page === 'accuracy' && <div style={{ flex: 1, overflow: 'auto', minHeight: 0, padding: '14px 20px 20px' }}><AccuracyTab periodGroups={periodGroups} allData={data} metric={errorMetric} /></div>}
          {page === 'explorer' && <ItemExplorerPage allData={data} period={activePeriod} mode={explorerMode} />}
          {page === 'newitems' && <NewItemsPage allData={data} />}
          {page === 'dormant' && <DormantItemsPage allData={data} />}
          {page === 'costing' && <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '14px 20px 14px' }}><CostingPage allData={data || []} /></div>}
          {page === 'cashflow' && <CashFlowPage allData={data || []} />}
          {page === 'iteminsight' && <ItemInsightPage allData={data} />}
          {page === 'forecasts' && <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '14px 20px 0' }}><ItemForecastsGrid allData={data || []} /></div>}
          {page === 'upload' && <div style={{ padding: 24, overflow: 'auto' }}><UploadDataPage onOpenDataSource={() => setDsOpen(true)} /></div>}
        </main>
      </div>
      <DataSourceModal open={dsOpen} onClose={() => setDsOpen(false)} />
      <TweaksPanel><TweakColor label="Accent color" value={tweaks.accentColor} onChange={v => tweaks.set('accentColor', v)} /></TweaksPanel>
    </>
  );
}

/* ===== MONTHLY PREDICTIONS PAGE — tabbed dashboard ===== */
function PredictionsPage({ data, allData, stats, periodGroups, period, mode = 'predicted' }) {
  const [tab, setTab] = useState('overview');
  const fmtK = v => v >= 1e6 ? (v/1e6).toFixed(1)+'M' : v >= 1e3 ? Math.round(v).toLocaleString() : Math.round(v).toString();

  // Predicted ⇄ Actual is driven by the toggle in the top header (App).
  const viewMode = mode;
  const isActual = viewMode === 'actual';

  // KPI stats recomputed for the active view mode (predicted vs actual).
  const viewStats = useMemo(() => {
    const d = data || [];
    const deliver = d.filter(x => fcAction(x, viewMode) === 'Deliver');
    const ret     = d.filter(x => fcAction(x, viewMode) === 'Return');
    const deliverQty = deliver.reduce((s, x) => s + fcQty(x, viewMode), 0);
    const returnQty  = ret.reduce((s, x) => s + fcQty(x, viewMode), 0);
    const prevTotal = d.reduce((s, x) => s + (x.prevClosingBal || 0), 0);
    const curTotal  = d.reduce((s, x) => s + (fcBal(x, viewMode) || 0), 0);
    // Predicted rental value — HV items only (cost is NULL for Standard items),
    // so the sum is the forecast value of the high-value stock for this month.
    const hvValRows = d.filter(x => x.predValueAvg != null);
    const hvValue     = hvValRows.reduce((s, x) => s + x.predValueAvg, 0);
    const hvValueLow  = hvValRows.reduce((s, x) => s + (x.predValueLow  || 0), 0);
    const hvValueHigh = hvValRows.reduce((s, x) => s + (x.predValueHigh || 0), 0);
    return { deliver: deliver.length, return: ret.length, deliverQty, returnQty, prevTotal, curTotal,
             total: d.length, hvCount: d.filter(x => x.isHV).length,
             hvValue, hvValueLow, hvValueHigh, hvValueN: hvValRows.length };
  }, [data, viewMode]);

  const pctChange = viewStats.prevTotal > 0 ? (((viewStats.curTotal - viewStats.prevTotal) / viewStats.prevTotal) * 100).toFixed(1) : '0';
  // Mode tag (· predicted / · actual) only when the month has actuals — i.e.
  // when the toggle is actually present so the suffix disambiguates. On
  // Future months there's nothing to switch between, so no tag.
  const modeTag = stats.hasActuals ? (isActual ? ' · actual' : ' · predicted') : '';

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'movement', label: 'Movement & Trends' },
    { id: 'distribution', label: 'Distribution' },
    { id: 'insights', label: 'Insights' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Sticky KPI strip — Predicted/Actual is driven by the header toggle. */}
      <div style={{ padding: '14px 24px 0', flexShrink: 0 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
          <KPI color="var(--accent)" label="Items" value={viewStats.total} sub={`${viewStats.hvCount} high-value`} />
          <KPI color={isActual ? '#F59E0B' : 'var(--accent)'} label={'Net Closing Bal' + modeTag} value={fmtK(viewStats.curTotal)} sub={`${pctChange >= 0 ? '+' : ''}${pctChange}% vs prev`} subColor={pctChange >= 0 ? '#059669' : '#DC2626'} />
          <KPI color="#059669" label={'Deliver Volume' + modeTag} value={fmtK(viewStats.deliverQty)} sub={`${viewStats.deliver} items`} subColor="#059669" />
          <KPI color="#DC2626" label={'Return Volume' + modeTag} value={fmtK(viewStats.returnQty)} sub={`${viewStats.return} items`} subColor="#DC2626" />
          <KPI color="#7C3AED" label="Forecast Value" value={viewStats.hvValueN ? <span style={{ whiteSpace: 'nowrap' }}><DirhamSign />{fmtShort(viewStats.hvValue)}</span> : '—'} sub={viewStats.hvValueN ? `${fmtShort(viewStats.hvValueLow)}–${fmtShort(viewStats.hvValueHigh)} · ${viewStats.hvValueN} HV` : 'HV items only'} />
        </div>
      </div>

      {/* Tab nav */}
      <div style={{ padding: '14px 24px 0', flexShrink: 0, borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: '8px 16px', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'var(--font)',
              background: 'transparent', color: tab === t.id ? 'var(--accent)' : 'var(--text-2)',
              borderBottom: '2px solid', borderColor: tab === t.id ? 'var(--accent)' : 'transparent',
              marginBottom: -1, transition: 'all .15s',
            }}
              onMouseEnter={e => { if (tab !== t.id) e.currentTarget.style.color = 'var(--text)'; }}
              onMouseLeave={e => { if (tab !== t.id) e.currentTarget.style.color = 'var(--text-2)'; }}>{t.label}</button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'hidden', padding: 16, display: 'flex', flexDirection: 'column' }}>
        {tab === 'overview' && <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}><OverviewTab data={data} stats={stats} periodGroups={periodGroups} period={period} mode={viewMode} /></div>}
        {tab === 'movement' && <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}><MovementTab data={data} periodGroups={periodGroups} mode={viewMode} hasActuals={stats.hasActuals} /></div>}
        {tab === 'distribution' && <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}><DistributionTab data={data} allData={allData} mode={viewMode} /></div>}
        {tab === 'insights' && <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}><InsightsTab data={data} allData={allData} periodGroups={periodGroups} period={period} /></div>}
      </div>
    </div>
  );
}

function OverviewTab({ data, stats, periodGroups, period, mode = 'predicted' }) {
  const mapeData = window.__MAPE_SUMMARY || [];
  // Mode tag for card titles — only when the month has actuals (so the toggle
  // is present and the suffix actually disambiguates predicted vs actual).
  const hasActuals = (data || []).some(d => d.actualClosingBal != null);
  const modeTag = hasActuals ? (mode === 'actual' ? ' · actual' : ' · predicted') : '';
  // Direction accuracy from actual data rows
  const rowsWithActual = (data || []).filter(d => d.directionCorrect != null);
  const dirAcc = rowsWithActual.length > 0 ? Math.round(rowsWithActual.filter(d => d.directionCorrect).length / rowsWithActual.length * 100) : null;
  const hvRows = rowsWithActual.filter(d => d.isHV);
  const hvDirAcc = hvRows.length > 0 ? Math.round(hvRows.filter(d => d.directionCorrect).length / hvRows.length * 100) : null;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gridAutoRows: 'min-content', gap: 12 }}>
      {/* Forecast Accuracy Strip */}
      {mapeData.length > 0 && (() => {
        const fmtPeriodLabel = p => {
          if (!p) return p;
          const m = p.match(/^(\d{4})-(\d{2})$/);
          if (m) { const ns = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']; return ns[parseInt(m[2])-1] + ' ' + m[1]; }
          const q = p.match(/^(\d{4})-Q(\d)$/); if (q) return `Q${q[2]} ${q[1]}`;
          const h = p.match(/^(\d{4})-H(\d)$/); if (h) return `H${h[2]} ${h[1]}`;
          return p;
        };
        const tierMeta = t => t === 'Low'
          ? { label: 'Good accuracy', icon: '✓', bg: 'rgba(5,150,105,.07)', color: '#059669', line: '#059669' }
          : t === 'Moderate'
          ? { label: 'Moderate error', icon: '~', bg: 'rgba(217,119,6,.07)', color: '#B45309', line: '#D97706' }
          : { label: 'High error', icon: '⚠', bg: 'rgba(220,38,38,.07)', color: '#DC2626', line: '#DC2626' };
        // Use the darker amber (#B45309) in the 50–100% band so the bold value
        // label passes contrast (the lighter #D97706 only colours the bar fill).
        const errColor = v => v == null ? 'var(--text-2)' : v > 100 ? '#DC2626' : v > 50 ? '#B45309' : '#059669';
        const ErrBar = ({ v }) => {
          if (v == null) return null;
          const pct = Math.min(v / 200, 1) * 100;
          const col = v > 100 ? '#DC2626' : v > 50 ? '#D97706' : '#059669';
          return (
            <div style={{ position: 'relative', marginTop: 5 }}>
              <div style={{ width: '100%', height: 6, background: '#EAECEF', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: col, opacity: .85, borderRadius: 3 }} />
              </div>
              {/* Threshold ticks at 100% and 200% of the 0–200 scale */}
              <div style={{ position: 'absolute', left: '25%', top: 0, width: 1, height: 6, background: 'var(--text-3)' }} />
              <div style={{ position: 'absolute', left: '50%', top: 0, width: 1, height: 6, background: 'var(--text-3)' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                <span style={{ fontSize: 9.5, color: 'var(--text-2)', fontFamily: 'var(--mono)' }}>0</span>
                <span style={{ fontSize: 9.5, color: 'var(--text-2)', fontFamily: 'var(--mono)' }}>100%</span>
                <span style={{ fontSize: 9.5, color: 'var(--text-2)', fontFamily: 'var(--mono)' }}>200%</span>
              </div>
            </div>
          );
        };
        const allMonthly = mapeData.filter(r => (r.model || '').toLowerCase().startsWith('month'));
        const monthlyData = period ? allMonthly.filter(r => r.period === period) : allMonthly.slice(0, 1);
        if (!monthlyData.length) return null;
        return (
          <div style={{ gridColumn: 'span 6' }}>
            {/* Strip header */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2)' }}>Forecast Accuracy · {fmtPeriodLabel(period)}</span>
              <span style={{ fontSize: 11, color: 'var(--text-2)' }}>
                · MAPE = avg % error between predicted and actual closing balance.
                &nbsp;<b style={{ color: '#059669' }}>&lt;30% excellent</b>,
                &nbsp;<b style={{ color: '#D97706' }}>30–100% acceptable</b>,
                &nbsp;<b style={{ color: '#DC2626' }}>&gt;100% high error</b>.
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${monthlyData.length}, 1fr)`, gap: 10 }}>
              {monthlyData.map((r, i) => {
                const tm = tierMeta(r.tier);
                const accColor = (v) => v == null ? 'var(--text-3)' : v >= 80 ? '#059669' : v >= 60 ? '#D97706' : '#DC2626';
                return (
                  <div key={i} style={{
                    background: '#fff', border: '1px solid var(--border)', borderRadius: 12,
                    padding: '12px 18px',
                    display: 'flex', alignItems: 'center', gap: 22, flexWrap: 'wrap',
                  }}>
                    {/* Period block */}
                    <div style={{ flexShrink: 0, minWidth: 120 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', lineHeight: 1.1 }}>{fmtPeriodLabel(r.period)}</div>
                      <div style={{ fontSize: 10.5, color: 'var(--text-2)', marginTop: 3 }}>{r.itemsPredicted ? r.itemsPredicted + ' items forecast' : 'Monthly forecast'}</div>
                    </div>

                    {/* Direction accuracy */}
                    <div style={{ flexShrink: 0, paddingLeft: 18, borderLeft: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Direction</div>
                      <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--mono)', lineHeight: 1.15, color: accColor(dirAcc) }}>
                        {dirAcc != null ? dirAcc + '%' : '—'}
                      </div>
                    </div>

                    {/* HV accuracy */}
                    <div style={{ flexShrink: 0, paddingLeft: 18, borderLeft: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '.06em' }}>HV Direction</div>
                      <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--mono)', lineHeight: 1.15, color: accColor(hvDirAcc) }}>
                        {hvDirAcc != null ? hvDirAcc + '%' : '—'}
                      </div>
                    </div>

                    {/* MAPE bars — inline, takes remaining space. The numeric
                        MAPE value is printed above each bar so the exact error
                        is readable, not just inferred from the fill length. */}
                    <div style={{ flex: 1, minWidth: 240, paddingLeft: 18, borderLeft: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 6 }}>
                          <span style={{ fontSize: 10.5, color: 'var(--text-2)', fontWeight: 600 }}>Forecast error · All</span>
                          <span style={{ fontSize: 14, fontWeight: 800, fontFamily: 'var(--mono)', color: errColor(r.mapeAll), lineHeight: 1 }}>{r.mapeAll != null ? r.mapeAll.toFixed(1) + '%' : '—'}</span>
                        </div>
                        <ErrBar v={r.mapeAll} />
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 6 }}>
                          <span style={{ fontSize: 10.5, color: 'var(--text-2)', fontWeight: 600 }}>Forecast error · HV</span>
                          <span style={{ fontSize: 14, fontWeight: 800, fontFamily: 'var(--mono)', color: errColor(r.mapeHV), lineHeight: 1 }}>{r.mapeHV != null ? r.mapeHV.toFixed(1) + '%' : '—'}</span>
                        </div>
                        <ErrBar v={r.mapeHV} />
                      </div>
                    </div>

                    {/* Tier badge */}
                    {r.tier && (
                      <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, padding: '5px 10px', borderRadius: 20, background: tm.bg, color: tm.color, whiteSpace: 'nowrap' }}>
                        {tm.icon} {tm.label}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}
      <Card title={'Action Mix' + modeTag} style={{ gridColumn: 'span 2' }} info={`Every item this month is recommended to Deliver (ship stock out to site), Return (send stock back), or No Change (hold). The donut shows how all items split across those three actions — the centre number is the total item count. Switch the header toggle to Actual to see what actually happened.`}><ActionDonut data={data} mode={mode} /></Card>
      <Card title={'HV vs Standard' + modeTag} style={{ gridColumn: 'span 2' }} info={`The same Deliver / Return / No-Change split, but separated for High-Value items (your most important SKUs) vs Standard items — so you can see whether the key items behave differently from the rest.`}><HVBreakdown data={data} mode={mode} /></Card>
      <Card title={'Closing Balance' + modeTag} style={{ gridColumn: 'span 2' }} info={`Total units on site at the end of last month vs the model's predicted total for this month (or the real total in Actual mode). A longer second bar means overall inventory is forecast to grow.`}><ClosingBalancePortfolio data={data} mode={mode} /></Card>
      <Card title={'Top 10 Deliver' + modeTag} style={{ gridColumn: 'span 3' }} info={`The ten items with the largest predicted delivery quantity this month — where the most stock is forecast to ship out. Bar length = number of units.`}><TopItemsBar data={data} action="Deliver" maxItems={10} color="#059669" mode={mode} /></Card>
      <Card title={'Top 10 Return' + modeTag} style={{ gridColumn: 'span 3' }} info={`The ten items with the largest predicted return quantity this month — where the most stock is forecast to come back from site.`}><TopItemsBar data={data} action="Return" maxItems={10} color="#DC2626" mode={mode} /></Card>
    </div>
  );
}

function MovementTab({ data, periodGroups, mode = 'predicted', hasActuals = false }) {
  const [pairFrom, setPairFrom] = useState(periodGroups.length >= 2 ? periodGroups[periodGroups.length - 2].period : null);
  const [pairTo, setPairTo] = useState(periodGroups.length >= 2 ? periodGroups[periodGroups.length - 1].period : null);
  const fromData = periodGroups.find(pg => pg.period === pairFrom)?.data || [];
  const toData = periodGroups.find(pg => pg.period === pairTo)?.data || [];
  const many = periodGroups.length > 4;
  // Mode tag for card titles — only when actuals exist (toggle present).
  const modeTag = hasActuals ? (mode === 'actual' ? ' · actual' : ' · predicted') : '';

  const ac = a => a === 'Deliver' ? '#059669' : a === 'Return' ? '#DC2626' : '#D97706';
  const fmtP = p => { if (!p) return ''; const [y, m] = p.split('-'); const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']; return `${names[parseInt(m)-1]} ${y}`; };

  // Period-to-period action shift breakdown — uses predicted or actual action
  // depending on the header toggle.
  const shiftData = useMemo(() => {
    const map = {};
    fromData.forEach(d => { map[d.itemCode] = fcAction(d, mode); });
    const changeTypes = {}, stableCount = { Deliver: 0, Return: 0, 'No Change': 0 };
    let total = 0;
    toData.forEach(d => {
      const prev = map[d.itemCode];
      const cur = fcAction(d, mode);
      if (!prev || !cur) return;
      total++;
      if (prev === cur) { stableCount[prev] = (stableCount[prev] || 0) + 1; return; }
      const key = `${prev}||${cur}`;
      if (!changeTypes[key]) changeTypes[key] = { from: prev, to: cur, count: 0 };
      changeTypes[key].count++;
    });
    const shifts = Object.values(changeTypes).sort((a, b) => b.count - a.count);
    const changedCount = shifts.reduce((s, c) => s + c.count, 0);
    return { shifts, changedCount, stableCount, total };
  }, [fromData, toData, mode]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gridAutoRows: 'min-content', gap: 12 }}>

      {/* Row 1: Action counts (left) + HV breakdown (right) */}
      <Card title={`Action Count by Period${modeTag} · ${periodGroups.length} period${periodGroups.length === 1 ? '' : 's'}`} style={{ gridColumn: 'span 3' }}
        info={`For each month, how many items fall into Deliver, Return, and No Change. Read it left-to-right to spot trends — e.g. returns creeping up over the months.`}>
        <ActionCountBars periodGroups={periodGroups} mode={mode} />
      </Card>
      <Card title={'HV vs Standard · items per action' + modeTag} style={{ gridColumn: 'span 3' }}
        info={`Deliver and Return item counts per month, each bar split into High-Value (dark) and Standard (light). The number on top is the total for that bar; the number inside the dark base is the High-Value count — so you can see how much of the movement is driven by your key SKUs.`}>
        <HVMovementByPeriod periodGroups={periodGroups} mode={mode} />
      </Card>

      {/* Row 2: Net qty movement — full width */}
      <Card title={'Net Inventory Movement · quantity units per period' + modeTag} style={{ gridColumn: 'span 6' }}
        info={`Per month: total units delivered (green), total returned (red), and the net change (blue = delivered − returned). Net above the line means stock is flowing out to site overall; below means it is coming back.`}>
        <NetMovementBars periodGroups={periodGroups} dense={many} mode={mode} />
      </Card>

      {/* Row 3: Top movers (left) + Period shift summary (right) */}
      <Card title={'Top Items by Cumulative Movement' + modeTag} style={{ gridColumn: 'span 4' }}
        info={`The items that moved the most units across all months combined. Each bar is split into the share that was delivered (green) vs returned (red), so you can see both volume and direction at a glance.`}>
        <HighVelocityItems periodGroups={periodGroups} mode={mode} />
      </Card>

      {periodGroups.length > 1 ? (
        <Card title="Period-to-Period Action Shifts" style={{ gridColumn: 'span 2' }}
          info={`Pick two months. This counts how many items changed their action between them (e.g. an item that was Deliver in the first month and Return in the second). "Churn %" is the share of items that changed. The list shows the most common from → to switches.`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Period selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <PeriodPicker value={pairFrom} onChange={setPairFrom} options={periodGroups.map(p => p.period)} />
              <span style={{ fontSize: 13, color: 'var(--text-3)' }}>→</span>
              <PeriodPicker value={pairTo} onChange={setPairTo} options={periodGroups.map(p => p.period)} />
            </div>
            {/* KPI row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
              {[
                { label: 'Changed', value: shiftData.changedCount, color: shiftData.changedCount > 0 ? '#D97706' : '#059669' },
                { label: 'Stable', value: shiftData.total - shiftData.changedCount, color: '#059669' },
                { label: 'Churn %', value: shiftData.total > 0 ? Math.round(shiftData.changedCount / shiftData.total * 100) + '%' : '—', color: 'var(--text)' },
              ].map(k => (
                <div key={k.label} style={{ background: '#FAFBFC', borderRadius: 7, padding: '7px 8px', textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'var(--mono)', color: k.color, lineHeight: 1 }}>{k.value}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 600, marginTop: 2 }}>{k.label}</div>
                </div>
              ))}
            </div>
            {/* Shift breakdown */}
            {shiftData.shifts.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Action shifts</div>
                {shiftData.shifts.map((c, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: ac(c.from), minWidth: 46, fontFamily: 'var(--mono)' }}>{c.from.slice(0,3)}</span>
                    <span style={{ fontSize: 10, color: 'var(--text-3)' }}>→</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: ac(c.to), minWidth: 46, fontFamily: 'var(--mono)' }}>{c.to.slice(0,3)}</span>
                    <div style={{ flex: 1, height: 6, background: '#F3F4F6', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(c.count / (shiftData.shifts[0]?.count || 1)) * 100}%`, background: ac(c.to), opacity: .75, borderRadius: 2 }} />
                    </div>
                    <span style={{ fontSize: 11, fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--text-2)', minWidth: 22, textAlign: 'right' }}>{c.count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center', padding: '12px 0' }}>No action changes between these periods</div>
            )}
          </div>
        </Card>
      ) : (
        <div style={{ gridColumn: 'span 2' }} />
      )}

      {/* Row 4: Action flow Sankey — full width, only if multiple periods */}
      {periodGroups.length > 1 && (
        <Card title={`Action Flow${modeTag} · ${fmtP(pairFrom)} → ${fmtP(pairTo)}`} style={{ gridColumn: 'span 6' }}
          info={`A flow view between the two chosen months. For each starting action on the left, it shows where those items ended up on the right. Flows that stay on the same action = stable items; flows that cross over = items that switched behaviour between the two months.`}>
          <ActionFlowSankey janData={fromData} febData={toData} fromPeriod={pairFrom} toPeriod={pairTo} mode={mode} />
        </Card>
      )}
    </div>
  );
}

function PeriodPicker({ value, onChange, options }) {
  const fmt = p => { const [y, m] = p.split('-'); const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']; return `${names[parseInt(m)-1]} ${y}`; };
  return (
    <select value={value || ''} onChange={e => onChange(e.target.value)} style={{
      padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)', background: '#fff',
      fontSize: 12, fontWeight: 600, fontFamily: 'var(--font)', color: 'var(--text)', cursor: 'pointer', outline: 'none'
    }}>
      {options.map(p => <option key={p} value={p}>{fmt(p)}</option>)}
    </select>
  );
}


function NetMovementBars({ periodGroups, dense, mode = 'predicted' }) {
  const bars = periodGroups.map(pg => {
    const del = pg.data.filter(d => fcAction(d, mode) === 'Deliver').reduce((s, d) => s + fcQty(d, mode), 0);
    const ret = pg.data.filter(d => fcAction(d, mode) === 'Return').reduce((s, d) => s + fcQty(d, mode), 0);
    return { period: pg.period, deliver: del, return: ret, net: del - ret };
  });
  const maxAbs = Math.max(...bars.flatMap(b => [b.deliver, b.return, Math.abs(b.net)]), 1);
  const fmtK = v => v >= 1e3 ? (v / 1e3).toFixed(1) + 'K' : Math.round(v);
  const w = 880, h = 200, padL = 50, padR = 12, padT = 14, padB = 38;
  const cW = w - padL - padR, cH = h - padT - padB;
  const groupW = cW / bars.length;
  const barW = Math.min(dense ? 4 : 18, groupW * 0.28);
  const labelEvery = bars.length > 24 ? 3 : bars.length > 12 ? 2 : 1;
  const fmt = p => { const m = p.split('-')[1]; const names = ['','J','F','M','A','M','J','J','A','S','O','N','D']; return names[parseInt(m)]; };
  const [hi, setHi] = React.useState(null);

  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>Deliveries (green) vs returns (red) and net change (blue) per period.</div>
      <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ overflow: 'visible' }}>
        {[0,.5,1].map((p,i) => { const yy = padT + cH - cH * p; return <g key={i}><line x1={padL} y1={yy} x2={w-padR} y2={yy} stroke="#F3F4F6" /><text x={padL-6} y={yy+3.5} textAnchor="end" fontSize="10" fill="var(--text-3)" fontFamily="var(--mono)">{fmtK(maxAbs*p)}</text></g>; })}
        {bars.map((b, i) => {
          const cx = padL + groupW * (i + 0.5);
          const dh = (b.deliver / maxAbs) * cH;
          const rh = (b.return / maxAbs) * cH;
          const nh = (Math.abs(b.net) / maxAbs) * cH;
          return (
            <g key={b.period} style={{ cursor: 'pointer' }} onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(null)} opacity={hi != null && hi !== i ? 0.65 : 1}>
              <rect x={cx - barW * 1.6} y={padT + cH - dh} width={barW} height={dh} rx={Math.min(2, barW/3)} fill="#059669" opacity={.8} />
              <rect x={cx - barW * 0.5} y={padT + cH - rh} width={barW} height={rh} rx={Math.min(2, barW/3)} fill="#DC2626" opacity={.8} />
              <rect x={cx + barW * 0.6} y={padT + cH - nh} width={barW} height={nh} rx={Math.min(2, barW/3)} fill={b.net >= 0 ? 'var(--accent)' : '#7C3AED'} opacity={.8} />
            </g>
          );
        })}
        {bars.map((b, i) => i % labelEvery === 0 && <text key={i} x={padL + groupW * (i + 0.5)} y={padT+cH+14} textAnchor="middle" fontSize="9" fill="var(--text-3)" fontFamily="var(--mono)">{fmt(b.period)}</text>)}
        {(() => { const yrs = {}; bars.forEach((b, i) => { const y = b.period.split('-')[0]; if (!yrs[y]) yrs[y] = []; yrs[y].push(i); }); return Object.entries(yrs).map(([yr, idxs]) => { const xPos = padL + groupW * ((idxs[0] + idxs[idxs.length - 1]) / 2 + 0.5); return <text key={yr} x={xPos} y={padT+cH+30} textAnchor="middle" fontSize="11" fill="var(--text-2)" fontWeight="700" fontFamily="var(--mono)">{yr}</text>; }); })()}
        {hi != null && (() => { const b = bars[hi]; const cx = padL + groupW * (hi + 0.5); const ttX = Math.min(Math.max(cx, padL + 70), w - padR - 70); return <g><rect x={ttX-66} y={padT-2} width={132} height={64} rx={6} fill="#fff" stroke="var(--border)" /><text x={ttX} y={padT+12} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--text)" fontFamily="var(--mono)">{b.period}</text><text x={ttX-58} y={padT+28} fontSize="10" fill="#059669" fontWeight="600">↑ {fmtK(b.deliver)}</text><text x={ttX-58} y={padT+42} fontSize="10" fill="#DC2626" fontWeight="600">↓ {fmtK(b.return)}</text><text x={ttX-58} y={padT+56} fontSize="10" fill={b.net>=0?'var(--accent)':'#7C3AED'} fontWeight="700">net {b.net>=0?'+':''}{fmtK(b.net)}</text></g>; })()}
      </svg>
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>
      {children}
    </div>
  );
}

function InsightsTab({ data, allData, periodGroups, period }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Key Signals ── */}
      <div>
        <SectionLabel>Key Signals · this period</SectionLabel>
        <AutoInsights allData={allData} currentPeriod={period} />
      </div>

      {/* ── Risk Watchlist ── */}
      <div>
        <SectionLabel>Risk Watchlist · stock-out, excess & persistent patterns</SectionLabel>
        <RiskWatchlist data={data} allData={allData} currentPeriod={period} />
      </div>

      {/* ── ABC Pareto ── */}
      <div>
        <SectionLabel>ABC Pareto · 80 / 20 concentration</SectionLabel>
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px' }}>
          <ABCPareto data={data} />
        </div>
      </div>

      {/* ── Action Calendar (multi-period only) ── */}
      {periodGroups.length > 1 && (
        <div>
          <SectionLabel>Action Calendar · top items × all periods</SectionLabel>
          <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px' }}>
            <ActionCalendarHeatmap data={allData} />
          </div>
        </div>
      )}

      {/* ── Year-over-Year (multi-year only) ── */}
      {periodGroups.length > 1 && (
        <div>
          <SectionLabel>Year-over-Year Comparison</SectionLabel>
          <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px' }}>
            <YearOverYearComparison allData={allData} />
          </div>
        </div>
      )}

    </div>
  );
}

function DistributionTab({ data, allData, mode = 'predicted' }) {
  const abcByCode = useMemo(() => {
    const sorted = [...(allData || [])].sort((a, b) => (b.prevClosingBal || 0) - (a.prevClosingBal || 0));
    const codes = [...new Set(sorted.map(d => d.itemCode))];
    const n = codes.length || 1;
    const result = {};
    codes.forEach((code, i) => {
      const pct = i / n;
      result[code] = pct < 0.2 ? 'A' : pct < 0.5 ? 'B' : 'C';
    });
    return result;
  }, [allData]);

  // Mode tag for titles — only when the month has actuals (so the toggle is
  // present and the suffix actually disambiguates predicted vs actual). The
  // ABC tier ranking stays mode-independent (it's based on the prior closing
  // balance, a known input); only the action split inside each tier flips.
  const hasActuals = (data || []).some(d => d.actualClosingBal != null);
  const modeTag = hasActuals ? (mode === 'actual' ? ' · actual' : ' · predicted') : '';

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gridAutoRows: 'min-content', gap: 12 }}>
      {/* ABC tier cross-tab + Balance bracket */}
      <Card title={`ABC Tier × Action${modeTag} · where is each tier going?`} style={{ gridColumn: 'span 3' }}
        info={`Items are ranked by inventory volume into three tiers: A = the top 20% (your highest-volume "vital few"), B = the next 30%, C = the bottom 50% (the long tail). Each tier's bar shows how its items split across Deliver / Return / No Change — so you can see whether your big-volume items behave differently from the small ones. Flip between predicted and actual (when a month has actuals) to spot tiers where reality diverged from the forecast.`}>
        <ABCDistributionChart data={data} abcByCode={abcByCode} mode={mode} />
      </Card>
      <Card title={`Balance Bracket${modeTag} · action density by balance size`} style={{ gridColumn: 'span 3' }}
        info={`Items grouped by how much stock they hold (under 1K units, 1K–10K, etc.). Each band shows the Deliver / Return / No-Change split, revealing whether it's the big-stock or small-stock items that drive most of the movement. In actual mode the bands regroup by the real ending balance and the real actions.`}>
        <BalanceBracketChart data={data} mode={mode} />
      </Card>

      {/* Quantity magnitude heatmap */}
      <Card title={`Action × Quantity Magnitude${modeTag} · item count per cell`} style={{ gridColumn: 'span 6' }}
        info={`A grid counting items by action (rows) against the size of the move in units (columns). Darker cells hold more items. It answers questions like "are most of my returns small quantities, or a few big ones?" In actual mode the move size is the real change in closing balance, |actual − previous|.`}>
        <ActionMagnitudeHeatmap data={data} mode={mode} />
      </Card>
    </div>
  );
}

/* ===== MODEL ACCURACY TAB ===== */
function AccuracyTab({ periodGroups, allData, metric = 'mape' }) {
  const modelLabel = 'Monthly';
  const [mapeThresholds, setMapeThresholds] = React.useState(MAPE_DEFAULT_THRESHOLDS);
  // MAPE vs APE comes from the header toggle (state lifted to App). MAPE = each
  // item's average error across months; APE = every individual item-month error.
  const em = metric.toUpperCase();
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gridAutoRows: 'min-content', gap: 12 }}>
      {/* Bucket editor */}
      <div style={{ gridColumn: 'span 8', background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 16px' }}>
        <MapeBucketEditor thresholds={mapeThresholds} onChange={setMapeThresholds} />
      </div>

      {/* Direction accuracy — full-width month-wise trend (a single pooled
          number hides whether the model degrades over the horizon). */}
      <Card title="Direction Accuracy by Month" style={{ gridColumn: 'span 8' }}
        info={`For each month with known outcomes, the share of items whose predicted direction matched reality — the model said Deliver and the item delivered, said Return and it returned, said No Change and the balance held. Reading it month-by-month (instead of one pooled average) shows whether accuracy holds up further out in the forecast and which months to trust. The dashed line marks the overall average. The panel on the right keeps the overall hit-rate plus a breakdown by predicted action — i.e. whether the model is more reliable when it calls a Deliver than a Return. Bars are green at 80%+, amber from 60–80%, red below 60%.`}>
        <DirectionAccuracyByMonth allData={allData} />
      </Card>

      {/* Error-band histograms (MAPE or APE per the header toggle) */}
      <Card title={`Item ${em} · Standard items`} style={{ gridColumn: 'span 4' }}
        info={`${em} = the % difference between predicted and actual closing balance. ${metric === 'mape' ? 'MAPE averages that error per item across all its months — one count per item.' : 'APE counts every item-month forecast separately, showing the full spread of individual errors.'} This histogram buckets Standard items by their error band — the more in the green (<30%) buckets, the more reliable the forecast. Tall bars on the right (>100%) are where the model struggled. Switch MAPE/APE from the top header.`}>
        <MapeDistributionChart allData={allData} segment="std" thresholds={mapeThresholds} label="standard" metric={metric} />
      </Card>
      <Card title={`Item ${em} · High-value items`} style={{ gridColumn: 'span 4' }}
        info={`Same error-band histogram as the Standard chart, but for High-Value items only — these are the SKUs where accuracy matters most, so you want most of them in the green (<30%) buckets. Currently showing ${em} (${metric === 'mape' ? 'per-item average' : 'every item-month'}).`}>
        <MapeDistributionChart allData={allData} segment="hv" thresholds={mapeThresholds} label="high-value" metric={metric} />
      </Card>

      {/* Bottom row — Portfolio chart + MAPE/APE Summary table */}
      <Card title="Portfolio: Predicted vs Actual Closing Balance" style={{ gridColumn: 'span 4' }}
        info={`For each month, the total predicted closing balance (indigo) next to the actual (amber), with the % error underneath. The closer the two bars are in height, the more accurate the forecast was that month.`}>
        <PortfolioActualVsPredicted periodGroups={periodGroups} />
      </Card>
      <Card title={`${em} Summary · by period & model`} style={{ gridColumn: 'span 4' }}
        info={metric === 'mape'
          ? `The model's monthly accuracy table: overall MAPE and High-Value MAPE (lower = better), plus how many items were predicted, delivered, and returned each month. Switch to APE from the top header to see each month's average individual forecast error instead.`
          : `Each month's average APE — the absolute % error of the individual item forecasts that month (all items and HV) — alongside the predicted / deliver / return counts. Switch back to MAPE from the top header for the model's reported summary.`}>
        <ModelAccuracyTable periodGroups={periodGroups} modelLabel={modelLabel} allData={allData} metric={metric} />
      </Card>
    </div>
  );
}

function ItemsTableTab({ data, allPeriods, standalone }) {
  const [tablePage, setTablePage] = useState(0);
  // Default to sorting by Period (newest first). Within the same period,
  // larger quantities float to the top as a natural secondary sort.
  const [sortCol, setSortCol] = useState('period');
  const [sortDir, setSortDir] = useState('desc');
  const [actionFilter, setActionFilter] = useState('All');
  const [search, setSearch] = useState('');
  // When the user picks a specific item from the search dropdown we store its
  // exact item code here and filter to that one item only. Typing clears it.
  const [exactItem, setExactItem] = useState(null);
  const [hvOnly, setHvOnly] = useState(false);
  const [matchFilter, setMatchFilter] = useState('All'); // All | Match | Mismatch
  const [periodFilter, setPeriodFilter] = useState('All');
  const PAGE_SIZE = 20;

  const hasActuals = data.some(d => d.actualClosingBal != null);
  const periods = standalone ? (allPeriods || [...new Set(data.map(d => d.period))].sort()) : [];
  const fmtPeriod = (p) => {
    if (!p) return p;
    const m = p.match(/^(\d{4})-(\d{2})$/);
    if (m) { const ns = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']; return `${ns[parseInt(m[2])-1]} '${m[1].slice(2)}`; }
    return p;
  };
  const ac = (a) => a === 'Deliver' ? '#059669' : a === 'Return' ? '#DC2626' : '#D97706';
  const acBg = (a) => a === 'Deliver' ? 'rgba(5,150,105,.1)' : a === 'Return' ? 'rgba(220,38,38,.08)' : 'rgba(217,119,6,.1)';
  // All quantities/balances shown as whole numbers (client asked to round).
  const fmt = (v) => { if (v == null) return '—'; if (typeof v === 'number') return (Math.round(v) || 0).toLocaleString('en-US'); return v; };
  const fmtSigned = (v) => { if (v == null) return '—'; const r = Math.round(v) || 0; return (r > 0 ? '+' : '') + r.toLocaleString('en-US'); };

  // Unique items (by code) for the search dropdown suggestions.
  const searchOptions = useMemo(() => {
    const seen = new Set();
    const out = [];
    for (const d of (data || [])) {
      if (!d.itemCode || seen.has(d.itemCode)) continue;
      seen.add(d.itemCode);
      out.push({ label: d.description || d.itemCode, sub: d.itemCode, code: d.itemCode, isHV: d.isHV });
    }
    return out.sort((a, b) => (a.label || '').localeCompare(b.label || ''));
  }, [data]);

  const filtered = useMemo(() => {
    let rows = data;
    if (standalone && periodFilter !== 'All') rows = rows.filter(d => d.period === periodFilter);
    if (actionFilter !== 'All') rows = rows.filter(d => d.predictedAction === actionFilter);
    if (hvOnly) rows = rows.filter(d => d.isHV);
    if (matchFilter === 'Match') rows = rows.filter(d => d.directionCorrect === true);
    if (matchFilter === 'Mismatch') rows = rows.filter(d => d.directionCorrect === false);
    if (exactItem) {
      // A specific item was chosen from the dropdown — show only its rows.
      rows = rows.filter(d => d.itemCode === exactItem);
    } else if (search) {
      const s = search.toLowerCase();
      rows = rows.filter(d => d.description?.toLowerCase().includes(s) || d.itemCode?.toLowerCase().includes(s));
    }
    return rows;
  }, [data, actionFilter, hvOnly, matchFilter, search, exactItem, periodFilter, standalone]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let va = a[sortCol], vb = b[sortCol];
      if (typeof va === 'string') { va = va.toLowerCase(); vb = (vb || '').toLowerCase(); }
      if (va == null) va = -Infinity; if (vb == null) vb = -Infinity;
      const primary = sortDir === 'asc' ? (va < vb ? -1 : va > vb ? 1 : 0) : (va > vb ? -1 : va < vb ? 1 : 0);
      if (primary !== 0) return primary;
      // Stable secondary sort so equal-primary rows aren't randomly ordered.
      // When sorting by Period, fall back to quantity desc (biggest movement
      // within the same month at the top); otherwise fall back to Period desc
      // so the same item's history reads chronologically.
      if (sortCol === 'period') {
        const qa = a.quantity == null ? -Infinity : a.quantity;
        const qb = b.quantity == null ? -Infinity : b.quantity;
        return qb - qa;
      }
      const pa = a.period || '';
      const pb = b.period || '';
      return pb.localeCompare(pa);
    });
    return arr;
  }, [filtered, sortCol, sortDir]);

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const pageRows = sorted.slice(tablePage * PAGE_SIZE, (tablePage + 1) * PAGE_SIZE);

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('desc'); }
    setTablePage(0);
  };

  // Export what's on screen: every filtered row in the current sort order (not
  // just the visible page), with the same columns the table shows.
  const exportCsv = () => {
    const r0 = (v) => v == null ? '' : Math.round(v);
    const head = ['Period', 'Item Code', 'Item', 'Pred. Action',
      ...(hasActuals ? ['Actual Action'] : []),
      'Prev Bal', 'Pred. Bal',
      ...(hasActuals ? ['Actual Bal', 'Error', 'APE %'] : []),
      'Pred. Change', 'Qty', 'MAPE %', 'High Value'];
    const body = sorted.map(d => {
      const ape = d.ape != null ? d.ape
        : (d.error != null && d.actualClosingBal ? Math.abs(d.error / d.actualClosingBal) * 100 : null);
      return [d.period, d.itemCode, d.description, d.predictedAction,
        ...(hasActuals ? [d.actualAction || ''] : []),
        r0(d.prevClosingBal), r0(d.predictedClosingBal),
        ...(hasActuals ? [r0(d.actualClosingBal), r0(d.error), ape != null ? ape.toFixed(1) : ''] : []),
        r0(d.difference), r0(d.quantity),
        d.itemMape != null ? d.itemMape.toFixed(1) : '',
        d.isHV ? 'Yes' : 'No'];
    });
    const stamp = (standalone && periodFilter !== 'All') ? periodFilter : 'all_periods';
    downloadCsv([head, ...body], `line_items_${stamp}.csv`);
  };

  React.useEffect(() => { setTablePage(0); }, [actionFilter, hvOnly, matchFilter, search, exactItem, periodFilter]);

  // Summary stats for toolbar
  // Direction tallies follow the active filters (HV Only, period, action, …) so
  // the toolbar summary matches what's actually in the table — compute from
  // `filtered`, not the full `data`.
  const matchCount = filtered.filter(d => d.directionCorrect === true).length;
  const mismatchCount = filtered.filter(d => d.directionCorrect === false).length;

  const cols = [
    ...(standalone ? [{ col: 'period', label: 'Period', width: '7%', align: 'left', sortable: true }] : []),
    { col: 'description',         label: 'Item',          width: standalone ? '18%' : '22%', align: 'left',  sortable: true },
    { col: 'predictedAction',     label: 'Pred. Action',  width: '9%',  align: 'left',  sortable: true },
    ...(hasActuals ? [{ col: 'actualAction', label: 'Actual Action', width: '9%', align: 'left', sortable: true }] : []),
    { col: 'prevClosingBal',      label: 'Prev Bal',      width: '8%',  align: 'right', sortable: true },
    { col: 'predictedClosingBal', label: 'Pred. Bal',     width: '8%',  align: 'right', sortable: true },
    ...(hasActuals ? [{ col: 'actualClosingBal', label: 'Actual Bal', width: '8%', align: 'right', sortable: true }] : []),
    ...(hasActuals ? [{ col: 'error', label: 'Error (Δ)', width: '7%', align: 'right', sortable: true }] : []),
    ...(hasActuals ? [{ col: 'ape', label: 'APE %', width: '6%', align: 'right', sortable: true }] : []),
    { col: 'difference',          label: 'Pred. Δ',       width: '7%',  align: 'right', sortable: true },
    { col: 'quantity',            label: 'Qty',            width: '6%',  align: 'right', sortable: true },
    { col: 'itemMape',            label: 'MAPE',           width: '6%',  align: 'right', sortable: true },
    // The pred-cost columns moved to the dedicated Costing page (CostingPage)
    // — Sonu found them crowding the inventory details here.
  ];

  const thStyle = (h) => ({
    padding: '9px 10px', textAlign: h.align, fontSize: 10, fontWeight: 600,
    color: sortCol === h.col ? 'var(--accent)' : 'var(--text-2)',
    cursor: h.sortable ? 'pointer' : 'default', userSelect: 'none',
    textTransform: 'uppercase', letterSpacing: '.05em',
    borderBottom: '2px solid var(--border)', background: '#FAFBFC',
    // Wrap instead of nowrap so a long header (e.g. the Dirham + "PRED COST MAX")
    // never hides behind the next column's opaque background.
    whiteSpace: 'normal', lineHeight: 1.2, verticalAlign: 'bottom',
    position: 'sticky', top: 0, zIndex: 1,
  });

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0, gap: 10 }}>

      {/* Toolbar row 1 — search + filters */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
        {/* Search — typeahead dropdown. Pick a suggestion → filter to that
            one item; type + Enter → all substring matches. */}
        <SearchBox
          value={search}
          onType={(v) => { setSearch(v); setExactItem(null); }}
          onPick={(opt) => { setSearch(opt.label); setExactItem(opt.code); }}
          onClear={() => { setSearch(''); setExactItem(null); }}
          options={searchOptions}
          placeholder="Search item…"
          width="0 0 240px"
        />

        {/* Period filter (standalone view only).
            Up to 6 periods: pill strip inline.
            More than 6: PeriodSelector dropdown (chevrons + searchable list)
            so a 24- or 36-month backtest doesn't push everything off-screen. */}
        {standalone && periods.length > 1 && (
          periods.length > 6 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--surface-2)', borderRadius: 8, padding: '2px 4px 2px 2px' }}>
              <button onClick={() => setPeriodFilter('All')} style={{
                padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600, fontFamily: 'var(--font)',
                background: periodFilter === 'All' ? '#fff' : 'transparent',
                color: periodFilter === 'All' ? 'var(--accent)' : 'var(--text-2)',
                boxShadow: periodFilter === 'All' ? '0 1px 3px rgba(0,0,0,.12)' : 'none',
                whiteSpace: 'nowrap',
              }}>All periods</button>
              <PeriodSelector
                value={periodFilter === 'All' ? periods[periods.length - 1] : periodFilter}
                onChange={(p) => setPeriodFilter(p)}
                options={periods}
              />
            </div>
          ) : (
            <div style={{ display: 'flex', background: 'var(--surface-2)', borderRadius: 8, padding: 2, gap: 2 }}>
              {['All', ...periods].map(p => (
                <button key={p} onClick={() => setPeriodFilter(p)} style={{
                  padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600, fontFamily: 'var(--font)',
                  background: periodFilter === p ? '#fff' : 'transparent',
                  color: periodFilter === p ? 'var(--accent)' : 'var(--text-2)',
                  boxShadow: periodFilter === p ? '0 1px 3px rgba(0,0,0,.12)' : 'none',
                  whiteSpace: 'nowrap',
                }}>{p === 'All' ? 'All periods' : fmtPeriod(p)}</button>
              ))}
            </div>
          )
        )}

        {/* Action filter */}
        <div style={{ display: 'flex', background: 'var(--surface-2)', borderRadius: 8, padding: 2, gap: 2 }}>
          {['All', 'Deliver', 'Return', 'No Change'].map(a => (
            <button key={a} onClick={() => setActionFilter(a)} style={{
              padding: '4px 11px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600, fontFamily: 'var(--font)',
              background: actionFilter === a ? '#fff' : 'transparent',
              color: actionFilter === a ? (a === 'All' ? 'var(--text)' : ac(a)) : 'var(--text-2)',
              boxShadow: actionFilter === a ? '0 1px 3px rgba(0,0,0,.12)' : 'none',
            }}>{a}</button>
          ))}
        </div>

        {/* Direction match filter (only when actuals exist) */}
        {hasActuals && (
          <div style={{ display: 'flex', background: 'var(--surface-2)', borderRadius: 8, padding: 2, gap: 2 }}>
            {[['All','All','var(--text-3)'], ['Match','✓ Match','#059669'], ['Mismatch','✗ Mismatch','#DC2626']].map(([v, l, c]) => (
              <button key={v} onClick={() => setMatchFilter(v)} style={{
                padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600, fontFamily: 'var(--font)',
                background: matchFilter === v ? '#fff' : 'transparent',
                color: matchFilter === v ? c : 'var(--text-2)',
                boxShadow: matchFilter === v ? '0 1px 3px rgba(0,0,0,.12)' : 'none',
              }}>{l}</button>
            ))}
          </div>
        )}

        {/* HV toggle */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, cursor: 'pointer', color: hvOnly ? 'var(--accent)' : 'var(--text-3)', padding: '5px 10px', border: '1px solid', borderColor: hvOnly ? 'var(--accent)' : 'var(--border)', borderRadius: 6, background: hvOnly ? 'rgba(79,70,229,.06)' : '#fff' }}>
          <input type="checkbox" checked={hvOnly} onChange={e => setHvOnly(e.target.checked)} style={{ accentColor: 'var(--accent)', margin: 0 }} />
          HV Only
        </label>

        {/* Row count + match summary + export */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, color: 'var(--text-2)' }}>
          {hasActuals && <span><span style={{ color: '#059669', fontWeight: 700 }}>{matchCount} ✓</span> · <span style={{ color: '#DC2626', fontWeight: 700 }}>{mismatchCount} ✗</span> direction</span>}
          <span>{filtered.length} of {data.length} rows</span>
          {/* Same export control as Cash Flow — downloads the filtered rows. */}
          <button onClick={exportCsv} disabled={!sorted.length} title="Download the filtered rows as CSV (opens in Excel)"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, border: '1px solid ' + (sorted.length ? 'var(--accent)' : 'var(--border)'), background: sorted.length ? 'var(--accent-surface)' : '#fff', color: sorted.length ? 'var(--accent)' : 'var(--text-3)', fontSize: 11.5, fontWeight: 700, cursor: sorted.length ? 'pointer' : 'default', fontFamily: 'var(--font)', flexShrink: 0 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
            Download CSV
          </button>
        </div>
      </div>

      {/* Table card */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: 12, border: '1px solid var(--border)', background: '#fff', minHeight: 0 }}>
        {/* h-scroller = themed horizontal scrollbar; minWidth on the table below
            makes it overflow (instead of squishing every column to fit) so the
            wider column sets scroll horizontally on narrower windows. */}
        <div className="h-scroller" style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          <table style={{ width: '100%', minWidth: cols.length * 96, borderCollapse: 'collapse', fontSize: 12, tableLayout: 'fixed' }}>
            <colgroup>
              {cols.map(c => <col key={c.col} style={{ width: c.width }} />)}
            </colgroup>
            <thead>
              <tr>
                {cols.map(h => (
                  <th key={h.col} onClick={() => h.sortable && handleSort(h.col)} style={thStyle(h)}>
                    {h.label}{h.cur && <span style={{ whiteSpace: 'nowrap' }}> (<DirhamSign s="1em" style={{ marginRight: 0, verticalAlign: '-0.12em' }} />)</span>}{h.sortable && (sortCol === h.col
                      ? <span style={{ fontSize: 12, marginLeft: 3, color: 'var(--accent)' }}>{sortDir === 'asc' ? '▲' : '▼'}</span>
                      : <span style={{ fontSize: 9, marginLeft: 3, color: 'var(--text-3)', opacity: .6 }}>↕</span>)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row, i) => {
                // APE is provided directly by the v4 schema; fall back to a computed value for older files.
                const apeVal = row.ape != null
                  ? row.ape
                  : (row.error != null && row.actualClosingBal != null && row.actualClosingBal !== 0
                      ? Math.abs(row.error / row.actualClosingBal) * 100
                      : null);
                const mismatch = row.directionCorrect === false;
                return (
                  <tr key={row.itemCode + '_' + row.period + '_' + i}
                    style={{ borderBottom: '1px solid #F3F4F6', background: mismatch ? 'rgba(220,38,38,.03)' : 'transparent' }}
                    onMouseEnter={e => e.currentTarget.style.background = mismatch ? 'rgba(220,38,38,.06)' : '#F9FAFB'}
                    onMouseLeave={e => e.currentTarget.style.background = mismatch ? 'rgba(220,38,38,.03)' : 'transparent'}>

                    {/* Period (standalone only) */}
                    {standalone && (
                      <td style={{ padding: '7px 10px', fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600, color: 'var(--text-2)' }}>{fmtPeriod(row.period)}</td>
                    )}

                    {/* Item — name + code + HV */}
                    <td style={{ padding: '7px 10px', overflow: 'hidden' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden' }}>
                        {row.isHV && <span style={{ fontSize: 10, color: 'var(--accent)', flexShrink: 0 }}>★</span>}
                        <span style={{ fontSize: 11, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.description}>{row.description}</span>
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--mono)', marginTop: 1 }}>{row.itemCode}</div>
                    </td>

                    {/* Predicted action badge */}
                    <td style={{ padding: '7px 10px' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, color: ac(row.predictedAction), background: acBg(row.predictedAction), whiteSpace: 'nowrap' }}>{row.predictedAction}</span>
                    </td>

                    {/* Actual action + match indicator */}
                    {hasActuals && (
                      <td style={{ padding: '7px 10px' }}>
                        {row.actualAction ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, color: ac(row.actualAction), background: acBg(row.actualAction), whiteSpace: 'nowrap' }}>{row.actualAction}</span>
                            <span style={{ fontSize: 12, fontWeight: 800, color: row.directionCorrect ? '#059669' : '#DC2626', flexShrink: 0 }}>{row.directionCorrect ? '✓' : '✗'}</span>
                          </div>
                        ) : <span style={{ color: 'var(--text-3)', fontSize: 11 }}>—</span>}
                      </td>
                    )}

                    {/* Numeric cols */}
                    <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-2)' }}>{fmt(row.prevClosingBal)}</td>
                    <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700 }}>{fmt(row.predictedClosingBal)}</td>
                    {hasActuals && <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-2)' }}>{row.actualClosingBal != null ? fmt(row.actualClosingBal) : '—'}</td>}

                    {/* Error (absolute) */}
                    {hasActuals && (
                      <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600, color: row.error == null ? 'var(--text-3)' : row.error < 0 ? '#DC2626' : '#059669' }}>
                        {row.error != null ? fmtSigned(row.error) : '—'}
                      </td>
                    )}

                    {/* APE % — direct from v4 schema (with fallback for older files) */}
                    {hasActuals && (
                      <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, color: apeVal == null ? 'var(--text-3)' : apeVal > 100 ? '#DC2626' : apeVal > 30 ? '#D97706' : '#059669' }}>
                        {apeVal != null ? apeVal.toFixed(1) + '%' : '—'}
                      </td>
                    )}

                    {/* Predicted delta (diff) */}
                    <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600, color: (row.difference||0) > 0 ? '#059669' : (row.difference||0) < 0 ? '#DC2626' : 'var(--text-3)' }}>
                      {fmtSigned(row.difference)}
                    </td>

                    <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700 }}>{fmt(row.quantity)}</td>
                    <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700,
                      color: row.itemMape == null ? 'var(--text-3)' : row.itemMape > 100 ? '#DC2626' : row.itemMape > 50 ? '#D97706' : '#059669' }}>
                      {row.itemMape != null ? row.itemMape.toFixed(1) + '%' : '—'}
                    </td>
                  </tr>
                );
              })}
              {pageRows.length === 0 && <tr><td colSpan={cols.length} style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>No items match the filters</td></tr>}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '8px 14px', borderTop: '1px solid var(--border)', background: '#FAFBFC', flexShrink: 0, gap: 8 }}>
          <div style={{ flex: 1, fontSize: 11, color: 'var(--text-3)' }}>
            {sorted.length === 0 ? 'No results' : `${tablePage * PAGE_SIZE + 1}–${Math.min((tablePage + 1) * PAGE_SIZE, sorted.length)} of ${sorted.length}`}
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <PgBtn label="←" disabled={tablePage === 0} onClick={() => setTablePage(p => p - 1)} />
            {(() => { const btns = []; const start = Math.max(0, Math.min(tablePage - 2, totalPages - 5)); const end = Math.min(totalPages, start + 5); for (let i = start; i < end; i++) btns.push(<PgBtn key={i} label={i + 1} active={i === tablePage} onClick={() => setTablePage(i)} />); return btns; })()}
            <PgBtn label="→" disabled={tablePage >= totalPages - 1} onClick={() => setTablePage(p => p + 1)} />
          </div>
          <div style={{ flex: 1 }} />
        </div>
      </div>
    </div>
  );
}

function KPI({ label, value, sub, subColor, color }) {
  return (
    <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 16px' }}>
      <div style={{ width: 22, height: 3, borderRadius: 2, background: color, marginBottom: 8 }}></div>
      <div style={{ fontSize: 10, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', fontFamily: 'var(--mono)', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: subColor || 'var(--text-3)', marginTop: 4, fontWeight: 500 }}>{sub}</div>}
    </div>
  );
}

function ExpandBtn({ onClick, absolute }) {
  const base = {
    background: 'none', border: '1px solid var(--border)', borderRadius: 6,
    padding: '3px 5px', cursor: 'pointer', color: 'var(--text-2)',
    display: 'flex', alignItems: 'center', transition: 'color .12s, border-color .12s, background .12s',
  };
  const pos = absolute ? { position: 'absolute', top: 12, right: 14, zIndex: 2, background: '#fff' } : {};
  return (
    <button onClick={onClick} title="Expand" aria-label="Expand"
      style={{ ...base, ...pos }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.background = 'var(--hover)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-2)'; e.currentTarget.style.background = absolute ? '#fff' : 'none'; }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 3 21 3 21 9" />
        <polyline points="9 21 3 21 3 15" />
        <line x1="21" y1="3" x2="14" y2="10" />
        <line x1="3" y1="21" x2="10" y2="14" />
      </svg>
    </button>
  );
}

// Small ⓘ button — opens the chart's "How to read" explanation.
function InfoBtn({ onClick, absolute }) {
  const base = {
    background: 'none', border: '1px solid var(--border)', borderRadius: 6,
    padding: '3px 5px', cursor: 'pointer', color: 'var(--text-2)',
    display: 'flex', alignItems: 'center', transition: 'color .12s, border-color .12s, background .12s',
  };
  const pos = absolute ? { position: 'absolute', top: 12, right: 46, zIndex: 2, background: '#fff' } : {};
  return (
    <button onClick={onClick} title="How to read this chart" aria-label="How to read this chart"
      style={{ ...base, ...pos }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.background = 'var(--hover)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-2)'; e.currentTarget.style.background = absolute ? '#fff' : 'none'; }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="11" x2="12" y2="16" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
    </button>
  );
}

// Accent-tinted explanation panel shown at the top of the maximized modal.
function InfoPanel({ info }) {
  if (!info) return null;
  return (
    <div style={{ background: 'var(--accent-surface)', border: '1px solid var(--accent-border)', borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="11" x2="12" y2="16" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
        How to read this chart
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>{info}</div>
    </div>
  );
}

function Card({ title, children, style, info }) {
  const [maxed, setMaxed] = React.useState(false);
  // When the modal is opened via the ⓘ button, the explanation panel starts open.
  const [showInfo, setShowInfo] = React.useState(false);
  const close = () => setMaxed(false);
  React.useEffect(() => {
    if (!maxed) return;
    const onKey = e => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [maxed]);
  const openExpand = () => { setShowInfo(false); setMaxed(true); };
  const openInfo = () => { setShowInfo(true); setMaxed(true); };

  return (
    <>
      <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px', position: 'relative', ...style }}>
        {title ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-0.01em', flex: 1 }}>{title}</div>
            {info && <InfoBtn onClick={openInfo} />}
            <ExpandBtn onClick={openExpand} />
          </div>
        ) : (
          <>
            {info && <InfoBtn onClick={openInfo} absolute />}
            <ExpandBtn onClick={openExpand} absolute />
          </>
        )}
        {children}
      </div>
      {maxed && (
        <div onClick={close} role="dialog" aria-modal="true"
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.40)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 16, width: 'min(1200px, calc(100vw - 48px))', maxHeight: 'calc(100vh - 48px)', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 60px rgba(0,0,0,.18), 0 0 0 1px rgba(0,0,0,.04)' }}>
            <div style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', flexShrink: 0, gap: 10 }}>
              <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em', flex: 1, minWidth: 0 }}>{title || 'Detail view'}</div>
              {/* Toggle the explanation on/off inside the modal too. */}
              {info && (
                <button onClick={() => setShowInfo(s => !s)} style={{
                  display: 'flex', alignItems: 'center', gap: 6, background: showInfo ? 'var(--accent)' : 'var(--surface-2)',
                  color: showInfo ? '#fff' : 'var(--text-2)', border: 'none', borderRadius: 8, padding: '6px 12px',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)', whiteSpace: 'nowrap',
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="11" x2="12" y2="16" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
                  How to read
                </button>
              )}
              <button onClick={close} title="Close (Esc)" aria-label="Close"
                style={{ background: 'var(--surface-2)', border: 'none', color: 'var(--text-2)', cursor: 'pointer', width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, lineHeight: 1, flexShrink: 0 }}>×</button>
            </div>
            <div style={{ padding: '20px 24px', overflow: 'auto', flex: 1 }}>
              {showInfo && <InfoPanel info={info} />}
              {children}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function PgBtn({ label, active, disabled, onClick }) {
  return (
    <button onClick={disabled ? undefined : onClick} style={{
      width: typeof label === 'number' ? 30 : 28, height: 30, borderRadius: 7, border: '1px solid',
      borderColor: active ? 'var(--accent)' : 'var(--border)',
      background: active ? 'var(--accent)' : '#fff',
      color: active ? '#fff' : disabled ? 'var(--text-3)' : 'var(--text-2)',
      fontSize: 12, fontWeight: 600, cursor: disabled ? 'default' : 'pointer',
      fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      opacity: disabled ? .55 : 1, transition: 'all .12s',
    }}>{label}</button>
  );
}
// Shared with CostingPage so its pagination matches Line Items exactly.
Object.assign(window, { PgBtn });

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
