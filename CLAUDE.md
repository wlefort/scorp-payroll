# scorp-payroll

S Corp payroll calculator — React 19 + Vite, deployed via Cloudflare Pages (wrangler).

## Stack
- React 19, Vite 8
- Single-file app: `src/App.jsx`
- Cloudflare Pages function: `functions/api/sync.js`
- No UI library — all styles are inline JS objects

## Key constants (App.jsx)
- `FEDERAL_FICA` = 7.65% (employee-side FICA)
- `DEFAULT_EMPLOYER_TAX_PCT` = 7.65% employer tax, billed on top of wages (editable in Settings)
- `DEFAULT_FED_WH_PCT` = 10% / `DEFAULT_SC_WH_PCT` = 5% income-tax withholding (editable in Settings)
- `DEFAULT_TAX_RESERVE_PCT` = 15%
- `PAYROLL_THRESHOLD` = $1,500

## Tests
`tests/e2e-scenarios.mjs` — Playwright scenario suite (see file header; Playwright is not a dependency).

## Dev
```bash
npm run dev       # local dev server
npm run build     # production build → dist/
```

## Deploy
Cloudflare Pages — push to GitHub triggers deploy.
Config in `wrangler.toml`.

## GitHub
https://github.com/wlefort/scorp-payroll
Always commit and push changes to GitHub after making them.
