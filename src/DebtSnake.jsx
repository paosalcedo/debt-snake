import { useState, useEffect, useRef } from "react";

const GRID = 20;
const CELL = 24;
const TICK_MS = 145;
const MONTHS_TOTAL = 24;
const MONTH_MS = 5000;
const APPLE_SHRINK = 1;
const INIT_LEN = 5;

const CARDS = [
  {
    id: "secured",
    name: "Secured Card",
    apr: "20%",
    desc: "Low APR, but any unpaid balance grows. Discipline wins here.",
    headColor: "#14532d",
    bodyColor: "#4ade80",
    accent: "#86efac",
    tagline: "STARTER",
    growthStartMs: 7000,
    compoundFactor: 0.975,
  },
  {
    id: "rewards",
    name: "Rewards Card",
    apr: "27%",
    desc: "The points aren't worth it if you're carrying a balance.",
    headColor: "#78350f",
    bodyColor: "#fb923c",
    accent: "#fdba74",
    tagline: "RISKY",
    growthStartMs: 3200,
    compoundFactor: 0.94,
  },
  {
    id: "retail",
    name: "Retail Card",
    apr: "34%",
    desc: "That 20% off at checkout is costing you 34% APR.",
    headColor: "#7f1d1d",
    bodyColor: "#ef4444",
    accent: "#fca5a5",
    tagline: "TRAP",
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

export default function DebtSnake() {
  const [screen, setScreen] = useState("select");
  const [, tick] = useState(0);
  const rerender = () => tick((n) => n + 1);

  const G = useRef(null);
  const loopRef = useRef(null);
  const monthRef = useRef(null);
  const growTimeoutRef = useRef(null);

  const stopAll = () => {
    clearInterval(loopRef.current);
    clearInterval(monthRef.current);
    clearTimeout(growTimeoutRef.current);
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

  const startGame = (loan) => {
    stopAll();
    const snake = initSnake();
    G.current = {
      snake,
      apple: randCell(snake),
      dir: { x: 1, y: 0 },
      nextDir: { x: 1, y: 0 },
      month: 0,
      growInterval: loan.growthStartMs,
      loan,
      alive: true,
      applesEaten: 0,
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

      if (head.x === g.apple.x && head.y === g.apple.y) {
        g.applesEaten++;
        const shrink = Math.min(APPLE_SHRINK, g.snake.length - 1);
        g.snake = g.snake.slice(0, g.snake.length - shrink);
        if (g.snake.length <= 1) {
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
      g.month++;
      if (g.month >= MONTHS_TOTAL) {
        g.alive = false;
        stopAll();
        setScreen("lose");
      }
      rerender();
    }, MONTH_MS);

    growTimeoutRef.current = setTimeout(() => growFn.current(), loan.growthStartMs);
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
            fontSize: 15,
            marginBottom: 48,
            textAlign: "center",
            maxWidth: 480,
            lineHeight: 1.9,
            fontFamily: "'Cormorant Garamond', serif",
          }}
        >
          Pick your card. The snake grows automatically — that's interest compounding on your balance.
          <br />
          Collect <span style={{ color: "var(--gold)" }}>$</span> tokens to make payments. Hit a wall, hit yourself, or run out of time and you default.
        </p>

        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", justifyContent: "center" }}>
          {CARDS.map((l, idx) => (
            <div
              key={l.id}
              onClick={() => startGame(l)}
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
                Place Your Bet →
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
            PAID<br />OFF
          </h1>
        </div>

        <p
          style={{
            color: "var(--champagne)",
            textAlign: "center",
            lineHeight: 1.8,
            fontSize: 15,
            fontFamily: "'Cormorant Garamond', serif",
            fontStyle: "italic",
            position: "relative",
            zIndex: 10,
            maxWidth: 380,
          }}
        >
          You paid it off. That's what consistent payments ahead of the interest curve looks like.
          <br />
          <span style={{ fontSize: 13, color: "var(--gold-dim)" }}>
            {g?.loan.name} cleared in {g?.month} of 24 months — {g?.applesEaten} payments made.
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
            fontSize: 13,
            color: "var(--gold-dim)",
            lineHeight: 1.8,
            textAlign: "center",
            fontFamily: "'Cormorant Garamond', serif",
            position: "relative",
            zIndex: 10,
          }}
        >
          <strong style={{ color: "var(--jade)" }}>The Takeaway:</strong> Most cardholders never reach this point. They get trapped in minimum payments and watch their balance grow despite making payments. You paid ahead of the curve.
        </div>

        <button
          onClick={() => setScreen("select")}
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

          {/* Stamped "DEFAULT" text */}
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
            DEFAULT
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
            Your {g?.loan.name} at {g?.loan.apr} APR compounded beyond your payment capacity.
            <br />
            You made it {g?.month} of 24 months.
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
            <strong style={{ color: "var(--ruby)" }}>How This Card Works:</strong> {lessons[g?.loan.id]}
          </div>

          <button
            onClick={() => setScreen("select")}
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
        {[
          { label: "CARD TYPE", value: loan?.name, color: "var(--gold)", small: true },
          { label: "APR", value: loan?.apr, color: "var(--gold)" },
          { label: "BALANCE", value: snake.length, color: "var(--ruby)" },
          { label: "MONTHS LEFT", value: monthsLeft, color: urgentColor },
        ].map((item, i) => (
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
          border: "3px solid var(--gold)",
          boxShadow: `inset 0 0 20px rgba(212, 175, 55, 0.1), 0 8px 24px rgba(0, 0, 0, 0.5)`,
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
