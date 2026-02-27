import { useState, useEffect, useRef } from "react";

const GRID = 20;
const CELL = 24;
const TICK_MS = 145;
const MONTHS_TOTAL = 24;
const MONTH_MS = 5000;
const APPLE_SHRINK = 1;
const INIT_LEN = 5;

// Low Balance Mode constants
const LOW_BALANCE_CREDIT_LIMIT = 20;
const LOW_BALANCE_TARGET_AVG = 6;
const LOW_BALANCE_WARNING = 10;
const PURCHASE_INTERVAL_MS = 6000;
const PURCHASE_SIZE = 2;
const PURCHASE_FLASH_MS = 1200;
const PURCHASE_TYPES = [
  { label: "Bought a coffee", min: 2, max: 2 },
  { label: "Streaming subscription", min: 2, max: 2 },
  { label: "Gas fill-up", min: 2, max: 3 },
  { label: "Ride-share home", min: 2, max: 3 },
  { label: "Movie tickets", min: 3, max: 3 },
  { label: "Weekend brunch", min: 3, max: 3 },
  { label: "Grocery run", min: 3, max: 4 },
  { label: "Italian dinner", min: 3, max: 4 },
  { label: "Online shopping", min: 3, max: 4 },
  { label: "New headphones", min: 4, max: 4 },
];

const CARDS = [
  {
    id: "secured",
    name: "Liberty Exclusive",
    apr: "20%",
    desc: "A great starter card",
    headColor: "#14532d",
    bodyColor: "#4ade80",
    accent: "#86efac",
    tagline: "",
    growthStartMs: 7000,
    compoundFactor: 0.975,
  },
  {
    id: "rewards",
    name: "Luxe Rewards",
    apr: "27%",
    desc: "Travel and dining!",
    headColor: "#78350f",
    bodyColor: "#fb923c",
    accent: "#fdba74",
    tagline: "",
    growthStartMs: 3200,
    compoundFactor: 0.94,
  },
  {
    id: "retail",
    name: "Platinum Ultra",
    apr: "34%",
    desc: "For movers and shakers",
    headColor: "#7f1d1d",
    bodyColor: "#ef4444",
    accent: "#fca5a5",
    tagline: "",
    growthStartMs: 900,
    compoundFactor: 0.87,
  },
];

const randCell = (snake) => {
  const occ = new Set(snake.map((s) => `${s.x},${s.y}`));
  if (occ.size >= GRID * GRID) return { x: 0, y: 0 };
  let c;
  do {
    c = {
      x: Math.floor(Math.random() * GRID),
      y: Math.floor(Math.random() * GRID),
    };
  } while (occ.has(`${c.x},${c.y}`));
  return c;
};

const initSnake = () =>
  Array.from({ length: INIT_LEN }, (_, i) => ({ x: 10 - i, y: 10 }));

const PAYMENT_OPTIONS = [
  {
    id: "full",
    label: "Pay in Full",
    sublabel: "Full balance each month",
    desc: "Each payment token immediately reduces your balance to a single segment — the easiest path to zero.",
    effect: "Token wipes balance to 1",
    color: "var(--jade)",
    roman: "I",
  },
  {
    id: "minimum",
    label: "Minimum Payment",
    sublabel: "Just the minimums",
    desc: "Each token shaves off only one segment. You're technically paying, but interest keeps compounding.",
    effect: "Token removes 1 segment",
    color: "#F5A623",
    roman: "II",
  },
  {
    id: "none",
    label: "Free Money",
    sublabel: "I won't pay",
    desc: "No payment tokens spawn. Your balance grows unchecked. A lesson in avoidance.",
    effect: "No tokens spawn",
    color: "var(--ruby)",
    roman: "III",
  },
];

const GAME_MODES = [
  {
    id: "payoff",
    label: "Debt Payoff",
    sublabel: "Race against compound interest",
    desc: "Your balance grows uncontrollably due to interest. Each payment token reduces it. Pay it off before time runs out.",
    goal: "Pay off balance to $0 before running out of time",
    color: "var(--ruby)",
    roman: "I",
  },
  {
    id: "low-balance",
    label: "Low Balance",
    sublabel: "Maintain healthy credit utilization",
    desc: "Random purchases add to your balance. Collect payment tokens to keep your balance low. Keep utilization below 30% for 24 months.",
    goal: "Maintain average balance below 30% for 24 months",
    color: "var(--jade)",
    roman: "II",
  },
];

export default function DebtSnake() {
  const [screen, setScreen] = useState("mode");
  const [gameMode, setGameMode] = useState(null);
  const [pendingLoan, setPendingLoan] = useState(null);
  const [, tick] = useState(0);
  const rerender = () => tick((n) => n + 1);

  const G = useRef(null);
  const loopRef = useRef(null);
  const monthRef = useRef(null);
  const growTimeoutRef = useRef(null);
  const purchaseTimeoutRef = useRef(null);

  const stopAll = () => {
    clearInterval(loopRef.current);
    clearInterval(monthRef.current);
    clearTimeout(growTimeoutRef.current);
    clearTimeout(purchaseTimeoutRef.current);
  };

  // defined outside startGame so it can self-reference via closure over stable refs
  const growFn = useRef(null);
  growFn.current = () => {
    const g = G.current;
    if (!g?.alive) return;
    const t = g.snake[g.snake.length - 1];
    g.snake = [...g.snake, { ...t }];
    g.growInterval = Math.max(260, g.growInterval * g.loan.compoundFactor);
    growTimeoutRef.current = setTimeout(() => growFn.current(), g.growInterval);
    rerender();
  };

  // Purchase function for Low Balance Mode
  const purchaseFn = useRef(null);
  purchaseFn.current = () => {
    const g = G.current;
    if (!g?.alive || g.mode !== "low-balance") return;
    const randomPurchaseType = PURCHASE_TYPES[Math.floor(Math.random() * PURCHASE_TYPES.length)];
    const randomPurchaseSize =
      Math.floor(Math.random() * (randomPurchaseType.max - randomPurchaseType.min + 1)) +
      randomPurchaseType.min;
    const t = g.snake[g.snake.length - 1];
    for (let i = 0; i < randomPurchaseSize; i++) {
      g.snake = [...g.snake, { ...t }];
    }
    g.purchases++;
    g.lastPurchaseSize = randomPurchaseSize;
    g.lastPurchaseType = randomPurchaseType.label;
    g.purchasePulseUntil = Date.now() + PURCHASE_FLASH_MS;
    g.purchasePulseId += 1;
    // Schedule next purchase with randomized interval (6-10 seconds)
    const nextInterval = PURCHASE_INTERVAL_MS + Math.random() * 4000;
    purchaseTimeoutRef.current = setTimeout(() => purchaseFn.current(), nextInterval);
    rerender();
  };

  const startGame = (loan, paymentType, mode = "payoff") => {
    stopAll();
    const snake = initSnake();
    const spawnApple = paymentType !== "none";
    G.current = {
      snake,
      apple: spawnApple ? randCell(snake) : null,
      dir: { x: 1, y: 0 },
      nextDir: { x: 1, y: 0 },
      month: 0,
      growInterval: loan.growthStartMs,
      loan,
      paymentType,
      mode,
      alive: true,
      applesEaten: 0,
      balanceHistory: [],
      purchases: 0,
      lastPurchaseSize: 0,
      lastPurchaseType: "",
      purchasePulseUntil: 0,
      purchasePulseId: 0,
    };
    setScreen("playing");

    loopRef.current = setInterval(() => {
      const g = G.current;
      if (!g?.alive) return;
      g.dir = { ...g.nextDir };
      const head = { x: g.snake[0].x + g.dir.x, y: g.snake[0].y + g.dir.y };

      if (head.x < 0 || head.x >= GRID || head.y < 0 || head.y >= GRID) {
        g.alive = false;
        stopAll();
        setScreen("lose");
        return;
      }
      if (g.snake.slice(0, -1).some((s) => s.x === head.x && s.y === head.y)) {
        g.alive = false;
        stopAll();
        setScreen("lose");
        return;
      }

      g.snake = [head, ...g.snake.slice(0, -1)];

      if (g.apple && head.x === g.apple.x && head.y === g.apple.y) {
        g.applesEaten++;
        let shrink;
        if (g.paymentType === "full") {
          shrink = g.snake.length - 1; // reduce to 1 segment
        } else {
          shrink = Math.min(APPLE_SHRINK, g.snake.length - 1); // minimum: 1
        }
        g.snake = g.snake.slice(0, g.snake.length - shrink);
        if (g.mode === "payoff" && g.snake.length <= 1) {
          g.alive = false;
          stopAll();
          setScreen("win");
          return;
        }
        g.apple = randCell(g.snake);
      }
      rerender();
    }, TICK_MS);

    monthRef.current = setInterval(() => {
      const g = G.current;
      if (!g?.alive) return;
      // Record balance snapshot for average calculation
      g.balanceHistory.push(g.snake.length);
      g.month++;
      if (g.month >= MONTHS_TOTAL) {
        g.alive = false;
        stopAll();
        // For low balance mode, check win condition
        if (g.mode === "low-balance") {
          const avgBalance = g.balanceHistory.reduce((a, b) => a + b, 0) / g.balanceHistory.length;
          if (avgBalance <= LOW_BALANCE_TARGET_AVG) {
            setScreen("win");
          } else {
            setScreen("lose");
          }
        } else {
          setScreen("lose");
        }
      }
      rerender();
    }, MONTH_MS);

    if (mode === "payoff") {
      growTimeoutRef.current = setTimeout(() => growFn.current(), loan.growthStartMs);
    } else if (mode === "low-balance") {
      // Start purchase events
      const initialPurchaseDelay = PURCHASE_INTERVAL_MS + Math.random() * 4000;
      purchaseTimeoutRef.current = setTimeout(() => purchaseFn.current(), initialPurchaseDelay);
    }
  };

  const handleDir = (nd) => {
    const g = G.current;
    if (!g) return;
    if (nd.x !== -g.dir.x || nd.y !== -g.dir.y) g.nextDir = nd;
  };

  useEffect(() => {
    const onKey = (e) => {
      const map = {
        ArrowUp: { x: 0, y: -1 },
        ArrowDown: { x: 0, y: 1 },
        ArrowLeft: { x: -1, y: 0 },
        ArrowRight: { x: 1, y: 0 },
        w: { x: 0, y: -1 },
        s: { x: 0, y: 1 },
        a: { x: -1, y: 0 },
        d: { x: 1, y: 0 },
      };
      const nd = map[e.key];
      if (!nd) return;
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key))
        e.preventDefault();
      const g = G.current;
      if (!g) return;
      if (nd.x !== -g.dir.x || nd.y !== -g.dir.y) g.nextDir = nd;
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => () => stopAll(), []);

  const g = G.current;
  const boardPx = GRID * CELL;

  /* ── MODE SCREEN ── */
  if (screen === "mode")
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "var(--felt)",
          backgroundImage: `
            repeating-linear-gradient(
              45deg,
              transparent,
              transparent 35px,
              rgba(212, 175, 55, 0.03) 35px,
              rgba(212, 175, 55, 0.03) 70px
            )
          `,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--champagne)",
          padding: 24,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Decorative gold border */}
        <div
          style={{
            position: "absolute",
            inset: "20px",
            border: "4px solid var(--gold)",
            pointerEvents: "none",
            borderRadius: "2px",
            boxShadow: "inset 0 0 20px rgba(212, 175, 55, 0.1)",
          }}
        />

        <h1
          style={{
            fontSize: 72,
            fontWeight: 900,
            letterSpacing: 6,
            margin: "0 0 24px",
            background: "linear-gradient(135deg, var(--gold) 40%, var(--gold-light))",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            fontFamily: "'Playfair Display', serif",
            textShadow: "2px 2px 8px rgba(0, 0, 0, 0.5)",
          }}
        >
          DEBT SNAKE
        </h1>

        <p
          style={{
            color: "var(--gold-dim)",
            fontSize: 18,
            marginBottom: 48,
            textAlign: "center",
            maxWidth: 520,
            lineHeight: 1.9,
            fontFamily: "'Cormorant Garamond', serif",
          }}
        >
          Choose a game mode below to learn about different aspects of credit card management.
        </p>

        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", justifyContent: "center" }}>
          {GAME_MODES.map((m, idx) => (
            <div
              key={m.id}
              onClick={() => { setGameMode(m.id); setScreen("select"); }}
              style={{
                background: "var(--felt-light)",
                border: `2px solid ${m.color}`,
                borderRadius: 8,
                padding: "28px 24px",
                cursor: "pointer",
                width: 220,
                transition: "all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)",
                position: "relative",
                overflow: "hidden",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-6px)";
                e.currentTarget.style.borderColor = m.color === "var(--gold)" ? "var(--gold-light)" : m.color;
                e.currentTarget.style.boxShadow = `0 12px 24px ${m.color}44, 0 0 20px ${m.color}33`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.borderColor = m.color;
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              {/* Mode number marker */}
              <div
                style={{
                  position: "absolute",
                  top: 8,
                  right: 12,
                  fontSize: 10,
                  fontWeight: 700,
                  color: "var(--gold-dim)",
                  letterSpacing: 2,
                  fontFamily: "'Courier Prime', monospace",
                }}
              >
                {m.roman}
              </div>

              <div
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: m.color,
                  marginBottom: 6,
                  fontFamily: "'Playfair Display', serif",
                }}
              >
                {m.label}
              </div>

              <div
                style={{
                  fontSize: 11,
                  letterSpacing: 2,
                  color: "var(--gold-dim)",
                  marginBottom: 14,
                  fontFamily: "'Courier Prime', monospace",
                  textTransform: "uppercase",
                }}
              >
                {m.sublabel}
              </div>

              <div
                style={{
                  fontSize: 13,
                  color: "var(--champagne)",
                  lineHeight: 1.7,
                  fontFamily: "'Cormorant Garamond', serif",
                  marginBottom: 18,
                }}
              >
                {m.desc}
              </div>

              <div
                style={{
                  borderTop: `1px solid ${m.color}66`,
                  paddingTop: 12,
                  fontSize: 11,
                  color: m.color,
                  letterSpacing: 1,
                  fontFamily: "'Courier Prime', monospace",
                  fontWeight: 700,
                }}
              >
                GOAL: {m.goal}
              </div>
            </div>
          ))}
        </div>
      </div>
    );

  /* ── SELECT SCREEN ── */
  if (screen === "select")
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "var(--felt)",
          backgroundImage: `
            repeating-linear-gradient(
              45deg,
              transparent,
              transparent 35px,
              rgba(212, 175, 55, 0.03) 35px,
              rgba(212, 175, 55, 0.03) 70px
            )
          `,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--champagne)",
          padding: 24,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Decorative gold border */}
        <div
          style={{
            position: "absolute",
            inset: "20px",
            border: "4px solid var(--gold)",
            pointerEvents: "none",
            borderRadius: "2px",
            boxShadow: "inset 0 0 20px rgba(212, 175, 55, 0.1)",
          }}
        />

        <h1
          style={{
            fontSize: 72,
            fontWeight: 900,
            letterSpacing: 6,
            margin: "0 0 16px",
            background: "linear-gradient(135deg, var(--gold) 40%, var(--gold-light))",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            fontFamily: "'Playfair Display', serif",
            textShadow: "2px 2px 8px rgba(0, 0, 0, 0.5)",
          }}
        >
          DEBT SNAKE
        </h1>

        <p
          style={{
            color: "var(--gold-dim)",
            fontSize: 18,
            marginBottom: 48,
            textAlign: "center",
            maxWidth: 480,
            lineHeight: 1.9,
            fontFamily: "'Cormorant Garamond', serif",
          }}
        >
          Pick a credit card below. <br />Each card has a different interest rate and growth pattern. <br />The length of your snake is your balance; <br />it grows every month based on your card's terms.
          <br />
          Collect <span style={{ color: "var(--gold)" }}>$</span> tokens to make payments. Hit a wall, hit yourself, or run out of time and you default.
        </p>

        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", justifyContent: "center" }}>
          {CARDS.map((l, idx) => (
            <div
              key={l.id}
              onClick={() => { setPendingLoan(l); setScreen("payment"); }}
              style={{
                background: "var(--felt-light)",
                border: `2px solid var(--gold)`,
                borderRadius: 8,
                padding: "28px 24px",
                cursor: "pointer",
                width: 220,
                transition: "all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)",
                position: "relative",
                overflow: "hidden",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-6px)";
                e.currentTarget.style.borderColor = "var(--gold-light)";
                e.currentTarget.style.boxShadow = "0 12px 24px rgba(212, 175, 55, 0.3), 0 0 20px rgba(212, 175, 55, 0.2)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.borderColor = "var(--gold)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              {/* Table number marker */}
              <div
                style={{
                  position: "absolute",
                  top: 8,
                  right: 12,
                  fontSize: 10,
                  fontWeight: 700,
                  color: "var(--gold-dim)",
                  letterSpacing: 2,
                  fontFamily: "'Courier Prime', monospace",
                }}
              >
                {idx === 0 ? "I" : idx === 1 ? "II" : "III"}
              </div>

              <div
                style={{
                  fontSize: 10,
                  letterSpacing: 3,
                  color: "var(--gold)",
                  marginBottom: 12,
                  fontWeight: "bold",
                  fontFamily: "'Courier Prime', monospace",
                  textTransform: "uppercase",
                }}
              >
                {l.tagline}
              </div>

              <div
                style={{
                  fontSize: 18,
                  fontWeight: 600,
                  color: "var(--champagne)",
                  marginBottom: 8,
                  fontFamily: "'Playfair Display', serif",
                }}
              >
                {l.name}
              </div>

              <div
                style={{
                  fontSize: 48,
                  fontWeight: 900,
                  color: "var(--gold)",
                  lineHeight: 1,
                  marginBottom: 14,
                  fontFamily: "'Playfair Display', serif",
                }}
              >
                {l.apr}
              </div>

              <div
                style={{
                  fontSize: 12,
                  color: "var(--gold-dim)",
                  lineHeight: 1.6,
                  fontFamily: "'Cormorant Garamond', serif",
                  marginBottom: 16,
                }}
              >
                {l.desc}
              </div>

              <div
                style={{
                  fontSize: 10,
                  color: "var(--gold)",
                  lineHeight: 1.5,
                  fontFamily: "'Courier Prime', monospace",
                  marginBottom: 16,
                  padding: "8px",
                  background: "rgba(212, 175, 55, 0.08)",
                  borderRadius: 4,
                  border: "1px solid rgba(212, 175, 55, 0.2)",
                }}
              >
                The higher the APR, the faster your monthly payment - your snake - will grow if you don't pay it off.
              </div>

              <div
                style={{
                  borderTop: `1px solid var(--gold-dim)`,
                  paddingTop: 12,
                  fontSize: 12,
                  color: "var(--gold)",
                  letterSpacing: 2,
                  textAlign: "center",
                  fontFamily: "'Playfair Display', serif",
                  fontWeight: 700,
                  fontStyle: "italic",
                }}
              >
                Start your credit journey →
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            marginTop: 52,
            fontSize: 11,
            color: "var(--gold-dim)",
            textAlign: "center",
            fontFamily: "'Cormorant Garamond', serif",
            letterSpacing: 0.5,
            fontStyle: "italic",
          }}
        >
          Aligned with Jump$tart National Standards • Credit 12-1, 12-10, 12-13
        </div>

        <button
          onClick={() => { setGameMode(null); setScreen("mode"); }}
          style={{
            marginTop: 36,
            padding: "10px 28px",
            background: "transparent",
            border: "1px solid var(--gold-dim)",
            borderRadius: 2,
            color: "var(--gold-dim)",
            fontSize: 12,
            letterSpacing: 3,
            cursor: "pointer",
            fontFamily: "'Courier Prime', monospace",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "var(--gold)";
            e.currentTarget.style.borderColor = "var(--gold)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "var(--gold-dim)";
            e.currentTarget.style.borderColor = "var(--gold-dim)";
          }}
        >
          ← BACK
        </button>
      </div>
    );

  /* ── PAYMENT SCREEN ── */
  if (screen === "payment")
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "var(--felt)",
          backgroundImage: `
            repeating-linear-gradient(
              45deg,
              transparent,
              transparent 35px,
              rgba(212, 175, 55, 0.03) 35px,
              rgba(212, 175, 55, 0.03) 70px
            )
          `,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--champagne)",
          padding: 24,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Decorative gold border */}
        <div
          style={{
            position: "absolute",
            inset: "20px",
            border: "4px solid var(--gold)",
            pointerEvents: "none",
            borderRadius: "2px",
            boxShadow: "inset 0 0 20px rgba(212, 175, 55, 0.1)",
          }}
        />

        <div
          style={{
            fontSize: 11,
            letterSpacing: 4,
            color: "var(--gold-dim)",
            marginBottom: 12,
            textTransform: "uppercase",
            fontFamily: "'Courier Prime', monospace",
            fontWeight: 700,
          }}
        >
          {pendingLoan?.name} · {pendingLoan?.apr} APR
        </div>

        <h1
          style={{
            fontSize: 52,
            fontWeight: 900,
            letterSpacing: 4,
            margin: "0 0 12px",
            background: "linear-gradient(135deg, var(--gold) 40%, var(--gold-light))",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            fontFamily: "'Playfair Display', serif",
            textAlign: "center",
          }}
        >
          How much do you want<br />to pay per month?
        </h1>

        <p
          style={{
            color: "var(--gold-dim)",
            fontSize: 14,
            marginBottom: 40,
            textAlign: "center",
            fontFamily: "'Cormorant Garamond', serif",
            fontStyle: "italic",
          }}
        >
          Your choice determines what each $ token does when you collect it.
        </p>

        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", justifyContent: "center" }}>
          {PAYMENT_OPTIONS.map((opt) => (
            <div
              key={opt.id}
              onClick={() => startGame(pendingLoan, opt.id, gameMode)}
              style={{
                background: "var(--felt-light)",
                border: `2px solid ${opt.color}`,
                borderRadius: 8,
                padding: "28px 24px",
                cursor: "pointer",
                width: 220,
                transition: "all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)",
                position: "relative",
                overflow: "hidden",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-6px)";
                e.currentTarget.style.boxShadow = `0 12px 24px ${opt.color}44, 0 0 20px ${opt.color}33`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              {/* Roman numeral marker */}
              <div
                style={{
                  position: "absolute",
                  top: 8,
                  right: 12,
                  fontSize: 10,
                  fontWeight: 700,
                  color: opt.color,
                  letterSpacing: 2,
                  fontFamily: "'Courier Prime', monospace",
                  opacity: 0.6,
                }}
              >
                {opt.roman}
              </div>

              <div
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: opt.color,
                  marginBottom: 6,
                  fontFamily: "'Playfair Display', serif",
                }}
              >
                {opt.label}
              </div>

              <div
                style={{
                  fontSize: 11,
                  letterSpacing: 2,
                  color: "var(--gold-dim)",
                  marginBottom: 14,
                  fontFamily: "'Courier Prime', monospace",
                  textTransform: "uppercase",
                }}
              >
                {opt.sublabel}
              </div>

              <div
                style={{
                  fontSize: 13,
                  color: "var(--champagne)",
                  lineHeight: 1.7,
                  fontFamily: "'Cormorant Garamond', serif",
                  marginBottom: 18,
                }}
              >
                {opt.desc}
              </div>

              <div
                style={{
                  borderTop: `1px solid ${opt.color}66`,
                  paddingTop: 12,
                  fontSize: 11,
                  color: opt.color,
                  letterSpacing: 1,
                  fontFamily: "'Courier Prime', monospace",
                  fontWeight: 700,
                }}
              >
                ↳ {opt.effect}
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={() => setScreen("select")}
          style={{
            marginTop: 36,
            padding: "10px 28px",
            background: "transparent",
            border: "1px solid var(--gold-dim)",
            borderRadius: 2,
            color: "var(--gold-dim)",
            fontSize: 12,
            letterSpacing: 3,
            cursor: "pointer",
            fontFamily: "'Courier Prime', monospace",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "var(--gold)";
            e.currentTarget.style.borderColor = "var(--gold)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "var(--gold-dim)";
            e.currentTarget.style.borderColor = "var(--gold-dim)";
          }}
        >
          ← BACK
        </button>
      </div>
    );

  /* ── WIN SCREEN ── */
  if (screen === "win")
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "var(--felt)",
          backgroundImage: `
            repeating-linear-gradient(
              45deg,
              transparent,
              transparent 35px,
              rgba(45, 122, 74, 0.05) 35px,
              rgba(45, 122, 74, 0.05) 70px
            )
          `,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--champagne)",
          padding: 24,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Confetti animation */}
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={`confetti-${i}`}
            style={{
              position: "fixed",
              width: "8px",
              height: "8px",
              background: "var(--gold)",
              top: "-20px",
              left: `${Math.random() * 100}%`,
              animation: `confetti-fall ${2 + Math.random() * 2}s linear infinite`,
              zIndex: 1,
              pointerEvents: "none",
            }}
          />
        ))}

        <div
          style={{
            fontSize: 12,
            letterSpacing: 4,
            color: "var(--jade)",
            marginBottom: 16,
            textTransform: "uppercase",
            fontFamily: "'Courier Prime', monospace",
            fontWeight: 700,
            position: "relative",
            zIndex: 10,
          }}
        >
          Balance: $0
        </div>

        {/* Ornate circular badge */}
        <div
          style={{
            width: 220,
            height: 220,
            borderRadius: "50%",
            border: `3px solid var(--gold)`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 32,
            background: `radial-gradient(circle, var(--felt-light), var(--felt))`,
            boxShadow: `0 0 30px rgba(212, 175, 55, 0.3), inset 0 0 20px rgba(212, 175, 55, 0.1)`,
            position: "relative",
            animation: "snake-head-gleam 3s ease-in-out infinite",
            zIndex: 10,
          }}
        >
          {/* Inner decorative ring */}
          <div
            style={{
              position: "absolute",
              inset: 6,
              borderRadius: "50%",
              border: `1px solid var(--gold-dim)`,
            }}
          />

          <h1
            style={{
              fontSize: 48,
              fontWeight: 900,
              margin: 0,
              color: "var(--jade)",
              fontFamily: "'Playfair Display', serif",
              textAlign: "center",
              lineHeight: 1.1,
            }}
          >
            YOU<br />WIN
          </h1>
        </div>

        <p
          style={{
            color: "var(--champagne)",
            textAlign: "center",
            lineHeight: 1.8,
            fontSize: 18,
            fontFamily: "'Cormorant Garamond', serif",
            fontStyle: "italic",
            position: "relative",
            zIndex: 10,
            maxWidth: 380,
          }}
        >
          {g?.mode === "low-balance"
            ? `You maintained an average balance of ${Math.round(g?.balanceHistory.reduce((a, b) => a + b, 0) / g?.balanceHistory.length)} segments (${Math.round((g?.balanceHistory.reduce((a, b) => a + b, 0) / g?.balanceHistory.length / LOW_BALANCE_CREDIT_LIMIT) * 100)}% utilization) over 24 months. Excellent credit management!`
            : `You paid it off your monthly balance in one go! It's best to stay ahead of your debt.`}
          <br />
          <span style={{ fontSize: 13, color: "var(--gold-dim)" }}>
            {/* {g?.loan.name} cleared in {g?.month} of 24 months — {g?.applesEaten} payments made. */}
          </span>
        </p>

        <div
          style={{
            marginTop: 28,
            background: "var(--felt-light)",
            border: `1px solid var(--gold)`,
            borderRadius: 4,
            padding: "20px 24px",
            maxWidth: 380,
            fontSize: 16,
            color: "var(--gold-dim)",
            lineHeight: 1.8,
            textAlign: "center",
            fontFamily: "'Cormorant Garamond', serif",
            position: "relative",
            zIndex: 10,
          }}
        >
          <strong style={{ color: "var(--jade)" }}>The Takeaway:</strong>{" "}
          {g?.mode === "low-balance"
            ? "Keeping your balance below 30% of your credit limit (called credit utilization) is one of the top factors in building good credit. Lenders look for responsible spending habits and ability to manage credit."
            : "Paying off the full balance each month is the only way to avoid interest and keep your debt snake from spiraling out of control."}
        </div>

        <button
          onClick={() => setScreen("mode")}
          style={{
            marginTop: 32,
            padding: "14px 36px",
            background: "transparent",
            border: "2px solid var(--gold)",
            borderRadius: 2,
            color: "var(--gold)",
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: 3,
            cursor: "pointer",
            fontFamily: "'Playfair Display', serif",
            transition: "all 0.25s",
            position: "relative",
            zIndex: 10,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(212, 175, 55, 0.15)";
            e.currentTarget.style.boxShadow = "0 0 16px rgba(212, 175, 55, 0.3)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          Play Again
        </button>
      </div>
    );

  /* ── LOSE SCREEN ── */
  if (screen === "lose") {
    const lessons = {
      secured:
        "Even a low-APR card becomes expensive if you only make minimum payments. A $500 balance at 20% APR can take years to pay off.",
      rewards:
        "Rewards cards benefit cardholders who pay in full every month. Carrying a balance at 27% APR wipes out any points you earned.",
      retail:
        "Store cards have some of the highest APRs in consumer credit. That signup discount is rarely worth the rate you're locked into.",
    };
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#050A05",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--champagne)",
          padding: 24,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Smoke drift animation */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={`smoke-${i}`}
            style={{
              position: "fixed",
              width: `${80 + Math.random() * 120}px`,
              height: `${80 + Math.random() * 120}px`,
              background: `radial-gradient(circle, rgba(200, 200, 200, 0.3), transparent)`,
              borderRadius: "50%",
              bottom: `-100px`,
              left: `${Math.random() * 100}%`,
              animation: `smoke-drift ${5 + Math.random() * 3}s ease-out forwards`,
              zIndex: 1,
              pointerEvents: "none",
              filter: "blur(8px)",
            }}
          />
        ))}

        <div
          style={{
            position: "relative",
            zIndex: 10,
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: 12,
              letterSpacing: 4,
              color: "var(--ruby)",
              marginBottom: 16,
              textTransform: "uppercase",
              fontFamily: "'Courier Prime', monospace",
              fontWeight: 700,
            }}
          >
            Balance Spiraled
          </div>

          {/* Stamped "DEFAULT" text or header based on mode */}
          <h1
            style={{
              fontSize: 64,
              fontWeight: 900,
              letterSpacing: 3,
              color: "var(--ruby)",
              margin: "0 0 24px",
              fontFamily: "'Playfair Display', serif",
              transform: "rotate(-8deg)",
              opacity: 0.9,
              textShadow: "2px 2px 0px rgba(0, 0, 0, 0.5)",
              border: `2px solid var(--ruby)`,
              padding: "12px 20px",
              display: "inline-block",
            }}
          >
            {g?.mode === "low-balance" ? "HIGH UTILIZATION" : "DEFAULT"}
          </h1>

          <p
            style={{
              color: "var(--gold-dim)",
              textAlign: "center",
              lineHeight: 1.8,
              fontSize: 15,
              fontFamily: "'Cormorant Garamond', serif",
              maxWidth: 380,
              marginBottom: 28,
            }}
          >
            {g?.mode === "low-balance"
              ? `Your average balance was ${Math.round(g?.balanceHistory.reduce((a, b) => a + b, 0) / g?.balanceHistory.length)} segments (${Math.round((g?.balanceHistory.reduce((a, b) => a + b, 0) / g?.balanceHistory.length / LOW_BALANCE_CREDIT_LIMIT) * 100)}% utilization). You made it ${g?.month} of 24 months.`
              : `Your ${g?.loan.name} at ${g?.loan.apr} APR compounded beyond your payment capacity. You made it ${g?.month} of 24 months.`}
          </p>

          {/* Torn ticket style lesson box */}
          <div
            style={{
              background: "var(--felt-light)",
              border: `1px solid var(--ruby)`,
              borderRadius: 0,
              padding: "20px 24px",
              maxWidth: 400,
              fontSize: 13,
              color: "var(--gold-dim)",
              lineHeight: 1.8,
              textAlign: "center",
              fontFamily: "'Cormorant Garamond', serif",
              position: "relative",
              marginBottom: 32,
              clipPath: "polygon(0 20px, 100% 0, 100% 100%, 0 100%)",
            }}
          >
            <strong style={{ color: "var(--ruby)" }}>
              {g?.mode === "low-balance" ? "Credit Utilization Lesson:" : "How This Card Works:"}
            </strong>{" "}
            {g?.mode === "low-balance"
              ? "High credit utilization (above 30%) signals financial stress to lenders and damages your credit score, even if you pay on time. Keeping your balance low relative to your credit limit shows you manage credit responsibly."
              : lessons[g?.loan.id]}
          </div>

          <button
            onClick={() => setScreen("mode")}
            style={{
              padding: "14px 36px",
              background: "transparent",
              border: "2px solid var(--ruby)",
              borderRadius: 2,
              color: "var(--ruby)",
              fontSize: 15,
              fontWeight: 700,
              letterSpacing: 3,
              cursor: "pointer",
              fontFamily: "'Playfair Display', serif",
              transition: "all 0.25s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(196, 30, 58, 0.15)";
              e.currentTarget.style.boxShadow = "0 0 16px rgba(196, 30, 58, 0.3)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  /* ── PLAYING ── */
  const monthsLeft = MONTHS_TOTAL - (g?.month || 0);
  const loan = g?.loan;
  const snake = g?.snake || [];
  const apple = g?.apple;

  // Calculate utilization for low balance mode
  const avgBalance = g?.balanceHistory.length > 0 ? g?.balanceHistory.reduce((a, b) => a + b, 0) / g?.balanceHistory.length : snake.length;
  const utilization = (avgBalance / LOW_BALANCE_CREDIT_LIMIT) * 100;
  const utilizationColor = utilization <= 30 ? "var(--jade)" : utilization <= 50 ? "#F5A623" : "var(--ruby)";
  const purchasePulseMsLeft = Math.max(0, (g?.purchasePulseUntil || 0) - Date.now());
  const purchaseFlashRatio = purchasePulseMsLeft / PURCHASE_FLASH_MS;

  // Color progression for months left
  const urgentColor =
    monthsLeft <= 6 ? "var(--ruby)" : monthsLeft <= 12 ? "#F5A623" : "var(--champagne)";

  // Determine chip color based on card type
  const chipColor =
    loan?.id === "retail" ? "var(--chip-red)" :
    loan?.id === "rewards" ? "var(--chip-blue)" :
    "var(--chip-white)";

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--felt)",
        backgroundImage: `
          repeating-linear-gradient(
            45deg,
            transparent,
            transparent 35px,
            rgba(212, 175, 55, 0.02) 35px,
            rgba(212, 175, 55, 0.02) 70px
          )
        `,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--champagne)",
        padding: 12,
        userSelect: "none",
      }}
    >
      {/* Mode indicator */}
      {g?.mode === "low-balance" && (
        <div
          style={{
            fontSize: 10,
            letterSpacing: 2,
            color: "var(--jade)",
            marginBottom: 8,
            fontFamily: "'Courier Prime', monospace",
            fontWeight: 700,
            textTransform: "uppercase",
          }}
        >
          LOW BALANCE MODE
        </div>
      )}

      {/* HUD */}
      <div
        style={{
          display: "flex",
          gap: 0,
          marginBottom: 12,
          borderTop: "2px solid var(--gold)",
          borderBottom: "2px solid var(--gold)",
          background: "var(--felt-light)",
          overflow: "hidden",
        }}
      >
        {(g?.mode === "low-balance"
          ? [
              { label: "CARD TYPE", value: loan?.name, color: "var(--gold)", small: true },
              { label: "UTILIZATION", value: `${Math.round(utilization)}%`, color: utilizationColor },
              { label: "AVG BALANCE", value: `${Math.round(avgBalance)}/${LOW_BALANCE_CREDIT_LIMIT}`, color: "var(--ruby)" },
              { label: "MONTHS LEFT", value: monthsLeft, color: urgentColor },
            ]
          : [
              { label: "CARD TYPE", value: loan?.name, color: "var(--gold)", small: true },
              { label: "APR", value: loan?.apr, color: "var(--gold)" },
              { label: "BALANCE", value: snake.length, color: "var(--ruby)" },
              { label: "MONTHS LEFT", value: monthsLeft, color: urgentColor },
            ]
        ).map((item, i) => (
          <div
            key={i}
            style={{
              padding: "10px 18px",
              borderRight: i < 3 ? "1px solid var(--gold-dim)" : "none",
              textAlign: "center",
              minWidth: item.small ? 150 : 100,
            }}
          >
            <div
              style={{
                fontSize: 9,
                letterSpacing: 2,
                color: "var(--gold-dim)",
                marginBottom: 4,
                fontFamily: "'Courier Prime', monospace",
                fontWeight: 700,
              }}
            >
              {item.label}
            </div>
            <div
              style={{
                fontSize: item.small ? 13 : 22,
                fontWeight: 700,
                color: item.color,
                fontFamily: item.small ? "'Playfair Display', serif" : "'Courier Prime', monospace",
              }}
            >
              {item.value}
            </div>
          </div>
        ))}
      </div>

      {/* Month progress bar (roulette wheel segment style) */}
      <div
        style={{
          width: boardPx,
          height: 4,
          background: "var(--felt-mid)",
          marginBottom: 8,
          borderRadius: 2,
          border: "1px solid var(--gold-dim)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${((MONTHS_TOTAL - monthsLeft) / MONTHS_TOTAL) * 100}%`,
            background: chipColor,
            borderRadius: 1,
            transition: "width 0.5s linear",
            boxShadow: `0 0 8px ${chipColor}`,
          }}
        />
      </div>

      {/* Board - Casino table felt */}
      <div
        style={{
          position: "relative",
          width: boardPx,
          height: boardPx,
          background: "var(--felt)",
          border: purchasePulseMsLeft > 0 ? "3px solid var(--ruby)" : "3px solid var(--gold)",
          boxShadow: purchasePulseMsLeft > 0
            ? `inset 0 0 24px rgba(196, 30, 58, ${0.16 + purchaseFlashRatio * 0.26}), 0 0 ${8 + Math.round(20 * purchaseFlashRatio)}px rgba(196, 30, 58, ${0.25 + purchaseFlashRatio * 0.4}), 0 8px 24px rgba(0, 0, 0, 0.5)`
            : `inset 0 0 20px rgba(212, 175, 55, 0.1), 0 8px 24px rgba(0, 0, 0, 0.5)`,
          backgroundImage: `
            repeating-linear-gradient(
              45deg,
              transparent,
              transparent 35px,
              rgba(212, 175, 55, 0.03) 35px,
              rgba(212, 175, 55, 0.03) 70px
            )
          `,
        }}
      >
        {/* Decorative corner markers */}
        {["top-left", "top-right", "bottom-left", "bottom-right"].map((corner) => (
          <div
            key={corner}
            style={{
              position: "absolute",
              width: 8,
              height: 8,
              background: "var(--gold)",
              ...(corner === "top-left" && { top: 6, left: 6 }),
              ...(corner === "top-right" && { top: 6, right: 6 }),
              ...(corner === "bottom-left" && { bottom: 6, left: 6 }),
              ...(corner === "bottom-right" && { bottom: 6, right: 6 }),
              transform: "rotate(45deg)",
            }}
          />
        ))}

        {/* Grid dots (very subtle) */}
        {Array.from({ length: GRID }).map((_, row) =>
          Array.from({ length: GRID }).map((_, col) => (
            <div
              key={`${row}-${col}`}
              style={{
                position: "absolute",
                left: col * CELL + CELL / 2 - 0.5,
                top: row * CELL + CELL / 2 - 0.5,
                width: 1,
                height: 1,
                background: "rgba(212, 175, 55, 0.08)",
                borderRadius: "50%",
              }}
            />
          ))
        )}

        {/* Payment chip (casino chip design) */}
        {apple && (
          <div
            style={{
              position: "absolute",
              left: apple.x * CELL + CELL / 2 - CELL / 2 + 2,
              top: apple.y * CELL + CELL / 2 - CELL / 2 + 2,
              width: CELL - 4,
              height: CELL - 4,
              borderRadius: "50%",
              background: `radial-gradient(circle at 30% 30%, ${chipColor}, ${chipColor}dd)`,
              boxShadow: `0 0 12px ${chipColor}88, 0 0 24px ${chipColor}44, inset -2px -2px 4px rgba(0, 0, 0, 0.4), inset 2px 2px 4px rgba(255, 255, 255, 0.1)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              fontWeight: "bold",
              color: "var(--champagne)",
              fontFamily: "'Courier Prime', monospace",
              animation: "chip-pulse 2s ease-in-out infinite",
              border: `2px solid ${chipColor}`,
            }}
          >
            $
          </div>
        )}

        {/* Snake */}
        {snake.map((seg, i) => {
          const isHead = i === 0;
          const fade = Math.max(0.4, 1 - (i / snake.length) * 0.6);
          const segmentColor = i === 0 ? "var(--gold-light)" : i === 1 ? "var(--gold)" : "var(--gold-dim)";

          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: seg.x * CELL + 2,
                top: seg.y * CELL + 2,
                width: CELL - 4,
                height: CELL - 4,
                borderRadius: isHead ? "50%" : "3px",
                background: segmentColor,
                opacity: fade,
                boxShadow: isHead
                  ? `0 0 10px var(--gold), 0 0 16px rgba(240, 208, 96, 0.3), inset -2px -2px 4px rgba(0, 0, 0, 0.4), inset 2px 2px 4px rgba(255, 255, 255, 0.2)`
                  : `inset -1px -1px 3px rgba(0, 0, 0, 0.3), inset 1px 1px 2px rgba(255, 255, 255, 0.1)`,
                border: isHead ? "2px solid var(--gold-light)" : `1px solid rgba(0, 0, 0, 0.2)`,
                animation: isHead ? "snake-head-gleam 2s ease-in-out infinite" : "none",
              }}
            >
              {/* Head indicator - small eye */}
              {isHead && (
                <div
                  style={{
                    position: "absolute",
                    width: 3,
                    height: 3,
                    background: "#000",
                    borderRadius: "50%",
                    top: "6px",
                    right: "5px",
                  }}
                />
              )}
            </div>
          );
        })}

        {g?.mode === "low-balance" && purchasePulseMsLeft > 0 && (
          <div
            key={g.purchasePulseId}
            style={{
              position: "absolute",
              top: 12,
              left: "50%",
              transform: `translate(-50%, ${Math.round((1 - purchaseFlashRatio) * -12)}px)`,
              padding: "6px 12px",
              borderRadius: 999,
              border: "1px solid rgba(196, 30, 58, 0.85)",
              background: `rgba(42, 19, 27, ${0.65 + purchaseFlashRatio * 0.25})`,
              color: "#ff8ea7",
              fontSize: 12,
              fontFamily: "'Courier Prime', monospace",
              fontWeight: 700,
              letterSpacing: 1,
              textTransform: "uppercase",
              boxShadow: `0 0 ${6 + Math.round(10 * purchaseFlashRatio)}px rgba(196, 30, 58, ${0.25 + purchaseFlashRatio * 0.4})`,
              opacity: 0.6 + purchaseFlashRatio * 0.4,
              pointerEvents: "none",
              zIndex: 10,
            }}
          >
            {g.lastPurchaseType} +{g.lastPurchaseSize}
          </div>
        )}
      </div>

      {/* D-pad controls */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 4,
          marginTop: 14,
        }}
      >
        {[
          [{ label: "▲", dir: { x: 0, y: -1 } }],
          [
            { label: "◀", dir: { x: -1, y: 0 } },
            { label: "●", dir: null },
            { label: "▶", dir: { x: 1, y: 0 } },
          ],
          [{ label: "▼", dir: { x: 0, y: 1 } }],
        ].map((row, ri) => (
          <div key={ri} style={{ display: "flex", gap: 4 }}>
            {row.map((btn, bi) => (
              <div
                key={bi}
                onClick={() => btn.dir && handleDir(btn.dir)}
                style={{
                  width: 40,
                  height: 40,
                  background: btn.dir ? `radial-gradient(circle, ${btn.dir ? "var(--felt-light)" : "transparent"}, var(--felt))` : "transparent",
                  border: btn.dir ? "2px solid var(--gold)" : "none",
                  borderRadius: "50%",
                  color: btn.dir ? "var(--gold)" : "transparent",
                  fontSize: 16,
                  fontWeight: "bold",
                  cursor: btn.dir ? "pointer" : "default",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "'Courier Prime', monospace",
                  transition: "all 0.15s",
                  boxShadow: btn.dir ? "inset 0 2px 4px rgba(0, 0, 0, 0.3), 0 0 8px rgba(212, 175, 55, 0.2)" : "none",
                }}
                onMouseEnter={(e) => {
                  if (btn.dir) {
                    e.currentTarget.style.boxShadow = "inset 0 2px 4px rgba(0, 0, 0, 0.3), 0 0 12px rgba(212, 175, 55, 0.4)";
                    e.currentTarget.style.color = "var(--gold-light)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (btn.dir) {
                    e.currentTarget.style.boxShadow = "inset 0 2px 4px rgba(0, 0, 0, 0.3), 0 0 8px rgba(212, 175, 55, 0.2)";
                    e.currentTarget.style.color = "var(--gold)";
                  }
                }}
              >
                {btn.label}
              </div>
            ))}
          </div>
        ))}
      </div>

      <div
        style={{
          fontSize: 12,
          color: "var(--gold-dim)",
          marginTop: 10,
          fontFamily: "'Cormorant Garamond', serif",
          letterSpacing: 1,
          fontStyle: "italic",
        }}
      >
        WASD / Arrow Keys or tap controls
      </div>
    </div>
  );
}
