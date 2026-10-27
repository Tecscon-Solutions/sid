# Forecast Intel (Sonu, Tecscon)

Streamlit app (`app.py`) serving a React/Babel-standalone UI from `frontend/` inside one iframe. Data comes from Supabase (`forecast_runs`, `forecast_predictions`). The live app is forecast-intel.streamlit.app and deploys from `main`.

## Working loop

1. Read the request from Sonu (usually pasted WhatsApp text and a doc from the ML engineer). Check the live Supabase schema before trusting the doc.
2. Change the code. A new page is a file in `frontend/components/`, registered in four places: `_COMPONENT_FILES` and the `refs` list in `app.py`, a `<script>` tag in `frontend/index.html`, and `PAGE_IDS`, title and render line in `frontend/app.jsx` plus the nav item in `frontend/components/sidebar.jsx`.
3. Check it in the browser pane: preview `streamlit` from `.claude/launch.json`. The first load takes about 60 s because it reads every Supabase row. The gate password is in `.streamlit/secrets.toml`.
4. Commit with the Claude co-author line, then push to both `origin` and `personal`.
5. Draft the reply to Sonu in siddhant-voice.

## Rules from past work

- Every monthly view must read monthly rows only (`isMonthlyRow` in `data.jsx`, `_monthly_only` in `app.py`). Since Oct 2026 the same table also holds quarterly, half-yearly and yearly rows.
- Quantities are shown as whole numbers.
