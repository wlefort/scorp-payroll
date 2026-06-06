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
      <span style={{ fontSize: 12, color: sub ? T.textMuted : T.textSub, paddingLeft: sub ? 12 : 0 }}>{sub ? "â³ " : ""}{label}</span>
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
    <div 
      onClick={onToggle} 
      title="Toggle light/dark" 
      style={{
        width: 52,
        height: 28,
        background: dark ? T.toggleBg : "#d0d2e8",
        border: `1px solid ${T.cardBorder}`,
        borderRadius: 14,
        cursor: "pointer",
        position: "relative",
        transition: "background 0.3s"
      }}
    >
      <div style={{
        position: "absolute",
        top: 3,
        left: dark ? 26 : 3,
        width: 20,
        height: 20,
        borderRadius: "50%",
        background: dark ? "#2a2a4a" : "#ffffff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 12,
        transition: "left 0.3s, background 0.3s",
        boxShadow: "0 1px 3px rgba(0,0,0,0.2)"
      }}>
        {dark ? "🌙" : "☀️"}
      </div>
    </div>
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

  // Cumulative flying balance â all jobs ever minus all runs ever
  const totalFlyJobsGross  = flyJobs.reduce((s, j) => s + j.amount, 0);
  const totalFlyRunsGross  = payrollRuns.filter(r => r.type === "flying").reduce((s, r) => s + (r.gross || 0), 0);
  const flyingBalance      = Math.max(0, totalFlyJobsGross - totalFlyRunsGross);
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
    addReserveDeposit(taxAmt, `Auto â Flying payroll (${taxReservePct}% of ${fmt(flyingBalance)})`);
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
    addReserveDeposit(taxAmt, `Auto â Sales payroll (${taxReservePct}% of ${fmt(monthSalesGross)})`);
    setSalesRunNote("");
  }
  function removePayrollRun(id) { setPayrollRuns(prev => prev.filter(r => r.id !== id)); }

  const monthPayrollRuns  = payrollRuns.filter(r => r.monthKey === viewKey);
  const flyRunThisMonth   = monthPayrollRuns.some(r => r.type === "flying");
  const salesRunThisMonth = monthPayrollRuns.some(r => r.type === "sales");
  const payrollReady      = flyingBalance >= PAYROLL_THRESHOLD;

  // Expense-only payout (skip payroll)
  function logExpensePayout(action) {
    // action: "hold" = keep remaining in corp, "distribute" = take it all out
    setExpensePayouts(prev => [...prev, {
      id: Date.now(),
      date: new Date().toISOString(),
      monthKey: viewKey,
      expenseAmount: monthExpTotal,
      grossAmount: monthGross,
      remainingAmount: Math.max(0, monthGross - monthExpTotal),
      action,
    }]);
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

  // Monthly calcs â order: gross â tax reserve â expenses â payroll
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

  // Year-end W-2 check â total wages paid via actual payroll runs this year
  const ytdWagesPaid = payrollRuns
    .filter(r => r.monthKey && r.monthKey.startsWith(String(viewYear)))
    .reduce((s, r) => s + (r.wage || 0), 0);
  const ytdPayrollBase = Math.max(0