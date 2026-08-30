/* ============================================================
   Supabase data layer — runs in React so run switching is instant
   (no Streamlit rerun, no iframe reload).  The Python side still
   pre-fetches the latest year for fast first paint; this hook then
   takes over for any subsequent switches.

   Schema reference: forecast_predictions has 18 stored columns; we
   no longer derive Tier / Diff of Actual to Prediction / Difference /
   actual_action / direction_correct / item_mape / months_in_mape /
   bias_correction.  Per-row forecast_mode lets Backtest and Future
   months coexist in one continuous view.
   ============================================================ */
// Top-of-program destructure used here AND in app.jsx — Babel-standalone
// concatenates every <script type="text/babel"> block, so declaring these
// in app.jsx as well would be a "Identifier already declared" SyntaxError.
const { useState, useEffect, useMemo } = React;

/* Predicted ⇄ Actual accessors. The Overview tab has a toggle that flips
   every card between the model's prediction and what actually happened
   (only meaningful for Backtest months where actuals exist).
     fcAction — which action column to read
     fcBal    — which closing-balance column to read
     fcQty    — move magnitude: predicted uses the stored action_quantity;
                actual is derived as |actual − previous| closing balance. */
function fcAction(d, mode) { return mode === 'actual' ? d.actualAction : d.predictedAction; }
function fcBal(d, mode) { return mode === 'actual' ? d.actualClosingBal : d.predictedClosingBal; }
function fcQty(d, mode) {
  if (mode === 'actual') {
    if (d.actualClosingBal == null || d.prevClosingBal == null) return 0;
    return Math.abs(d.actualClosingBal - d.prevClosingBal);
  }
  return d.quantity || 0;
}

const ACTION_THRESHOLD = 0.5;
function classifyAction(delta) {
  if (delta == null) return null;
  if (delta >= ACTION_THRESHOLD) return 'Deliver';
  if (delta <= -ACTION_THRESHOLD) return 'Return';
  return 'No Change';
}
function _num(v) {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function _txt(v) {
  if (v == null) return null;
  return String(v).trim();
}

/* Money formatting for the cost / value columns. CURRENCY is the rental-rate
   currency — change this ONE constant if the rates are ever in a different
   currency. NULL / non-numeric -> "-" (cost is only filled for HV items, so
   every Standard item and any missing value renders as a dash, never 0). */
const CURRENCY = 'AED';
/* UAE Dirham symbol (Central Bank, Mar 2025) — artwork supplied by Sonu/Sid:
   a "D" with two horizontal bars, viewBox 256x256. Fill uses currentColor so
   it scales with the surrounding font and inherits its color (no Unicode
   codepoint in fonts yet — U+20C3 is still rolling out). Plain-text spots
   (tooltips, exports) keep the "AED" code. */
function DirhamSign({ s, style }) {
  const size = s || '1em';
  // viewBox cropped to the actual glyph bounds (~x38-216, y46-210) so the mark
  // fills its box instead of floating in padding — visible at plain text size.
  return (
    <svg viewBox="38 44 180 168" width={size} height={size} role="img" aria-label="AED"
      style={{ display: 'inline-block', verticalAlign: '-0.15em', marginRight: '0.14em', flexShrink: 0, ...style }}>
      <g fill="currentColor">
        {/* Main 'D' (outer shape + carved counter) */}
        <path fillRule="evenodd" d="M 125 48 L 60 48 C 70 48, 75 53, 75 63 L 75 193 C 75 203, 70 208, 60 208 L 125 208 C 165 208, 200 183, 200 128 C 200 73, 165 48, 125 48 Z M 105 68 L 125 68 C 150 68, 170 88, 170 128 C 170 168, 150 188, 125 188 L 105 188 Z" />
        {/* Top bar */}
        <path d="M 40 105 L 200 105 Q 213 105, 215 120 L 55 120 Q 42 120, 40 105 Z" />
        {/* Bottom bar */}
        <path d="M 40 136 L 200 136 Q 213 136, 215 151 L 55 151 Q 42 151, 40 136 Z" />
      </g>
    </svg>
  );
}
function fmtMoney(v) {
  if (v == null) return '-';
  const n = Number(v);
  if (!Number.isFinite(n)) return '-';
  return CURRENCY + ' ' + Math.round(n).toLocaleString('en-US');
}
function fmtMoneyShort(v) {
  if (v == null) return '-';
  const n = Number(v);
  if (!Number.isFinite(n)) return '-';
  const a = Math.abs(n);
  if (a >= 1e6) return CURRENCY + ' ' + (n / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M';
  if (a >= 1e4) return CURRENCY + ' ' + Math.round(n / 1e3).toLocaleString('en-US') + 'k';
  return CURRENCY + ' ' + Math.round(n).toLocaleString('en-US');
}
function fmtNum0(v) {
  if (v == null) return '-';
  const n = Number(v);
  if (!Number.isFinite(n)) return '-';
  return Math.round(n).toLocaleString('en-US');
}
/* Download a table as CSV (opens straight in Excel). `rows` is an array of
   arrays — first row is the header. Values are quoted when needed and the file
   is BOM-prefixed so Excel reads UTF-8 correctly. The anchor is built in the
   PARENT document because the app runs inside Streamlit's component iframe. */
function downloadCsv(rows, filename) {
  try {
    const csv = (rows || []).map(r => (r || []).map(c => {
      const s = c == null ? '' : String(c);
      return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(',')).join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    let pdoc = document;
    try { if (window.parent && window.parent.document) pdoc = window.parent.document; } catch (e) { pdoc = document; }
    const a = pdoc.createElement('a');
    a.href = url; a.download = filename || 'export.csv'; a.style.display = 'none';
    pdoc.body.appendChild(a);
    a.click();
    setTimeout(() => { try { pdoc.body.removeChild(a); } catch (e) {} try { URL.revokeObjectURL(url); } catch (e) {} }, 1500);
    return true;
  } catch (e) { console.error('csv export failed', e); return false; }
}

// Compact, no currency symbol — for the low–high range shown next to a value
// that already carries the currency (e.g. "186k – 279k" under "AED 233k").
function fmtShort(v) {
  if (v == null) return '-';
  const n = Number(v);
  if (!Number.isFinite(n)) return '-';
  const a = Math.abs(n);
  if (a >= 1e6) return (n / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M';
  if (a >= 1e4) return Math.round(n / 1e3).toLocaleString('en-US') + 'k';
  return Math.round(n).toLocaleString('en-US');
}

// Mirror of Python's _supabase_to_records. As of the 2026-05-28 schema
// update every Excel column is stored directly in Supabase, so we just
// map column names through — no more client-side derivation.
function supabaseRowsToRecords(rows) {
  if (!rows || !rows.length) return [];
  return rows.map(r => ({
    itemCode: _txt(r.item_code),
    description: _txt(r.item_description),
    isHV: !!r.is_high_value,
    tier: _txt(r.tier),
    period: _txt(r.year_month),
    prevClosingBal: _num(r.prev_closing_bal),
    predictedClosingBal: _num(r.pred_closing_balance),
    actualClosingBal: _num(r.actual_closing_balance),
    error: _num(r.diff_actual_to_prediction),
    difference: _num(r.difference),
    predictedAction: _txt(r.pred_action),
    actualAction: _txt(r.actual_action),
    directionCorrect: r.direction_correct == null ? null : !!r.direction_correct,
    quantity: _num(r.action_quantity),
    biasCorrection: _num(r.bias_correction_applied),
    ape: _num(r.ape),
    itemMape: _num(r.item_mape),
    mapeMonths: r.months_in_mape == null ? null : Math.round(Number(r.months_in_mape)),
    forecastMode: _txt(r.forecast_mode),
    // Cost / value columns — populated only for the ~94 High-Value items;
    // NULL for everything else (_num keeps that null so the UI shows "-",
    // never 0). low/avg/high = rental rate per unit (internal, not rendered);
    // predValue* = predicted balance × the matching rate. The backend RENAMED
    // the value columns on 2026-07-14 (pred_value_low/avg/high →
    // pred_cost_min/avg/max) — read the new names first, old as fallback.
    lowCost: _num(r.low_cost),
    avgCost: _num(r.avg_cost),
    highCost: _num(r.high_cost),
    predValueLow: _num(r.pred_cost_min != null ? r.pred_cost_min : r.pred_value_low),
    predValueAvg: _num(r.pred_cost_avg != null ? r.pred_cost_avg : r.pred_value_avg),
    predValueHigh: _num(r.pred_cost_max != null ? r.pred_cost_max : r.pred_value_high),
  }));
}

function synthMapeSummary(rows, runMeta) {
  if (!rows || !rows.length) return [];
  const byPeriod = {};
  for (const r of rows) {
    const p = r.year_month;
    if (!byPeriod[p]) byPeriod[p] = { period: p, allMape: [], hvMape: [], items: 0, deliver: 0, ret: 0, mode: r.forecast_mode };
    byPeriod[p].items += 1;
    // Schema as of 2026-05-28: per-row APE lives in column `ape`.
    if (r.ape != null) {
      byPeriod[p].allMape.push(r.ape);
      if (r.is_high_value === 1) byPeriod[p].hvMape.push(r.ape);
    }
    if (r.pred_action === 'Deliver') byPeriod[p].deliver += 1;
    else if (r.pred_action === 'Return') byPeriod[p].ret += 1;
  }
  const tierLabel = (runMeta && runMeta.forecast_mode) || 'Monthly';
  const avg = a => a.reduce((s, x) => s + x, 0) / a.length;
  return Object.values(byPeriod).map(b => ({
    period: b.period,
    model: 'Monthly',
    mapeAll: b.allMape.length ? avg(b.allMape) : null,
    mapeHV: b.hvMape.length ? avg(b.hvMape) : null,
    itemsPredicted: b.items,
    itemsDeliver: b.deliver,
    itemsReturn: b.ret,
    tier: b.mode || tierLabel,
  })).sort((a, b) => a.period.localeCompare(b.period));
}

function formatYearLabel(yearMeta) {
  if (!yearMeta) return 'Supabase';
  const bits = [`Forecast ${yearMeta.year}`];
  if (yearMeta.period_count) bits.push(`${yearMeta.period_count} mo`);
  const modes = Array.isArray(yearMeta.modes) ? [...new Set(yearMeta.modes)] : [];
  if (modes.length) bits.push(modes.sort().join('/'));
  return 'Supabase · ' + bits.join(' · ');
}

function formatSourceLabel(runMeta) {
  if (!runMeta) return 'Supabase';
  const ts = String(runMeta.run_timestamp || '').slice(0, 16).replace('T', ' ');
  const bits = [`Run #${runMeta.id}`];
  if (runMeta.predict_year) bits.push(String(runMeta.predict_year));
  if (runMeta.forecast_mode) bits.push(runMeta.forecast_mode);
  if (ts) bits.push(ts);
  return 'Supabase · ' + bits.join(' · ');
}

/* localStorage cache for years list + per-year predictions. Stale-while-
   revalidate: serve cached values instantly on mount, then refresh in the
   background so the next interaction has fresh data. The cache key includes
   the supabase project URL so swapping creds doesn't read the wrong cache.
   CACHE_NS bumped to v2 when the schema flipped from per-run to per-year
   (and per-row stored columns replaced client-side derivations). */
const CACHE_NS = 'fi.v4';
function _cacheKey(suffix) {
  const url = window.__SUPABASE_URL || 'noenv';
  return `${CACHE_NS}|${url}|${suffix}`;
}
function readCache(suffix) {
  try {
    const raw = localStorage.getItem(_cacheKey(suffix));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) { return null; }
}
function writeCache(suffix, value) {
  try {
    localStorage.setItem(_cacheKey(suffix), JSON.stringify({ ts: Date.now(), value }));
  } catch (e) { /* quota / private mode — ignore */ }
}

// Roll up raw forecast_runs rows into one entry per predict_year so the
// sidebar picker shows "2025 / 2026 / ..." instead of individual runs.
function summariseYears(runs, predictionsByYear) {
  const byYear = {};
  for (const r of runs || []) {
    const y = r.predict_year;
    if (y == null) continue;
    const yi = Number(y);
    if (!byYear[yi]) {
      byYear[yi] = {
        year: yi, run_ids: [], modes: [],
        total_items: 0, hv_item_count: 0,
        avg_mape: null, latest_ts: '', training_years: '',
      };
    }
    const slot = byYear[yi];
    slot.run_ids.push(Number(r.id));
    if (r.forecast_mode) slot.modes.push(r.forecast_mode);
    const ti = Number(r.total_items || 0);
    if (ti > slot.total_items) {
      slot.total_items = ti;
      slot.hv_item_count = Number(r.hv_item_count || 0);
      slot.training_years = r.training_years || '';
    }
    const ts = String(r.run_timestamp || '');
    if (ts > slot.latest_ts) slot.latest_ts = ts;
    if (r.avg_mape != null) slot.avg_mape = Number(r.avg_mape);
  }
  if (predictionsByYear) {
    for (const y in predictionsByYear) {
      if (!byYear[y]) continue;
      const periods = [...new Set((predictionsByYear[y] || []).map(p => p.year_month))].sort();
      byYear[y].period_count = periods.length;
      byYear[y].periods = periods;
      byYear[y].row_count = (predictionsByYear[y] || []).length;
    }
  }
  return Object.values(byYear).sort((a, b) => b.year - a.year);
}

function useSupabaseData() {
  // Initial state hydrated from server-rendered values for fast first paint.
  // If the server didn't provide data (cold deploy, no secrets), fall back
  // to whatever we cached in localStorage from the previous visit.  The
  // "all" cache key holds the merged dataset (year picker is gone).
  const cachedAllBlob = React.useRef(readCache('all')).current;
  const initRecords   = (window.__RAW_DATA && window.__RAW_DATA.length) ? window.__RAW_DATA : (cachedAllBlob?.value?.records || []);
  const initMape      = (window.__MAPE_SUMMARY && window.__MAPE_SUMMARY.length) ? window.__MAPE_SUMMARY : (cachedAllBlob?.value?.mapeSummary || []);
  const initLabel     = window.__SOURCE_LABEL || cachedAllBlob?.value?.sourceLabel || '';
  // Years list left as an empty array — the picker is hidden — but kept
  // in the hook's return shape so old call sites don't trip.
  const initYears = [];
  const initYear  = null;

  const [years, setYears] = useState(initYears);
  const [currentYear, setCurrentYear] = useState(initYear);
  const [records, setRecords] = useState(initRecords);
  const [mapeSummary, setMapeSummary] = useState(initMape);
  const [sourceLabel, setSourceLabel] = useState(initLabel);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Lazy-create the supabase-js client. Returns null if creds aren't set
  // (we'll just keep the server-rendered data in that case).
  const client = React.useMemo(() => {
    const url = window.__SUPABASE_URL;
    const key = window.__SUPABASE_KEY;
    if (!url || !key || !window.supabase) return null;
    try { return window.supabase.createClient(url, key); }
    catch (e) { console.error('supabase client init failed', e); return null; }
  }, []);

  // Paginated fetch for one year's predictions — gathers every row from
  // every run that touches the year. Backtest + Future runs union into a
  // single continuous view via the per-row forecast_mode column.
  // (Still used by switchYear() for back-compat, but the picker that
  // surfaced it is hidden now — the dashboard merges all years.)
  const fetchPredictionsForYear = React.useCallback(async (year) => {
    const all = [];
    let offset = 0;
    const PAGE = 1000;
    const lo = `${year}-01`;
    const hi = `${year}-12`;
    while (true) {
      const { data, error: err } = await client
        .from('forecast_predictions')
        .select('*')
        .gte('year_month', lo)
        .lte('year_month', hi)
        .order('year_month')
        .range(offset, offset + PAGE - 1);
      if (err) throw err;
      if (!data || !data.length) break;
      all.push(...data);
      if (data.length < PAGE) break;
      offset += PAGE;
    }
    return all;
  }, [client]);

  // Paginated fetch for EVERY prediction across every run. The dashboard
  // renders all years as one continuous view; per-row forecast_mode
  // distinguishes Backtest from Future.
  const fetchAllPredictions = React.useCallback(async () => {
    const all = [];
    let offset = 0;
    const PAGE = 1000;
    while (true) {
      const { data, error: err } = await client
        .from('forecast_predictions')
        .select('*')
        .order('year_month')
        .range(offset, offset + PAGE - 1);
      if (err) throw err;
      if (!data || !data.length) break;
      all.push(...data);
      if (data.length < PAGE) break;
      offset += PAGE;
    }
    return all;
  }, [client]);

  const switchYear = React.useCallback(async (year) => {
    if (Number(year) === Number(currentYear)) return;
    if (!client) { setError('Supabase not configured'); return; }
    setError(null);
    // Optimistic hydrate from cache so the dashboard flips instantly when
    // we've already seen this year. Background refresh keeps it fresh.
    const cached = readCache(`year|${year}`);
    if (cached?.value?.records?.length) {
      setRecords(cached.value.records);
      setMapeSummary(cached.value.mapeSummary || []);
      setSourceLabel(cached.value.sourceLabel || `Forecast ${year}`);
      setCurrentYear(Number(year));
      writeCache('currentYear', Number(year));
    } else {
      setLoading(true);
    }
    try {
      const rawRows = await fetchPredictionsForYear(year);
      const recs = supabaseRowsToRecords(rawRows);
      // Synthetic year-meta for the source label + MAPE-summary tier.
      const yearMeta = years.find(y => Number(y.year) === Number(year)) || { year: Number(year) };
      const synthMeta = { ...yearMeta, forecast_mode: (yearMeta.modes || []).sort().join('/') || null };
      const mape = synthMapeSummary(rawRows, synthMeta);
      const label = formatYearLabel({ ...yearMeta, period_count: [...new Set(rawRows.map(r => r.year_month))].length });
      setRecords(recs);
      setMapeSummary(mape);
      setSourceLabel(label);
      setCurrentYear(Number(year));
      writeCache(`year|${year}`, { records: recs, mapeSummary: mape, sourceLabel: label });
      writeCache('currentYear', Number(year));
    } catch (err) {
      console.error('switch year failed', err);
      if (!cached?.value?.records?.length) {
        setError(`Failed to load ${year}: ${err.message || 'unknown error'}`);
      }
    } finally {
      setLoading(false);
    }
  }, [client, currentYear, years, fetchPredictionsForYear]);

  // Back-compat shim: old call sites still call switchRun(runId). Translate
  // to the year that run belongs to and switch by year. Avoids breakage if
  // any cached sidebar code in localStorage tries the old API.
  const switchRun = React.useCallback((runId) => {
    const run = (window.__RUNS_LIST || []).find(r => Number(r.id) === Number(runId));
    if (run?.predict_year != null) switchYear(Number(run.predict_year));
  }, [switchYear]);

  // Background refresh on mount: re-fetch every prediction row across
  // every run so the dashboard stays accurate after a stale hydrate.
  // Runs once per session.  (Year picker is hidden; we always show all.)
  React.useEffect(() => {
    if (!client) return;
    let cancelled = false;
    (async () => {
      try {
        const { data: freshRuns, error: rErr } = await client
          .from('forecast_runs').select('*').order('run_timestamp', { ascending: false });
        if (rErr) throw rErr;
        if (cancelled) return;
        const rawRows = await fetchAllPredictions();
        if (cancelled) return;
        const periods = [...new Set(rawRows.map(r => r.year_month))].sort();
        const modes = [...new Set(rawRows.map(r => r.forecast_mode).filter(Boolean))].sort();
        const synthMeta = { forecast_mode: modes.join('/') || null };
        const recs = supabaseRowsToRecords(rawRows);
        const mape = synthMapeSummary(rawRows, synthMeta);
        const bits = ['All forecasts'];
        if (periods.length) bits.push(`${periods.length} mo`);
        if (modes.length) bits.push(modes.join('/'));
        const label = 'Supabase · ' + bits.join(' · ');
        setRecords(recs);
        setMapeSummary(mape);
        setSourceLabel(label);
        setYears([]);
        setCurrentYear(null);
        writeCache('all', { records: recs, mapeSummary: mape, sourceLabel: label });
      } catch (err) {
        console.warn('background refresh failed', err);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client]);

  // When Streamlit reruns (Excel upload, login, reset), pull fresh values
  // from the injected globals AND mirror them into localStorage so the
  // next page-load can hydrate from cache instantly.
  useEffect(() => {
    const handler = () => {
      const recs = window.__RAW_DATA || [];
      const mape = window.__MAPE_SUMMARY || [];
      const lbl  = window.__SOURCE_LABEL || '';
      setRecords(recs);
      setMapeSummary(mape);
      setYears([]);
      setCurrentYear(null);
      setSourceLabel(lbl);
      if (recs.length) writeCache('all', { records: recs, mapeSummary: mape, sourceLabel: lbl });
    };
    window.addEventListener('dataready', handler);
    return () => window.removeEventListener('dataready', handler);
  }, []);

  return { records, mapeSummary, years, currentYear, switchYear, switchRun, loading, error, sourceLabel };
}

/* ============================================================
   SearchBox — reusable typeahead used by Line Items, Item Explorer
   and Item Forecasts. Behaviour the user asked for:
     • Type a partial word → a dropdown of matching items appears.
     • Mouse-click a row, or ↑/↓ + Enter → filter to THAT one item
       (exact match on item code, so prefix-sharing codes like
       ABJ / ABJ-G / ABJ-BLCK don't bleed into each other).
     • Type freely + Enter (no row highlighted) → keep the keyword,
       close the dropdown, show ALL substring matches.
     • Clearing the box (×) resets both the text and the exact pick.

   Contract:
     value      current text (string)
     onType     (text) => void          — typing; caller should clear its exact pick
     onPick     (option) => void         — a specific suggestion was chosen
     onClear    () => void               — the × button / empty box
     options    [{ label, sub, code, isHV }]  candidate items to suggest
     placeholder, width (flex basis string), maxItems (default 8)
   ============================================================ */
function SearchBox({ value, onType, onPick, onClear, options, placeholder, width, maxItems }) {
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(-1);
  const ref = React.useRef(null);
  // No cap — show every match (the dropdown scrolls). A cap silently hid most
  // of a family (e.g. searching "s150" dropped the 3m / 4m variants). A caller
  // can still pass maxItems explicitly, but by default it's unlimited.
  const cap = maxItems || Infinity;

  const suggestions = React.useMemo(() => {
    if (!value || !value.trim()) return [];
    const s = value.trim().toLowerCase();
    const seen = new Set();
    const out = [];
    for (const o of (options || [])) {
      if (out.length >= cap) break;
      const hay = ((o.label || '') + ' ' + (o.sub || '')).toLowerCase();
      if (!hay.includes(s)) continue;
      const k = (o.code != null ? String(o.code) : (o.label || '') + '|' + (o.sub || ''));
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(o);
    }
    return out;
  }, [options, value, cap]);

  React.useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const pick = (opt) => {
    if (onPick) onPick(opt);
    else if (onType) onType(opt.label);
    setOpen(false);
    setActive(-1);
  };

  const keyDown = (e) => {
    if (e.key === 'ArrowDown') {
      if (!open || !suggestions.length) return;
      e.preventDefault(); setActive(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      if (!open || !suggestions.length) return;
      e.preventDefault(); setActive(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (open && active >= 0 && suggestions[active]) pick(suggestions[active]);
      else { setOpen(false); setActive(-1); e.target.blur(); }
    } else if (e.key === 'Escape') {
      setOpen(false); setActive(-1);
    }
  };

  return (
    <div ref={ref} style={{ position: 'relative', flex: width || '0 0 300px' }}>
      <input
        value={value}
        onChange={e => { if (onType) onType(e.target.value); setOpen(true); setActive(-1); }}
        onFocus={e => { e.target.style.borderColor = 'var(--accent)'; setOpen(true); }}
        onBlur={e => e.target.style.borderColor = 'var(--border)'}
        onKeyDown={keyDown}
        placeholder={placeholder || 'Search…'}
        autoComplete="off"
        style={{ width: '100%', padding: '7px 30px 7px 32px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, fontFamily: 'var(--font)', color: 'var(--text)', outline: 'none', background: '#fff', boxSizing: 'border-box' }}
      />
      <svg style={{ position: 'absolute', left: 11, top: 9, pointerEvents: 'none' }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-2)" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.3-4.3"></path></svg>
      {value && (
        <button aria-label="Clear search" onMouseDown={e => { e.preventDefault(); if (onClear) onClear(); else if (onType) onType(''); setOpen(false); setActive(-1); }}
          style={{ position: 'absolute', right: 6, top: 5, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-2)', fontSize: 16, lineHeight: 1, padding: '3px 5px', borderRadius: 5, transition: 'background .12s, color .12s' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--hover)'; e.currentTarget.style.color = 'var(--text)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-2)'; }}>×</button>
      )}
      {/* Explicit empty-state so the user knows the search ran and found nothing. */}
      {open && value && value.trim() && suggestions.length === 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: '#fff', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,.10)', zIndex: 60, padding: '10px 12px', fontSize: 12, color: 'var(--text-2)' }}>
          No items match “{value.trim()}”
        </div>
      )}
      {open && suggestions.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: '#fff', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,.10)', zIndex: 60, overflow: 'hidden', maxHeight: 320, overflowY: 'auto' }}>
          {suggestions.map((s, i) => (
            <div key={s.code != null ? s.code : i}
              onMouseDown={e => { e.preventDefault(); pick(s); }}
              onMouseEnter={() => setActive(i)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', cursor: 'pointer', background: active === i ? 'var(--accent-surface, #EEF2FF)' : '#fff', borderBottom: i < suggestions.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
              {s.isHV && <span style={{ fontSize: 10, color: 'var(--accent)', flexShrink: 0 }}>★</span>}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.label}</div>
                {s.sub && <div style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>{s.sub}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Re-exported on window so other inlined files can use them without
// caring about module ordering. (Babel-standalone compiles each
// <script type="text/babel"> in isolation, so top-level names aren't
// shared across scripts.)
Object.assign(window, {
  supabaseRowsToRecords, synthMapeSummary, formatYearLabel, formatSourceLabel,
  summariseYears, useSupabaseData,
  readCache, writeCache,
  classifyAction, fcAction, fcBal, fcQty,
  fmtMoney, fmtMoneyShort, fmtNum0, fmtShort, CURRENCY, DirhamSign, downloadCsv,
  SearchBox,
});
