import { useState, useEffect, useRef } from "react";

const SYNC_URL = "/api/sync";

const FEDERAL_FICA = 0.0765;
const FEDERAL_TAX_RATE = 0.10;
const SC_TAX_RATE = 0.05;
const PAYROLL_THRESHOLD = 1500;
const DEFAULT_TAX_RESERVE_PCT = 15;

const DARK = {
  bg:        "#0a0a14",
  bgGrad:    "radial-gradient(ellipse at 15% 15%, #1a0a2e 0%, transparent 55%), radial-gradient(ellipse at 85% 85%, #0a1a2e 0%, transparent 55%)",
  card:      "#0f0f1f",
  cardBorder:"#2a2a4a",
  text:      "#e8e8ff",
  textSub:   "#c8c8e8",
  textMuted: "#8888aa",
  textDim:   "#555577",
  inputBg:   "#0a0a14",
  inputBorder:"#2a2a4a",
  sliderTrack:"#1a1a2e",
  rowBorder:  "#1a1a2e",
  heroFly:   "linear-gradient(135deg,#0f1f0f,#0f0f1f)",
  heroYtd:   "linear-gradient(135deg,#0f0f2f,#0f0f1f)",
  toggleBg:  "#1a1a2e",
};
const LIGHT = {
  bg:        "#f0f2f8",
  bgGrad:    "radial-gradient(ellipse at 15% 15%, #e8e0f8 0%, transparent 55%), radial-gradient(ellipse at 85% 85%, #ddeeff 0%, transparent 55%)",
  card:      "#ffffff",
  cardBorder:"#d8daf0",
  text:      "#1a1a3a",
  textSub:   "#2a2a4a",
  textMuted: "#6666aa",
  textDim:   "#9999bb",
  inputBg:   "#f8f8ff",
  inputBorder:"#c8cae8",
  sliderTrack:"#d0d2e8",
  rowBorder:  "#e8eaf8",
  heroFly:   "linear-gradient(135deg,#e8f8ee,#f0f0ff)",
  heroYtd:   "linear-gradient(135deg,#ede8ff,#f0f0ff)",
  toggleBg:  "#e0e2f0",
};

const A = {
  green:  "#16a869",
  greenL: "#4fffb0",
  red:    "#e5405e",
  yellow: "#d4a000",
  yellowL:"#ffe066",
  purple: "#7c5cbf",
  purpleL:"#a78bfa",
  blue:   "#2a7fd4",
  blueL:  "#60a5fa",
};

function fmt(val) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Math.max(0, val));
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function calcPayroll(gross, salaryPct) {
  const wage = Math.round(gross * (salaryPct / 100));
  const erFICA = Math.round(wage * FEDERAL_FICA);
  const eeFICA = Math.round(wage * FEDERAL_FICA);
  const fedWH = Math.round(wage * FEDERAL_TAX_RATE);
  const scWH = Math.round(wage * SC_TAX_RATE);
  const netCheck = Math.max(0, wage - eeFICA - fedWH - scWH);
  const totalCost = wage + erFICA;
  const afterPayroll = Math.max(0, gross - totalCost);
  return { wage, erFICA, eeFICA, fedWH, scWH, netCheck, totalCost, afterPayroll };
}

function RiskBadge({ pct }) {
  const [label, color] = pct < 28 ? ["HIGH", A.red] : pct < 35 ? ["MOD", A.yellow] : ["SAFE", A.green];
  return <span style={{ fontSize: 10, color, border: `1px solid ${color}`, borderRadius: 4, padding: "1px 6px", letterSpacing: "0.1em", marginLeft: 8 }}>{label}</span>;
}

function SliderRow({ label, value, min, max, onChange, color, showRisk, hint, T }) {
  const id = label.replace(/\s+/g, "-");
  return (
    <div style={{ marginBottom: 16 }}>
      <style>{`.sl-${id}{-webkit-appearance:none;appearance:none;height:4px;border-radius:2px;background:${T.sliderTrack};outline:none;cursor:pointer;width:100%}.sl-${id}::-webkit-slider-thumb{-webkit-appearance:none;width:16px;height:16px;border-radius:50%;background:${color};cursor:pointer;box-shadow:0 0 8px ${color}55}`}</style>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: T.textMuted, letterSpacing: "0.12em" }}>{label}</span>
        <div style={{ display: "flex", alignItems: "center" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{value}%</span>
          {showRisk && <RiskBadge pct={value} />}
        </div>
      </div>
      <input type="range" className={`sl-${id}`} min={min} max={max} value={value} onChange={e => onChange(Number(e.target.value))} />
      {hint && <div style={{ fontSize: 10, color: T.textDim, marginTop: 3 }}>{hint}</div>}
    </div>
  );
}

function Row({ label, value, sub, accent, bold, T }) {
  const isDark = T === DARK;
  const color = accent === "green" ? (isDark ? A.greenL : A.green)
    : accent === "red"    ? A.red
    : accent === "yellow" ? (isDark ? A.yellowL : A.yellow)
    : accent === "purple" ? (isDark ? A.purpleL : A.purple)
    : accent === "blue"   ? (isDark ? A.blueL : A.blue)
    : T.text;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${T.rowBorder}` }}>
      <span style={{ fontSize: 12, color: sub ? T.textMuted : T.textSub, paddingLeft: sub ? 12 : 0 }}>{sub ? "↳ " : ""}{label}</span>
      <span style={{ fontSize: 12, fontWeight: bold ? 700 : 500, color }}>{value}</span>
    </div>
  );
}

function SectionLabel({ text, T }) {
  return <div style={{ fontSize: 10, color: T.textDim, letterSpacing: "0.15em", marginTop: 14, marginBottom: 2 }}>{text}</div>;
}

function Card({ children, accentColor, T, style = {} }) {
  return (
    <div style={{ background: T.card, border: `1px solid ${accentColor || T.cardBorder}`, borderRadius: 12, padding: "18px 20px", ...style }}>
      {children}
    </div>
  );
}

function StatBox({ label, value, color, T }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 10, color: T.textMuted, letterSpacing: "0.12em", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color, fontFamily: "'Syne', sans-serif" }}>{value}</div>
    </div>
  );
}

function Tab({ label, active, onClick, color, T }) {
  return (
    <button onClick={onClick} style={{
      background: active ? color + "22" : "transparent",
      border: `1px solid ${active ? color : T.cardBorder}`,
      borderRadius: 8, padding: "8px 18px", cursor: "pointer",
      color: active ? color : T.textMuted, fontSize: 11,
      fontFamily: "'DM Mono', monospace", letterSpacing: "0.12em",
      transition: "all 0.2s"
    }}>{label}</button>
  );
}

function ThemeToggle({ dark, onToggle, T }) {
  return (
    <button onClick={onToggle} title="Toggle light/dark" style={{
      background: T.toggleBg, border: `1px solid ${T.cardBorder}`,
      borderRadius: 20, padding: "5px 12px", cursor: "pointer",
      fontSize: 14, display: "flex", alignItems: "center", gap: 6,
      color: T.textMuted, transition: "all 0.2s"
    }}>
      {dark ? "☀️" : "🌙"}
    </button>
  );
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const now = new Date();
const currentMonth = now.getMonth();
const currentYear = now.getFullYear();

function getMonthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}`;
}

export default function App() {
  const [dark, setDark] = useState(false);
  const T = dark ? DARK : LIGHT;
  const green  = dark ? A.greenL  : A.green;
  const yellow = dark ? A.yellowL : A.yellow;
  const purple = dark ? A.purpleL : A.purple;
  const blue   = dark ? A.blueL   : A.blue;

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = e => setDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  function ls(key, fallback) {
    try { const v = localStorage.getItem(key); return v !== null ? JSON.parse(v) : fallback; } catch { return fallback; }
  }
  function usePersist(key, fallback) {
    const [val, setVal] = useState(() => ls(key, fallback));
    const set = v => { const next = typeof v === "function" ? v(val) : v; localStorage.setItem(key, JSON.stringify(next)); setVal(next); };
    return [val, set];
  }

  const [syncStatus, setSyncStatus] = useState("synced");
  const initialized = useRef(false);

  const [tab, setTab] = useState("monthly");
  const [recodeDesc, setRecodeDesc] = useState("");
  const [recodeStatus, setRecodeStatus] = useState(null); // null | "loading" | "done" | "error"
  const [recodeMsg, setRecodeMsg] = useState("");
  const [flySalaryPct, setFlySalaryPct] = usePersist("sp_flySalaryPct", 35);
  const [salesSalaryPct, setSalesSalaryPct] = usePersist("sp_salesSalaryPct", 40);
  const [taxReservePct, setTaxReservePct] = usePersist("sp_taxReservePct", DEFAULT_TAX_RESERVE_PCT);
  const [flyJobs, setFlyJobs] = usePersist("sp_flyJobs", []);
  const [flyInput, setFlyInput] = useState("");
  const [flyNote, setFlyNote] = useState("");
  const [salesEntries, setSalesEntries] = usePersist("sp_salesEntries", []);
  const [salesInput, setSalesInput] = useState("");
  const [salesNoteInput, setSalesNoteInput] = useState("");
  const [expenses, setExpenses] = usePersist("sp_expenses", []);
  const [expInput, setExpInput] = useState("");
  const [expNote, setExpNote] = useState("");
  const [payrollRuns, setPayrollRuns] = usePersist("sp_payrollRuns", []);
  const [expensePayouts, setExpensePayouts] = usePersist("sp_expensePayouts", []);
  const [healthPremium, setHealthPremium] = usePersist("sp_healthPremium", 0);
  const [reserveEvents, setReserveEvents] = usePersist("sp_reserveEvents", []);
  const [flyRunNote, setFlyRunNote] = useState("");
  const [salesRunNote, setSalesRunNote] = useState("");
  const [reserveCorrectionInput, setReserveCorrectionInput] = useState("");
  const [reserveWithdrawInput, setReserveWithdrawInput] = useState("");
  const [reserveNoteInput, setReserveNoteInput] = useState("");

  // Load from server on mount
  useEffect(() => {
    fetch(SYNC_URL)
      .then(r => r.json())
      .then(data => {
        if (data && typeof data === "object") {
          if (data.flyJobs)        { setFlyJobs(data.flyJobs);               localStorage.setItem("sp_flyJobs", JSON.stringify(data.flyJobs)); }
          if (data.salesEntries)   { setSalesEntries(data.salesEntries);     localStorage.setItem("sp_salesEntries", JSON.stringify(data.salesEntries)); }
          if (data.expenses)       { setExpenses(data.expenses);             localStorage.setItem("sp_expenses", JSON.stringify(data.expenses)); }
          if (data.payrollRuns)    { setPayrollRuns(data.payrollRuns);       localStorage.setItem("sp_payrollRuns", JSON.stringify(data.payrollRuns)); }
          if (data.expensePayouts) { setExpensePayouts(data.expensePayouts); localStorage.setItem("sp_expensePayouts", JSON.stringify(data.expensePayouts)); }
          if (data.flySalaryPct   !== undefined) { setFlySalaryPct(data.flySalaryPct);       localStorage.setItem("sp_flySalaryPct", JSON.stringify(data.flySalaryPct)); }
          if (data.salesSalaryPct !== undefined) { setSalesSalaryPct(data.salesSalaryPct); localStorage.setItem("sp_salesSalaryPct", JSON.stringify(data.salesSalaryPct)); }
          if (data.taxReservePct  !== undefined) { setTaxReservePct(data.taxReservePct);   localStorage.setItem("sp_taxReservePct", JSON.stringify(data.taxReservePct)); }
          if (data.healthPremium  !== undefined) { setHealthPremium(data.healthPremium);   localStorage.setItem("sp_healthPremium", JSON.stringify(data.healthPremium)); }
          if (data.reserveEvents)                { setReserveEvents(data.reserveEvents);   localStorage.setItem("sp_reserveEvents", JSON.stringify(data.reserveEvents)); }
        }
        setSyncStatus("synced");
      })
      .catch(() => setSyncStatus("error"))
      .finally(() => { initialized.current = true; });
  }, []);

  // Debounced save
  useEffect(() => {
    if (!initialized.current) return;
    setSyncStatus("pending");
    const t = setTimeout(() => {
      fetch(SYNC_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flyJobs, salesEntries, expenses, payrollRuns, expensePayouts, flySalaryPct, salesSalaryPct, taxReservePct, healthPremium, reserveEvents }),
      })
        .then(r => r.ok ? setSyncStatus("synced") : setSyncStatus("error"))
        .catch(() => setSyncStatus("error"));
    }, 1000);
    return () => clearTimeout(t);
  }, [flyJobs, salesEntries, expenses, payrollRuns, expensePayouts, flySalaryPct, salesSalaryPct, taxReservePct, healthPremium, reserveEvents]);

  const [viewMonth, setViewMonth] = useState(currentMonth);
  const [viewYear, setViewYear] = useState(currentYear);
  const viewKey = `${viewYear}-${String(viewMonth+1).padStart(2,"0")}`;

  function addFlyJob() {
    const amt = parseFloat(flyInput);
    if (isNaN(amt) || amt <= 0) return;
    setFlyJobs(prev => [...prev, { id: Date.now(), amount: amt, note: flyNote, monthKey: getMonthKey(new Date()) }]);
    setFlyInput(""); setFlyNote("");
  }
  function removeFlyJob(id) { setFlyJobs(prev => prev.filter(j => j.id !== id)); }

  function addSales() {
    const amt = parseFloat(salesInput);
    if (isNaN(amt) || amt <= 0) return;
    const existing = salesEntries.find(e => e.monthKey === viewKey);
    if (existing) {
      setSalesEntries(prev => prev.map(e => e.monthKey === viewKey ? { ...e, amount: amt, note: salesNoteInput || e.note } : e));
    } else {
      setSalesEntries(prev => [...prev, { id: Date.now(), amount: amt, note: salesNoteInput, monthKey: viewKey }]);
    }
    setSalesInput(""); setSalesNoteInput("");
  }

  function addExpense() {
    const amt = parseFloat(expInput);
    if (isNaN(amt) || amt <= 0) return;
    setExpenses(prev => [...prev, { id: Date.now(), amount: amt, note: expNote, monthKey: getMonthKey(new Date()), banked: false }]);
    setExpInput(""); setExpNote("");
  }
  function removeExpense(id) { setExpenses(prev => prev.filter(e => e.id !== id)); }
  function toggleBanked(id) { setExpenses(prev => prev.map(e => e.id === id ? { ...e, banked: !e.banked } : e)); }
  function applyBanked() { setExpenses(prev => prev.map(e => e.banked ? { ...e, banked: false } : e)); }

  // Cumulative flying balance — all jobs ever minus all runs ever minus already-taken expense payouts
  const totalFlyJobsGross  = flyJobs.reduce((s, j) => s + j.amount, 0);
  const totalFlyRunsGross  = payrollRuns.filter(r => r.type === "flying").reduce((s, r) => s + (r.gross || 0), 0);
  const totalFlyExpPayoutGross = expensePayouts.reduce((s, p) => s + (p.flyGrossTaken || 0), 0);
  const flyingBalance      = Math.max(0, totalFlyJobsGross - totalFlyRunsGross - totalFlyExpPayoutGross);
  const flyBalancePct      = Math.min(100, (flyingBalance / PAYROLL_THRESHOLD) * 100);

  // Reserve balance helpers
  const reserveBalance = reserveEvents.reduce((s, e) => s + e.amount, 0);
  function addReserveDeposit(amount, note) {
    setReserveEvents(prev => [...prev, { id: Date.now(), date: new Date().toISOString(), type: "deposit", amount: Math.round(amount), note }]);
  }
  function applyReserveCorrection() {
    const target = parseFloat(reserveCorrectionInput);
    if (isNaN(target)) return;
    const delta = target - reserveBalance;
    setReserveEvents(prev => [...prev, { id: Date.now(), date: new Date().toISOString(), type: "correction", amount: Math.round(delta), note: reserveNoteInput || `Corrected to ${fmt(target)}` }]);
    setReserveCorrectionInput(""); setReserveNoteInput("");
  }
  function applyReserveWithdrawal() {
    const amt = parseFloat(reserveWithdrawInput);
    if (isNaN(amt) || amt <= 0) return;
    setReserveEvents(prev => [...prev, { id: Date.now(), date: new Date().toISOString(), type: "withdrawal", amount: -Math.round(amt), note: reserveNoteInput || "Withdrawal" }]);
    setReserveWithdrawInput(""); setReserveNoteInput("");
  }
  function removeReserveEvent(id) { setReserveEvents(prev => prev.filter(e => e.id !== id)); }

  // Payroll run log
  function markFlyPayrollRun() {
    const taxAmt = Math.round(flyingBalance * taxReservePct / 100);
    const payBase = flyingBalance - taxAmt;
    const runP = calcPayroll(payBase, flySalaryPct);
    const run = {
      id: Date.now(),
      type: "flying",
      date: new Date().toISOString(),
      monthKey: viewKey,
      gross: flyingBalance,
      taxReserve: taxAmt,
      wage: runP.wage,
      netCheck: runP.netCheck,
      erFICA: runP.erFICA,
      eeFICA: runP.eeFICA,
      fedWH: runP.fedWH,
      scWH: runP.scWH,
      note: flyRunNote,
    };
    setPayrollRuns(prev => [...prev, run]);
    addReserveDeposit(taxAmt, `Auto — Flying payroll (${taxReservePct}% of ${fmt(flyingBalance)})`);
    setFlyRunNote("");
  }
  function markSalesPayrollRun() {
    const taxAmt = Math.round(monthSalesGross * taxReservePct / 100);
    const payBase = monthSalesGross - taxAmt;
    const tmpP = calcPayroll(payBase, salesSalaryPct);
    const run = {
      id: Date.now(),
      type: "sales",
      date: new Date().toISOString(),
      monthKey: viewKey,
      gross: monthSalesGross,
      taxReserve: taxAmt,
      wage: tmpP.wage,
      netCheck: tmpP.netCheck,
      erFICA: tmpP.erFICA,
      eeFICA: tmpP.eeFICA,
      fedWH: tmpP.fedWH,
      scWH: tmpP.scWH,
      note: salesRunNote,
    };
    setPayrollRuns(prev => [...prev, run]);
    addReserveDeposit(taxAmt, `Auto — Sales payroll (${taxReservePct}% of ${fmt(monthSalesGross)})`);
    setSalesRunNote("");
  }
  function removePayrollRun(id) { setPayrollRuns(prev => prev.filter(r => r.id !== id)); }

  const monthPayrollRuns  = payrollRuns.filter(r => r.monthKey === viewKey);
  const flyRunThisMonth   = monthPayrollRuns.some(r => r.type === "flying");
  const salesRunThisMonth = monthPayrollRuns.some(r => r.type === "sales");
  const payrollReady      = flyingBalance >= PAYROLL_THRESHOLD;

  // Expense-only payout (skip payroll)
  function logExpensePayout(action, taxAccount) {
    // action: "hold" = keep remaining in corp, "distribute" = take it all out
    // taxAccount: "business" (bank auto-withholds 15%) or "personal" (no withholding) — only matters for "distribute"
    const remaining = Math.max(0, monthGross - monthExpTotal);
    const flyShare = monthGross > 0 ? monthFlyGross / monthGross : 0;
    const flyGrossTaken = action === "distribute" ? monthGross * flyShare : monthExpTotal * flyShare;
    const taxReserveAmt = (action === "distribute" && taxAccount === "business")
      ? Math.round(remaining * taxReservePct / 100)
      : 0;
    setExpensePayouts(prev => [...prev, {
      id: Date.now(),
      date: new Date().toISOString(),
      monthKey: viewKey,
      expenseAmount: monthExpTotal,
      grossAmount: monthGross,
      remainingAmount: remaining,
      flyGrossTaken: Math.round(flyGrossTaken),
      action,
      taxAccount: action === "distribute" ? taxAccount : null,
      taxReserveAmt,
    }]);
    if (taxReserveAmt > 0) {
      addReserveDeposit(taxReserveAmt, `Auto — Expense reimbursement distribution to business acct (${taxReservePct}% of ${fmt(remaining)})`);
    }
  }
  function removeExpensePayout(id) { setExpensePayouts(prev => prev.filter(p => p.id !== id)); }
  const monthExpensePayout = expensePayouts.find(p => p.monthKey === viewKey);

  // Month data
  const monthFlyJobs = flyJobs.filter(j => j.monthKey === viewKey);
  const monthFlyGross = monthFlyJobs.reduce((s, j) => s + j.amount, 0);
  const monthSalesEntry = salesEntries.find(e => e.monthKey === viewKey);
  const monthSalesGross = monthSalesEntry ? monthSalesEntry.amount : 0;
  const monthExpenses = expenses.filter(e => e.monthKey === viewKey);
  const monthActiveExp = monthExpenses.filter(e => !e.banked);
  const monthBankedExp = monthExpenses.filter(e => e.banked);
  const monthExpTotal  = monthActiveExp.reduce((s, e) => s + e.amount, 0);
  const monthBankedTotal = monthBankedExp.reduce((s, e) => s + e.amount, 0);

  // YTD data
  const ytdFlyGross   = flyJobs.filter(j => j.monthKey.startsWith(String(viewYear))).reduce((s,j) => s+j.amount, 0);
  const ytdSalesGross = salesEntries.filter(e => e.monthKey.startsWith(String(viewYear))).reduce((s,e) => s+e.amount, 0);
  const ytdExpenses   = expenses.filter(e => e.monthKey.startsWith(String(viewYear)) && !e.banked).reduce((s,e) => s+e.amount, 0);
  const ytdGross = ytdFlyGross + ytdSalesGross;

  // Monthly calcs — order: gross → tax reserve → expenses → payroll
  const monthGross        = monthFlyGross + monthSalesGross;
  const taxFactor         = 1 - taxReservePct / 100;
  const monthTaxReserve   = Math.round(monthGross * taxReservePct / 100);
  const monthAfterTax     = Math.max(0, monthGross - monthTaxReserve);
  const monthNetProfit    = Math.max(0, monthAfterTax - monthExpTotal);
  const monthPayrollBase  = monthNetProfit;
  const flyAfterTax       = monthFlyGross * taxFactor;
  const salesAfterTax     = monthSalesGross * taxFactor;
  const flyExpShare       = monthAfterTax > 0 ? monthExpTotal * (flyAfterTax / monthAfterTax) : 0;
  const salesExpShare     = monthAfterTax > 0 ? monthExpTotal * (salesAfterTax / monthAfterTax) : 0;
  const flyP   = calcPayroll(Math.max(0, flyAfterTax - flyExpShare), flySalaryPct);
  const salesP = calcPayroll(Math.max(0, salesAfterTax - salesExpShare), salesSalaryPct);
  const monthAfterPayroll = flyP.afterPayroll + salesP.afterPayroll;
  const monthDistribution = Math.max(0, monthAfterPayroll);
  const monthNetPaycheck  = flyP.netCheck + salesP.netCheck;
  const monthTakeHome     = monthNetPaycheck + monthDistribution;

  // YTD calcs
  const ytdNetProfit    = Math.max(0, ytdGross - ytdExpenses);
  const ytdTaxReserve   = Math.round(ytdGross * taxReservePct / 100);
  const ytdAfterTax     = Math.max(0, ytdGross - ytdTaxReserve);
  const ytdFlyAfterTax  = ytdFlyGross * taxFactor;
  const ytdSalesAfterTax= ytdSalesGross * taxFactor;
  const ytdFlyExpShare  = ytdAfterTax > 0 ? ytdExpenses * (ytdFlyAfterTax / ytdAfterTax) : 0;
  const ytdSalesExpShare= ytdAfterTax > 0 ? ytdExpenses * (ytdSalesAfterTax / ytdAfterTax) : 0;
  const ytdFlyP         = calcPayroll(Math.max(0, ytdFlyAfterTax - ytdFlyExpShare), flySalaryPct);
  const ytdSalesP       = calcPayroll(Math.max(0, ytdSalesAfterTax - ytdSalesExpShare), salesSalaryPct);
  const ytdAfterPayroll = ytdFlyP.afterPayroll + ytdSalesP.afterPayroll;
  const ytdDistribution = Math.max(0, ytdAfterPayroll);
  const ytdNetPaycheck  = ytdFlyP.netCheck + ytdSalesP.netCheck;
  const ytdTakeHome     = ytdNetPaycheck + ytdDistribution;

  // YTD projections (only meaningful for current year)
  const monthsElapsed     = viewYear === currentYear ? currentMonth + 1 : 12;
  const projFlyGross      = monthsElapsed > 0 ? Math.round((ytdFlyGross / monthsElapsed) * 12) : 0;
  const projSalesGross    = monthsElapsed > 0 ? Math.round((ytdSalesGross / monthsElapsed) * 12) : 0;
  const projGross         = projFlyGross + projSalesGross;
  const projTakeHome      = monthsElapsed > 0 ? Math.round(((ytdTakeHome + ytdExpenses) / monthsElapsed) * 12) : 0;
  const projTaxLiability  = Math.round((monthsElapsed > 0 ? (ytdDistribution / monthsElapsed) * 12 : 0) * 0.27);

  // Year-end W-2 check — total wages paid via actual payroll runs this year
  const ytdWagesPaid = payrollRuns
    .filter(r => r.monthKey && r.monthKey.startsWith(String(viewYear)))
    .reduce((s, r) => s + (r.wage || 0), 0);
  const ytdPayrollBase = Math.max(0, ytdAfterTax - ytdExpenses);
  const w2Ratio  = ytdPayrollBase > 0 ? Math.round((ytdWagesPaid / ytdPayrollBase) * 100) : 0;
  const w2Status = w2Ratio >= 40 ? "SAFE" : w2Ratio >= 28 ? "REVIEW" : "LOW";

  // CSV export
  function exportCSV() {
    const rows = [
      ["Type","Date","Amount","Note","Category"],
      ...flyJobs.map(j => ["Flying Job", j.monthKey, j.amount, j.note || "", "Income"]),
      ...salesEntries.map(e => ["Sales Payout", e.monthKey, e.amount, e.note || "", "Income"]),
      ...expenses.map(e => ["Expense", e.monthKey, e.amount, e.note || "", e.banked ? "Banked Expense" : "Expense"]),
      ...payrollRuns.map(r => ["Payroll Run", r.date ? r.date.slice(0,10) : r.monthKey, r.netCheck, `${r.type} | gross ${r.gross}${r.note ? " | " + r.note : ""}`, "Payroll"]),
      ...expensePayouts.map(p => ["Expense Payout", p.date ? p.date.slice(0,10) : p.monthKey, p.expenseAmount, `action: ${p.action} | remaining: ${p.remainingAmount}`, "Reimbursement"]),
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `scorp-payroll-${viewYear}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); } else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); } else setViewMonth(m => m + 1);
  }

  // PDF export — uses browser print with hidden print-only div
  function exportPDF() { window.print(); }

  const inputStyle = {
    background: T.inputBg, border: `1px solid ${T.inputBorder}`, borderRadius: 8,
    color: T.text, fontSize: 13, padding: "9px 12px",
    fontFamily: "'DM Mono', monospace", outline: "none", width: "100%", boxSizing: "border-box",
    transition: "background 0.2s, border 0.2s, color 0.2s"
  };
  const btnStyle = (c) => ({
    background: c + "22", border: `1px solid ${c}`, borderRadius: 8,
    color: c, fontSize: 12, padding: "9px 16px", cursor: "pointer",
    fontFamily: "'DM Mono', monospace", letterSpacing: "0.08em", whiteSpace: "nowrap"
  });

  return (
    <div style={{ minHeight: "100vh", background: T.bg, backgroundImage: T.bgGrad, fontFamily: "'DM Mono', monospace", padding: "28px 16px", transition: "background 0.3s, color 0.3s" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Syne:wght@700;800&display=swap');
        input[type=number]{-moz-appearance:textfield}
        input[type=number]::-webkit-outer-spin-button,input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none}
        input::placeholder{color:${T.textDim}}
        #print-area { display: none; }
        @media print {
          body > * { display: none !important; }
          #print-area {
            display: block !important;
            font-family: 'DM Mono', monospace;
            color: #1a1a3a;
            padding: 32px;
            max-width: 680px;
            margin: 0 auto;
          }
          #print-area h2 { font-size: 22px; font-family: 'Syne', sans-serif; margin: 0 0 4px; }
          #print-area .sub { font-size: 11px; color: #6666aa; letter-spacing: 0.15em; margin-bottom: 24px; }
          #print-area table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          #print-area th { font-size: 10px; letter-spacing: 0.12em; color: #9999bb; text-align: left; padding: 4px 0; border-bottom: 2px solid #d8daf0; }
          #print-area td { font-size: 12px; padding: 7px 0; border-bottom: 1px solid #e8eaf8; }
          #print-area td:last-child { text-align: right; font-weight: 600; }
          #print-area .section { font-size: 10px; color: #9999bb; letter-spacing: 0.15em; margin: 16px 0 4px; }
          #print-area .total-row td { font-weight: 800; font-size: 13px; border-top: 2px solid #d8daf0; border-bottom: none; }
          #print-area .runs-table td { font-size: 11px; }
          #print-area .footer { font-size: 10px; color: #9999bb; margin-top: 32px; }
        }
      `}</style>

      {/* ── PRINT-ONLY AREA ── */}
      <div id="print-area">
        <h2>PAYROLL TRACKER</h2>
        <div className="sub">S-CORP · SOLO OPERATOR · SC · {MONTHS[viewMonth].toUpperCase()} {viewYear}</div>
        <table>
          <thead><tr><th>INCOME</th><th></th></tr></thead>
          <tbody>
            <tr><td>Flying gross</td><td>{fmt(monthFlyGross)}</td></tr>
            <tr><td>Sales gross</td><td>{fmt(monthSalesGross)}</td></tr>
            <tr><td>Total gross</td><td>{fmt(monthGross)}</td></tr>
          </tbody>
        </table>
        <table>
          <thead><tr><th>TAX RESERVE</th><th></th></tr></thead>
          <tbody>
            <tr><td>Tax reserve ({taxReservePct}% of gross)</td><td>-{fmt(monthTaxReserve)}</td></tr>
            <tr><td>After tax reserve</td><td>{fmt(monthAfterTax)}</td></tr>
          </tbody>
        </table>
        <table>
          <thead><tr><th>EXPENSES</th><th></th></tr></thead>
          <tbody>
            {monthExpenses.map(e => <tr key={e.id}><td>{e.note || "Expense"}</td><td>{fmt(e.amount)}</td></tr>)}
            <tr><td>Total expenses (tax-free)</td><td>{fmt(monthExpTotal)}</td></tr>
            <tr><td>Payroll base</td><td>{fmt(monthPayrollBase)}</td></tr>
          </tbody>
        </table>
        <table>
          <thead><tr><th>PAYROLL</th><th></th></tr></thead>
          <tbody>
            <tr><td>Flying wages ({flySalaryPct}%)</td><td>{fmt(flyP.wage)}</td></tr>
            <tr><td>Flying er FICA</td><td>-{fmt(flyP.erFICA)}</td></tr>
            <tr><td>Flying net paycheck</td><td>{fmt(flyP.netCheck)}</td></tr>
            <tr><td>Sales wages ({salesSalaryPct}%)</td><td>{fmt(salesP.wage)}</td></tr>
            <tr><td>Sales er FICA</td><td>-{fmt(salesP.erFICA)}</td></tr>
            <tr><td>Sales net paycheck</td><td>{fmt(salesP.netCheck)}</td></tr>
          </tbody>
        </table>
        <table>
          <thead><tr><th>TAX RESERVE & DISTRIBUTION</th><th></th></tr></thead>
          <tbody>
            <tr><td>Tax reserve ({taxReservePct}% auto-deducted)</td><td>-{fmt(monthTaxReserve)}</td></tr>
            <tr><td>After payroll costs</td><td>{fmt(monthAfterPayroll)}</td></tr>
            <tr><td>Owner distribution</td><td>{fmt(monthDistribution)}</td></tr>
          </tbody>
        </table>
        <table>
          <tbody>
            <tr className="total-row"><td>TOTAL TO YOUR POCKET</td><td>{fmt(monthTakeHome + monthExpTotal)}</td></tr>
          </tbody>
        </table>
        {monthPayrollRuns.length > 0 && (
          <table className="runs-table">
            <thead><tr><th>PAYROLL RUNS</th><th>DATE</th><th>NET CHECK</th></tr></thead>
            <tbody>
              {monthPayrollRuns.map(r => (
                <tr key={r.id}>
                  <td>{r.type === "flying" ? "✈ Flying" : "💼 Sales"}</td>
                  <td>{fmtDate(r.date)}</td>
                  <td>{fmt(r.netCheck)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {monthExpensePayout && (
          <table className="runs-table">
            <thead><tr><th>EXPENSE REIMBURSEMENT</th><th>DATE</th><th></th></tr></thead>
            <tbody>
              <tr>
                <td>{fmt(monthExpensePayout.expenseAmount)} tax-free reimbursement</td>
                <td>{fmtDate(monthExpensePayout.date)}</td>
                <td>{monthExpensePayout.action === "hold" ? `${fmt(monthExpensePayout.remainingAmount)} held in corp` : `${fmt(monthExpensePayout.remainingAmount)} taken as distribution`}</td>
              </tr>
            </tbody>
          </table>
        )}
        <div className="footer">Estimates only. Federal ~10%, SC ~5%. Consult a CPA for filing decisions. Generated {new Date().toLocaleDateString()}.</div>
      </div>

      <div style={{ maxWidth: 780, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 11, color: green, letterSpacing: "0.2em", marginBottom: 4 }}>S-CORP · SOLO OPERATOR · SC</div>
            <h1 style={{ margin: 0, fontSize: 26, fontFamily: "'Syne', sans-serif", fontWeight: 800, color: T.text }}>PAYROLL TRACKER</h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span title={syncStatus === "synced" ? "Synced" : syncStatus === "pending" ? "Saving…" : "Sync error"} style={{ width: 8, height: 8, borderRadius: "50%", background: syncStatus === "synced" ? A.green : syncStatus === "pending" ? A.yellow : A.red, display: "inline-block", boxShadow: `0 0 6px ${syncStatus === "synced" ? A.green : syncStatus === "pending" ? A.yellow : A.red}88`, transition: "background 0.3s" }} />
            <ThemeToggle dark={dark} onToggle={() => setDark(d => !d)} T={T} />
          </div>
        </div>

        {/* Month Nav */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <button onClick={prevMonth} style={{ ...btnStyle(T.textMuted), padding: "8px 14px" }}>←</button>
          <div style={{ fontSize: 18, fontWeight: 800, color: T.text, fontFamily: "'Syne', sans-serif", flex: 1, textAlign: "center" }}>
            {MONTHS[viewMonth]} {viewYear}
          </div>
          <button onClick={nextMonth} style={{ ...btnStyle(T.textMuted), padding: "8px 14px" }}>→</button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          <Tab label="MONTHLY"  active={tab === "monthly"}  onClick={() => setTab("monthly")}  color={green}  T={T} />
          <Tab label="YTD"      active={tab === "ytd"}      onClick={() => setTab("ytd")}      color={purple} T={T} />
          <Tab label="SETTINGS" active={tab === "settings"} onClick={() => setTab("settings")} color={yellow} T={T} />
          <Tab label="AI"       active={tab === "ai"}       onClick={() => setTab("ai")}       color={blue}   T={T} />
        </div>

        {/* ── MONTHLY TAB ── */}
        {tab === "monthly" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Flying Jobs */}
            <Card accentColor={green + "44"} T={T}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontSize: 11, color: green, letterSpacing: "0.15em" }}>✈️ FLYING JOBS</span>
                {flyRunThisMonth && (
                  <span style={{ fontSize: 10, color: green, border: `1px solid ${green}`, borderRadius: 4, padding: "2px 8px" }}>✓ PAYROLL RUN</span>
                )}
              </div>
              {/* Cumulative balance tracker */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                  <span style={{ fontSize: 11, color: T.textMuted }}>Cumulative balance</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: payrollReady ? green : yellow }}>{fmt(flyingBalance)} / {fmt(PAYROLL_THRESHOLD)}</span>
                </div>
                <div style={{ height: 5, background: T.sliderTrack, borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${flyBalancePct}%`, background: payrollReady ? green : yellow, borderRadius: 3, transition: "width 0.4s" }} />
                </div>
                {!payrollReady && <div style={{ fontSize: 10, color: T.textDim, marginTop: 3 }}>Need {fmt(PAYROLL_THRESHOLD - flyingBalance)} more to run payroll</div>}
              </div>
              {payrollReady && !flyRunThisMonth && (
                <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                  <input type="text" value={flyRunNote} onChange={e => setFlyRunNote(e.target.value)} placeholder="Run note (e.g. Gusto batch #5)" style={{ ...inputStyle, flex: 1 }} onKeyDown={e => e.key === "Enter" && markFlyPayrollRun()} />
                  <button onClick={markFlyPayrollRun} style={btnStyle(green)}>✓ MARK RUN · {fmt(flyingBalance)}</button>
                </div>
              )}
              <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                <input type="number" value={flyInput} onChange={e => setFlyInput(e.target.value)} placeholder="Job amount ($)" style={{ ...inputStyle, flex: "1 1 120px" }} onKeyDown={e => e.key === "Enter" && addFlyJob()} />
                <input type="text" value={flyNote} onChange={e => setFlyNote(e.target.value)} placeholder="Note (optional)" style={{ ...inputStyle, flex: "2 1 150px" }} onKeyDown={e => e.key === "Enter" && addFlyJob()} />
                <button onClick={addFlyJob} style={btnStyle(green)}>+ ADD</button>
              </div>
              {monthFlyJobs.length === 0
                ? <div style={{ fontSize: 12, color: T.textDim, textAlign: "center", padding: "12px 0" }}>No flying jobs logged this month</div>
                : monthFlyJobs.map(j => (
                  <div key={j.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: `1px solid ${T.rowBorder}` }}>
                    <span style={{ fontSize: 12, color: T.textMuted }}>{j.note || "Flying job"}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: green }}>{fmt(j.amount)}</span>
                      <button onClick={() => removeFlyJob(j.id)} style={{ background: "none", border: "none", color: A.red, cursor: "pointer", fontSize: 14, padding: 0 }}>×</button>
                    </div>
                  </div>
                ))
              }
              {monthFlyJobs.length > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 10 }}>
                  <span style={{ fontSize: 12, color: T.textMuted }}>{monthFlyJobs.length} job{monthFlyJobs.length !== 1 ? "s" : ""} total</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: green }}>{fmt(monthFlyGross)}</span>
                </div>
              )}
            </Card>

            {/* Sales */}
            <Card accentColor={purple + "44"} T={T}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <span style={{ fontSize: 11, color: purple, letterSpacing: "0.15em" }}>💼 SALES PAYOUT — {MONTHS[viewMonth]} 10th</span>
                {monthSalesEntry && !salesRunThisMonth && (
                  <button onClick={markSalesPayrollRun} style={{ ...btnStyle(purple), padding: "2px 10px", fontSize: 10 }}>✓ MARK RUN · {fmt(monthSalesGross)}</button>
                )}
                {salesRunThisMonth && (
                  <span style={{ fontSize: 10, color: purple, border: `1px solid ${purple}`, borderRadius: 4, padding: "2px 8px" }}>✓ PAYROLL RUN</span>
                )}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                <input type="number" value={salesInput} onChange={e => setSalesInput(e.target.value)} placeholder={monthSalesEntry ? `Current: ${fmt(monthSalesEntry.amount)}` : "Monthly payout ($)"} style={{ ...inputStyle, flex: 1 }} onKeyDown={e => e.key === "Enter" && addSales()} />
                <button onClick={addSales} style={btnStyle(purple)}>{monthSalesEntry ? "UPDATE" : "+ SET"}</button>
                {monthSalesEntry && <button onClick={() => setSalesEntries(prev => prev.filter(e => e.monthKey !== viewKey))} style={btnStyle(A.red)}>RESET</button>}
              </div>
              <input type="text" value={salesNoteInput} onChange={e => setSalesNoteInput(e.target.value)} placeholder="Note (optional)" style={{ ...inputStyle, marginBottom: 4 }} onKeyDown={e => e.key === "Enter" && addSales()} />
              {monthSalesEntry && !salesRunThisMonth && (
                <input type="text" value={salesRunNote} onChange={e => setSalesRunNote(e.target.value)} placeholder="Payroll run note (e.g. Gusto batch #5)" style={{ ...inputStyle, marginBottom: 4, borderColor: purple + "66" }} />
              )}
              {monthSalesEntry && (
                <div style={{ padding: "8px 0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 12, color: T.textMuted }}>{monthSalesEntry.note || "Monthly sales payout"}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: purple }}>{fmt(monthSalesEntry.amount)}</span>
                  </div>
                </div>
              )}
            </Card>

            {/* Expenses */}
            <Card accentColor={blue + "44"} T={T}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <div style={{ fontSize: 11, color: blue, letterSpacing: "0.15em" }}>🧾 EXPENSES — TAX-FREE TO YOUR POCKET</div>
                {healthPremium > 0 && (
                  <button onClick={() => { setExpenses(prev => [...prev, { id: Date.now(), amount: healthPremium, note: "Health insurance premium", monthKey: getMonthKey(new Date()), banked: false }]); }} style={{ ...btnStyle(blue), padding: "2px 10px", fontSize: 10 }}>
                    + Health Ins. {fmt(healthPremium)}
                  </button>
                )}
              </div>
              <div style={{ fontSize: 10, color: T.textDim, marginBottom: 12 }}>Logged before payroll runs — reduces taxable base</div>
              <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                <input type="number" value={expInput} onChange={e => setExpInput(e.target.value)} placeholder="Amount ($)" style={{ ...inputStyle, flex: "1 1 120px" }} onKeyDown={e => e.key === "Enter" && addExpense()} />
                <input type="text" value={expNote} onChange={e => setExpNote(e.target.value)} placeholder="Description (optional)" style={{ ...inputStyle, flex: "2 1 150px" }} onKeyDown={e => e.key === "Enter" && addExpense()} />
                <button onClick={addExpense} style={btnStyle(blue)}>+ ADD</button>
              </div>
              {monthExpenses.length === 0
                ? <div style={{ fontSize: 12, color: T.textDim, textAlign: "center", padding: "12px 0" }}>No expenses logged this month</div>
                : monthExpenses.map(e => (
                  <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: `1px solid ${T.rowBorder}`, opacity: e.banked ? 0.55 : 1 }}>
                    <div>
                      <span style={{ fontSize: 12, color: T.textMuted }}>{e.note || "Expense"}</span>
                      {e.banked && <span style={{ fontSize: 10, color: yellow, border: `1px solid ${yellow}`, borderRadius: 4, padding: "1px 5px", marginLeft: 7, letterSpacing: "0.08em" }}>BANKED</span>}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: e.banked ? T.textDim : blue }}>{fmt(e.amount)}</span>
                      <button onClick={() => toggleBanked(e.id)} title={e.banked ? "Apply to payroll" : "Bank it — exclude from payroll"} style={{ background: e.banked ? yellow + "22" : T.toggleBg, border: `1px solid ${e.banked ? yellow : T.cardBorder}`, borderRadius: 6, color: e.banked ? yellow : T.textDim, fontSize: 10, padding: "2px 7px", cursor: "pointer", whiteSpace: "nowrap" }}>
                        {e.banked ? "APPLY" : "BANK"}
                      </button>
                      <button onClick={() => removeExpense(e.id)} style={{ background: "none", border: "none", color: A.red, cursor: "pointer", fontSize: 14, padding: 0 }}>×</button>
                    </div>
                  </div>
                ))
              }
              {monthExpenses.length > 0 && (
                <div style={{ paddingTop: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 12, color: T.textMuted }}>Applied to payroll</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: blue }}>{fmt(monthExpTotal)}</span>
                  </div>
                  {monthBankedTotal > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6, padding: "7px 10px", background: yellow + "15", borderRadius: 8, border: `1px solid ${yellow}44` }}>
                      <div>
                        <span style={{ fontSize: 12, color: yellow, fontWeight: 700 }}>🏦 Banked: {fmt(monthBankedTotal)}</span>
                        <div style={{ fontSize: 10, color: T.textDim, marginTop: 2 }}>excluded from payroll — apply when ready</div>
                      </div>
                      <button onClick={applyBanked} style={{ background: yellow + "22", border: `1px solid ${yellow}`, borderRadius: 6, color: yellow, fontSize: 10, padding: "4px 10px", cursor: "pointer", whiteSpace: "nowrap" }}>APPLY ALL</button>
                    </div>
                  )}
                </div>
              )}
            </Card>

            {/* Expense Reimbursement — skip-payroll flow */}
            {(monthExpTotal > 0 || monthBankedTotal > 0) && (
              <Card accentColor={blue + "44"} T={T}>
                <div style={{ fontSize: 11, color: blue, letterSpacing: "0.15em", marginBottom: 12 }}>💸 EXPENSE REIMBURSEMENT</div>

                {!monthExpensePayout ? (
                  <>
                    <div style={{ fontSize: 12, color: T.textSub, lineHeight: 1.8, marginBottom: 14 }}>
                      If your expenses cover most of the gross, you can skip payroll and just reimburse yourself the expenses tax-free.
                    </div>

                    {/* Math summary */}
                    <div style={{ background: T.inputBg, borderRadius: 8, padding: "12px 14px", marginBottom: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontSize: 12, color: T.textMuted }}>Total gross income</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{fmt(monthGross)}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontSize: 12, color: T.textMuted }}>Expense reimbursement (tax-free)</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: blue }}>−{fmt(monthExpTotal)}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8, borderTop: `1px solid ${T.rowBorder}` }}>
                        <span style={{ fontSize: 12, color: T.textMuted }}>Remaining in corp</span>
                        <span style={{ fontSize: 13, fontWeight: 800, color: Math.max(0, monthGross - monthExpTotal) === 0 ? green : yellow }}>
                          {fmt(Math.max(0, monthGross - monthExpTotal))}
                        </span>
                      </div>
                    </div>

                    <div style={{ fontSize: 11, color: T.textDim, marginBottom: 12 }}>What do you want to do with the remaining {fmt(Math.max(0, monthGross - monthExpTotal))}?</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button onClick={() => logExpensePayout("hold")} style={{ ...btnStyle(blue), flex: 1 }}>
                        🏦 HOLD IN CORP
                      </button>
                      <button onClick={() => logExpensePayout("distribute", "business")} style={{ ...btnStyle(purple), flex: 1 }}>
                        💰 TAKE OUT → BUSINESS ACCT
                      </button>
                      <button onClick={() => logExpensePayout("distribute", "personal")} style={{ ...btnStyle(yellow), flex: 1 }}>
                        💸 TAKE OUT → PERSONAL ACCT
                      </button>
                    </div>
                    <div style={{ fontSize: 10, color: T.textDim, marginTop: 8, lineHeight: 1.5 }}>
                      Hold: keep {fmt(Math.max(0, monthGross - monthExpTotal))} toward next payroll threshold.{"  "}
                      Business acct: pulls the full {fmt(monthGross)} out and auto-reserves {taxReservePct}% of {fmt(Math.max(0, monthGross - monthExpTotal))} for taxes (bank withholds it).{"  "}
                      Personal acct: pulls the full {fmt(monthGross)} out with no tax reserve set aside — you'll need to handle that yourself.
                    </div>
                  </>
                ) : (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: blue, marginBottom: 4 }}>
                          {fmt(monthExpensePayout.expenseAmount)} reimbursed tax-free
                        </div>
                        <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 2 }}>
                          {fmtDate(monthExpensePayout.date)}
                        </div>
                        {monthExpensePayout.action === "hold" ? (
                          <div style={{ fontSize: 11, color: yellow }}>
                            🏦 {fmt(monthExpensePayout.remainingAmount)} held in corp for next payroll
                          </div>
                        ) : (
                          <>
                            <div style={{ fontSize: 11, color: purple }}>
                              {monthExpensePayout.taxAccount === "business" ? "💰" : "💸"} {fmt(monthExpensePayout.remainingAmount)} taken as distribution → {monthExpensePayout.taxAccount === "business" ? "business acct" : "personal acct"}
                            </div>
                            {monthExpensePayout.taxReserveAmt > 0 && (
                              <div style={{ fontSize: 11, color: yellow, marginTop: 2 }}>
                                🏦 +{fmt(monthExpensePayout.taxReserveAmt)} reserved to Tax Reserves Account
                              </div>
                            )}
                          </>
                        )}
                      </div>
                      <button onClick={() => removeExpensePayout(monthExpensePayout.id)} style={{ background: "none", border: "none", color: A.red, cursor: "pointer", fontSize: 14, padding: 0 }}>×</button>
                    </div>
                  </div>
                )}
              </Card>
            )}

            {/* Monthly Breakdown */}
            <Card T={T}>
              <div style={{ fontSize: 11, color: T.textMuted, letterSpacing: "0.15em", marginBottom: 8 }}>MONTHLY BREAKDOWN</div>
              <SectionLabel text="STEP 1 — GROSS INCOME" T={T} />
              <Row label="Flying gross" value={fmt(monthFlyGross)} accent="green" T={T} />
              <Row label="Sales gross" value={fmt(monthSalesGross)} accent="purple" T={T} />
              <Row label="Total gross" value={fmt(monthGross)} bold T={T} />
              <SectionLabel text={`STEP 2 — TAX RESERVE (${taxReservePct}% AUTO-DEDUCTED FIRST)`} T={T} />
              <Row label={`Tax reserve (${taxReservePct}% → reserves account)`} value={`-${fmt(monthTaxReserve)}`} accent="yellow" bold T={T} />
              <Row label="After tax reserve" value={fmt(monthAfterTax)} bold T={T} />
              <SectionLabel text="STEP 3 — EXPENSES (TAX-FREE TO YOUR POCKET)" T={T} />
              <Row label="Expenses reimbursed to you" value={fmt(monthExpTotal)} accent="blue" bold T={T} />
              <Row label="Payroll base" value={fmt(monthPayrollBase)} bold accent="yellow" T={T} />
              <SectionLabel text="STEP 4 — PAYROLL ON PAYROLL BASE" T={T} />
              <Row label={`Flying wages (${flySalaryPct}% of payroll base)`} value={fmt(flyP.wage)} sub T={T} />
              <Row label="Flying employer FICA" value={`-${fmt(flyP.erFICA)}`} sub accent="red" T={T} />
              <Row label={`Sales wages (${salesSalaryPct}% of payroll base)`} value={fmt(salesP.wage)} sub T={T} />
              <Row label="Sales employer FICA" value={`-${fmt(salesP.erFICA)}`} sub accent="red" T={T} />
              <SectionLabel text="YOUR PAYCHECKS (AFTER WITHHOLDING)" T={T} />
              <Row label="Flying net paycheck" value={fmt(flyP.netCheck)} accent="green" T={T} />
              <Row label="Sales net paycheck" value={fmt(salesP.netCheck)} accent="purple" T={T} />
              <Row label="Combined net paycheck" value={fmt(monthNetPaycheck)} bold accent="green" T={T} />
              <SectionLabel text="STEP 5 — DISTRIBUTION" T={T} />
              <Row label="After all payroll costs" value={fmt(monthAfterPayroll)} T={T} />
              <Row label="Owner distribution" value={fmt(monthDistribution)} bold accent="purple" T={T} />
              <SectionLabel text="TOTAL TO YOUR POCKET" T={T} />
              <Row label="Expenses (tax-free)" value={fmt(monthExpTotal)} accent="blue" T={T} />
              <Row label="Net paycheck + distribution" value={fmt(monthTakeHome)} accent="green" T={T} />
              <Row label="Grand total" value={fmt(monthTakeHome + monthExpTotal)} bold accent="green" T={T} />
            </Card>

            {/* Payroll Run Log */}
            {monthPayrollRuns.length > 0 && (
              <Card accentColor={green + "33"} T={T}>
                <div style={{ fontSize: 11, color: green, letterSpacing: "0.15em", marginBottom: 12 }}>📋 PAYROLL RUN LOG</div>
                {monthPayrollRuns.map(r => (
                  <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${T.rowBorder}` }}>
                    <div>
                      <span style={{ fontSize: 12, color: r.type === "flying" ? green : purple, fontWeight: 700 }}>
                        {r.type === "flying" ? "✈ Flying" : "💼 Sales"}
                      </span>
                      <span style={{ fontSize: 11, color: T.textDim, marginLeft: 10 }}>{fmtDate(r.date)}</span>
                      {r.note && <div style={{ fontSize: 10, color: T.textDim, marginTop: 2 }}>{r.note}</div>}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 11, color: T.textDim }}>gross {fmt(r.gross)}</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: r.type === "flying" ? green : purple }}>net {fmt(r.netCheck)}</div>
                      </div>
                      <button onClick={() => removePayrollRun(r.id)} style={{ background: "none", border: "none", color: A.red, cursor: "pointer", fontSize: 14, padding: 0 }}>×</button>
                    </div>
                  </div>
                ))}
              </Card>
            )}

            {/* Tax Reserves Tracker */}
            <Card accentColor={yellow + "55"} T={T}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <span style={{ fontSize: 11, color: yellow, letterSpacing: "0.15em" }}>🏦 TAX RESERVES ACCOUNT</span>
                <span style={{ fontSize: 22, fontWeight: 800, fontFamily: "'Syne', sans-serif", color: reserveBalance >= 0 ? yellow : A.red }}>{fmt(reserveBalance)}</span>
              </div>

              {/* Correction */}
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 10, color: T.textDim, letterSpacing: "0.12em", marginBottom: 6 }}>CORRECTION — set balance to exact amount</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <input type="number" value={reserveCorrectionInput} onChange={e => setReserveCorrectionInput(e.target.value)} placeholder={`Set balance to ($) — currently ${fmt(reserveBalance)}`} style={{ ...inputStyle, flex: 2 }} onKeyDown={e => e.key === "Enter" && applyReserveCorrection()} />
                  <input type="text" value={reserveNoteInput} onChange={e => setReserveNoteInput(e.target.value)} placeholder="Note (optional)" style={{ ...inputStyle, flex: 2 }} />
                  <button onClick={applyReserveCorrection} style={btnStyle(yellow)}>CORRECT</button>
                </div>
              </div>

              {/* Withdrawal */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, color: T.textDim, letterSpacing: "0.12em", marginBottom: 6 }}>WITHDRAWAL — pull funds out</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <input type="number" value={reserveWithdrawInput} onChange={e => setReserveWithdrawInput(e.target.value)} placeholder="Withdrawal amount ($)" style={{ ...inputStyle, flex: 2 }} onKeyDown={e => e.key === "Enter" && applyReserveWithdrawal()} />
                  <button onClick={applyReserveWithdrawal} style={btnStyle(A.red)}>WITHDRAW</button>
                </div>
              </div>

              {/* Transaction history */}
              {reserveEvents.length === 0
                ? <div style={{ fontSize: 12, color: T.textDim, textAlign: "center", padding: "10px 0" }}>No reserve transactions yet — auto-deposited when you mark payroll runs</div>
                : [...reserveEvents].reverse().slice(0, 10).map(e => {
                  const color = e.type === "withdrawal" ? A.red : e.type === "correction" ? blue : yellow;
                  const label = e.type === "withdrawal" ? "WITHDRAW" : e.type === "correction" ? "CORRECTION" : "DEPOSIT";
                  return (
                    <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: `1px solid ${T.rowBorder}` }}>
                      <div>
                        <span style={{ fontSize: 10, color, border: `1px solid ${color}`, borderRadius: 4, padding: "1px 5px", marginRight: 8, letterSpacing: "0.08em" }}>{label}</span>
                        <span style={{ fontSize: 11, color: T.textMuted }}>{e.note || ""}</span>
                        <div style={{ fontSize: 10, color: T.textDim, marginTop: 2 }}>{fmtDate(e.date)}</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color }}>{e.amount >= 0 ? "+" : ""}{fmt(Math.abs(e.amount))}</span>
                        <button onClick={() => removeReserveEvent(e.id)} style={{ background: "none", border: "none", color: A.red, cursor: "pointer", fontSize: 14, padding: 0 }}>×</button>
                      </div>
                    </div>
                  );
                })
              }
            </Card>

            {/* Hero */}
            <div style={{ background: T.heroFly, border: `1px solid ${green}55`, borderRadius: 12, padding: "22px 24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                <div style={{ fontSize: 11, color: T.textMuted, letterSpacing: "0.15em" }}>{MONTHS[viewMonth].toUpperCase()} TOTAL TO YOUR POCKET</div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={exportCSV} style={{ ...btnStyle(T.textMuted), padding: "4px 12px", fontSize: 10 }}>⬇ CSV</button>
                  <button onClick={exportPDF} style={{ ...btnStyle(T.textMuted), padding: "4px 12px", fontSize: 10 }}>⬇ PDF</button>
                </div>
              </div>
              <div style={{ fontSize: 40, fontWeight: 800, color: green, fontFamily: "'Syne', sans-serif", lineHeight: 1, marginBottom: 4 }}>{fmt(monthTakeHome + monthExpTotal)}</div>
              {monthExpTotal > 0 && <div style={{ fontSize: 12, color: blue, marginBottom: 12 }}>↳ includes {fmt(monthExpTotal)} tax-free expenses</div>}
              <div style={{ display: "flex", gap: 0, borderRadius: 8, overflow: "hidden", marginBottom: 14, height: 6 }}>
                {monthGross > 0 && <>
                  <div style={{ width: `${(monthExpTotal/monthGross)*100}%`, background: blue }} />
                  <div style={{ width: `${(monthNetPaycheck/monthGross)*100}%`, background: green }} />
                  <div style={{ width: `${(monthDistribution/monthGross)*100}%`, background: purple }} />
                  <div style={{ width: `${(monthTaxReserve/monthGross)*100}%`, background: yellow }} />
                </>}
              </div>
              <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                <StatBox label="EXPENSES"     value={fmt(monthExpTotal)}    color={blue}   T={T} />
                <StatBox label="TAX RESERVE"  value={fmt(monthTaxReserve)}  color={yellow} T={T} />
                <StatBox label="PAYCHECK"     value={fmt(monthNetPaycheck)} color={green}  T={T} />
                <StatBox label="DISTRIBUTION" value={fmt(monthDistribution)} color={purple} T={T} />
              </div>
              <div style={{ fontSize: 12, color: T.textMuted, marginTop: 14 }}>
                Taxable base: <span style={{ color: yellow, fontWeight: 700 }}>{fmt(monthNetProfit)}</span>
                {" · "}Reserves balance: <span style={{ color: yellow, fontWeight: 700 }}>{fmt(reserveBalance)}</span>
              </div>
            </div>

          </div>
        )}

        {/* ── YTD TAB ── */}
        {tab === "ytd" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ background: T.heroYtd, border: `1px solid ${purple}55`, borderRadius: 12, padding: "22px 24px" }}>
              <div style={{ fontSize: 11, color: T.textMuted, letterSpacing: "0.15em", marginBottom: 6 }}>{viewYear} YEAR TO DATE</div>
              <div style={{ fontSize: 40, fontWeight: 800, color: purple, fontFamily: "'Syne', sans-serif", lineHeight: 1, marginBottom: 16 }}>{fmt(ytdTakeHome + ytdExpenses)}</div>
              <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                <StatBox label="FLYING GROSS" value={fmt(ytdFlyGross)}  color={green}  T={T} />
                <StatBox label="SALES GROSS"  value={fmt(ytdSalesGross)} color={purple} T={T} />
                <StatBox label="TOTAL GROSS"  value={fmt(ytdGross)}      color={T.text} T={T} />
              </div>
            </div>

            <Card T={T}>
              <div style={{ fontSize: 11, color: T.textMuted, letterSpacing: "0.15em", marginBottom: 8 }}>YTD SUMMARY</div>
              <SectionLabel text="GROSS INCOME" T={T} />
              <Row label="Flying gross" value={fmt(ytdFlyGross)} accent="green" T={T} />
              <Row label="Sales gross" value={fmt(ytdSalesGross)} accent="purple" T={T} />
              <Row label="Total gross" value={fmt(ytdGross)} bold T={T} />
              <SectionLabel text="EXPENSES (TAX-FREE TO YOUR POCKET)" T={T} />
              <Row label="Total expense reimbursements" value={fmt(ytdExpenses)} accent="blue" bold T={T} />
              <Row label="Remaining taxable base" value={fmt(ytdNetProfit)} bold accent="yellow" T={T} />
              <SectionLabel text="PAYCHECKS" T={T} />
              <Row label="Flying net paychecks" value={fmt(ytdFlyP.netCheck)} accent="green" T={T} />
              <Row label="Sales net paychecks" value={fmt(ytdSalesP.netCheck)} accent="purple" T={T} />
              <Row label="Total net paychecks" value={fmt(ytdNetPaycheck)} bold accent="green" T={T} />
              <SectionLabel text="TAX RESERVE & DISTRIBUTION" T={T} />
              <Row label={`Tax reserve (${taxReservePct}% auto-deducted)`} value={fmt(ytdTaxReserve)} accent="yellow" T={T} />
              <Row label="Owner distributions" value={fmt(ytdDistribution)} bold accent="purple" T={T} />
              <Row label="Reserves account balance" value={fmt(reserveBalance)} accent="yellow" bold T={T} />
              <SectionLabel text="TOTALS" T={T} />
              <Row label="Expense reimbursements (tax-free)" value={fmt(ytdExpenses)} accent="blue" T={T} />
              <Row label="Paycheck + distributions" value={fmt(ytdTakeHome)} accent="green" T={T} />
              <Row label="Grand total to your pocket" value={fmt(ytdTakeHome + ytdExpenses)} bold accent="green" T={T} />
              <Row label="Est. year-end tax liability" value={fmt(Math.round(ytdDistribution * 0.27))} accent="red" T={T} />
              <Row label="Reserves vs. tax liability" value={reserveBalance >= ytdDistribution * 0.27 ? "✓ COVERED" : "⚠ SHORT"} accent={reserveBalance >= ytdDistribution * 0.27 ? "green" : "yellow"} bold T={T} />
            </Card>

            {/* Monthly bar chart */}
            <Card T={T}>
              <div style={{ fontSize: 11, color: T.textMuted, letterSpacing: "0.15em", marginBottom: 14 }}>MONTHLY GROSS — {viewYear}</div>
              {MONTHS.map((m, i) => {
                const mk = `${viewYear}-${String(i+1).padStart(2,"0")}`;
                const fg = flyJobs.filter(j => j.monthKey === mk).reduce((s,j) => s+j.amount, 0);
                const sg = (salesEntries.find(e => e.monthKey === mk) || {amount:0}).amount;
                const total = fg + sg;
                const maxTotal = Math.max(...MONTHS.map((_, ii) => {
                  const k = `${viewYear}-${String(ii+1).padStart(2,"0")}`;
                  const f = flyJobs.filter(j => j.monthKey === k).reduce((s,j)=>s+j.amount,0);
                  const s2 = (salesEntries.find(e => e.monthKey === k)||{amount:0}).amount;
                  return f + s2;
                }), 1);
                return (
                  <div key={m} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                    <span style={{ fontSize: 11, color: i === viewMonth ? T.text : T.textMuted, width: 28 }}>{m}</span>
                    <div style={{ flex: 1, height: 8, background: T.sliderTrack, borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${(fg/maxTotal)*100}%`, background: green, borderRadius: 4, display: "inline-block" }} />
                      <div style={{ height: "100%", width: `${(sg/maxTotal)*100}%`, background: purple, borderRadius: 4, display: "inline-block" }} />
                    </div>
                    <span style={{ fontSize: 11, color: total > 0 ? T.text : T.textDim, width: 64, textAlign: "right" }}>{total > 0 ? fmt(total) : "—"}</span>
                  </div>
                );
              })}
              <div style={{ display: "flex", gap: 16, marginTop: 10 }}>
                <span style={{ fontSize: 10, color: green }}>■ Flying</span>
                <span style={{ fontSize: 10, color: purple }}>■ Sales</span>
              </div>
            </Card>

            {/* Income Projection */}
            {ytdGross > 0 && viewYear === currentYear && (
              <Card accentColor={blue + "44"} T={T}>
                <div style={{ fontSize: 11, color: blue, letterSpacing: "0.15em", marginBottom: 4 }}>📈 {viewYear} FULL-YEAR PROJECTION</div>
                <div style={{ fontSize: 10, color: T.textDim, marginBottom: 12 }}>Based on {monthsElapsed}-month average · actual results will vary</div>
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 14 }}>
                  <StatBox label="PROJ. FLYING" value={fmt(projFlyGross)} color={green} T={T} />
                  <StatBox label="PROJ. SALES" value={fmt(projSalesGross)} color={purple} T={T} />
                  <StatBox label="PROJ. GROSS" value={fmt(projGross)} color={T.text} T={T} />
                  <StatBox label="PROJ. TAKE-HOME" value={fmt(projTakeHome)} color={blue} T={T} />
                </div>
                <div style={{ background: T.inputBg, borderRadius: 8, padding: "10px 14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: T.textMuted }}>Est. year-end tax liability</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: A.red }}>{fmt(projTaxLiability)}</span>
                  </div>
                  <div style={{ fontSize: 10, color: T.textDim }}>Rough estimate on projected distribution at ~27% effective rate. File with your CPA.</div>
                </div>
              </Card>
            )}

            {/* Year-End W-2 Reasonableness Check */}
            <Card accentColor={(w2Status === "SAFE" ? green : w2Status === "REVIEW" ? yellow : A.red) + "44"} T={T}>
              <div style={{ fontSize: 11, color: T.textMuted, letterSpacing: "0.15em", marginBottom: 12 }}>🏛 YEAR-END W-2 CHECK</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "'Syne', sans-serif", color: w2Status === "SAFE" ? green : w2Status === "REVIEW" ? yellow : A.red }}>{w2Ratio}% wages</div>
                  <div style={{ fontSize: 11, color: T.textMuted }}>of net profit paid as W-2</div>
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: w2Status === "SAFE" ? green : w2Status === "REVIEW" ? yellow : A.red, border: `1px solid ${w2Status === "SAFE" ? green : w2Status === "REVIEW" ? yellow : A.red}`, borderRadius: 6, padding: "4px 12px" }}>
                  {w2Status === "SAFE" ? "✓ SAFE" : w2Status === "REVIEW" ? "⚠ REVIEW" : "⚠ LOW"}
                </span>
              </div>
              <Row label="Total W-2 wages paid YTD" value={fmt(ytdWagesPaid)} accent="green" T={T} />
              <Row label="Net profit (taxable base) YTD" value={fmt(ytdNetProfit)} T={T} />
              <div style={{ fontSize: 10, color: T.textDim, marginTop: 10, lineHeight: 1.6 }}>
                IRS expects W-2 wages to be a "reasonable" portion of S-Corp net profit. 30–40%+ is generally defensible. Below 28% raises audit risk. Target: keep above 30% by Dec 31.
              </div>
            </Card>
          </div>
        )}

        {/* ── SETTINGS TAB ── */}
        {tab === "settings" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Card accentColor={yellow + "44"} T={T}>
              <div style={{ fontSize: 11, color: yellow, letterSpacing: "0.15em", marginBottom: 16 }}>⚙️ SALARY RATIOS & RESERVE</div>
              <SliderRow label="FLYING SALARY RATIO" value={flySalaryPct} min={20} max={60} onChange={setFlySalaryPct} color={green} showRisk hint="Contract pilot — 30–35% is defensible" T={T} />
              <SliderRow label="SALES SALARY RATIO" value={salesSalaryPct} min={20} max={60} onChange={setSalesSalaryPct} color={purple} showRisk hint="Closer work — 35–40% recommended" T={T} />
              <SliderRow label="TAX RESERVE RATE" value={taxReservePct} min={5} max={30} onChange={setTaxReservePct} color={yellow} hint="Deducted from gross before payroll — auto-deposited to reserves account" T={T} />
            </Card>
            <Card accentColor={blue + "33"} T={T}>
              <div style={{ fontSize: 11, color: blue, letterSpacing: "0.15em", marginBottom: 12 }}>🏥 HEALTH INSURANCE PREMIUM</div>
              <div style={{ fontSize: 12, color: T.textSub, marginBottom: 10, lineHeight: 1.6 }}>
                Set your monthly premium and a one-tap button appears in the expenses card to log it instantly each month.
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input type="number" value={healthPremium || ""} onChange={e => setHealthPremium(parseFloat(e.target.value) || 0)} placeholder="Monthly premium ($)" style={{ ...inputStyle, flex: 1 }} />
                {healthPremium > 0 && <span style={{ fontSize: 12, color: blue, whiteSpace: "nowrap" }}>{fmt(healthPremium)}/mo · {fmt(healthPremium * 12)}/yr</span>}
              </div>
            </Card>
            <Card T={T}>
              <div style={{ fontSize: 11, color: T.textMuted, letterSpacing: "0.15em", marginBottom: 12 }}>PAYROLL THRESHOLD</div>
              <div style={{ fontSize: 13, color: T.textSub, lineHeight: 1.6 }}>
                Flying payroll flags ready at <span style={{ color: green, fontWeight: 700 }}>{fmt(PAYROLL_THRESHOLD)}</span> accumulated.<br />
                Sales payroll runs on the <span style={{ color: purple, fontWeight: 700 }}>10th</span> of each month.
              </div>
              <div style={{ fontSize: 11, color: T.textDim, marginTop: 10, lineHeight: 1.6 }}>
                IRS requires reasonable annual W-2 wages. Batch flying payrolls but ensure total annual wages are defensible by Dec 31.
              </div>
            </Card>
          </div>
        )}

        {/* ── AI TAB ── */}
        {tab === "ai" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Card accentColor={blue + "55"} T={T}>
              <div style={{ fontSize: 11, color: blue, letterSpacing: "0.15em", marginBottom: 8 }}>🤖 AI — MODIFY THIS APP</div>
              <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 16, lineHeight: 1.6 }}>
                Describe what you want to add or change. Claude will update the code and redeploy automatically (~30s).
              </div>
              <textarea
                value={recodeDesc}
                onChange={e => setRecodeDesc(e.target.value)}
                placeholder={"Example: Add a notes section where I can log free-form text for each month"}
                rows={5}
                style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }}
              />
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10 }}>
                <button
                  disabled={recodeStatus === "loading" || !recodeDesc.trim()}
                  onClick={async () => {
                    setRecodeStatus("loading");
                    setRecodeMsg("");
                    try {
                      const res = await fetch("/api/recode", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ description: recodeDesc }),
                      });
                      const data = await res.json();
                      if (data.ok) {
                        setRecodeStatus("done");
                        setRecodeMsg(data.message);
                        setRecodeDesc("");
                      } else {
                        setRecodeStatus("error");
                        setRecodeMsg(data.error || "Unknown error");
                      }
                    } catch (e) {
                      setRecodeStatus("error");
                      setRecodeMsg(e.message);
                    }
                  }}
                  style={{ ...btnStyle(blue), opacity: recodeStatus === "loading" ? 0.6 : 1 }}
                >
                  {recodeStatus === "loading" ? "⏳ UPDATING..." : "🚀 APPLY CHANGES"}
                </button>
                {recodeStatus === "done"  && <span style={{ fontSize: 12, color: A.green }}>✓ {recodeMsg}</span>}
                {recodeStatus === "error" && <span style={{ fontSize: 12, color: A.red }}>✗ {recodeMsg}</span>}
              </div>
            </Card>
            <Card T={T}>
              <div style={{ fontSize: 11, color: T.textMuted, letterSpacing: "0.15em", marginBottom: 8 }}>HOW IT WORKS</div>
              <div style={{ fontSize: 12, color: T.textSub, lineHeight: 1.8 }}>
                1. You describe the change in plain English<br/>
                2. Claude reads the current app code<br/>
                3. Claude rewrites the code with your change<br/>
                4. The update is committed to GitHub<br/>
                5. Cloudflare redeploys automatically (~30s)<br/>
                6. Refresh the page to see your change
              </div>
            </Card>
          </div>
        )}

        <div style={{ fontSize: 10, color: T.textDim, textAlign: "center", lineHeight: 1.6, marginTop: 24 }}>
          Estimates only. Federal ~10%, SC ~5%. Consult a CPA for filing decisions.
        </div>
      </div>
    </div>
  );
}
