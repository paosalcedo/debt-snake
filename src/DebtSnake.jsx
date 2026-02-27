import { useState, useEffect, useRef } from "react";

// Load DM Sans from Google Fonts
const fontLink = document.createElement("link");
fontLink.rel = "stylesheet";
fontLink.href = "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;700;900&display=swap";
document.head.appendChild(fontLink);

const GRID = 20;
const CELL = 24;
const TICK_MS = 145;
const MONTHS_TOTAL = 24;
const MONTH_MS = 5000;
const APPLE_SHRINK = 1;
const INIT_LEN = 5;

const LOANS = [
  {
    id: "federal",
    name: "Federal Student Loan",
    apr: "5%",
    desc: "Low interest, government-backed. Hard, but survivable with discipline.",
    headColor: "#14532d",
    bodyColor: "#4ade80",
    accent: "#86efac",
    tagline: "MANAGEABLE",
    growthStartMs: 7500,
    compoundFactor: 0.974,
  },
  {
    id: "credit",
    name: "Credit Card",
    apr: "22%",
    desc: "Easy access, easy spiral. Minimum payments barely touch the interest.",
    headColor: "#78350f",
    bodyColor: "#fb923c",
    accent: "#fdba74",
    tagline: "RISKY",
    growthStartMs: 3200,
    compoundFactor: 0.94,
  },
  {
    id: "payday",
    name: "Payday Loan",
    apr: "400%",
    desc: "Fast cash, predatory trap. Almost impossible to escape once you're in.",
    headColor: "#7f1d1d",
    bodyColor: "#ef4444",
    accent: "#fca5a5",
    tagline: "DANGER",
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
          background: "#060a12",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'DM Sans', 'Trebuchet MS', sans-serif",
          color: "#e2e8f0",
          padding: 24,
          backgroundImage:
            "radial-gradient(ellipse at 50% 0%, #0f2027 0%, #060a12 70%)",
        }}
      >
        <div
          style={{
            fontSize: 11,
            letterSpacing: 6,
            color: "#334155",
            marginBottom: 8,
            textTransform: "uppercase",
          }}
        >
          Financial Literacy Game
        </div>
        <h1
          style={{
            fontSize: 48,
            fontWeight: 900,
            letterSpacing: 8,
            margin: "0 0 6px",
            background: "linear-gradient(135deg, #f8fafc 40%, #64748b)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          DEBT SNAKE
        </h1>
        <p
          style={{
            color: "#475569",
            fontSize: 13,
            marginBottom: 48,
            textAlign: "center",
            maxWidth: 400,
            lineHeight: 1.8,
          }}
        >
          Pick your loan. The snake grows automatically — that's compound
          interest.
          <br />
          Collect <span style={{ color: "#4ade80" }}>●</span> to pay it down.
          Hit a wall, hit yourself, or run out of time and you lose.
        </p>

        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center" }}>
          {LOANS.map((l) => (
            <div
              key={l.id}
              onClick={() => startGame(l)}
              style={{
                background: "#0d1724",
                border: `1px solid ${l.bodyColor}33`,
                borderRadius: 4,
                padding: "24px 22px 20px",
                cursor: "pointer",
                width: 200,
                transition: "all 0.18s",
                position: "relative",
                overflow: "hidden",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.border = `1px solid ${l.bodyColor}99`;
                e.currentTarget.style.background = "#111c2c";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.border = `1px solid ${l.bodyColor}33`;
                e.currentTarget.style.background = "#0d1724";
              }}
            >
              <div
                style={{
                  fontSize: 9,
                  letterSpacing: 3,
                  color: l.bodyColor,
                  marginBottom: 10,
                  fontWeight: "bold",
                }}
              >
                {l.tagline}
              </div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: "bold",
                  color: "#cbd5e1",
                  marginBottom: 6,
                }}
              >
                {l.name}
              </div>
              <div
                style={{
                  fontSize: 36,
                  fontWeight: 900,
                  color: l.bodyColor,
                  lineHeight: 1,
                  marginBottom: 12,
                }}
              >
                {l.apr}
                <span style={{ fontSize: 14, color: "#64748b" }}> APR</span>
              </div>
              <div
                style={{ fontSize: 11, color: "#475569", lineHeight: 1.6 }}
              >
                {l.desc}
              </div>
              <div
                style={{
                  marginTop: 18,
                  borderTop: `1px solid ${l.bodyColor}22`,
                  paddingTop: 14,
                  fontSize: 11,
                  color: l.bodyColor,
                  letterSpacing: 2,
                  textAlign: "center",
                }}
              >
                CHOOSE →
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            marginTop: 48,
            fontSize: 11,
            color: "#1e293b",
            textAlign: "center",
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
          background: "#060a12",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'DM Sans', 'Trebuchet MS', sans-serif",
          color: "#e2e8f0",
          padding: 24,
        }}
      >
        <div style={{ fontSize: 64, marginBottom: 16 }}>💵</div>
        <div
          style={{
            fontSize: 9,
            letterSpacing: 6,
            color: "#4ade80",
            marginBottom: 8,
          }}
        >
          OBJECTIVE COMPLETE
        </div>
        <h1
          style={{
            fontSize: 40,
            fontWeight: 900,
            letterSpacing: 6,
            color: "#4ade80",
            margin: "0 0 16px",
          }}
        >
          DEBT FREE
        </h1>
        <p style={{ color: "#64748b", textAlign: "center", lineHeight: 1.8, fontSize: 13 }}>
          You paid off your {g?.loan.name} in {g?.month} of 24 months.
          <br />
          Payments made: {g?.applesEaten}
        </p>
        <div
          style={{
            marginTop: 24,
            background: "#0d1724",
            border: "1px solid #4ade8033",
            borderRadius: 4,
            padding: "16px 24px",
            maxWidth: 360,
            fontSize: 12,
            color: "#94a3b8",
            lineHeight: 1.7,
            textAlign: "center",
          }}
        >
          <strong style={{ color: "#4ade80" }}>The takeaway:</strong> Consistent
          payments beat compound interest. The earlier you pay, the less you owe.
        </div>
        <button
          onClick={() => setScreen("select")}
          style={{
            marginTop: 28,
            padding: "12px 32px",
            background: "transparent",
            border: "1px solid #4ade80",
            borderRadius: 4,
            color: "#4ade80",
            fontSize: 12,
            fontWeight: "bold",
            letterSpacing: 3,
            cursor: "pointer",
            fontFamily: "inherit",
            transition: "all 0.15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#4ade8022";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
          }}
        >
          PLAY AGAIN
        </button>
      </div>
    );

  /* ── LOSE SCREEN ── */
  if (screen === "lose") {
    const lessons = {
      payday:
        "Payday loans are designed to trap borrowers. The average borrower takes out 8 loans per year. Many states have banned them entirely.",
      credit:
        "Credit card minimum payments are structured so you pay mostly interest. On a $3,000 balance at 22% APR, minimum payments can take over 10 years to clear.",
      federal:
        "Even federal loans spiral without a plan. Income-driven repayment, deferment, and forgiveness programs exist — use them before defaulting.",
    };
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#060a12",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'DM Sans', 'Trebuchet MS', sans-serif",
          color: "#e2e8f0",
          padding: 24,
        }}
      >
        <div style={{ fontSize: 64, marginBottom: 16 }}>📉</div>
        <div
          style={{
            fontSize: 9,
            letterSpacing: 6,
            color: "#ef4444",
            marginBottom: 8,
          }}
        >
          DEBT SPIRAL
        </div>
        <h1
          style={{
            fontSize: 40,
            fontWeight: 900,
            letterSpacing: 6,
            color: "#ef4444",
            margin: "0 0 16px",
          }}
        >
          GAME OVER
        </h1>
        <p style={{ color: "#64748b", textAlign: "center", lineHeight: 1.8, fontSize: 13 }}>
          Your {g?.loan.name} ({g?.loan.apr} APR) got away from you.
          <br />
          The interest compounded faster than you could pay.
        </p>
        <div
          style={{
            marginTop: 24,
            background: "#0d1724",
            border: "1px solid #ef444433",
            borderRadius: 4,
            padding: "16px 24px",
            maxWidth: 360,
            fontSize: 12,
            color: "#94a3b8",
            lineHeight: 1.7,
            textAlign: "center",
          }}
        >
          <strong style={{ color: "#ef4444" }}>Real talk: </strong>
          {lessons[g?.loan.id]}
        </div>
        <button
          onClick={() => setScreen("select")}
          style={{
            marginTop: 28,
            padding: "12px 32px",
            background: "transparent",
            border: "1px solid #ef4444",
            borderRadius: 4,
            color: "#ef4444",
            fontSize: 12,
            fontWeight: "bold",
            letterSpacing: 3,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#ef444422";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
          }}
        >
          TRY AGAIN
        </button>
      </div>
    );
  }

  /* ── PLAYING ── */
  const monthsLeft = MONTHS_TOTAL - (g?.month || 0);
  const loan = g?.loan;
  const snake = g?.snake || [];
  const apple = g?.apple;
  const urgentColor =
    monthsLeft <= 6 ? "#ef4444" : monthsLeft <= 12 ? "#fb923c" : "#e2e8f0";

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#060a12",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'DM Sans', 'Trebuchet MS', sans-serif",
        color: "#e2e8f0",
        padding: 12,
        userSelect: "none",
      }}
    >
      {/* HUD */}
      <div
        style={{
          display: "flex",
          gap: 0,
          marginBottom: 10,
          border: "1px solid #1e293b",
          borderRadius: 3,
          overflow: "hidden",
        }}
      >
        {[
          { label: "LOAN", value: loan?.name, color: loan?.bodyColor, small: true },
          { label: "APR", value: loan?.apr, color: loan?.bodyColor },
          { label: "DEBT", value: snake.length, color: "#ef4444" },
          { label: "MONTHS LEFT", value: monthsLeft, color: urgentColor },
        ].map((item, i) => (
          <div
            key={i}
            style={{
              padding: "8px 16px",
              borderRight: i < 3 ? "1px solid #1e293b" : "none",
              textAlign: "center",
              minWidth: item.small ? 140 : 90,
            }}
          >
            <div style={{ fontSize: 8, letterSpacing: 2, color: "#334155", marginBottom: 3 }}>
              {item.label}
            </div>
            <div
              style={{
                fontSize: item.small ? 12 : 20,
                fontWeight: "bold",
                color: item.color,
              }}
            >
              {item.value}
            </div>
          </div>
        ))}
      </div>

      {/* Month progress bar */}
      <div
        style={{
          width: boardPx,
          height: 3,
          background: "#0d1724",
          marginBottom: 6,
          borderRadius: 1,
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${((MONTHS_TOTAL - monthsLeft) / MONTHS_TOTAL) * 100}%`,
            background: urgentColor,
            borderRadius: 1,
            transition: "width 0.5s linear",
          }}
        />
      </div>

      {/* Board */}
      <div
        style={{
          position: "relative",
          width: boardPx,
          height: boardPx,
          background: "#080e1a",
          border: "1px solid #1e293b",
          outline: `1px solid ${loan?.bodyColor}11`,
          outlineOffset: 3,
        }}
      >
        {/* Grid dots */}
        {Array.from({ length: GRID }).map((_, row) =>
          Array.from({ length: GRID }).map((_, col) => (
            <div
              key={`${row}-${col}`}
              style={{
                position: "absolute",
                left: col * CELL + CELL / 2 - 1,
                top: row * CELL + CELL / 2 - 1,
                width: 1,
                height: 1,
                background: "#0f172a",
                borderRadius: "50%",
              }}
            />
          ))
        )}

        {/* Apple */}
        {apple && (
          <div
            style={{
              position: "absolute",
              left: apple.x * CELL + 3,
              top: apple.y * CELL + 3,
              width: CELL - 6,
              height: CELL - 6,
              borderRadius: "50%",
              background: "#22c55e",
              boxShadow: "0 0 10px #22c55e88, 0 0 20px #22c55e33",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 10,
              fontWeight: "bold",
              color: "#052e16",
            }}
          >
            $
          </div>
        )}

        {/* Snake */}
        {snake.map((seg, i) => {
          const isHead = i === 0;
          const fade = Math.max(0.3, 1 - (i / snake.length) * 0.65);
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: seg.x * CELL + 1,
                top: seg.y * CELL + 1,
                width: CELL - 2,
                height: CELL - 2,
                borderRadius: isHead ? 5 : 2,
                background: isHead ? loan?.headColor : loan?.bodyColor,
                opacity: isHead ? 1 : fade,
                boxShadow: isHead
                  ? `0 0 6px ${loan?.bodyColor}66`
                  : undefined,
              }}
            />
          );
        })}
      </div>

      {/* D-pad */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 3,
          marginTop: 12,
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
          <div key={ri} style={{ display: "flex", gap: 3 }}>
            {row.map((btn, bi) => (
              <div
                key={bi}
                onClick={() => btn.dir && handleDir(btn.dir)}
                style={{
                  width: 36,
                  height: 36,
                  background: btn.dir ? "#0d1724" : "transparent",
                  border: btn.dir ? "1px solid #1e293b" : "none",
                  borderRadius: 3,
                  color: btn.dir ? "#475569" : "transparent",
                  fontSize: 14,
                  cursor: btn.dir ? "pointer" : "default",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {btn.label}
              </div>
            ))}
          </div>
        ))}
      </div>

      <div style={{ fontSize: 10, color: "#1e293b", marginTop: 8 }}>
        WASD / Arrow keys or tap controls above
      </div>
    </div>
  );
}
