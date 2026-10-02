/* Sidebar component — light theme */

function YearPicker({ collapsed, years, currentYear, onSwitchYear, switching }) {
  // Year-level forecast picker. Each entry represents one predict_year and
  // unions every Supabase run that touches that year — Backtest months and
  // Future months appear in one continuous view via the per-row
  // forecast_mode column.
  const safeYears = years || [];
  const [open, setOpen] = React.useState(false);
  const [pendingYear, setPendingYear] = React.useState(null);
  const ref = React.useRef(null);
  React.useEffect(() => {
    function onDoc(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);
  const wasSwitching = React.useRef(switching);
  React.useEffect(() => {
    if (wasSwitching.current && !switching) {
      setPendingYear(null);
      setOpen(false);
    }
    wasSwitching.current = switching;
  }, [switching]);
  if (!safeYears.length || collapsed) return null;
  const current = safeYears.find(y => Number(y.year) === Number(currentYear)) || safeYears[0];
  const modeBadge = (modes) => {
    const set = [...new Set(modes || [])].sort();
    if (set.length === 0) return { label: '—', color: '#9CA3AF' };
    if (set.length === 1) return { label: set[0], color: set[0] === 'Backtest' ? '#059669' : '#6366F1' };
    return { label: set.join('+'), color: '#7C3AED' };
  };
  const handle = (year) => {
    if (Number(year) === Number(currentYear) || switching) return;
    setPendingYear(year);
    if (onSwitchYear) onSwitchYear(year);
  };
  const currentBadge = modeBadge(current.modes);
  return (
    <div ref={ref} style={{ padding: '0 10px 6px', position: 'relative' }}>
      <div style={{ fontSize: 9.5, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.1em', padding: '2px 4px 6px' }}>Forecast Year</div>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 10px', borderRadius: 9,
          background: open ? 'var(--hover)' : 'var(--surface, #fff)',
          border: '1px solid var(--border)',
          fontFamily: 'var(--font)', textAlign: 'left', cursor: 'pointer',
          transition: 'background .12s',
        }}
        onMouseEnter={e => { if (!open) e.currentTarget.style.background = 'var(--hover)'; }}
        onMouseLeave={e => { if (!open) e.currentTarget.style.background = 'var(--surface, #fff)'; }}
      >
        <span style={{
          fontSize: 9.5, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
          background: currentBadge.color + '14',
          color: currentBadge.color, letterSpacing: '.02em',
        }}>{currentBadge.label}</span>
        <div style={{ flex: 1, minWidth: 0, lineHeight: 1.2 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
            {current.year}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {current.period_count != null ? `${current.period_count} mo` : `${current.run_ids?.length || 1} run${current.run_ids?.length > 1 ? 's' : ''}`}
            {current.total_items ? ` · ${current.total_items} items` : ''}
          </div>
        </div>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-3)', transition: 'transform .15s', transform: open ? 'rotate(180deg)' : 'none', flexShrink: 0 }}>
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 10, right: 10, marginTop: 4,
          background: '#fff', border: '1px solid var(--border)', borderRadius: 10,
          boxShadow: '0 12px 28px rgba(15,23,42,.10), 0 2px 4px rgba(15,23,42,.04)',
          zIndex: 50, overflow: 'hidden', maxHeight: 320, overflowY: 'auto',
        }}>
          {safeYears.map(y => {
            const sel = Number(y.year) === Number(currentYear);
            const isSw = Number(pendingYear) === Number(y.year) && switching;
            const badge = modeBadge(y.modes);
            return (
              <button key={y.year} onClick={() => handle(y.year)} disabled={sel || switching}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '9px 11px', border: 'none',
                  borderBottom: '1px solid #F3F4F6',
                  background: sel ? 'var(--accent-surface)' : 'transparent',
                  cursor: (sel || switching) ? 'default' : 'pointer',
                  fontFamily: 'var(--font)',
                  opacity: (switching && !isSw) ? 0.5 : 1,
                  transition: 'background .12s',
                }}
                onMouseEnter={e => { if (!sel && !switching) e.currentTarget.style.background = 'var(--hover)'; }}
                onMouseLeave={e => { if (!sel && !switching) e.currentTarget.style.background = 'transparent'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <span style={{
                    fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
                    background: badge.color + '14', color: badge.color, letterSpacing: '.02em',
                  }}>{badge.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{y.year}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-3)' }}>
                    {y.period_count != null ? `${y.period_count} mo` : `${y.run_ids?.length || 1} run${y.run_ids?.length > 1 ? 's' : ''}`}
                  </span>
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-3)', lineHeight: 1.35 }}>
                  {y.total_items ? `${y.total_items} items` : ''}
                  {y.avg_mape != null && <> · MAPE {y.avg_mape.toFixed(1)}%</>}
                  {y.training_years ? ` · trained ${y.training_years}` : ''}
                </div>
                {isSw && (
                  <div style={{ marginTop: 4, fontSize: 9.5, color: 'var(--accent)', fontWeight: 600 }}>
                    Loading…
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Sidebar({ activePage, onNavigate, collapsed, onToggleCollapse, onOpenDataSource, itemCount, years, currentYear, onSwitchYear, switching }) {
  const nav = [
    { id: 'lineitems', label: 'Line Items', icon: 'list' },
    { id: 'costing', label: 'Costing', icon: 'banknote' },
    { id: 'cashflow', label: 'Cash Flow', icon: 'cashflow' },
    { id: 'predictions', label: 'Predictions', icon: 'chart' },
    { id: 'actionflow', label: 'Action Flow', icon: 'flow' },
    { id: 'accuracy', label: 'Model Accuracy', icon: 'target' },
    { id: 'forecasts', label: 'Item Forecasts', icon: 'forecasts', badge: null },
    { id: 'iteminsight', label: 'Item Insights', icon: 'bulb' },
    { id: 'explorer', label: 'Item Explorer', icon: 'table', badge: itemCount },
    { id: 'newitems', label: 'New Items', icon: 'sparkle' },
    { id: 'dormant', label: 'Dormant Items', icon: 'moon' },
    { id: 'movers', label: 'Most Moving Items', icon: 'movers' },
    { id: 'upload', label: 'Upload Data', icon: 'upload' },
  ];
  const config = [];

  const icons = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5"></rect><rect x="14" y="3" width="7" height="7" rx="1.5"></rect><rect x="14" y="14" width="7" height="7" rx="1.5"></rect><rect x="3" y="14" width="7" height="7" rx="1.5"></rect></>,
    table: <><rect x="3" y="3" width="18" height="18" rx="2"></rect><path d="M3 9h18M3 15h18M9 3v18"></path></>,
    chart: <><rect x="3" y="12" width="4" height="8" rx="1"></rect><rect x="10" y="4" width="4" height="16" rx="1"></rect><rect x="17" y="8" width="4" height="12" rx="1"></rect></>,
    database: <><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></>,
    menu: <><line x1="4" y1="7" x2="20" y2="7"></line><line x1="4" y1="12" x2="20" y2="12"></line><line x1="4" y1="17" x2="20" y2="17"></line></>,
    upload: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></>,
    banknote: <><rect x="2" y="6" width="20" height="12" rx="2"></rect><circle cx="12" cy="12" r="2.5"></circle><path d="M6 12h.01M18 12h.01"></path></>,
    cashflow: <><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></>,
    chevronL: <><polyline points="15 18 9 12 15 6"></polyline></>,
    chevronR: <><polyline points="9 18 15 12 9 6"></polyline></>,
    forecasts: <><path d="M18 20V10"></path><path d="M12 20V4"></path><path d="M6 20v-6"></path><path d="M2 20h20"></path></>,
    list: <><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></>,
    target: <><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></>,
    flow: <><polyline points="16 3 21 3 21 8"></polyline><line x1="4" y1="20" x2="21" y2="3"></line><polyline points="21 16 21 21 16 21"></polyline><line x1="15" y1="15" x2="21" y2="21"></line><line x1="4" y1="4" x2="9" y2="9"></line></>,
    sparkle: <><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z"></path><path d="M19 14l.8 2.1L22 17l-2.2.9L19 20l-.9-2.1L16 17l2.1-.9L19 14z"></path></>,
    bulb: <><path d="M9 18h6"></path><path d="M10 22h4"></path><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5.76.76 1.23 1.52 1.41 2.5"></path></>,
    movers: <><path d="M3 17l6-6 4 4 8-8"></path><path d="M15 7h6v6"></path></>,
    moon: <><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></>,
  };

  const SvgIcon = ({ name, size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{icons[name]}</svg>
  );

  const renderItem = (item) => {
    const active = activePage === item.id;
    return (
      <button key={item.id} onClick={() => item.action ? item.action() : onNavigate(item.id)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: collapsed ? '9px 0' : '9px 12px', borderRadius: 10, cursor: 'pointer',
          fontSize: 13, fontWeight: active ? 600 : 450, border: 'none', width: '100%', textAlign: 'left', fontFamily: 'var(--font)',
          justifyContent: collapsed ? 'center' : 'flex-start',
          color: active ? 'var(--accent)' : 'var(--text-2)',
          background: active ? 'var(--accent-surface)' : 'transparent',
          transition: 'all .15s',
        }}
        onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--hover)'; }}
        onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
      >
        <span style={{ opacity: active ? 1 : 0.72, display: 'flex' }}><SvgIcon name={item.icon} /></span>
        {!collapsed && <span>{item.label}</span>}
        {!collapsed && item.badge && <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 10, background: 'var(--accent-surface)', color: 'var(--accent)' }}>{item.badge}</span>}
      </button>
    );
  };

  return (
    <div style={{
      width: collapsed ? 60 : 220, background: 'var(--sidebar-bg)', borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', height: '100vh', flexShrink: 0, transition: 'width .2s ease',
    }}>
      {/* Logo — click to toggle collapse */}
      <div style={{ padding: collapsed ? '12px 6px' : '12px 10px', minHeight: 60, display: 'flex', alignItems: 'center' }}>
        <button onClick={onToggleCollapse}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            width: '100%', padding: collapsed ? '6px 0' : '6px 8px',
            background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: 'var(--font)', textAlign: 'left',
            justifyContent: collapsed ? 'center' : 'flex-start',
            borderRadius: 10, transition: 'background .15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--hover)'}
          onMouseLeave={e => e.currentTarget.style.background = 'none'}>
          <div style={{
            width: 30, height: 30, borderRadius: 9, flexShrink: 0,
            background: 'linear-gradient(135deg, var(--accent), #818CF8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em'
          }}>P</div>
          {!collapsed && <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>Predictions</span>}
        </button>
      </div>

      <YearPicker collapsed={collapsed} years={years} currentYear={currentYear} onSwitchYear={onSwitchYear} switching={switching} />

      <nav style={{ flex: 1, padding: '4px 8px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {!collapsed && <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.1em', padding: '8px 12px 4px' }}>Dashboard</div>}
        {nav.map(renderItem)}
        {config.length > 0 && (<>
          {!collapsed && <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.1em', padding: '16px 12px 4px' }}>Settings</div>}
          {config.map(renderItem)}
        </>)}
      </nav>

      {!collapsed && (
        <div style={{ padding: '12px 12px 16px' }}>
          <button onClick={onOpenDataSource} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
            fontSize: 12, fontWeight: 600, width: '100%', textAlign: 'left', fontFamily: 'var(--font)',
            color: 'var(--accent)', background: 'var(--accent-surface)', border: '1px dashed var(--accent-border)',
          }}>
            <SvgIcon name="upload" size={15} />
            <span>Load New Data</span>
          </button>
        </div>
      )}
    </div>
  );
}

window.Sidebar = Sidebar;
