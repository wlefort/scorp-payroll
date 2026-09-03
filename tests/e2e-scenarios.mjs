// End-to-end scenario suite for the payroll math.
//
// Drives the real UI through realistic sequences — expenses and flights logged, payroll run
// (or deliberately not run) — with the clock faked so month rollovers can be exercised.
// Expectations are computed from the payroll formulas independently of the app, so a change
// to the app's math shows up as a failure rather than being mirrored.
//
//   npm run dev -- --port 5199 --host 127.0.0.1   # in one shell
//   npm i -D playwright                            # not a project dependency; deploys stay lean
//   node tests/e2e-scenarios.mjs                   # in another
//
// APP_URL overrides the default target.
import { chromium } from "playwright";

const APP_URL = process.env.APP_URL || "http://127.0.0.1:5199";

const TAX = 15, SAL = 38;
const calc = base => {
  const wage = Math.round(base * SAL / 100);
  const erFICA = Math.round(wage * 0.0765), eeFICA = Math.round(wage * 0.0765);
  const fedWH = Math.round(wage * 0.10), scWH = Math.round(wage * 0.05);
  return { wage, net: Math.max(0, wage - eeFICA - fedWH - scWH), dist: Math.max(0, base - (wage + erFICA)) };
};
// independent model of the run preview
const expectRun = (flyBal, sales, openExp) => {
  const combined = flyBal + sales;
  const cash = Math.round(flyBal * (1 - TAX/100)) + Math.round(sales * (1 - TAX/100));
  const applied = Math.min(openExp, cash);
  const base = Math.max(0, cash - applied);
  return { combined, applied, grossIntoPayroll: Math.max(0, combined - applied), base, ...calc(base) };
};

let pass = 0, fail = 0; const failures = [];
const check = (label, got, want) => {
  const ok = got === want;
  if (ok) pass++; else { fail++; failures.push(`${label}: got ${got}, want ${want}`); }
  console.log(`   ${ok ? "PASS" : "FAIL"}  ${label}${ok ? ` = ${got}` : ` -> got ${got}, want ${want}`}`);
};

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", headless: true });
const ctx = await browser.newContext({ viewport: { width: 480, height: 2600 } });
const errors = [];
ctx.on("weberror", e => errors.push(e.error().message));

const open = async (iso) => {
  const page = await ctx.newPage();
  page.on("pageerror", e => errors.push(e.message));
  await page.addInitScript(ts => {
    const R = Date;                 // keep the month pinned, but let the clock advance so
    const origin = R.now();         // Date.now()-derived record ids stay unique
    class F extends R {
      constructor(...a){ a.length ? super(...a) : super(ts + (R.now() - origin)); }
      static now(){ return ts + (R.now() - origin); }
    }
    window.Date = F;
  }, new Date(iso).getTime());
  await page.route("**/api/sync", r => r.fulfill({ status:200, contentType:"application/json", body:"null" }));
  await page.goto(APP_URL);
  await page.waitForTimeout(700);
  return page;
};
const addFly = async (p, amt, note) => {
  await p.getByPlaceholder("Job amount ($)").fill(String(amt));
  await p.getByPlaceholder("Note (optional)").first().fill(note);
  await p.getByRole("button", { name: "+ ADD" }).first().click(); await p.waitForTimeout(250);
  await p.getByRole("button", { name: "✓ RECEIVED" }).first().click(); await p.waitForTimeout(300);
};
const addExp = async (p, amt, note) => {
  await p.getByPlaceholder("Amount ($)", { exact: true }).fill(String(amt));
  await p.getByPlaceholder("Description (optional)").fill(note);
  await p.getByRole("button", { name: "+ ADD" }).nth(1).click(); await p.waitForTimeout(300);
};
const runPayroll = async p => { await p.getByRole("button", { name: /MARK PAYROLL RUN/ }).click(); await p.waitForTimeout(500); };
const read = async p => {
  const t = await p.locator("body").innerText();
  const slice = (a,b) => { const i=t.indexOf(a), j=t.indexOf(b,i); return i<0?"":t.slice(i, j>i?j:i+900); };
  const runCard = slice("PAYROLL RUN","EXPENSES — TAX");
  const brk = slice("MONTHLY BREAKDOWN","PAYROLL RUN LOG");
  const n = (src,re) => { const m = src.match(re); return m ? parseInt(m[1].replace(/,/g,""),10) : null; };
  return {
    balance:  n(t, /Cumulative balance\s*\$([\d,]+)/),
    waiting:  n(t, /received, waiting for payroll\s*\$([\d,]+)/),
    ranJobs:  n(t, /run this month\s*\$([\d,]+)/),
    carried:  n(t, /Carried from earlier months:\s*\$([\d,]+)/) ?? 0,
    combined: n(runCard, /Combined gross\s*\$([\d,]+)/),
    applied:  n(runCard, /Expense reimbursement \(tax-free, out\)[^\n]*\n-\$([\d,]+)/) ?? 0,
    gross:    n(runCard, /Gross into payroll\s*\$([\d,]+)/) ?? n(runCard, /Combined gross\s*\$([\d,]+)/),
    base:     n(runCard, /After-tax pay base\s*\$([\d,]+)/),
    wage:     n(runCard, /Wages \(38% of base\)\s*\$([\d,]+)/),
    net:      n(runCard, /Net paycheck to you\s*\$([\d,]+)/),
    dist:     n(runCard, /Owner distribution to you\s*\$([\d,]+)/),
    brkNet:   n(brk, /Net paycheck\s*\$([\d,]+)/),
    brkDist:  n(brk, /Owner distribution\s*\$([\d,]+)/),
    monthExp: n(t, /Reimbursed to personal \(out of payroll pool\)\s*\$([\d,]+)/) ?? 0,
    runsLogged: (t.match(/💵 Payroll run/g) || []).length,
  };
};
const assertRun = (label, r, flyBal, sales, openExp) => {
  const e = expectRun(flyBal, sales, openExp);
  check(`${label} combined gross`, r.combined, e.combined);
  check(`${label} expense deducted`, r.applied, e.applied);
  check(`${label} gross into payroll`, r.gross, e.grossIntoPayroll);
  check(`${label} pay base`, r.base, e.base);
  check(`${label} wage`, r.wage, e.wage);
  check(`${label} net paycheck`, r.net, e.net);
  check(`${label} distribution`, r.dist, e.dist);
};

// ───────────────────────── MONTH 1 ─────────────────────────
console.log("\n=== MONTH 1 (Sep) — expenses + flights, then payroll ===");
let p = await open("2026-09-05T12:00:00Z");
await p.evaluate(() => { localStorage.clear(); localStorage.setItem("sp_taxReservePct","15"); localStorage.setItem("sp_salaryPct","38"); });
await p.reload(); await p.waitForTimeout(700);
await addFly(p, 1200, "Job A");
await addExp(p, 300, "Fuel");
await addFly(p, 800, "Job B");
let r = await read(p);
check("balance after 2 jobs", r.balance, 2000);
check("waiting total", r.waiting, 2000);
assertRun("M1 preview", r, 2000, 0, 300);

console.log("\n--- run payroll #1 ---");
const m1r1 = expectRun(2000, 0, 300);
await runPayroll(p); r = await read(p);
check("balance drops to 0", r.balance, 0);
check("jobs moved to already-run", r.ranJobs, 2000);
check("carried panel clear", r.carried, 0);
check("breakdown net = run net", r.brkNet, m1r1.net);
check("breakdown dist = run dist", r.brkDist, m1r1.dist);

console.log("\n--- more expenses + flight, then payroll #2 (same month) ---");
await addExp(p, 200, "Parts");
await addFly(p, 1000, "Job C");
r = await read(p);
assertRun("M1 2nd preview", r, 1000, 0, 200);   // only the NEW $200, not the absorbed $300
const m1r2 = expectRun(1000, 0, 200);
await runPayroll(p); r = await read(p);
check("2 runs logged", r.runsLogged, 2);
check("breakdown net = sum of both runs", r.brkNet, m1r1.net + m1r2.net);
check("breakdown dist = sum of both runs", r.brkDist, m1r1.dist + m1r2.dist);
check("balance 0 after run 2", r.balance, 0);
await p.close();

// ───────────────────────── MONTH 2 — NO payroll ─────────────────────────
console.log("\n=== MONTH 2 (Oct) — expenses + flight, payroll NOT run ===");
p = await open("2026-10-08T12:00:00Z");
r = await read(p);
check("fresh month starts with no carried expenses", r.carried, 0);
await addExp(p, 400, "Oct fuel");
await addFly(p, 600, "Oct job");
r = await read(p);
check("Oct month expenses", r.monthExp, 400);
assertRun("M2 preview", r, 600, 0, 400);
await p.close();  // month ends WITHOUT running payroll

// ───────────────────────── MONTH 3 — carryover ─────────────────────────
console.log("\n=== MONTH 3 (Nov) — Oct expense must carry (no Oct payroll) ===");
p = await open("2026-11-04T12:00:00Z");
r = await read(p);
check("Oct $400 carried into Nov", r.carried, 400);
check("Oct flying $600 still in balance", r.balance, 600);
await addFly(p, 1400, "Nov job");
r = await read(p);
check("balance = Oct 600 + Nov 1400", r.balance, 2000);
assertRun("M3 preview (carried 400)", r, 2000, 0, 400);
const m3r = expectRun(2000, 0, 400);
await runPayroll(p); r = await read(p);
check("carried cleared after absorbing", r.carried, 0);
check("Nov breakdown net", r.brkNet, m3r.net);
await p.close();

// ───────────────────────── MONTH 4 — no re-carry ─────────────────────────
console.log("\n=== MONTH 4 (Dec) — absorbed expense must NOT come back ===");
p = await open("2026-12-03T12:00:00Z");
r = await read(p);
check("no re-carry of absorbed expense", r.carried, 0);
await addFly(p, 1500, "Dec job");
r = await read(p);
assertRun("M4 preview (no expenses)", r, 1500, 0, 0);

console.log("\n--- business/held expense must NOT reduce payroll ---");
await addExp(p, 500, "Held");
await p.getByRole("button", { name: "→ BUSINESS" }).first().click(); await p.waitForTimeout(400);
r = await read(p);
assertRun("M4 w/ business expense", r, 1500, 0, 0);
await p.close();

// ───────────────────────── MONTH 5 — held expense doesn't carry ─────────────
console.log("\n=== MONTH 5 (Jan) — business-held expense must not carry ===");
p = await open("2027-01-06T12:00:00Z");
r = await read(p);
check("held expense did not carry", r.carried, 0);
check("Dec's un-run $1,500 still carries", r.balance, 1500);
await p.close();


// ───────────────── MONTH 6-8 — two months with NO payroll at all ─────────────────
console.log("\n=== MONTH 6 (Feb) — expense + flight, NO payroll ===");
p = await open("2027-02-05T12:00:00Z");
await addExp(p, 250, "Feb fuel");
await addFly(p, 700, "Feb job");
r = await read(p);
check("Feb balance = Dec 1500 + Feb 700", r.balance, 2200);
assertRun("M6 preview", r, 2200, 0, 250);
await p.close();

console.log("\n=== MONTH 7 (Mar) — still NO payroll; Feb must carry alongside Mar ===");
p = await open("2027-03-05T12:00:00Z");
r = await read(p);
check("Feb $250 carried into Mar", r.carried, 250);
await addExp(p, 150, "Mar parts");
await addFly(p, 500, "Mar job");
r = await read(p);
check("balance = 2200 + Mar 500", r.balance, 2700);
check("Mar's own expenses", r.monthExp, 150);
assertRun("M7 preview (250 carried + 150 own)", r, 2700, 0, 400);
await p.close();

console.log("\n=== MONTH 8 (Apr) — both prior months carry, then payroll ===");
p = await open("2027-04-05T12:00:00Z");
r = await read(p);
check("Feb+Mar carried into Apr", r.carried, 400);
check("balance carried across 3 un-run months", r.balance, 2700);
assertRun("M8 preview", r, 2700, 0, 400);
await runPayroll(p); r = await read(p);
check("carried cleared after payroll", r.carried, 0);
await p.close();

console.log("\n=== MONTH 9 (May) — nothing should linger ===");
p = await open("2027-05-05T12:00:00Z");
r = await read(p);
check("no lingering carry", r.carried, 0);
check("no lingering balance", r.balance, 0);
await p.close();

// ───────────────── PARTIAL ABSORPTION — expense bigger than the cash ─────────────
console.log("\n=== PARTIAL: expense larger than available cash ===");
p = await open("2027-06-05T12:00:00Z");
await addExp(p, 900, "Big repair");
await addFly(p, 300, "Small job");
r = await read(p);
// cash = round(300*.85) = 255 -> only 255 of the 900 can be absorbed
assertRun("partial preview", r, 300, 0, 900);
check("only cash-limited amount deducted", r.applied, 255);
check("pay base floored at 0", r.base, 0);
await runPayroll(p); await p.close();

console.log("\n=== PARTIAL carry: remaining 645 must carry to next month ===");
p = await open("2027-07-05T12:00:00Z");
r = await read(p);
check("remainder carried (900-255)", r.carried, 645);
await addFly(p, 2000, "Jul job");
r = await read(p);
assertRun("partial remainder applied", r, 2000, 0, 645);
await runPayroll(p); r = await read(p);
check("remainder fully cleared", r.carried, 0);
await p.close();

// ───────────────── SALES + FLYING combined ─────────────────
console.log("\n=== SALES + FLYING together with an expense ===");
p = await open("2027-08-05T12:00:00Z");
await addFly(p, 1000, "Aug job");
await p.getByPlaceholder("Monthly payout ($)").fill("500");
await p.getByRole("button", { name: "+ SET" }).click(); await p.waitForTimeout(300);
const recvBtns = await p.getByRole("button", { name: "✓ RECEIVED" }).count();
if (recvBtns > 0) { await p.getByRole("button", { name: "✓ RECEIVED" }).first().click(); await p.waitForTimeout(300); }
await addExp(p, 200, "Aug fuel");
r = await read(p);
check("combined gross = flying 1000 + sales 500", r.combined, 1500);
assertRun("sales+flying preview", r, 1000, 500, 200);
await runPayroll(p); r = await read(p);
check("balance cleared after combined run", r.balance, 0);
await p.close();

console.log(`\n================  ${pass} passed, ${fail} failed  ================`);
if (failures.length) console.log("FAILURES:\n - " + failures.join("\n - "));
console.log("page errors:", errors.length ? errors : "none");
await browser.close();
process.exit(fail ? 1 : 0);
