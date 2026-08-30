/* Cash Flow — next-month planning rollup (Sonu, Jul 2026). The customer wants
   to see, for the coming month: the top demand items and the cash flow needed
   at min / avg / max rates.

   All figures come straight from the forecast:
     demand      = pred_closing_balance (predicted units on-site)
     rate/unit   = low_cost / avg_cost / high_cost (rental rate per unit)
     cash flow   = pred_cost_min / _avg / _max  (= demand × rate)
   Costs exist for the ~94 High-Value items only, so this view is HV by nature.

   NOTE: the fuller "procurement / cross-hire / payback" mockup needs data the
   forecast doesn't have (owned-stock levels, purchase prices, cross-hire
   rates), so it is intentionally NOT shown — nothing here is fabricated. */
function CashFlowPage({ allData }) {
  const [rankBy, setRankBy] = React.useState('value'); // 'value' | 'qty'
  const [infoOpen, setInfoOpen] = React.useState(false);
  const [month, setMonth] = React.useState(null);

  const num0 = v => v == null ? '0' : (Math.round(v) || 0).toLocaleString('en-US');
  const fmtP = p => { const m = String(p || '').match(/^(\d{4})-(\d{2})$/); if (!m) return p || '—'; const ns = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']; return `${ns[parseInt(m[2])]} ${m[1]}`; };
  const fmtPS = p => { const m = String(p || '').match(/^(\d{4})-(\d{2})$/); if (!m) return p || '—'; const ns = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']; return `${ns[parseInt(m[2])]} ${m[1]}`; };

  // Planning horizon = costed months AFTER the last month that has any actuals.
  // (forecast_mode isn't reliable here — the cost backfill tagged historical
  // months too — so key off "no actuals yet", the app's usual future test.)
  const lastActual = React.useMemo(() => {
    let mx = '';
    (allData || []).forEach(d => { if (d.actualClosingBal != null && d.period > mx) mx = d.period; });
    return mx;
  }, [allData]);
  const futurePeriods = React.useMemo(
    () => [...new Set((allData || []).filter(d => d.predValueAvg != null && (!lastActual || d.period > lastActual)).map(d => d.period))].sort(),
    [allData, lastActual]);
  React.useEffect(() => {
    if (!futurePeriods.length || (month && futurePeriods.includes(month))) return;
    // Default to the nearest planning month that hasn't calendar-passed (so we
    // don't open on a stale month if a ledger upload is overdue); if they've
    // all passed, fall back to the latest available.
    let cur = '';
    try { const n = new Date(); cur = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`; } catch (e) {}
    setMonth(futurePeriods.find(p => p >= cur) || futurePeriods[futurePeriods.length - 1]);
  }, [futurePeriods, month]);

  const items = React.useMemo(() => (allData || []).filter(d => d.period === month && d.predValueAvg != null), [allData, month]);
  const totals = React.useMemo(() => items.reduce((a, d) => ({
    min: a.min + (d.predValueLow || 0), avg: a.avg + (d.predValueAvg || 0), max: a.max + (d.predValueHigh || 0), qty: a.qty + (d.predictedClosingBal || 0),
  }), { min: 0, avg: 0, max: 0, qty: 0 }), [items]);

  const ranked = React.useMemo(() => [...items].sort((a, b) =>
    rankBy === 'qty' ? (b.predictedClosingBal || 0) - (a.predictedClosingBal || 0) : (b.predValueAvg || 0) - (a.predValueAvg || 0)), [items, rankBy]);
  const top20 = ranked.slice(0, 20);
  const top20Tot = top20.reduce((a, d) => ({ qty: a.qty + (d.predictedClosingBal || 0), min: a.min + (d.predValueLow || 0), avg: a.avg + (d.predValueAvg || 0), max: a.max + (d.predValueHigh || 0) }), { qty: 0, min: 0, avg: 0, max: 0 });

  const groups = React.useMemo(() => {
    const m = {};
    items.forEach(d => {
      const g = (d.itemCode || '?').split('-')[0] || '?';
      if (!m[g]) m[g] = { g, qty: 0, min: 0, avg: 0, max: 0, n: 0 };
      const s = m[g]; s.qty += d.predictedClosingBal || 0; s.min += d.predValueLow || 0; s.avg += d.predValueAvg || 0; s.max += d.predValueHigh || 0; s.n++;
    });
    return Object.values(m).sort((a, b) => b.avg - a.avg);
  }, [items]);

  // NB: named exportCsv, not downloadCsv — the shared helper on window is
  // called downloadCsv and a same-named local would shadow (and recurse into) it.
  const exportCsv = () => {
    const head = ['Item Code', 'Item', 'Predicted On-site Qty', 'Rate Min', 'Rate Avg', 'Rate Max', 'Cash Flow Min (AED)', 'Cash Flow Avg (AED)', 'Cash Flow Max (AED)'];
    const body = ranked.map(d => [d.itemCode, d.description, Math.round(d.predictedClosingBal || 0), d.lowCost, d.avgCost, d.highCost, Math.round(d.predValueLow || 0), Math.round(d.predValueAvg || 0), Math.round(d.predValueHigh || 0)]);
    const rows = [head, ...body, [], ['TOTAL', '', Math.round(totals.qty), '', '', '', Math.round(totals.min), Math.round(totals.avg), Math.round(totals.max)]];
    downloadCsv(rows, `cash_flow_${month}.csv`);
  };

  const card = { background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: '18px 20px' };
  const th = { padding: '9px 10px', fontSize: 10, fontWeight: 600, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '2px solid var(--border)', background: '#FAFBFC', whiteSpace: 'normal', lineHeight: 1.2, verticalAlign: 'bottom', position: 'sticky', top: 0, zIndex: 1 };
  const cur = () => <span style={{ whiteSpace: 'nowrap' }}> (<DirhamSign s="1em" style={{ marginRight: 0, verticalAlign: '-0.12em' }} />)</span>;
  const td = (align, extra) => ({ padding: '7px 10px', textAlign: align || 'right', fontFamily: 'var(--mono)', fontSize: 11, ...extra });
  // Total row pinned to the bottom of the scroll area (stays visible while rows scroll).
  const totalTd = (align, extra) => ({ ...td(align, extra), position: 'sticky', bottom: 0, background: '#FAFBFC', zIndex: 2, boxShadow: 'inset 0 2px 0 var(--border)' });

  return (
    <div style={{ flex: 1, overflow: 'auto', minHeight: 0, padding: '16px 22px 28px' }} className="h-scroller">
      {/* Header + month selector */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h2 style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-0.02em' }}>Cash Flow — {fmtP(month)}</h2>
            <button onClick={() => setInfoOpen(o => !o)} title="What is this?" aria-label="What is this?"
              style={{ background: infoOpen ? 'var(--accent-surface)' : 'none', border: '1px solid ' + (infoOpen ? 'var(--accent-border)' : 'var(--border)'), borderRadius: 6, padding: '3px 5px', cursor: 'pointer', color: infoOpen ? 'var(--accent)' : 'var(--text-2)', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="11" x2="12" y2="16" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
            </button>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginTop: 3 }}>Predicted demand for the coming month and the cash flow it represents at min / avg / max rental rates.</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {futurePeriods.length > 1 && (
            <select value={month || ''} onChange={e => setMonth(e.target.value)}
              style={{ padding: '7px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, fontWeight: 600, fontFamily: 'var(--font)', color: 'var(--accent)', background: '#fff', outline: 'none', cursor: 'pointer' }}>
              {futurePeriods.map(p => <option key={p} value={p}>{fmtP(p)}</option>)}
            </select>
          )}
          <button onClick={exportCsv} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 8, border: '1px solid var(--accent)', background: 'var(--accent-surface)', color: 'var(--accent)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
            Download CSV
          </button>
        </div>
      </div>

      {infoOpen && (
        <div style={{ background: 'var(--accent-surface)', border: '1px solid var(--accent-border)', borderRadius: 10, padding: '11px 14px', marginBottom: 16, fontSize: 11.5, color: 'var(--text-2)', lineHeight: 1.55 }}>
          <b>Demand</b> = predicted units on-site. <b>Rate/unit</b> = the min / avg / max rental rate. <b>Cash flow</b> = demand × rate, so the three totals are the value of next month’s on-site fleet at the low, expected and high rate. Costs are calculated for High-Value items only, so this planning view covers those {items.length} items.
        </div>
      )}

      {/* Big numbers — cash flow needed at min / avg / max */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 }}>
        {[
          { k: 'min', label: 'Cash flow · Min', sub: 'best-case rates', v: totals.min, accent: '#047857', bg: 'rgba(5,150,105,.05)', bd: 'rgba(5,150,105,.25)' },
          { k: 'avg', label: 'Cash flow · Avg', sub: 'expected', v: totals.avg, accent: 'var(--accent)', bg: 'var(--accent-surface)', bd: 'var(--accent-border)', big: true },
          { k: 'max', label: 'Cash flow · Max', sub: 'top-rate case', v: totals.max, accent: '#B45309', bg: 'rgba(217,119,6,.05)', bd: 'rgba(217,119,6,.28)' },
        ].map(c => (
          <div key={c.k} style={{ ...card, background: c.bg, borderColor: c.bd, padding: '16px 18px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: c.accent, textTransform: 'uppercase', letterSpacing: '.04em' }}>{c.label}</div>
            <div style={{ fontSize: c.big ? 30 : 26, fontWeight: 800, fontFamily: 'var(--mono)', color: 'var(--text)', lineHeight: 1.1, marginTop: 6, display: 'flex', alignItems: 'center' }}>
              <DirhamSign s={c.big ? '0.82em' : '0.8em'} style={{ color: c.accent }} />{num0(c.v)}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3 }}>{c.sub}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 20 }}>
        <b style={{ color: 'var(--text)', fontFamily: 'var(--mono)' }}>{num0(totals.qty)}</b> predicted units on-site across <b style={{ color: 'var(--text)' }}>{items.length}</b> high-value items · expected spread <b style={{ color: 'var(--text)', fontFamily: 'var(--mono)' }}>{num0(totals.max - totals.min)}</b> between best and top-rate case.
      </div>

      {/* Top demand items */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>Top {top20.length} {rankBy === 'qty' ? 'by demand' : 'by cash flow'}</div>
        <div style={{ display: 'flex', background: 'var(--surface-2)', borderRadius: 8, padding: 2, gap: 2 }}>
          {[['value', 'Cash flow'], ['qty', 'Demand (qty)']].map(([k, l]) => (
            <button key={k} onClick={() => setRankBy(k)} style={{ padding: '4px 11px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600, fontFamily: 'var(--font)', background: rankBy === k ? '#fff' : 'transparent', color: rankBy === k ? 'var(--accent)' : 'var(--text-2)', boxShadow: rankBy === k ? '0 1px 3px rgba(0,0,0,.12)' : 'none' }}>{l}</button>
          ))}
        </div>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-3)' }}>top {top20.length} of {items.length} items · full-month totals in the cards above</span>
      </div>
      <div style={{ ...card, padding: 0, overflow: 'hidden', marginBottom: 22 }}>
        <div className="h-scroller" style={{ overflow: 'auto', maxHeight: 440 }}>
          <table style={{ width: '100%', minWidth: 760, borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: 'left', width: '26%' }}>Item</th>
                <th style={{ ...th, textAlign: 'right' }}>Predicted<br />on-site</th>
                <th style={{ ...th, textAlign: 'right' }}>Rate min{cur()}</th>
                <th style={{ ...th, textAlign: 'right' }}>Rate avg{cur()}</th>
                <th style={{ ...th, textAlign: 'right' }}>Rate max{cur()}</th>
                <th style={{ ...th, textAlign: 'right' }}>Cash flow min{cur()}</th>
                <th style={{ ...th, textAlign: 'right' }}>Cash flow avg{cur()}</th>
                <th style={{ ...th, textAlign: 'right' }}>Cash flow max{cur()}</th>
              </tr>
            </thead>
            <tbody>
              {top20.map((d, i) => (
                <tr key={(d.itemCode || '') + i} style={{ borderBottom: '1px solid #F3F4F6' }}>
                  <td style={td('left')}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ color: 'var(--accent)', fontSize: 10, flexShrink: 0 }}>★</span>
                      <span style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.description}>{d.description}</span>
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--mono)', marginTop: 1 }}>{d.itemCode}</div>
                  </td>
                  <td style={td('right', { fontWeight: 700 })}>{num0(d.predictedClosingBal)}</td>
                  <td style={td('right', { color: 'var(--text-3)' })}>{d.lowCost != null ? num0(d.lowCost) : '—'}</td>
                  <td style={td('right', { color: 'var(--text-2)' })}>{d.avgCost != null ? num0(d.avgCost) : '—'}</td>
                  <td style={td('right', { color: 'var(--text-3)' })}>{d.highCost != null ? num0(d.highCost) : '—'}</td>
                  <td style={td('right', { color: 'var(--text-2)' })}>{num0(d.predValueLow)}</td>
                  <td style={td('right', { fontWeight: 700 })}>{num0(d.predValueAvg)}</td>
                  <td style={td('right', { color: 'var(--text-2)' })}>{num0(d.predValueHigh)}</td>
                </tr>
              ))}
              <tr>
                <td style={totalTd('left', { fontWeight: 800 })}>Top {top20.length} total</td>
                <td style={totalTd('right', { fontWeight: 800 })}>{num0(top20Tot.qty)}</td>
                <td style={totalTd()} /><td style={totalTd()} /><td style={totalTd()} />
                <td style={totalTd('right', { fontWeight: 700 })}>{num0(top20Tot.min)}</td>
                <td style={totalTd('right', { fontWeight: 800 })}>{num0(top20Tot.avg)}</td>
                <td style={totalTd('right', { fontWeight: 700 })}>{num0(top20Tot.max)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* By material group */}
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Cash flow by material group</div>
      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <div className="h-scroller" style={{ overflow: 'auto', maxHeight: 360 }}>
          <table style={{ width: '100%', minWidth: 640, borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: 'left', width: '22%' }}>Group</th>
                <th style={{ ...th, textAlign: 'right' }}>Items</th>
                <th style={{ ...th, textAlign: 'right' }}>Predicted<br />on-site</th>
                <th style={{ ...th, textAlign: 'right' }}>Cash flow min{cur()}</th>
                <th style={{ ...th, textAlign: 'right' }}>Cash flow avg{cur()}</th>
                <th style={{ ...th, textAlign: 'right' }}>Cash flow max{cur()}</th>
                <th style={{ ...th, textAlign: 'right' }}>Share</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g, i) => (
                <tr key={g.g + i} style={{ borderBottom: '1px solid #F3F4F6' }}>
                  <td style={td('left', { fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--accent)' })}>{g.g}</td>
                  <td style={td('right', { color: 'var(--text-3)' })}>{g.n}</td>
                  <td style={td('right', { fontWeight: 700 })}>{num0(g.qty)}</td>
                  <td style={td('right', { color: 'var(--text-2)' })}>{num0(g.min)}</td>
                  <td style={td('right', { fontWeight: 700 })}>{num0(g.avg)}</td>
                  <td style={td('right', { color: 'var(--text-2)' })}>{num0(g.max)}</td>
                  <td style={td('right', { color: 'var(--text-3)' })}>{totals.avg ? (g.avg / totals.avg * 100).toFixed(1) + '%' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { CashFlowPage });
