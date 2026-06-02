# scorp-payroll

S Corp payroll calculator — React 19 + Vite, deployed via Cloudflare Pages (wrangler).

## Stack
- React 19, Vite 8
- Single-file app: `src/App.jsx`
- Cloudflare Pages function: `functions/api/sync.js`
- No UI library — all styles are inline JS objects

## Key constants (App.jsx)
- `FEDERAL_FICA` = 6.75% employer FICA
- `FEDERAL_TAX_RATE` = 10%
- `SC_TAX_RATE` = 5% (South Carolina)
- `PAYROLL_THRESHOLD` = $1,500

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
