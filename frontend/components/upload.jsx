/* Upload Data page */

function UploadDataPage({ onOpenDataSource }) {
  const sourceLabel = (typeof window !== 'undefined' && window.__SOURCE_LABEL) || 'Bundled · Re_Forecast_2026_JanFeb_train24_25.xlsx';
  const job = (typeof window !== 'undefined' && window.__UPLOAD_JOB) || null;
  const hasJob = !!(job && job.job_id);
  const [mode, setMode] = React.useState('consolidate');

  return (
    <div style={{ maxWidth: 700 }}>
      <div style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 4 }}>Upload Data</h2>
        <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>
          Two steps. <strong>Merge &amp; Download</strong> combines the separate company files into one ledger you can download. <strong>Upload &amp; Forecast</strong> takes that single file and runs the forecast.
        </div>
      </div>

      {/* A forecast job in flight takes over the whole area; otherwise a toggle
          picks the tab — Merge & Download (multi-file → one file) vs Upload &
          Forecast (single file → forecast). */}
      {hasJob ? (
        <LedgerUpdateCard />
      ) : (
        <React.Fragment>
          <LatestRunStatus />
          <div style={{ display: 'inline-flex', gap: 3, padding: 4, background: 'var(--surface-2,#F3F4F7)', borderRadius: 10, marginBottom: 18 }}>
            {[['consolidate', 'Merge & Download'], ['single', 'Upload & Forecast']].map(([m, label]) => (
              <button key={m} onClick={() => setMode(m)} style={{
                padding: '8px 16px', fontSize: 12.5, fontWeight: mode === m ? 700 : 600, border: 'none', borderRadius: 7, cursor: 'pointer', fontFamily: 'var(--font)',
                background: mode === m ? '#fff' : 'transparent', color: mode === m ? 'var(--accent)' : 'var(--text-2)',
                boxShadow: mode === m ? '0 1px 3px rgba(0,0,0,.08)' : 'none', transition: 'all .12s',
              }}>{label}</button>
            ))}
          </div>
          {mode === 'consolidate' ? <MergeDownloadCard /> : <LedgerUpdateCard />}
        </React.Fragment>
      )}

      <UploadHistory />

      {/* Current source info */}
      <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(79,70,229,.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>Active Source</div>
          <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sourceLabel}</div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>Loaded: {new Date().toLocaleDateString()}</div>
        </div>
        <button onClick={() => window.__resetToBundled && window.__resetToBundled()} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #CBD0D8', background: '#fff', color: 'var(--text)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)', transition: 'background .12s, border-color .12s' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--hover)'; e.currentTarget.style.borderColor = 'var(--text-3)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#CBD0D8'; }}>Reset to Bundled</button>
      </div>

    </div>
  );
}

function DropZone() {
  const [dragOver, setDragOver] = React.useState(false);
  const [file, setFile] = React.useState(null);
  const [status, setStatus] = React.useState(null); // null | 'uploading' | 'done' | 'error'
  const [errorMsg, setErrorMsg] = React.useState('');
  const fileRef = React.useRef(null);

  const handleFile = (f) => {
    if (!f) return;
    const ok = /\.(xlsx|xls|csv)$/i.test(f.name);
    if (!ok) { setStatus('error'); setErrorMsg('Only .xlsx, .xls or .csv files are accepted.'); return; }
    if (f.size > 200 * 1024 * 1024) { setStatus('error'); setErrorMsg('File exceeds 200MB limit.'); return; }
    setFile(f);
    setStatus(null);
    setErrorMsg('');
  };

  const apply = async () => {
    if (!file) return;
    setStatus('uploading');
    setErrorMsg('');
    try {
      const parentDoc = window.parent.document;
      const input = parentDoc.querySelector('[data-testid="stFileUploaderDropzoneInput"]')
        || parentDoc.querySelector('[data-testid="stFileUploader"] input[type="file"]')
        || parentDoc.querySelector('input[type="file"]');
      if (!input) {
        throw new Error('Host uploader not found. Use the toolbar uploader at the top of the page.');
      }
      const dt = new DataTransfer();
      dt.items.add(file);
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'files').set;
      setter.call(input, dt.files);
      input.dispatchEvent(new Event('change', { bubbles: true }));
      setStatus('done');
    } catch (err) {
      console.error(err);
      setStatus('error');
      setErrorMsg(err.message || String(err));
    }
  };

  const clear = () => { setFile(null); setStatus(null); setErrorMsg(''); if (fileRef.current) fileRef.current.value = ''; };

  return (
    <div>
      <div onClick={() => fileRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); }}
        style={{
          border: `2px dashed ${dragOver ? 'var(--accent)' : '#C4C9D2'}`,
          borderRadius: 12, padding: '28px 20px', textAlign: 'center', cursor: 'pointer',
          background: dragOver ? 'rgba(79,70,229,.04)' : '#FAFBFC',
          transition: 'all .15s',
        }}>
        <input type="file" ref={fileRef} accept=".xlsx,.xls,.csv" style={{ display: 'none' }}
          onChange={e => { if (e.target.files[0]) handleFile(e.target.files[0]); }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={dragOver ? 'var(--accent)' : 'var(--text-2)'} strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
          <div>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Click to browse, or drag and drop</span>
            <span style={{ fontSize: 12, color: 'var(--text-3)', marginLeft: 8 }}>200MB per file · CSV, XLSX, XLS</span>
          </div>
        </div>
      </div>

      {file && status !== 'error' && (
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'rgba(5,150,105,.06)', borderRadius: 8, border: '1px solid rgba(5,150,105,.15)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#059669', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{Math.round(file.size / 1024)} KB</span>
          {status === null && (
            <>
              <button onClick={clear} style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)', background: '#fff', color: 'var(--text-2)', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>Cancel</button>
              <button onClick={apply} style={{ padding: '5px 14px', borderRadius: 6, border: 'none', background: '#059669', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>Apply</button>
            </>
          )}
          {status === 'uploading' && <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Uploading…</span>}
          {status === 'done' && <span style={{ fontSize: 11, fontWeight: 600, color: '#059669' }}>Applied · refreshing dashboard</span>}
        </div>
      )}

      {status === 'error' && (
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'rgba(220,38,38,.06)', borderRadius: 8, border: '1px solid rgba(220,38,38,.18)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#DC2626', flex: 1 }}>{errorMsg}</span>
          <button onClick={clear} style={{ padding: '5px 14px', borderRadius: 6, border: 'none', background: '#DC2626', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>Dismiss</button>
        </div>
      )}
    </div>
  );
}

/* ---- Live pipeline progress (Sonu's step-by-step + validation view) -------
   While a job is in flight we poll Supabase directly from the browser:
     pipeline_jobs   (by job_id)     -> phase/status/current_step/error
     validation_runs (by year_month) -> each validation check + hard stop
   Polling client-side means the panel updates smoothly with no iframe reload
   during the 12-18 min wait. */

function PhIcon({ s, sm, big }) {
  const sz = big ? 22 : sm ? 15 : 18;
  const ring = { width: sz, height: sz, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxSizing: 'border-box' };
  if (s === 'running') return (<svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.6" strokeLinecap="round" style={{ animation: 'fi-spin .8s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.22-8.56"></path></svg>);
  if (s === 'pass') return (<span style={{ ...ring, background: '#059669' }}><svg width={Math.round(sz * 0.6)} height={Math.round(sz * 0.6)} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></span>);
  if (s === 'fail') return (<span style={{ ...ring, background: '#DC2626' }}><svg width={Math.round(sz * 0.52)} height={Math.round(sz * 0.52)} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.6" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></span>);
  if (s === 'warn') return (<span style={{ ...ring, background: '#D97706' }}><svg width={Math.round(sz * 0.5)} height={Math.round(sz * 0.5)} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round"><line x1="12" y1="6" x2="12" y2="13"></line><line x1="12" y1="17.5" x2="12" y2="17.5"></line></svg></span>);
  if (s === 'skip') return (<span style={{ ...ring, background: '#E5E7EB' }}><svg width={Math.round(sz * 0.5)} height={Math.round(sz * 0.5)} viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="3" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg></span>);
  return (<span style={{ ...ring, border: '2px solid #D1D5DB' }}></span>);
}

function CheckRow({ c }) {
  // The pipeline emits PASS / WARNING / FAIL. WARNING = non-blocking (auto-fixed
  // or flagged for review) — the run still succeeds, so show it amber, not red.
  const s = String(c.status || '').toUpperCase();
  const kind = s === 'PASS' ? 'pass' : s === 'FAIL' ? 'fail' : 'warn';
  const nameColor = kind === 'fail' ? '#B91C1C' : kind === 'warn' ? '#92400E' : 'var(--text)';
  const tagColor = kind === 'fail' ? '#DC2626' : kind === 'warn' ? '#B45309' : '#059669';
  const tag = kind === 'fail' ? 'FAIL' : kind === 'warn' ? 'WARNING' : 'PASS';
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 9, alignItems: 'flex-start' }}>
      <div style={{ marginTop: 1 }}><PhIcon s={kind} sm /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: nameColor }}>
          {c.name}
          <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 800, letterSpacing: '.04em', color: tagColor }}>{tag}</span>
        </div>
        {c.message && <div style={{ fontSize: 11.5, color: 'var(--text-2)', marginTop: 1, lineHeight: 1.45 }}>{c.message}</div>}
      </div>
    </div>
  );
}

function PhaseRow({ s, title, detail, children }) {
  const muted = s === 'pending' || s === 'skip';
  return (
    <div style={{ display: 'flex', gap: 12, padding: '7px 0' }}>
      <div style={{ marginTop: 1 }}><PhIcon s={s} /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: muted ? 'var(--text-3)' : 'var(--text)' }}>{title}</div>
        {detail && <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 1, lineHeight: 1.5 }}>{detail}</div>}
        {children}
      </div>
    </div>
  );
}

/* Download a base64 payload as a file. The React app runs inside Streamlit's
   component iframe; we build the anchor in the PARENT document (same-origin)
   and click it there so the download isn't swallowed by the frame sandbox. */
function downloadBase64File(b64, name, mime) {
  try {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const blob = new Blob([bytes], { type: mime || 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    let pdoc = document;
    try { if (window.parent && window.parent.document) pdoc = window.parent.document; } catch (e) { pdoc = document; }
    const a = pdoc.createElement('a');
    a.href = url; a.download = name || 'download.xlsx'; a.style.display = 'none';
    pdoc.body.appendChild(a);
    a.click();
    setTimeout(() => { try { pdoc.body.removeChild(a); } catch (e) {} try { URL.revokeObjectURL(url); } catch (e) {} }, 1500);
    return true;
  } catch (e) { console.error('download failed', e); return false; }
}

/* Shared merge summary — the white card listing the company files detected,
   per-file row counts, item-map fill stats, unmapped names and warnings.
   Used by the Tab 1 "Merge & Download" result card. */
function MergeSummary({ mr }) {
  if (!mr) return null;
  const files = mr.files || [];
  const companies = mr.companies_detected || [];
  const unmapped = mr.item_names_not_in_map || [];
  const warnings = mr.warnings || [];
  return (
    <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 10, padding: '11px 16px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ width: 22, height: 22, borderRadius: 6, background: 'var(--accent-surface)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
        </span>
        <div style={{ fontSize: 12.5, fontWeight: 700, flex: 1, minWidth: 0 }}>Merged {files.length || companies.length || 0} file{(files.length === 1) ? '' : 's'}</div>
        {mr.total_rows_merged != null && <span style={{ fontSize: 11.5, fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--accent)' }}>{Number(mr.total_rows_merged).toLocaleString()} rows</span>}
      </div>
      {companies.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {companies.map((c, i) => (
            <span key={i} style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-surface)', border: '1px solid var(--accent-border)', padding: '2px 9px', borderRadius: 10, letterSpacing: '.02em' }}>{c}</span>
          ))}
        </div>
      )}
      {files.map((f, i) => {
        const s = String(f.status || '').toLowerCase();
        const ok = s === 'ok' || s === 'merged' || s === 'success' || s.indexOf('ok') === 0;
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderTop: i ? '1px solid #F3F4F6' : 'none' }}>
            <span style={{ flex: 1, minWidth: 0, fontSize: 11.5, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={f.filename}>{f.filename}</span>
            {f.company && <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-2)', fontFamily: 'var(--mono)' }}>{f.company}</span>}
            {f.rows != null && <span style={{ fontSize: 10.5, color: 'var(--text-3)', fontFamily: 'var(--mono)', minWidth: 56, textAlign: 'right' }}>{Number(f.rows).toLocaleString()} rows</span>}
            {f.status && <span style={{ fontSize: 9.5, fontWeight: 700, color: ok ? '#059669' : '#B45309', background: ok ? 'rgba(5,150,105,.1)' : 'rgba(217,119,6,.12)', padding: '1px 7px', borderRadius: 9, whiteSpace: 'nowrap' }}>{f.status}</span>}
          </div>
        );
      })}
      {(mr.item_codes_filled != null || mr.reference_map_items != null) && (
        <div style={{ marginTop: 8, fontSize: 10.5, color: 'var(--text-3)', display: 'flex', flexWrap: 'wrap', gap: '2px 14px' }}>
          {mr.item_codes_filled != null && <span>{Number(mr.item_codes_filled).toLocaleString()} item codes filled from the map</span>}
          {mr.reference_map_items != null && <span>{Number(mr.reference_map_items).toLocaleString()} items in reference map</span>}
        </div>
      )}
      {unmapped.length > 0 && (
        <div style={{ marginTop: 8, fontSize: 11, color: '#92400E', background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.22)', borderRadius: 7, padding: '7px 10px', lineHeight: 1.45 }}>
          {unmapped.length} item name{unmapped.length === 1 ? '' : 's'} weren't in the code map (code left blank): {unmapped.slice(0, 8).join(', ')}{unmapped.length > 8 ? ` +${unmapped.length - 8} more` : ''}
        </div>
      )}
      {warnings.length > 0 && (
        <div style={{ marginTop: 8, fontSize: 11, color: '#92400E', background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.22)', borderRadius: 7, padding: '7px 10px', lineHeight: 1.45 }}>
          {warnings.map((w, i) => <div key={i}>{typeof w === 'string' ? w : (w.message || JSON.stringify(w))}</div>)}
        </div>
      )}
    </div>
  );
}

function JobProgress({ job, onDismiss, onDone }) {
  const [jobRow, setJobRow] = React.useState(null);
  const [val, setVal] = React.useState(null);
  const firedDone = React.useRef(false);
  const attempts = React.useRef(0);

  React.useEffect(() => {
    let alive = true, timer = null;
    const base = window.__SUPABASE_URL, key = window.__SUPABASE_KEY;
    const get = async (path) => {
      if (!base || !key) return null;
      try {
        const r = await fetch(base + '/rest/v1/' + path, { headers: { apikey: key, Authorization: 'Bearer ' + key } });
        if (!r.ok) return null;
        return await r.json();
      } catch (e) { return null; }
    };
    const poll = async () => {
      attempts.current += 1;
      let jr = null;
      if (job.job_id) {
        const rows = await get('pipeline_jobs?select=*&limit=1&job_id=eq.' + encodeURIComponent(job.job_id));
        jr = (rows && rows[0]) || null;
      }
      const ym = (jr && jr.year_month) || job.year_month;
      // Match THIS upload's validation run (the same month can have many):
      // year_month within a short window of when the job started. Anchor on
      // the pipeline_jobs row if present, else the upload time we recorded —
      // a validation row can exist even when the job row doesn't (early fail).
      const anchor = (jr && jr.created_at) || job.started_iso;
      let vr = null;
      if (ym && anchor) {
        const lower = new Date(new Date(anchor).getTime() - 120000).toISOString();
        const rows = await get('validation_runs?select=*&order=upload_timestamp.desc&limit=1&year_month=eq.' + encodeURIComponent(ym) + '&upload_timestamp=gte.' + encodeURIComponent(lower));
        vr = (rows && rows[0]) || null;
      }
      if (!alive) return;
      if (jr) setJobRow(jr);
      if (vr) setVal(vr);
      const vFail = vr && String(vr.overall_result || '').toUpperCase() === 'FAIL';
      const jStatus = (jr && jr.status) || job.status;
      const isDone = jStatus === 'complete';
      const isFail = jStatus === 'failed' || vFail;
      if (isDone && job.status !== 'complete' && !firedDone.current) {
        firedDone.current = true;
        try { onDone && onDone(); } catch (e) { /* noop */ }
      }
      // Keep polling until the outcome is known — a validation hard stop can
      // write a validation_runs FAIL row with no pipeline_jobs row, so don't
      // gate on job status alone. Capped so it never spins forever (~26 min).
      if (!isDone && !isFail && attempts.current < 400) timer = setTimeout(poll, 4000);
    };
    poll();
    return () => { alive = false; if (timer) clearTimeout(timer); };
  }, [job.job_id]);

  const status = (jobRow && jobRow.status) || job.status || 'queued';
  const ym = (jobRow && jobRow.year_month) || job.year_month;
  const checksRaw = (val && val.checks_summary) || [];
  const checks = checksRaw.slice().sort((a, b) => (a.check_id || 0) - (b.check_id || 0));
  const overall = val && String(val.overall_result || '').toUpperCase();
  // The pipeline marks non-blocking checks WARNING and the run PASS_WITH_WARNINGS
  // — anything starting with PASS is a success, not a failure.
  const overallPass = !!overall && overall.indexOf('PASS') === 0;
  const passCount = checks.filter(c => String(c.status || '').toUpperCase() === 'PASS').length;
  const warnCount = checks.filter(c => { const s = String(c.status || '').toUpperCase(); return s !== 'PASS' && s !== 'FAIL'; }).length;
  const autofixes = (val && val.auto_fixes_applied) || [];
  const hardStopReason = val && val.hard_stop_reason;
  const hardStop = hardStopReason || (status === 'failed' ? ((jobRow && jobRow.error_message) || job.error_message) : null);
  const frId = jobRow && jobRow.forecast_run_id;
  const step = (jobRow && jobRow.current_step) || job.current_step;
  const failed = status === 'failed' || overall === 'FAIL';
  const done = status === 'complete';

  // The pipeline doesn't always write a validation_runs row on success — but
  // it does keep pipeline_jobs.current_step updated. Infer which stage the
  // run is in from that text so the phases advance live either way.
  const t = String(step || '').toLowerCase();
  const stage = !t ? null
    : /done|saved|complete|writ|insert|database|supabase/.test(t) ? 'save'
    : /sav/.test(t) ? 'save'
    : /train|model|forecast|generat|predict|season/.test(t) ? 'forecast'
    : /valid|pars|read|check|load|struct/.test(t) ? 'validate'
    : null;

  const valPassed = overallPass || done || !!frId || stage === 'forecast' || stage === 'save';
  const phUpload = 'pass';
  const phVal = overall === 'FAIL' ? 'fail'
    : valPassed ? 'pass'
    : failed ? 'fail'
    : 'running';
  const phFore = overall === 'FAIL' ? 'skip'
    : (done || !!frId || stage === 'save') ? 'pass'
    : failed ? (valPassed ? 'fail' : 'skip')
    : valPassed ? 'running'
    : 'pending';
  const phSave = done ? 'pass'
    : failed ? 'skip'
    : (phFore === 'pass' && stage === 'save') ? 'running'
    : 'pending';

  const tone = done ? '#047857' : failed ? '#B91C1C' : 'var(--accent)';
  const wrap = {
    border: '1px solid',
    borderColor: done ? 'rgba(5,150,105,.28)' : failed ? 'rgba(220,38,38,.26)' : 'var(--accent-border)',
    background: done ? 'rgba(5,150,105,.04)' : failed ? 'rgba(220,38,38,.035)' : 'var(--accent-surface)',
    borderRadius: 12, padding: 22, marginBottom: 20,
  };

  const valDetail = phVal === 'running' ? ((stage === 'validate' && step) ? step : 'Running the file & data checks…')
    : phVal === 'pass' ? (warnCount > 0 ? `${passCount} passed · ${warnCount} warning${warnCount > 1 ? 's' : ''} (auto-handled)` : 'All checks passed')
    : overall === 'FAIL' ? 'Stopped on a failing check'
    : 'Did not complete';
  const foreDetail = phFore === 'running' ? ((stage === 'forecast' && step) ? step : 'Retraining the model and generating the new forecast…')
    : phFore === 'pass' ? 'Model retrained on the latest month'
    : phFore === 'fail' ? ((jobRow && jobRow.error_message) || 'The forecasting step reported an error')
    : phFore === 'skip' ? 'Not run'
    : 'Waiting for validation to pass';
  const saveClean = step ? String(step).replace(/^\s*Done\s*[—–-]\s*/i, '') : '';
  const saveDetail = phSave === 'pass' ? (saveClean || 'Predictions written to the database')
    : phSave === 'running' ? (step || 'Saving predictions…')
    : phSave === 'skip' ? 'Not run' : '—';
  // Multi-company merge summary (present only when several files were consolidated).
  const mr = job.merge_report || null;

  return (
    <div style={wrap}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <PhIcon s={done ? 'pass' : failed ? 'fail' : 'running'} big />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: tone }}>
            {done ? 'Forecasts updated' : failed ? 'Pipeline stopped' : 'Updating forecasts'}{ym ? ' · ' + ym : ''}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 1, lineHeight: 1.5 }}>
            {done ? (warnCount > 0 ? `Fresh predictions are live · ${warnCount} check${warnCount > 1 ? 's' : ''} raised warnings (auto-handled), see below.` : 'Fresh predictions are now live on the dashboard.')
              : failed ? (overall === 'FAIL' ? 'A validation check did not pass — see the details below.' : 'The pipeline reported an error — see the details below.')
              : 'Validating and retraining on the server — about 12–18 minutes. You can keep using the dashboard.'}
          </div>
        </div>
      </div>

      {mr && <div style={{ marginBottom: 12 }}><MergeSummary mr={mr} /></div>}

      <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 10, padding: '6px 16px' }}>
        <PhaseRow s={phUpload} title="Upload received" detail={'Ledger handed to the pipeline' + (ym ? ' · ' + ym : '')} />
        <PhaseRow s={phVal} title="Validation" detail={valDetail}>
          {checks.map((c, i) => <CheckRow key={i} c={c} />)}
          {autofixes.length > 0 && (
            <div style={{ marginTop: 9, fontSize: 11.5, color: '#92400E', background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.22)', borderRadius: 7, padding: '7px 10px', lineHeight: 1.45 }}>
              Auto-fixed: {autofixes.map(a => typeof a === 'string' ? a : (a.message || a.name || JSON.stringify(a))).join('; ')}
            </div>
          )}
        </PhaseRow>
        <PhaseRow s={phFore} title="Forecasting" detail={foreDetail} />
        <PhaseRow s={phSave} title="Predictions saved" detail={saveDetail} />
      </div>

      {hardStop && (
        <div style={{ marginTop: 14, padding: '12px 14px', background: 'rgba(220,38,38,.06)', border: '1px solid rgba(220,38,38,.22)', borderRadius: 9 }}>
          <div style={{ fontSize: 10.5, fontWeight: 800, color: '#B91C1C', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 3 }}>{hardStopReason ? 'Hard stop' : 'Pipeline error'}</div>
          <div style={{ fontSize: 12.5, color: '#7F1D1D', lineHeight: 1.5 }}>{hardStop}</div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
        <div style={{ flex: 1, minWidth: 0, fontSize: 11, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {job.job_id ? 'Job ' + String(job.job_id).slice(0, 8) : ''}{job.started_at ? ' · started ' + job.started_at : ''}{step && !done && !failed ? ' · ' + step : ''}
        </div>
        {(done || failed) && (
          <button onClick={onDismiss} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: done ? '#059669' : '#DC2626', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)', flexShrink: 0 }}>{done ? 'Done' : 'Dismiss'}</button>
        )}
      </div>
    </div>
  );
}

/* ---- Persistent "last upload failed" banner ------------------------------
   The live JobProgress panel only exists while a session job is in flight, so
   a failure would vanish on refresh / in a fresh session / if no one was
   watching. This reads the latest run straight from Supabase whenever the
   upload card is idle, and surfaces the pipeline's failure reason so it is
   always visible in the front end. Dismissals are remembered (localStorage)
   until a NEWER failure appears. */
function LatestRunStatus() {
  const [info, setInfo] = React.useState(null);
  const [dismissedId, setDismissedId] = React.useState(() => {
    try { return localStorage.getItem('fi_fail_dismissed') || ''; } catch (e) { return ''; }
  });

  React.useEffect(() => {
    let alive = true;
    const base = window.__SUPABASE_URL, key = window.__SUPABASE_KEY;
    if (!base || !key) return;
    const get = async (path) => {
      try {
        const r = await fetch(base + '/rest/v1/' + path, { headers: { apikey: key, Authorization: 'Bearer ' + key } });
        if (!r.ok) return null;
        return await r.json();
      } catch (e) { return null; }
    };
    (async () => {
      const [vrRows, pjRows] = await Promise.all([
        get('validation_runs?select=*&order=upload_timestamp.desc&limit=1'),
        get('pipeline_jobs?select=*&order=created_at.desc&limit=1'),
      ]);
      if (!alive) return;
      const vr = (vrRows && vrRows[0]) || null;
      const pj = (pjRows && pjRows[0]) || null;
      const vrFail = vr && String(vr.overall_result || '').toUpperCase() === 'FAIL' ? vr : null;
      const vrTime = vrFail ? new Date(vrFail.upload_timestamp).getTime() : -1;
      const pjTime = pj ? new Date(pj.created_at).getTime() : -1;
      // Show a failure only if the most recent upload event is a failure — a
      // newer successful run supersedes (and hides) an older failed one.
      if (vrFail && vrTime >= pjTime) {
        const checks = (vrFail.checks_summary || []).filter(c => String(c.status || '').toUpperCase() === 'FAIL');
        setInfo({ id: 'v' + vrFail.id, ym: vrFail.year_month, reason: vrFail.hard_stop_reason || 'Validation did not pass.', checks });
      } else if (pj && pj.status === 'failed') {
        setInfo({ id: 'j' + (pj.job_id || pj.id), ym: pj.year_month, reason: pj.error_message || 'The pipeline reported an error.', checks: [] });
      } else {
        setInfo(null);
      }
    })();
    return () => { alive = false; };
  }, []);

  if (!info || info.id === dismissedId) return null;

  const dismiss = () => {
    try { localStorage.setItem('fi_fail_dismissed', info.id); } catch (e) { /* noop */ }
    setDismissedId(info.id);
  };

  return (
    <div style={{ border: '1px solid rgba(220,38,38,.26)', background: 'rgba(220,38,38,.04)', borderRadius: 12, padding: 20, marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <PhIcon s="fail" big />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#B91C1C' }}>Last upload failed{info.ym && info.ym !== 'unknown' ? ' · ' + info.ym : ''}</div>
          <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 1, lineHeight: 1.5 }}>The most recent ledger upload did not complete. The pipeline’s reason is below.</div>
        </div>
      </div>
      <div style={{ padding: '12px 14px', background: 'rgba(220,38,38,.06)', border: '1px solid rgba(220,38,38,.22)', borderRadius: 9 }}>
        <div style={{ fontSize: 10.5, fontWeight: 800, color: '#B91C1C', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 3 }}>Reason</div>
        <div style={{ fontSize: 12.5, color: '#7F1D1D', lineHeight: 1.5 }}>{info.reason}</div>
      </div>
      {info.checks.length > 0 && (
        <div style={{ marginTop: 10, background: '#fff', border: '1px solid var(--border)', borderRadius: 10, padding: '4px 16px 12px' }}>
          {info.checks.map((c, i) => <CheckRow key={i} c={c} />)}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
        <div style={{ flex: 1, fontSize: 11, color: 'var(--text-3)', lineHeight: 1.5 }}>Fix the issue above and upload the month again, or contact the system administrator if it needs a reset.</div>
        <button onClick={dismiss} style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid #CBD0D8', background: '#fff', color: 'var(--text)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)', flexShrink: 0 }}>Dismiss</button>
      </div>
    </div>
  );
}

/* Tab 1 — Merge & Download. Upload several company ledgers (C20/C30/C50…);
   the server merges them into ONE file (no forecast). We then show the merge
   summary and a Download button for the merged file. The operator takes that
   file to Tab 2 (Upload & Forecast) to run the forecast. Files go to the
   dedicated multi-file bridge; the merge result comes back in
   window.__MERGE_RESULT. */
function MergeDownloadCard() {
  const result = (typeof window !== 'undefined' && window.__MERGE_RESULT) || null;
  const [files, setFiles] = React.useState([]);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState('');
  const [dl, setDl] = React.useState(false);
  const fileRef = React.useRef(null);

  // Reset the stored merge result (dismiss / merge a different set of files).
  const reset = () => {
    try {
      const pd = window.parent.document;
      const input = pd.querySelector('[data-testid="stFileUploaderDropzoneInput"]')
        || pd.querySelector('[data-testid="stFileUploader"] input[type="file"]')
        || pd.querySelector('input[type="file"]');
      if (!input) return;
      const dt = new DataTransfer();
      dt.items.add(new File([new Blob(['x'], { type: 'text/csv' })], '__MERGE_CLEAR__' + Date.now() + '.csv', { type: 'text/csv' }));
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'files').set;
      setter.call(input, dt.files);
      input.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (e) { /* noop */ }
  };

  // ---- Merge succeeded: show summary + Download button --------------------
  if (result && result.ok) {
    const download = () => {
      if (!result.file_b64) return;
      const ok = downloadBase64File(result.file_b64, result.file_name || 'merged_ledger.xlsx',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      if (ok) { setDl(true); setTimeout(() => setDl(false), 2500); }
    };
    return (
      <div style={{ border: '1px solid rgba(5,150,105,.28)', background: 'rgba(5,150,105,.04)', borderRadius: 12, padding: 22, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <PhIcon s="pass" big />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#047857' }}>Files merged{result.year_month ? ' · ' + result.year_month : ''}</div>
            <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 1, lineHeight: 1.5 }}>The company files were merged into one ledger. Download it below, then switch to Upload &amp; Forecast to run the forecast.</div>
          </div>
        </div>

        <MergeSummary mr={result.merge_report} />

        {result.download_error ? (
          <div style={{ marginTop: 12, padding: '11px 14px', background: 'rgba(217,119,6,.08)', border: '1px solid rgba(217,119,6,.24)', borderRadius: 9, fontSize: 12, color: '#92400E', lineHeight: 1.5 }}>{result.download_error} Please merge again.</div>
        ) : (
          <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <button onClick={download} style={{ display: 'inline-flex', alignItems: 'center', gap: 9, padding: '11px 20px', borderRadius: 9, border: 'none', background: '#059669', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)', boxShadow: '0 1px 3px rgba(5,150,105,.3)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              {dl ? 'Downloaded ✓' : 'Download merged file'}
            </button>
            <span style={{ fontSize: 11.5, color: 'var(--text-3)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={result.file_name}>{result.file_name}</span>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
          <div style={{ flex: 1, fontSize: 11.5, color: 'var(--text-2)', lineHeight: 1.5 }}>Next: open <strong style={{ color: 'var(--text)' }}>Upload &amp; Forecast</strong> above and upload this merged file to run the forecast.</div>
          <button onClick={reset} style={{ padding: '8px 15px', borderRadius: 8, border: '1px solid #CBD0D8', background: '#fff', color: 'var(--text)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)', flexShrink: 0 }}>Merge different files</button>
        </div>
      </div>
    );
  }

  // ---- Merge failed ------------------------------------------------------
  if (result && !result.ok) {
    return (
      <div style={{ border: '1px solid rgba(220,38,38,.26)', background: 'rgba(220,38,38,.04)', borderRadius: 12, padding: 22, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <PhIcon s="fail" big />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#B91C1C' }}>Merge failed</div>
            <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 1, lineHeight: 1.5 }}>The company files couldn’t be merged. The service’s reason is below.</div>
          </div>
        </div>
        <div style={{ padding: '12px 14px', background: 'rgba(220,38,38,.06)', border: '1px solid rgba(220,38,38,.22)', borderRadius: 9 }}>
          <div style={{ fontSize: 10.5, fontWeight: 800, color: '#B91C1C', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 3 }}>Reason</div>
          <div style={{ fontSize: 12.5, color: '#7F1D1D', lineHeight: 1.5 }}>{result.error}</div>
        </div>
        {result.merge_report && <div style={{ marginTop: 12 }}><MergeSummary mr={result.merge_report} /></div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
          <button onClick={reset} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)' }}>Try again</button>
        </div>
      </div>
    );
  }

  // ---- No result yet: the multi-file picker ------------------------------
  // Drop the picked files onto the dedicated multi-file uploader in the host.
  const submit = (fileList) => {
    const pd = window.parent.document;
    const input = pd.querySelector('.st-key-consolidate_bridge input[type="file"]')
      || pd.querySelector('.st-key-consolidate_bridge [data-testid="stFileUploaderDropzoneInput"]');
    if (!input) throw new Error('Merge uploader not found. Reload the page and try again.');
    const dt = new DataTransfer();
    fileList.forEach(f => dt.items.add(f));
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'files').set;
    setter.call(input, dt.files);
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };

  const addFiles = (list) => {
    const incoming = Array.from(list || []).filter(f => /\.xlsx$/i.test(f.name));
    if (!incoming.length) { setErr('Only .xlsx files are accepted.'); return; }
    for (const f of incoming) { if (f.size > 50 * 1024 * 1024) { setErr(f.name + ' exceeds the 50 MB limit.'); return; } }
    setErr('');
    setFiles(prev => {
      const seen = new Set(prev.map(f => f.name + '|' + f.size));
      const out = prev.slice();
      incoming.forEach(f => { const k = f.name + '|' + f.size; if (!seen.has(k)) { seen.add(k); out.push(f); } });
      return out;
    });
  };
  const removeAt = (i) => setFiles(prev => prev.filter((_, k) => k !== i));

  const start = () => {
    if (!files.length) return;
    setBusy(true); setErr('');
    try { submit(files); }
    catch (e) { setBusy(false); setErr(e.message || String(e)); }
  };

  const wrap = { background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: 24, marginBottom: 20 };
  return (
    <div style={wrap}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ width: 24, height: 24, borderRadius: 7, background: 'var(--accent-surface)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
        </span>
        <div style={{ fontSize: 15, fontWeight: 800 }}>Merge company ledgers</div>
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginBottom: 16, lineHeight: 1.6 }}>
        Add the separate company ledger files (e.g. C20, C30, C50). The server detects each company and merges them into one file. You’ll get a summary and a download link — no forecast runs here.
      </div>
      <div onClick={() => fileRef.current && fileRef.current.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
        style={{ border: '2px dashed #C4C9D2', borderRadius: 12, padding: '22px 20px', textAlign: 'center', cursor: 'pointer', background: '#FAFBFC' }}>
        <input type="file" ref={fileRef} accept=".xlsx" multiple style={{ display: 'none' }} onChange={e => { addFiles(e.target.files); e.target.value = ''; }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Click to add company files</span>
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>.xlsx · drag &amp; drop or click</span>
        </div>
      </div>
      {files.length > 0 && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {files.map((f, i) => (
            <div key={f.name + i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--accent-surface)', borderRadius: 8, border: '1px solid var(--accent-border)' }}>
              <span style={{ fontSize: 10, fontWeight: 800, fontFamily: 'var(--mono)', color: 'var(--accent)', flexShrink: 0, width: 14, textAlign: 'center' }}>{i + 1}</span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 600, color: 'var(--accent)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={f.name}>{f.name}</span>
              <span style={{ fontSize: 11, color: 'var(--text-3)', flexShrink: 0 }}>{Math.round(f.size / 1024)} KB</span>
              <button onClick={() => removeAt(i)} disabled={busy} title="Remove" style={{ flexShrink: 0, width: 22, height: 22, borderRadius: 6, border: '1px solid var(--border)', background: '#fff', color: 'var(--text-2)', fontSize: 14, lineHeight: 1, cursor: 'pointer', fontFamily: 'var(--font)' }}>×</button>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
            <span style={{ flex: 1, fontSize: 11, color: 'var(--text-3)' }}>{files.length} file{files.length > 1 ? 's' : ''} ready{files.length > 1 ? ' — will be merged' : ''}</span>
            <button onClick={() => setFiles([])} disabled={busy} style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid var(--border)', background: '#fff', color: 'var(--text-2)', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>Clear</button>
            <button onClick={start} disabled={busy} style={{ padding: '7px 16px', borderRadius: 7, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.7 : 1, fontFamily: 'var(--font)' }}>{busy ? 'Merging…' : 'Merge files'}</button>
          </div>
        </div>
      )}
      {err && <div style={{ marginTop: 10, fontSize: 12, color: '#DC2626', fontWeight: 600 }}>{err}</div>}
      <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 14, lineHeight: 1.55 }}>
        Send the raw company exports as-is. The server merges them into a single ledger (this can take up to a minute for large files) and returns it for download. Run the forecast afterwards from Upload &amp; Forecast.
      </div>
    </div>
  );
}

/* Upload a monthly ledger -> forecast pipeline (server-side) -> Supabase.
   Reads window.__UPLOAD_JOB to bootstrap, then JobProgress polls Supabase for
   the live step-by-step + validation state. */
function LedgerUpdateCard() {
  const job = (typeof window !== 'undefined' && window.__UPLOAD_JOB) || null;
  const [picked, setPicked] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState('');
  const fileRef = React.useRef(null);

  // Submit a file into the hidden Streamlit bridge uploader (same channel the
  // rest of the app uses). Python branches on the sentinel filename.
  const bridge = (file) => {
    const pd = window.parent.document;
    const input = pd.querySelector('[data-testid="stFileUploaderDropzoneInput"]')
      || pd.querySelector('[data-testid="stFileUploader"] input[type="file"]')
      || pd.querySelector('input[type="file"]');
    if (!input) throw new Error('Host uploader not found. Reload the page and try again.');
    const dt = new DataTransfer();
    dt.items.add(file);
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'files').set;
    setter.call(input, dt.files);
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };

  const pick = (f) => {
    if (!f) return;
    if (!/\.xlsx$/i.test(f.name)) { setErr('The ledger must be an .xlsx file.'); return; }
    if (f.size > 50 * 1024 * 1024) { setErr('File exceeds the 50 MB limit.'); return; }
    setErr(''); setPicked(f);
  };

  const start = () => {
    if (!picked) return;
    setBusy(true); setErr('');
    try {
      bridge(new File([picked], '__LEDGER_UPLOAD__' + picked.name, { type: picked.type || 'application/octet-stream' }));
    } catch (e) { setBusy(false); setErr(e.message || String(e)); }
  };

  const dismiss = () => {
    try { bridge(new File([new Blob(['x'], { type: 'text/csv' })], '__JOB_CLEAR__' + Date.now() + '.csv', { type: 'text/csv' })); } catch (e) { /* noop */ }
  };

  // Browser-side signal that the pipeline finished, so the host pulls fresh
  // predictions immediately instead of waiting on the 30s backup poll.
  const markDone = () => {
    try { bridge(new File([new Blob(['x'], { type: 'text/csv' })], '__JOB_DONE__' + Date.now() + '.csv', { type: 'text/csv' })); } catch (e) { /* noop */ }
  };

  const wrap = { background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: 24, marginBottom: 20 };

  // Any queued / running / finished job -> the live step-by-step panel.
  if (job && job.job_id) return <JobProgress job={job} onDismiss={dismiss} onDone={markDone} />;

  return (
    <div style={wrap}>
      <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>Update forecasts with a new month</div>
      <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginBottom: 16, lineHeight: 1.6 }}>
        Upload the monthly stock ledger exactly as the system exports it — it goes straight to the forecasting pipeline, which validates and processes it and writes fresh predictions. The dashboard updates on its own when it finishes (about 12–18 minutes).
      </div>
      <div onClick={() => fileRef.current && fileRef.current.click()}
        style={{ border: '2px dashed #C4C9D2', borderRadius: 12, padding: '24px 20px', textAlign: 'center', cursor: 'pointer', background: '#FAFBFC' }}>
        <input type="file" ref={fileRef} accept=".xlsx" style={{ display: 'none' }} onChange={e => pick(e.target.files[0])} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-2)" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Click to choose the monthly ledger</span>
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>.xlsx · up to 50 MB</span>
        </div>
      </div>
      {picked && (
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'var(--accent-surface)', borderRadius: 8, border: '1px solid var(--accent-border)' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{picked.name}</span>
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{Math.round(picked.size / 1024)} KB</span>
          <button onClick={() => { setPicked(null); if (fileRef.current) fileRef.current.value = ''; }} disabled={busy} style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)', background: '#fff', color: 'var(--text-2)', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>Cancel</button>
          <button onClick={start} disabled={busy} style={{ padding: '5px 14px', borderRadius: 6, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 11, fontWeight: 700, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.7 : 1, fontFamily: 'var(--font)' }}>{busy ? 'Starting…' : 'Start update'}</button>
        </div>
      )}
      {err && <div style={{ marginTop: 10, fontSize: 12, color: '#DC2626', fontWeight: 600 }}>{err}</div>}
      <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 14, lineHeight: 1.55 }}>
        Upload the stock ledger export exactly as the system produces it (.xlsx) — no reformatting needed. The pipeline parses and validates it. One month per file; the month is detected from the dates.
      </div>
    </div>
  );
}

/* ---- Upload history ------------------------------------------------------
   Sonu's ask: show the pipeline runs in the Upload Data section, off both
   tables — validation_runs (every upload attempt, with its checks) and
   pipeline_jobs (the forecast run that follows a clean validation).

   validation_runs is the spine: the pipeline writes it first and only creates
   a pipeline_jobs row once validation clears, so an upload rejected at a hard
   stop exists ONLY there. The two are matched on year_month + a timestamp
   within a couple of minutes (in practice the job row lands ~0.3s after the
   validation row).

   Read straight from Supabase in the browser, same as LatestRunStatus, so the
   list is current without waiting on a Streamlit rerun. */

const UH_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function uhMonth(ym) {
  const m = /^(\d{4})-(\d{1,2})$/.exec(String(ym || ''));
  if (!m) return ym ? String(ym).replace(/^unknown$/i, 'Not detected') : '—';
  return UH_MONTHS[parseInt(m[2], 10) - 1] + ' ' + m[1];
}

function uhWhen(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const p2 = n => String(n).padStart(2, '0');
  return d.getDate() + ' ' + UH_MONTHS[d.getMonth()] + ' ' + d.getFullYear() + ', ' + p2(d.getHours()) + ':' + p2(d.getMinutes());
}

function uhDuration(a, b) {
  if (!a || !b) return null;
  const ms = new Date(b).getTime() - new Date(a).getTime();
  if (!isFinite(ms) || ms <= 0) return null;
  const s = Math.round(ms / 1000);
  return s >= 60 ? Math.floor(s / 60) + 'm ' + (s % 60) + 's' : s + 's';
}

const UH_BADGES = {
  ok: { fg: '#047857', bg: 'rgba(5,150,105,.10)', bd: 'rgba(5,150,105,.30)' },
  warn: { fg: '#B45309', bg: 'rgba(245,158,11,.12)', bd: 'rgba(245,158,11,.32)' },
  bad: { fg: '#B91C1C', bg: 'rgba(220,38,38,.08)', bd: 'rgba(220,38,38,.26)' },
  none: { fg: 'var(--text-3)', bg: 'var(--surface-2,#F3F4F7)', bd: 'var(--border)' },
};

function UhBadge({ tone, label }) {
  const s = UH_BADGES[tone] || UH_BADGES.none;
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 9.5, fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase', color: s.fg, background: s.bg, border: '1px solid ' + s.bd, whiteSpace: 'nowrap' }}>{label}</span>
  );
}

/* validation_runs.overall_result is PASS / PASS_WITH_WARNINGS / FAIL. Anything
   starting with PASS cleared the gate — warnings are non-blocking. */
function uhValidation(v) {
  if (!v) return { tone: 'none', label: 'No record' };
  const r = String(v.overall_result || '').toUpperCase();
  if (r.indexOf('PASS') !== 0) return { tone: 'bad', label: 'Failed' };
  return r.indexOf('WARN') >= 0 ? { tone: 'warn', label: 'Warnings' } : { tone: 'ok', label: 'Passed' };
}

function uhForecast(j) {
  if (!j) return { tone: 'none', label: 'Not run' };
  if (j.status === 'complete') return { tone: 'ok', label: 'Success' };
  if (j.status === 'failed') return { tone: 'bad', label: 'Failed' };
  return { tone: 'warn', label: j.status === 'queued' ? 'Queued' : 'Running' };
}

/* On success the pipeline leaves e.g. "Done — 1,551 predictions saved for
   2026-09 → 2026-11" in current_step; the "Done —" prefix is noise next to a
   status column. */
function uhResult(v, j) {
  if (j) {
    if (j.status === 'failed') return j.error_message || 'The pipeline reported an error.';
    const t = String(j.current_step || '').replace(/^\s*Done\s*[—–-]\s*/i, '').trim();
    if (t) return t;
    return j.status === 'complete' ? 'Predictions saved' : 'In progress…';
  }
  if (v && String(v.overall_result || '').toUpperCase().indexOf('PASS') !== 0) {
    return v.hard_stop_reason || 'Stopped on a failing check — no forecast was run.';
  }
  return 'Validated · no forecast job recorded';
}

/* Pair each upload attempt with the forecast job it started. Same year_month
   and within two minutes; each job is claimed once so two uploads of the same
   month can't both point at it. */
function uhJoin(vrs, jobs) {
  const claimed = {};
  const rows = vrs.map(v => {
    let best = null, bestD = Infinity;
    for (let i = 0; i < jobs.length; i++) {
      const j = jobs[i];
      if (claimed[j.id] || j.year_month !== v.year_month) continue;
      const d = Math.abs(new Date(j.created_at).getTime() - new Date(v.upload_timestamp).getTime()) / 1000;
      if (d <= 120 && d < bestD) { bestD = d; best = j; }
    }
    if (best) claimed[best.id] = true;
    return { key: 'v' + v.id, v: v, j: best, at: v.upload_timestamp };
  });
  // A job with no validation row still belongs in the list.
  jobs.forEach(j => {
    if (!claimed[j.id]) rows.push({ key: 'j' + j.id, v: null, j: j, at: j.created_at });
  });
  rows.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return rows;
}

/* checks_summary / auto_fixes_applied / items_flagged are by far the biggest
   columns in validation_runs (~175 KB across 70 rows vs 14 KB without them),
   so the list query leaves them out and the detail fetches just the one row it
   is showing. */
function UhDetail({ row }) {
  const v = row.v, j = row.j;
  const [full, setFull] = React.useState(null);
  const [loadErr, setLoadErr] = React.useState(false);

  React.useEffect(() => {
    if (!v) return;
    let alive = true;
    const base = window.__SUPABASE_URL, key = window.__SUPABASE_KEY;
    if (!base || !key) { setLoadErr(true); return; }
    (async () => {
      try {
        const r = await fetch(base + '/rest/v1/validation_runs?select=checks_summary,auto_fixes_applied,items_flagged&limit=1&id=eq.' + encodeURIComponent(v.id), { headers: { apikey: key, Authorization: 'Bearer ' + key } });
        if (!r.ok) throw new Error('http ' + r.status);
        const d = await r.json();
        if (alive) setFull((d && d[0]) || {});
      } catch (e) {
        if (alive) setLoadErr(true);
      }
    })();
    return () => { alive = false; };
  }, [v && v.id]);

  const checks = ((full && full.checks_summary) || []).slice().sort((a, b) => (a.check_id || 0) - (b.check_id || 0));
  const autofixes = (full && full.auto_fixes_applied) || [];
  const flagged = (full && full.items_flagged) || [];
  const took = j && uhDuration(j.created_at, j.completed_at);
  const meta = [];
  if (j && j.job_id) meta.push('Job ' + String(j.job_id).slice(0, 8));
  if (j && j.forecast_run_id) meta.push('Forecast run #' + j.forecast_run_id);
  if (took) meta.push('Took ' + took);
  if (v && v.processed_by) meta.push('Via ' + v.processed_by);

  return (
    <div style={{ padding: '4px 12px 14px 12px', background: '#FAFBFC' }}>
      {checks.length > 0 ? (
        <div>
          <div style={{ fontSize: 9.5, fontWeight: 800, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.06em', paddingTop: 8 }}>Validation checks</div>
          {checks.map((c, i) => <CheckRow key={i} c={c} />)}
        </div>
      ) : (
        <div style={{ fontSize: 11.5, color: 'var(--text-3)', paddingTop: 10 }}>
          {!v ? 'No validation record was written for this run.'
            : loadErr ? 'Could not load the validation checks.'
            : full === null ? 'Loading the validation checks…'
            : 'No checks were recorded for this run.'}
        </div>
      )}

      {autofixes.length > 0 && (
        <div style={{ marginTop: 10, fontSize: 11.5, color: '#92400E', background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.22)', borderRadius: 7, padding: '7px 10px', lineHeight: 1.45 }}>
          Auto-fixed: {autofixes.map(a => typeof a === 'string' ? a : (a.message || a.name || JSON.stringify(a))).join('; ')}
        </div>
      )}

      {flagged.length > 0 && (
        <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {flagged.map((f, i) => (
            <span key={i} style={{ fontSize: 10.5, color: 'var(--text-2)', background: '#fff', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 8px' }}>
              {(f && f.check) || 'Flagged'}: <strong style={{ color: 'var(--text)' }}>{typeof (f && f.count) === 'number' ? f.count.toLocaleString() : '—'}</strong>
            </span>
          ))}
        </div>
      )}

      {j && j.status === 'failed' && j.error_message && (
        <div style={{ marginTop: 10, fontSize: 11.5, color: '#7F1D1D', background: 'rgba(220,38,38,.06)', border: '1px solid rgba(220,38,38,.22)', borderRadius: 7, padding: '7px 10px', lineHeight: 1.45 }}>
          Pipeline error: {j.error_message}
        </div>
      )}

      {meta.length > 0 && (
        <div style={{ marginTop: 10, fontSize: 10.5, color: 'var(--text-3)' }}>{meta.join(' · ')}</div>
      )}
    </div>
  );
}

function UploadHistory() {
  const [rows, setRows] = React.useState(null); // null = still loading
  const [failed, setFailed] = React.useState(false);
  const [view, setView] = React.useState('ok');  // 'ok' = forecast completed
  const [open, setOpen] = React.useState({});
  const [nonce, setNonce] = React.useState(0);

  React.useEffect(() => {
    let alive = true;
    const base = window.__SUPABASE_URL, key = window.__SUPABASE_KEY;
    if (!base || !key) { setRows([]); setFailed(true); return; }
    const get = async (path) => {
      const r = await fetch(base + '/rest/v1/' + path, { headers: { apikey: key, Authorization: 'Bearer ' + key } });
      if (!r.ok) throw new Error('http ' + r.status);
      return await r.json();
    };
    (async () => {
      try {
        const [vrs, jobs] = await Promise.all([
          get('validation_runs?select=id,upload_timestamp,year_month,overall_result,hard_stop_reason,processed_by&order=upload_timestamp.desc&limit=100'),
          get('pipeline_jobs?select=*&order=created_at.desc&limit=100'),
        ]);
        if (!alive) return;
        setRows(uhJoin(Array.isArray(vrs) ? vrs : [], Array.isArray(jobs) ? jobs : []));
        setFailed(false);
      } catch (e) {
        if (alive) { setRows([]); setFailed(true); }
      }
    })();
    return () => { alive = false; };
  }, [nonce]);

  const all = rows || [];
  const okCount = all.filter(r => r.j && r.j.status === 'complete').length;
  const shown = view === 'all' ? all : all.filter(r => r.j && r.j.status === 'complete');
  // An expanded row carries the whole validation check list — give the box
  // more room so the detail isn't read through a 360px slot.
  const anyOpen = shown.some(r => open[r.key]);

  const th = { padding: '8px 10px', fontSize: 9.5, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.06em', borderBottom: '2px solid var(--border)', background: '#FAFBFC', textAlign: 'left', whiteSpace: 'nowrap', position: 'sticky', top: 0, zIndex: 1 };
  const td = { padding: '9px 10px', fontSize: 12, color: 'var(--text)', borderBottom: '1px solid var(--border)', verticalAlign: 'top' };

  const subtitle = rows === null ? 'Loading the pipeline runs…'
    : failed ? 'Could not reach the pipeline tables.'
    : all.length === 0 ? 'No ledger has been through the pipeline yet.'
    : okCount + ' ledger' + (okCount === 1 ? '' : 's') + ' forecast successfully · ' + all.length + ' upload attempt' + (all.length === 1 ? '' : 's') + ' logged';

  return (
    <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: '18px 20px', marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 170 }}>
          <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: '-0.01em' }}>Upload history</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-2)', marginTop: 2, lineHeight: 1.5 }}>{subtitle}</div>
        </div>
        {all.length > 0 && (
          <div style={{ display: 'inline-flex', gap: 3, padding: 3, background: 'var(--surface-2,#F3F4F7)', borderRadius: 8 }}>
            {[['ok', 'Successful'], ['all', 'All uploads']].map(([v, label]) => (
              <button key={v} onClick={() => setView(v)} style={{
                padding: '5px 11px', fontSize: 11, fontWeight: view === v ? 700 : 600, border: 'none', borderRadius: 6, cursor: 'pointer', fontFamily: 'var(--font)',
                background: view === v ? '#fff' : 'transparent', color: view === v ? 'var(--accent)' : 'var(--text-2)',
                boxShadow: view === v ? '0 1px 3px rgba(0,0,0,.08)' : 'none', transition: 'all .12s',
              }}>{label}</button>
            ))}
          </div>
        )}
        <button onClick={() => setNonce(n => n + 1)} style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid var(--border)', background: '#fff', color: 'var(--text-2)', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)', flexShrink: 0 }}>Refresh</button>
      </div>

      {shown.length > 0 ? (
        <div className="h-scroller" style={{ overflow: 'auto', maxHeight: anyOpen ? 620 : 360, border: '1px solid var(--border)', borderRadius: 9 }}>
          <table style={{ width: '100%', minWidth: 660, borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...th, width: 22, padding: '8px 0 8px 8px' }}></th>
                <th style={th}>Ledger month</th>
                <th style={th}>Uploaded</th>
                <th style={th}>Validation</th>
                <th style={th}>Forecast</th>
                <th style={th}>Result</th>
              </tr>
            </thead>
            <tbody>
              {shown.map(r => {
                const val = uhValidation(r.v);
                const fore = uhForecast(r.j);
                const isOpen = !!open[r.key];
                return (
                  <React.Fragment key={r.key}>
                    <tr onClick={() => setOpen(o => Object.assign({}, o, { [r.key]: !o[r.key] }))}
                      style={{ cursor: 'pointer', background: isOpen ? 'var(--accent-surface)' : 'transparent' }}>
                      <td style={{ ...td, padding: '9px 0 9px 8px' }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                          style={{ transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform .12s' }}><polyline points="9 18 15 12 9 6"></polyline></svg>
                      </td>
                      <td style={{ ...td, fontWeight: 700, whiteSpace: 'nowrap' }}>{uhMonth((r.v && r.v.year_month) || (r.j && r.j.year_month))}</td>
                      <td style={{ ...td, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>{uhWhen(r.at)}</td>
                      <td style={td}><UhBadge tone={val.tone} label={val.label} /></td>
                      <td style={td}><UhBadge tone={fore.tone} label={fore.label} /></td>
                      <td style={{ ...td, color: (r.j && r.j.status === 'failed') || val.tone === 'bad' ? '#B91C1C' : 'var(--text-2)', lineHeight: 1.45, minWidth: 190 }}>{uhResult(r.v, r.j)}</td>
                    </tr>
                    {isOpen && (
                      <tr>
                        <td colSpan={6} style={{ padding: 0, borderBottom: '1px solid var(--border)' }}><UhDetail row={r} /></td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : rows !== null && (
        <div style={{ padding: '18px 0', textAlign: 'center', fontSize: 12, color: 'var(--text-3)' }}>
          {failed ? 'The pipeline tables are unavailable right now.' : all.length > 0 ? 'No forecast has completed yet — switch to All uploads to see the attempts.' : 'Upload a ledger to start the first run.'}
        </div>
      )}
    </div>
  );
}

Object.assign(window, { UploadDataPage, LedgerUpdateCard, MergeDownloadCard, MergeSummary, UploadHistory });
