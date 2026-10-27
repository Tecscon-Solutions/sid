/* ============================================================
   Long-range Forecast — quarterly / half-yearly / yearly predictions.

   Since Oct 2026 every monthly ledger upload also writes 4 quarterly,
   2 half-yearly and 1 yearly forecast into forecast_predictions
   (grain = 'quarterly' | 'halfyearly' | 'yearly', year_month holds a range
   label such as '2027-01_to_2027-03'). The period containing the uploaded
   month is skipped, so which periods exist changes every month: the page
   always builds its columns from the labels in the data, never from a fixed
   calendar. Only is_latest rows feed the main view; older versions are read
   for one item at a time in its "how the forecast changed" panel.

   pred_closing_balance is the average predicted closing balance over the
   period's months. actual_closing_balance stays null until every month of
   the period has been uploaded; null is shown as pending, never as 0.
   ============================================================ */
const LR_GRAINS = [
  { id: 'quarterly', label: 'Quarterly', n: 4 },
  { id: 'halfyearly', label: 'Half-yearly', n: 2 },
  { id: 'yearly', label: 'Yearly', n: 1 },
];
const LR_MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// '2027-01_to_2027-03' -> { name: 'Q1 2027', span: 'Jan – Mar 2027' }
function lrPeriodLabel(ym, grain) {
  const m = String(ym || '').match(/^(\d{4})-(\d{2})_to_(\d{4})-(\d{2})$/);
  if (!m) return { name: ym || '—', span: '' };
  const y1 = +m[1], m1 = +m[2], y2 = +m[3], m2 = +m[4];
  const span = `${LR_MONTHS[m1]} – ${LR_MONTHS[m2]} ${y2}${y1 !== y2 ? ` (from ${y1})` : ''}`;
  if (grain === 'quarterly') return { name: `Q${Math.floor((m1 - 1) / 3) + 1} ${y1}`, span };
  if (grain === 'halfyearly') return { name: `H${m1 <= 6 ? 1 : 2} ${y1}`, span };
  return { name: y1 === y2 ? `${y1}` : `${y1}–${y2}`, span };
}
function lrUploadLabel(u) {
  const m = String(u || '').match(/^(\d{4})-(\d{2})$/);
  return m ? `${LR_MONTHS[+m[2]]} ${m[1]}` : (u || '—');
}

/* Sample rows in the real schema, for looking at the page before the
   quarterly step is live. Built from the monthly items so names and costs
   are real; the balances are NOT model output and the page says so. */
function lrSampleRows(allData) {
  const items = {};
  let upload = null;
  (allData || []).forEach(d => {
    if (d.actualClosingBal != null && (!upload || d.period > upload)) upload = d.period;
    const it = items[d.itemCode] || (items[d.itemCode] = { code: d.itemCode, desc: d.description, isHV: d.isHV, bal: null, period: '', low: d.lowCost, avg: d.avgCost, high: d.highCost });
    if (d.predictedClosingBal != null && d.period >= it.period) { it.bal = d.predictedClosingBal; it.period = d.period; }
  });
  if (!upload) upload = (allData || []).reduce((mx, d) => (d.period > mx ? d.period : mx), '2026-10');
  const [uy, um] = upload.split('-').map(Number);
  const pad = n => String(n).padStart(2, '0');
  const range = (y, m, len) => { const e = m + len - 1; return `${y}-${pad(m)}_to_${y + Math.floor((e - 1) / 12)}-${pad(((e - 1) % 12) + 1)}`; };
  const periods = { quarterly: [], halfyearly: [], yearly: [] };
  let y = uy, q = Math.floor((um - 1) / 3) + 1;
  for (let i = 0; i < 4; i++) { q++; if (q > 4) { q = 1; y++; } periods.quarterly.push(range(y, (q - 1) * 3 + 1, 3)); }
  y = uy; let h = um <= 6 ? 1 : 2;
  for (let i = 0; i < 2; i++) { h++; if (h > 2) { h = 1; y++; } periods.halfyearly.push(range(y, h === 1 ? 1 : 7, 6)); }
  periods.yearly.push(range(uy + 1, 1, 12));
  const rows = [];
  Object.values(items).forEach(it => {
    if (it.bal == null) return;
    let hsh = 0; for (const ch of it.code) hsh = (hsh * 31 + ch.charCodeAt(0)) >>> 0;
    const drift = ((hsh % 81) - 40) / 1000; // -4% .. +4% per period
    Object.entries(periods).forEach(([grain, list]) => list.forEach((ym, i) => {
      const p = Math.max(0, Math.round(it.bal * (1 + drift * (i + 1))));
      const cost = r => (it.isHV && r != null ? p * r : null);
      rows.push({ item_code: it.code, item_description: it.desc, is_high_value: it.isHV ? 1 : 0, grain, year_month: ym, is_latest: true, upload_year_month: upload,
        pred_closing_balance: p, actual_closing_balance: null, low_cost: it.low, avg_cost: it.avg, high_cost: it.high,
        pred_cost_min: cost(it.low), pred_cost_avg: cost(it.avg), pred_cost_max: cost(it.high) });
    }));
  });
  return rows;
}

function LongRangePage({ allData }) {
  const fmtNum = v => (v == null ? '—' : (Math.round(v) || 0).toLocaleString('en-US'));
  const [state, setState] = React.useState({ status: 'loading', rows: [] }); // loading | ready | notlive | empty | error
  const [sample, setSample] = React.useState(false);
  const [grain, setGrain] = React.useState('quarterly');
  const [measure, setMeasure] = React.useState('units'); // units | cost
  const [hvOnly, setHvOnly] = React.useState(false);
  const [q, setQ] = React.useState('');
  const [sortBy, setSortBy] = React.useState(null); // period label, or null = item name
  const [itemSel, setItemSel] = React.useState(null);

  const client = React.useMemo(() => {
    const url = window.__SUPABASE_URL, key = window.__SUPABASE_KEY;
    if (!url || !key || !window.supabase) return null;
    try { return window.supabase.createClient(url, key); } catch (e) { return null; }
  }, []);

  React.useEffect(() => {
    if (!client) { setState({ status: 'error', rows: [], message: 'Supabase is not configured.' }); return; }
    let cancelled = false;
    (async () => {
      const all = [];
      const PAGE = 1000;
      for (let offset = 0; ; offset += PAGE) {
        const { data, error } = await client.from('forecast_predictions').select('*')
          .in('grain', LR_GRAINS.map(g => g.id)).eq('is_latest', true)
          .order('year_month').range(offset, offset + PAGE - 1);
        if (cancelled) return;
        if (error) {
          // 42703 = the grain / is_latest columns are not in the database yet
          setState(error.code === '42703' ? { status: 'notlive', rows: [] } : { status: 'error', rows: [], message: error.message });
          return;
        }
        all.push(...(data || []));
        if (!data || data.length < PAGE) break;
      }
      setState({ status: all.length ? 'ready' : 'empty', rows: all });
    })();
    return () => { cancelled = true; };
  }, [client]);

  const rows = React.useMemo(() => (sample ? lrSampleRows(allData) : state.rows), [sample, state.rows, allData]);
  const grainsPresent = React.useMemo(() => LR_GRAINS.filter(g => rows.some(r => r.grain === g.id)), [rows]);
  React.useEffect(() => {
    if (grainsPresent.length && !grainsPresent.some(g => g.id === grain)) setGrain(grainsPresent[0].id);
  }, [grainsPresent, grain]);

  const view = React.useMemo(() => {
    const gr = rows.filter(r => r.grain === grain);
    const periods = [...new Set(gr.map(r => r.year_month))].sort();
    const uploads = [...new Set(gr.map(r => r.upload_year_month).filter(Boolean))].sort();
    const items = {};
    gr.forEach(r => {
      const it = items[r.item_code] || (items[r.item_code] = { code: r.item_code, desc: r.item_description || r.item_code, isHV: !!r.is_high_value, by: {} });
      it.by[r.year_month] = r;
    });
    const totals = periods.map(p => {
      const ps = gr.filter(r => r.year_month === p);
      const withActual = ps.filter(r => r.actual_closing_balance != null);
      const sum = (a, k) => a.reduce((s, r) => s + (r[k] == null ? 0 : +r[k]), 0);
      return {
        period: p, items: ps.length, pred: sum(ps, 'pred_closing_balance'),
        costAvg: sum(ps, 'pred_cost_avg'), costMin: sum(ps, 'pred_cost_min'), costMax: sum(ps, 'pred_cost_max'),
        actualCount: withActual.length, predOfActual: sum(withActual, 'pred_closing_balance'), actual: sum(withActual, 'actual_closing_balance'),
      };
    });
    return { periods, upload: uploads[uploads.length - 1], items: Object.values(items), totals };
  }, [rows, grain]);

  const list = React.useMemo(() => {
    let a = view.items;
    if (hvOnly || measure === 'cost') a = a.filter(x => x.isHV);
    const s = q.trim().toLowerCase();
    if (s) a = a.filter(x => (x.desc + ' ' + x.code).toLowerCase().includes(s));
    const key = measure === 'cost' ? 'pred_cost_avg' : 'pred_closing_balance';
    const val = (x, p) => { const r = x.by[p]; return r && r[key] != null ? +r[key] : -1; };
    a = a.slice().sort(sortBy ? (x, y) => val(y, sortBy) - val(x, sortBy) : (x, y) => (x.desc < y.desc ? -1 : x.desc > y.desc ? 1 : 0));
    return a;
  }, [view, hvOnly, measure, q, sortBy]);

  /* ---------- states before there is anything to show ---------- */
  if (state.status === 'loading' && !sample) {
    return <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>Loading quarterly, half-yearly and yearly forecasts…</div>;
  }
  if (!sample && state.status !== 'ready') {
    const msg = state.status === 'notlive'
      ? 'The quarterly, half-yearly and yearly forecasts are not in the database yet. They appear here by themselves after the first ledger upload once the new forecast step is live.'
      : state.status === 'empty'
        ? 'No quarterly, half-yearly or yearly forecasts yet. They are written with each monthly ledger upload and appear here after the next one.'
        : `Could not load the long-range forecasts: ${state.message || 'unknown error'}`;
    return (
      <div style={{ padding: '56px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center' }}>
        <div style={{ maxWidth: 520, color: 'var(--text-2)', fontSize: 13.5, lineHeight: 1.6 }}>{msg}</div>
        {(allData || []).length > 0 && (
          <button onClick={() => setSample(true)} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid var(--accent)', background: '#fff', color: 'var(--accent)', fontWeight: 600, fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font)' }}>
            Preview the layout with sample numbers
          </button>
        )}
      </div>
    );
  }

  /* ---------- styles, matching the other table pages ---------- */
  const pill = active => ({
    padding: '5px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)',
    border: '1px solid', borderColor: active ? 'var(--accent)' : 'var(--border)',
    background: active ? 'rgba(79,70,229,.06)' : '#fff', color: active ? 'var(--accent)' : 'var(--text-2)',
  });
  const th = align => ({ padding: '8px 10px', textAlign: align || 'left', fontSize: 10, fontWeight: 600, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '2px solid var(--border)', whiteSpace: 'nowrap', position: 'sticky', top: 0, zIndex: 2, background: '#FAFBFC' });
  const td = align => ({ padding: '7px 10px', textAlign: align || 'left', fontSize: 11, borderBottom: '1px solid #F3F4F6', whiteSpace: 'nowrap' });
  const tag = (text, color, bg) => <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color, background: bg, padding: '2px 6px', borderRadius: 5 }}>{text}</span>;
  const pctDiff = (pred, act) => (act ? Math.round(((pred - act) / act) * 100) : null);
  const g = LR_GRAINS.find(x => x.id === grain);

  const exportCsv = () => {
    const head = ['Item Code', 'Item', 'High Value', ...view.periods.flatMap(p => { const n = lrPeriodLabel(p, grain).name; return [`${n} predicted`, `${n} actual`]; })];
    const key = measure === 'cost' ? 'pred_cost_avg' : 'pred_closing_balance';
    const body = list.map(x => [x.code, x.desc, x.isHV ? 'Yes' : 'No', ...view.periods.flatMap(p => { const r = x.by[p]; return [r && r[key] != null ? Math.round(r[key]) : '', r && r.actual_closing_balance != null ? Math.round(r.actual_closing_balance) : '']; })]);
    downloadCsv([head, ...body], `${grain}_forecast_from_${view.upload || 'latest'}${measure === 'cost' ? '_cost' : ''}.csv`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', padding: '14px 24px 14px' }}>
      {sample && (
        <div style={{ flexShrink: 0, marginBottom: 10, padding: '8px 12px', borderRadius: 8, background: '#FFFBEB', border: '1px solid #FDE68A', color: '#92400E', fontSize: 12, display: 'flex', gap: 10, alignItems: 'center' }}>
          <b>Sample numbers.</b> Items and costs are real, the balances are made up to show the layout. The real forecasts replace them once they are in the database.
          <button onClick={() => setSample(false)} style={{ ...pill(false), marginLeft: 'auto', padding: '3px 10px' }}>Hide sample</button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10, flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {LR_GRAINS.map(x => (
            <button key={x.id} onClick={() => { setGrain(x.id); setSortBy(null); }} disabled={!grainsPresent.some(p => p.id === x.id)} style={{ ...pill(grain === x.id), opacity: grainsPresent.some(p => p.id === x.id) ? 1 : 0.4 }}>{x.label}</button>
          ))}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5 }}>
          From the <b style={{ color: 'var(--text-2)' }}>{lrUploadLabel(view.upload)}</b> upload · next {view.periods.length} {g.label.toLowerCase()} period{view.periods.length === 1 ? '' : 's'}, average closing balance per period
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(view.totals.length, 1)}, minmax(0, 1fr))`, gap: 8, marginBottom: 12, flexShrink: 0 }}>
        {view.totals.map(t => {
          const lab = lrPeriodLabel(t.period, grain);
          const done = t.actualCount > 0;
          const d = done ? pctDiff(t.predOfActual, t.actual) : null;
          return (
            <div key={t.period} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{lab.name}</span>
                {done ? tag('Actuals in', '#047857', '#ECFDF5') : tag('Forecast only', '#6B7280', '#F3F4F6')}
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 1 }}>{lab.span}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--mono)', marginTop: 6 }}>
                {measure === 'cost' ? fmtNum(t.costAvg) : fmtNum(t.pred)}
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 1 }}>
                {measure === 'cost' ? `HV cost, range ${fmtNum(t.costMin)} – ${fmtNum(t.costMax)}` : `predicted units across ${fmtNum(t.items)} items`}
              </div>
              {done && (
                <div style={{ fontSize: 10.5, marginTop: 4, color: 'var(--text-2)' }}>
                  Actual {fmtNum(t.actual)} on {fmtNum(t.actualCount)} items · <span style={{ color: Math.abs(d) <= 10 ? '#059669' : '#D97706', fontWeight: 600 }}>{d > 0 ? '+' : ''}{d}%</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12, flexShrink: 0 }}>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search code or description…"
          style={{ flex: '0 0 260px', padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 12, fontFamily: 'var(--font)', outline: 'none' }} />
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Show</span>
          <button onClick={() => setMeasure('units')} style={pill(measure === 'units')}>Units</button>
          <button onClick={() => setMeasure('cost')} style={pill(measure === 'cost')} title="Predicted cost at the average rate, High-Value items only">Cost (HV)</button>
        </div>
        <button onClick={() => setHvOnly(v => !v)} style={pill(hvOnly || measure === 'cost')} disabled={measure === 'cost'}>★ HV only</button>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{list.length.toLocaleString('en-US')} item{list.length === 1 ? '' : 's'}</span>
          <button onClick={exportCsv} disabled={!list.length} style={{ ...pill(false), color: 'var(--accent)', borderColor: 'var(--accent)' }}>Download CSV</button>
        </div>
      </div>

      <div className="h-scroller" style={{ flex: 1, minHeight: 0, overflow: 'auto', background: '#fff', border: '1px solid var(--border)', borderRadius: 12 }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={{ ...th(), cursor: 'pointer' }} onClick={() => setSortBy(null)}>Item{!sortBy && ' ↓'}</th>
              {view.periods.map(p => {
                const lab = lrPeriodLabel(p, grain);
                return (
                  <th key={p} style={{ ...th('right'), cursor: 'pointer' }} onClick={() => setSortBy(p)} title={`${lab.span} · click to sort`}>
                    {lab.name}{sortBy === p && ' ↓'}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {list.slice(0, 300).map(x => (
              <tr key={x.code} onClick={() => setItemSel(x.code)} style={{ cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFC')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <td style={{ ...td(), whiteSpace: 'normal' }}>
                  <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: 12 }}>{x.isHV && <span style={{ color: 'var(--accent)' }}>★ </span>}{x.desc}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>{x.code}</div>
                </td>
                {view.periods.map(p => {
                  const r = x.by[p];
                  const v = r ? (measure === 'cost' ? r.pred_cost_avg : r.pred_closing_balance) : null;
                  const act = r && measure === 'units' ? r.actual_closing_balance : null;
                  const d = act != null ? pctDiff(+r.pred_closing_balance, +act) : null;
                  return (
                    <td key={p} style={{ ...td('right'), fontFamily: 'var(--mono)' }}>
                      <div style={{ fontWeight: 700, color: v == null ? 'var(--text-3)' : 'var(--text)' }}>{fmtNum(v)}</div>
                      {act != null && <div style={{ fontSize: 10, color: 'var(--text-3)' }}>actual {fmtNum(act)} <span style={{ color: Math.abs(d) <= 10 ? '#059669' : '#D97706' }}>{d > 0 ? '+' : ''}{d}%</span></div>}
                    </td>
                  );
                })}
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={view.periods.length + 1} style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>No items match the filters</td></tr>}
            {list.length > 300 && <tr><td colSpan={view.periods.length + 1} style={{ padding: 12, textAlign: 'center', color: 'var(--text-3)', fontSize: 11 }}>Showing 300 of {list.length.toLocaleString('en-US')}. Search to narrow, or download the CSV for all.</td></tr>}
          </tbody>
        </table>
      </div>

      {itemSel && <LongRangeItemModal code={itemSel} grain={grain} view={view} client={client} sample={sample} onClose={() => setItemSel(null)} />}
    </div>
  );
}

/* One item: its periods side by side, and how each period's forecast moved
   across past uploads (read on demand: every version, not only is_latest). */
function LongRangeItemModal({ code, grain, view, client, sample, onClose }) {
  const fmtNum = v => (v == null ? '—' : (Math.round(v) || 0).toLocaleString('en-US'));
  const item = view.items.find(x => x.code === code);
  const [hist, setHist] = React.useState(null); // { [year_month]: [{upload, pred, actual}] }
  React.useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  React.useEffect(() => {
    let cancelled = false;
    if (sample || !client) {
      // Sample: three earlier uploads drifting toward today's value.
      const h = {};
      view.periods.forEach(p => {
        const cur = item && item.by[p] ? +item.by[p].pred_closing_balance : null;
        if (cur == null) return;
        h[p] = [0.9, 0.95, 1.02, 1].map((k, i) => ({ upload: `v${i + 1}`, pred: Math.round(cur * k), actual: null }));
      });
      setHist(h);
      return;
    }
    (async () => {
      const { data, error } = await client.from('forecast_predictions')
        .select('year_month, upload_year_month, pred_closing_balance, actual_closing_balance')
        .eq('grain', grain).eq('item_code', code).order('upload_year_month');
      if (cancelled) return;
      if (error) { setHist({}); return; }
      const h = {};
      (data || []).forEach(r => { (h[r.year_month] || (h[r.year_month] = [])).push({ upload: r.upload_year_month, pred: r.pred_closing_balance, actual: r.actual_closing_balance }); });
      setHist(h);
    })();
    return () => { cancelled = true; };
  }, [code, grain, client, sample]);

  if (!item) return null;
  const vals = view.periods.map(p => (item.by[p] ? +item.by[p].pred_closing_balance : null));
  const acts = view.periods.map(p => (item.by[p] && item.by[p].actual_closing_balance != null ? +item.by[p].actual_closing_balance : null));
  const max = Math.max(1, ...vals.filter(v => v != null), ...acts.filter(v => v != null));
  const W = 560, H = 170, padL = 8, padB = 36, bw = Math.min(70, (W - padL) / Math.max(view.periods.length, 1) - 18);

  const spark = (pts) => {
    const ys = pts.flatMap(p => [p.pred, p.actual]).filter(v => v != null);
    if (pts.length < 2 || !ys.length) return <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{pts.length === 1 ? 'first forecast of this period' : '—'}</span>;
    const lo = Math.min(...ys), hi = Math.max(...ys), sw = 150, sh = 30, sx = i => (i / (pts.length - 1)) * sw, sy = v => sh - 3 - ((v - lo) / Math.max(hi - lo, 1)) * (sh - 6);
    const line = pts.map((p, i) => `${i ? 'L' : 'M'}${sx(i).toFixed(1)},${sy(p.pred).toFixed(1)}`).join(' ');
    const act = pts.find(p => p.actual != null);
    return (
      <svg width={sw} height={sh} style={{ display: 'block' }}>
        {act && <line x1={0} x2={sw} y1={sy(act.actual)} y2={sy(act.actual)} stroke="#059669" strokeDasharray="3 3" strokeWidth={1} />}
        <path d={line} fill="none" stroke="var(--accent)" strokeWidth={1.6} />
        {pts.map((p, i) => <circle key={i} cx={sx(i)} cy={sy(p.pred)} r={2.2} fill="var(--accent)"><title>{`${lrUploadLabel(p.upload)} upload: ${fmtNum(p.pred)}`}</title></circle>)}
      </svg>
    );
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={e => e.stopPropagation()} className="h-scroller" style={{ background: '#fff', borderRadius: 14, width: 'min(720px, 94vw)', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,.25)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '14px 18px', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: '#fff', zIndex: 3 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{item.isHV && <span style={{ color: 'var(--accent)' }}>★ </span>}{item.desc}</div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--mono)', marginTop: 2 }}>{item.code} · {LR_GRAINS.find(g => g.id === grain).label.toLowerCase()} forecast from the {lrUploadLabel(view.upload)} upload</div>
          </div>
          <button onClick={onClose} title="Close" style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 7, border: '1px solid var(--border)', background: '#fff', cursor: 'pointer', color: 'var(--text-2)', fontSize: 15 }}>×</button>
        </div>
        <div style={{ padding: '16px 18px' }}>
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }}>
            {view.periods.map((p, i) => {
              const slot = (W - padL) / view.periods.length, cx = padL + slot * i + slot / 2, v = vals[i], a = acts[i];
              const y = v => H - padB - (v / max) * (H - padB - 18);
              return (
                <g key={p}>
                  {v != null && <rect x={cx - bw / 2} y={y(v)} width={bw} height={H - padB - y(v)} rx={4} fill="rgba(79,70,229,.18)" stroke="var(--accent)" />}
                  {v != null && <text x={cx} y={y(v) - 5} textAnchor="middle" fontSize="11" fontWeight="700" fill="#111827" fontFamily="var(--mono)">{fmtNum(v)}</text>}
                  {a != null && <line x1={cx - bw / 2 - 4} x2={cx + bw / 2 + 4} y1={y(a)} y2={y(a)} stroke="#059669" strokeWidth={2.5} />}
                  <text x={cx} y={H - padB + 16} textAnchor="middle" fontSize="11" fontWeight="600" fill="#374151">{lrPeriodLabel(p, grain).name}</text>
                  <text x={cx} y={H - padB + 29} textAnchor="middle" fontSize="9.5" fill="#9CA3AF">{a != null ? `actual ${fmtNum(a)}` : 'forecast only'}</text>
                </g>
              );
            })}
          </svg>
          <div style={{ fontSize: 10.5, color: 'var(--text-3)', margin: '4px 0 16px' }}>Bars: predicted average closing balance. Green line: actual, once every month of the period is in.</div>

          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>How the forecast changed</div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 8 }}>Each dot is one monthly upload that forecast the period, oldest on the left{sample ? ' (sample)' : ''}.</div>
          {hist == null ? <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Loading…</div> : (
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <tbody>
                {view.periods.map(p => {
                  const pts = hist[p] || [];
                  const first = pts[0], last = pts[pts.length - 1];
                  return (
                    <tr key={p}>
                      <td style={{ padding: '6px 0', fontSize: 12, fontWeight: 600, width: 90, borderBottom: '1px solid #F3F4F6' }}>{lrPeriodLabel(p, grain).name}</td>
                      <td style={{ padding: '6px 0', borderBottom: '1px solid #F3F4F6' }}>{spark(pts)}</td>
                      <td style={{ padding: '6px 0', fontSize: 11, color: 'var(--text-2)', textAlign: 'right', fontFamily: 'var(--mono)', borderBottom: '1px solid #F3F4F6' }}>
                        {pts.length > 1 ? `${fmtNum(first.pred)} → ${fmtNum(last.pred)} over ${pts.length} uploads` : pts.length === 1 ? fmtNum(first.pred) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
window.LongRangePage = LongRangePage;
