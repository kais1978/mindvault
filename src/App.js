import React, { useEffect, useMemo, useState } from "react";

const TODAY_KEY = new Date().toISOString().slice(0, 10);
const TODAY_ID = TODAY_KEY.replaceAll("-", "");

const DOORS = [
  { name: "Pattern", shard: "Pattern Shard", icon: "◆" },
  { name: "Maze", shard: "Path Shard", icon: "✦" },
  { name: "Number", shard: "Number Shard", icon: "24" },
  { name: "Shadow", shard: "Shadow Shard", icon: "◈" },
  { name: "Cipher", shard: "Cipher Shard", icon: "⌘" },
];

const DAILY_BADGES = [
  "Neon Key",
  "Glass Compass",
  "Violet Flame",
  "Silver Circuit",
  "Star Prism",
  "Golden Gate",
  "Crown of Focus",
];

const SYMBOLS = ["◆", "●", "■", "▲", "◇", "✦"];
const CIPHER_SYMBOLS = ["▲", "◆", "●", "■", "◇", "✦"];

function hashString(str) {
  let h = 2166136261;

  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }

  return h >>> 0;
}

function createRng(seedString) {
  let seed = hashString(seedString);

  return function rng() {
    seed += 0x6d2b79f5;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

function shuffle(rng, arr) {
  const copy = [...arr];

  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function getRank(seconds, mistakes) {
  if (mistakes === 0 && seconds <= 360) return "S";
  if (mistakes <= 1 && seconds <= 480) return "A";
  if (mistakes <= 3) return "B";
  if (mistakes <= 5) return "C";
  return "D";
}

function getPrecision(mistakes) {
  return Math.max(45, 100 - mistakes * 7);
}

function getTodayBadge() {
  return DAILY_BADGES[new Date().getDay()];
}

function getWeekNumber(date = new Date()) {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  );

  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);

  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

function safeReadWeek() {
  try {
    return JSON.parse(localStorage.getItem("mindvault_week") || "[]");
  } catch {
    return [];
  }
}

/* ---------------- DAILY PUZZLE GENERATORS ---------------- */

function generatePatternPuzzle(seed) {
  const rng = createRng(seed + "-pattern");
  const pool = shuffle(rng, SYMBOLS).slice(0, 3);
  const offset = Math.floor(rng() * 3);

  const grid = Array.from({ length: 3 }, (_, row) =>
    Array.from({ length: 3 }, (_, col) => pool[(col + row + offset) % 3])
  );

  const answer = grid[2][2];
  grid[2][2] = "?";

  const wrongAnswers = SYMBOLS.filter((symbol) => symbol !== answer);
  const options = shuffle(rng, [
    answer,
    ...shuffle(rng, wrongAnswers).slice(0, 3),
  ]);

  return {
    grid,
    answer,
    options,
    explanation: "Each row shifts one step forward.",
  };
}

function generateMazePuzzle(seed) {
  const rng = createRng(seed + "-maze");

  const start = { r: 0, c: 0 };
  const exit = { r: 4, c: 4 };

  const path = [];
  let r = 0;
  let c = 0;

  path.push("0,0");

  while (r < 4 || c < 4) {
    if (r === 4) {
      c++;
    } else if (c === 4) {
      r++;
    } else if (rng() < 0.5) {
      r++;
    } else {
      c++;
    }

    path.push(`${r},${c}`);
  }

  const pathSet = new Set(path);
  const nonPathCells = [];

  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      const key = `${row},${col}`;
      if (!pathSet.has(key)) {
        nonPathCells.push(key);
      }
    }
  }

  const walls = new Set(shuffle(rng, nonPathCells).slice(0, 6));

  const orbCandidates = path.filter((key) => key !== "0,0" && key !== "4,4");
  const orbs = new Set(shuffle(rng, orbCandidates).slice(0, 3));

  return {
    start,
    exit,
    walls,
    orbs,
  };
}

function generateNumberPuzzle(seed) {
  const rng = createRng(seed + "-number");
  const mode = pick(rng, ["add", "multiply", "square"]);

  let sequence;
  let rule;

  if (mode === "add") {
    const start = 2 + Math.floor(rng() * 8);
    const step = 2 + Math.floor(rng() * 9);

    sequence = [0, 1, 2, 3, 4].map((i) => start + i * step);
    rule = `Add ${step} each time.`;
  } else if (mode === "multiply") {
    const start = 2 + Math.floor(rng() * 5);
    const factor = pick(rng, [2, 3]);

    sequence = [0, 1, 2, 3, 4].map((i) => start * Math.pow(factor, i));
    rule = `Multiply by ${factor} each time.`;
  } else {
    const start = 2 + Math.floor(rng() * 5);

    sequence = [0, 1, 2, 3, 4].map((i) => Math.pow(start + i, 2));
    rule = "The numbers are consecutive squares.";
  }

  const missingIndex = 1 + Math.floor(rng() * 3);
  const answer = String(sequence[missingIndex]);

  const display = sequence.map(String);
  display[missingIndex] = "?";

  const wrongs = new Set();

  while (wrongs.size < 3) {
    const offset = pick(rng, [-12, -9, -6, -4, -3, 3, 4, 6, 9, 12]);
    const wrong = Math.max(1, Number(answer) + offset);

    if (String(wrong) !== answer) {
      wrongs.add(String(wrong));
    }
  }

  return {
    sequence: display,
    missingIndex,
    answer,
    options: shuffle(rng, [answer, ...Array.from(wrongs)]),
    rule,
  };
}

function generateShadowPuzzle(seed) {
  const rng = createRng(seed + "-shadow");

  const allCells = Array.from({ length: 9 }, (_, i) => {
    const row = Math.floor(i / 3);
    const col = i % 3;
    return `${row},${col}`;
  });

  const count = 3 + Math.floor(rng() * 3);

  return {
    pattern: new Set(shuffle(rng, allCells).slice(0, count)),
    watchMs: 2400,
  };
}

function generateCipherPuzzle(seed) {
  const rng = createRng(seed + "-cipher");

  const symbols = shuffle(rng, CIPHER_SYMBOLS).slice(0, 4);
  const digits = shuffle(rng, ["1", "2", "3", "4", "5", "6", "7", "8", "9"]).slice(
    0,
    4
  );

  const map = symbols.map((symbol, index) => ({
    symbol,
    value: digits[index],
  }));

  const codeSymbols = Array.from({ length: 4 }, () => pick(rng, symbols));

  const answer = codeSymbols
    .map((symbol) => map.find((item) => item.symbol === symbol).value)
    .join("");

  return {
    map,
    codeSymbols,
    answer,
  };
}

function generateWeeklyRelic(seed) {
  const rng = createRng(seed + "-weekly");

  return {
    name: pick(rng, [
      "The Seven-Gate Seal",
      "The Obsidian Crown",
      "The Chrono Prism",
      "The Mindforge Relic",
      "The Arc Key",
    ]),
    difficulty: pick(rng, ["Hard", "Expert", "Master"]),
  };
}

function generateDailyVault(dateKey) {
  return {
    pattern: generatePatternPuzzle(dateKey),
    maze: generateMazePuzzle(dateKey),
    number: generateNumberPuzzle(dateKey),
    shadow: generateShadowPuzzle(dateKey),
    cipher: generateCipherPuzzle(dateKey),
  };
}

/* ---------------- MAIN APP ---------------- */

export default function App() {
  const dailyVault = useMemo(() => generateDailyVault(TODAY_KEY), []);

  const weeklyRelic = useMemo(() => {
    const week = getWeekNumber();
    const year = new Date().getFullYear();
    return generateWeeklyRelic(`${year}-W${week}`);
  }, []);

  const [started, setStarted] = useState(false);
  const [doorIndex, setDoorIndex] = useState(0);
  const [openedDoors, setOpenedDoors] = useState([]);
  const [seconds, setSeconds] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [reward, setReward] = useState(null);
  const [weekVersion, setWeekVersion] = useState(0);

  const rank = getRank(seconds, mistakes);
  const precision = getPrecision(mistakes);
  const todayBadge = getTodayBadge();

  const weeklyBadges = useMemo(() => safeReadWeek(), [weekVersion]);

  useEffect(() => {
    if (!started || completed || reward) return;

    const timer = setInterval(() => {
      setSeconds((previous) => previous + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [started, completed, reward]);

  function completeDoor() {
    const door = DOORS[doorIndex];

    setOpenedDoors((previous) => [...new Set([...previous, doorIndex])]);

    setTimeout(() => {
      setReward({
        title: `${door.shard} Earned`,
        icon: door.icon,
        subtitle: `${doorIndex + 1}/5 vault shards collected`,
        current: doorIndex + 1,
      });
    }, 850);
  }

  function continueAfterReward() {
    const currentDoor = doorIndex;

    setReward(null);

    window.setTimeout(() => {
      if (currentDoor < 4) {
        setDoorIndex(currentDoor + 1);
        return;
      }

      const saved = safeReadWeek();
      const updated = [...new Set([...saved, todayBadge])].slice(0, 7);

      localStorage.setItem("mindvault_week", JSON.stringify(updated));

      setWeekVersion((previous) => previous + 1);
      setCompleted(true);
    }, 80);
  }

  function resetGame() {
    setStarted(false);
    setDoorIndex(0);
    setOpenedDoors([]);
    setSeconds(0);
    setMistakes(0);
    setCompleted(false);
    setReward(null);
  }

  async function shareResult() {
    const text = `MindVault #${TODAY_ID}
🚪1 ✅ Pattern
🚪2 ✅ Maze
🚪3 ✅ Number
🚪4 ✅ Shadow
🚪5 ✅ Cipher

Badge Earned: ${todayBadge}
Rank: ${rank}
${formatTime(seconds)} · ${precision}% precision · ${mistakes} mistakes
Weekly Relic: ${weeklyBadges.length}/7 badges`;

    try {
      await navigator.clipboard.writeText(text);
      alert("Result copied.");
    } catch {
      alert(text);
    }
  }

  return (
    <>
      <style>{css}</style>

      <div className="screen">
        <main className="app">
          {!started && !completed && (
            <StartScreen
              todayBadge={todayBadge}
              weeklyCount={weeklyBadges.length}
              weeklyRelic={weeklyRelic}
              onStart={() => setStarted(true)}
            />
          )}

          {started && !completed && (
            <>
              <TopBar
                doorIndex={doorIndex}
                seconds={seconds}
                mistakes={mistakes}
              />

              <DoorRow activeDoor={doorIndex} openedDoors={openedDoors} />

              {doorIndex === 0 && (
                <PatternDoor
                  puzzle={dailyVault.pattern}
                  onMistake={() => setMistakes((previous) => previous + 1)}
                  onSolved={completeDoor}
                />
              )}

              {doorIndex === 1 && (
                <MazeDoor
                  puzzle={dailyVault.maze}
                  onMistake={() => setMistakes((previous) => previous + 1)}
                  onSolved={completeDoor}
                />
              )}

              {doorIndex === 2 && (
                <MissingNumberDoor
                  puzzle={dailyVault.number}
                  onMistake={() => setMistakes((previous) => previous + 1)}
                  onSolved={completeDoor}
                />
              )}

              {doorIndex === 3 && (
                <ShadowDoor
                  puzzle={dailyVault.shadow}
                  onMistake={() => setMistakes((previous) => previous + 1)}
                  onSolved={completeDoor}
                />
              )}

              {doorIndex === 4 && (
                <CipherDoor
                  puzzle={dailyVault.cipher}
                  onMistake={() => setMistakes((previous) => previous + 1)}
                  onSolved={completeDoor}
                />
              )}
            </>
          )}

          {completed && (
            <FinalScreen
              rank={rank}
              seconds={seconds}
              mistakes={mistakes}
              precision={precision}
              todayBadge={todayBadge}
              weeklyCount={weeklyBadges.length}
              weeklyRelic={weeklyRelic}
              onShare={shareResult}
              onReplay={resetGame}
            />
          )}

          {reward && (
            <RewardModal reward={reward} onContinue={continueAfterReward} />
          )}
        </main>
      </div>
    </>
  );
}

/* ---------------- UI COMPONENTS ---------------- */

function StartScreen({ todayBadge, weeklyCount, weeklyRelic, onStart }) {
  return (
    <>
      <div className="topline">
        <span>Daily Vault</span>
        <span>#{TODAY_ID}</span>
      </div>

      <section className="hero">
        <div className="content">
          <div className="vault-mark">◆</div>

          <h1>
            Mind<span className="accent">Vault</span>
          </h1>

          <p className="subtitle">
            Open five logic doors. Earn five shards. Forge today’s badge and move
            closer to the Weekly Relic.
          </p>

          <div className="weekly-card">
            <span>Today’s Badge</span>
            <strong>{todayBadge}</strong>
            <small>
              Weekly Relic: {weeklyRelic.name} · {weeklyCount}/7 badges
            </small>
          </div>

          <button type="button" className="primary-btn" onClick={onStart}>
            Enter Today’s Vault
          </button>
        </div>
      </section>

      <p className="footer">
        New generated vault every day. Same puzzle for everyone today.
      </p>
    </>
  );
}

function TopBar({ doorIndex, seconds, mistakes }) {
  return (
    <>
      <div className="topline">
        <span>MindVault</span>
        <span>Door {doorIndex + 1}/5</span>
      </div>

      <section className="stats">
        <div className="stat">
          <span>Time</span>
          <strong>{formatTime(seconds)}</strong>
        </div>

        <div className="stat">
          <span>Door</span>
          <strong>{doorIndex + 1}/5</strong>
        </div>

        <div className="stat">
          <span>Errors</span>
          <strong>{mistakes}</strong>
        </div>
      </section>
    </>
  );
}

function FinalScreen({
  rank,
  seconds,
  mistakes,
  precision,
  todayBadge,
  weeklyCount,
  weeklyRelic,
  onShare,
  onReplay,
}) {
  const relicUnlocked = weeklyCount >= 7;

  return (
    <section className="result-card">
      <div className="content">
        <div className="vault-icon">🔓</div>

        <div className="topline center">
          <span>Daily Vault Complete</span>
        </div>

        <h1>
          Badge <span className="accent">Forged</span>
        </h1>

        <div className="daily-badge">
          <div className="badge-ring">
            <div className="badge-core">◆</div>
          </div>

          <strong>{todayBadge}</strong>
          <span>Daily Badge Earned</span>
        </div>

        <div className="rank">{rank}</div>

        <p className="subtitle no-margin">
          You opened today’s vault in {formatTime(seconds)} with {precision}%
          precision.
        </p>

        <div className="result-grid">
          <div className="stat">
            <span>Time</span>
            <strong>{formatTime(seconds)}</strong>
          </div>

          <div className="stat">
            <span>Errors</span>
            <strong>{mistakes}</strong>
          </div>

          <div className="stat">
            <span>Precision</span>
            <strong>{precision}%</strong>
          </div>
        </div>

        <div className={`relic-card ${relicUnlocked ? "unlocked" : ""}`}>
          <span>
            {relicUnlocked ? "Weekly Relic Unlocked" : "Weekly Relic Progress"}
          </span>

          <strong>
            {relicUnlocked ? weeklyRelic.name : `${weeklyCount}/7 Badges`}
          </strong>

          <small>
            {relicUnlocked
              ? `${weeklyRelic.difficulty} relic puzzle ready.`
              : `Collect all 7 daily badges to unlock ${weeklyRelic.name}.`}
          </small>
        </div>

        <button type="button" className="primary-btn" onClick={onShare}>
          Share Result
        </button>

        <button type="button" className="secondary-btn" onClick={onReplay}>
          Replay Vault
        </button>
      </div>
    </section>
  );
}

function DoorRow({ activeDoor, openedDoors }) {
  return (
    <div className="doors">
      {DOORS.map((door, index) => (
        <div
          key={door.name}
          className={`door ${activeDoor === index ? "active" : ""} ${
            openedDoors.includes(index) ? "open" : ""
          }`}
        >
          <div className="door-light" />
          <div className="door-left" />
          <div className="door-right" />
          <div className="door-number">{index + 1}</div>
          <div className="door-title">{door.name}</div>
        </div>
      ))}
    </div>
  );
}

function BigOpeningDoor({ open, label }) {
  return (
    <div className={`big-door ${open ? "big-door-open" : ""}`}>
      <div className="big-door-light" />
      <div className="big-door-left" />
      <div className="big-door-right" />
      <div className="big-door-lock">{open ? "🔓" : "🔒"}</div>
      <div className="big-door-label">{label}</div>
    </div>
  );
}

function RewardModal({ reward, onContinue }) {
  return (
    <div className="modal-backdrop">
      <section className="reward-card">
        <div className="reward-burst">
          <span>✦</span>
          <span>◆</span>
          <span>✧</span>
          <span>◇</span>
          <span>✦</span>
          <span>◆</span>
        </div>

        <div className="reward-header">Shard Acquired</div>

        <div className="reward-medal-premium">
          <div className="reward-medal-ring">
            <div className="reward-medal-core">
              <span>{reward.icon}</span>
            </div>
          </div>
        </div>

        <h2>{reward.title}</h2>
        <p>{reward.subtitle}</p>

        <div className="shard-progress">
          {[1, 2, 3, 4, 5].map((n) => (
            <div
              key={n}
              className={`shard-dot ${n <= reward.current ? "filled" : ""}`}
            />
          ))}
        </div>

        <button
          type="button"
          className="claim-btn"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onContinue();
          }}
        >
          Claim & Continue
        </button>
      </section>
    </div>
  );
}

/* ---------------- DOOR COMPONENTS ---------------- */

function PatternDoor({ puzzle, onMistake, onSolved }) {
  const [grid, setGrid] = useState(puzzle.grid);
  const [status, setStatus] = useState(null);

  function choose(option) {
    if (status === "correct") return;

    if (option === puzzle.answer) {
      setGrid((oldGrid) =>
        oldGrid.map((row) =>
          row.map((cell) => (cell === "?" ? puzzle.answer : cell))
        )
      );

      setStatus("correct");
    } else {
      setStatus("wrong");
      onMistake();
    }
  }

  return (
    <section className="panel">
      <div className="content">
        <BigOpeningDoor open={status === "correct"} label="Door 1" />

        <div className="lock-label">Door 1</div>
        <h2 className="lock-title">Pattern Door</h2>

        <p className="lock-desc">
          Complete the missing symbol. The pattern shifts one step each row.
        </p>

        <div className="pattern-grid">
          {grid.flatMap((row, rowIndex) =>
            row.map((cell, colIndex) => (
              <div
                key={`${rowIndex}-${colIndex}`}
                className={`pattern-cell ${cell === "?" ? "missing" : ""} ${
                  status === "correct" && rowIndex === 2 && colIndex === 2
                    ? "filled"
                    : ""
                }`}
              >
                {cell}
              </div>
            ))
          )}
        </div>

        <div className="options">
          {puzzle.options.map((option) => (
            <button
              type="button"
              key={option}
              className="option-btn"
              onClick={() => choose(option)}
            >
              {option}
            </button>
          ))}
        </div>

        {status === "wrong" && (
          <div className="feedback bad">
            Not that one. Watch how the row rotates forward.
          </div>
        )}

        {status === "correct" && (
          <>
            <div className="feedback good">Correct. {puzzle.explanation}</div>

            <button type="button" className="primary-btn" onClick={onSolved}>
              Claim Shard
            </button>
          </>
        )}
      </div>
    </section>
  );
}

function MazeDoor({ puzzle, onMistake, onSolved }) {
  const [player, setPlayer] = useState(puzzle.start);
  const [orbs, setOrbs] = useState(new Set(puzzle.orbs));
  const [message, setMessage] = useState(
    "Collect all three energy orbs, then reach the exit."
  );

  const allOrbsCollected = orbs.size === 0;
  const reachedExit =
    player.r === puzzle.exit.r &&
    player.c === puzzle.exit.c &&
    allOrbsCollected;

  function keyOf(row, col) {
    return `${row},${col}`;
  }

  function move(rowChange, colChange) {
    if (reachedExit) return;

    const nextRow = player.r + rowChange;
    const nextCol = player.c + colChange;

    if (nextRow < 0 || nextRow > 4 || nextCol < 0 || nextCol > 4) {
      setMessage("Wall hit. Stay inside the vault path.");
      onMistake();
      return;
    }

    if (puzzle.walls.has(keyOf(nextRow, nextCol))) {
      setMessage("Blocked path. Choose another route.");
      onMistake();
      return;
    }

    const nextKey = keyOf(nextRow, nextCol);
    const nextOrbs = new Set(orbs);

    if (nextOrbs.has(nextKey)) {
      nextOrbs.delete(nextKey);
      setMessage("Energy collected.");
    } else {
      setMessage("Keep moving. Collect all orbs before the exit.");
    }

    setOrbs(nextOrbs);
    setPlayer({ r: nextRow, c: nextCol });

    if (nextRow === puzzle.exit.r && nextCol === puzzle.exit.c) {
      if (nextOrbs.size === 0) {
        setMessage("Exit unlocked. Path Shard unlocked.");
      } else {
        setMessage("The exit is locked. Collect all energy orbs first.");
        onMistake();
      }
    }
  }

  return (
    <section className="panel">
      <div className="content">
        <BigOpeningDoor open={reachedExit} label="Door 2" />

        <div className="lock-label">Door 2</div>
        <h2 className="lock-title">Maze Door</h2>

        <p className="lock-desc">
          Move the key. Collect all energy orbs, then reach the purple exit.
        </p>

        <div className="maze">
          {Array.from({ length: 25 }).map((_, index) => {
            const row = Math.floor(index / 5);
            const col = index % 5;
            const key = keyOf(row, col);

            const isPlayer = player.r === row && player.c === col;
            const isWall = puzzle.walls.has(key);
            const isOrb = orbs.has(key);
            const isExit = puzzle.exit.r === row && puzzle.exit.c === col;

            return (
              <div
                key={key}
                className={`maze-cell ${isWall ? "wall" : ""} ${
                  isOrb ? "orb" : ""
                } ${isExit ? "exit" : ""} ${isPlayer ? "player" : ""}`}
              >
                {isPlayer
                  ? "🔑"
                  : isWall
                  ? "×"
                  : isOrb
                  ? "✦"
                  : isExit
                  ? allOrbsCollected
                    ? "⟐"
                    : "🔒"
                  : ""}
              </div>
            );
          })}
        </div>

        <div className="movement">
          <div />
          <button type="button" className="move-btn" onClick={() => move(-1, 0)}>
            ↑
          </button>
          <div />

          <button type="button" className="move-btn" onClick={() => move(0, -1)}>
            ←
          </button>

          <button type="button" className="move-btn" onClick={() => move(1, 0)}>
            ↓
          </button>

          <button type="button" className="move-btn" onClick={() => move(0, 1)}>
            →
          </button>
        </div>

        <div className={reachedExit ? "feedback good" : "feedback bad"}>
          {message}
        </div>

        {reachedExit && (
          <button type="button" className="primary-btn" onClick={onSolved}>
            Claim Shard
          </button>
        )}
      </div>
    </section>
  );
}

function MissingNumberDoor({ puzzle, onMistake, onSolved }) {
  const [status, setStatus] = useState(null);
  const [filledAnswer, setFilledAnswer] = useState("?");

  function choose(option) {
    if (status === "correct") return;

    if (option === puzzle.answer) {
      setFilledAnswer(option);
      setStatus("correct");
    } else {
      setStatus("wrong");
      onMistake();
    }
  }

  return (
    <section className="panel">
      <div className="content">
        <BigOpeningDoor open={status === "correct"} label="Door 3" />

        <div className="lock-label">Door 3</div>
        <h2 className="lock-title">Number Door</h2>

        <p className="lock-desc">
          Find the missing number. Look at the rule from left to right.
        </p>

        <div className="number-sequence">
          {puzzle.sequence.map((value, index) => (
            <div
              key={index}
              className={`number-cell ${
                index === puzzle.missingIndex ? "missing-number" : ""
              } ${
                status === "correct" && index === puzzle.missingIndex
                  ? "number-filled"
                  : ""
              }`}
            >
              {index === puzzle.missingIndex ? filledAnswer : value}
            </div>
          ))}
        </div>

        <div className="options number-options">
          {puzzle.options.map((option) => (
            <button
              type="button"
              key={option}
              className="option-btn number-option"
              onClick={() => choose(option)}
            >
              {option}
            </button>
          ))}
        </div>

        {status === "wrong" && (
          <div className="feedback bad">Not that one. Look for the rule.</div>
        )}

        {status === "correct" && (
          <>
            <div className="feedback good">Correct. {puzzle.rule}</div>

            <button type="button" className="primary-btn" onClick={onSolved}>
              Claim Shard
            </button>
          </>
        )}
      </div>
    </section>
  );
}

function ShadowDoor({ puzzle, onMistake, onSolved }) {
  const [phase, setPhase] = useState("watch");
  const [selected, setSelected] = useState(new Set());
  const [status, setStatus] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => setPhase("repeat"), puzzle.watchMs);
    return () => clearTimeout(timer);
  }, [puzzle.watchMs]);

  function toggleCell(row, col) {
    if (phase !== "repeat" || status === "correct") return;

    const key = `${row},${col}`;
    const nextSelected = new Set(selected);

    if (nextSelected.has(key)) {
      nextSelected.delete(key);
    } else {
      nextSelected.add(key);
    }

    setSelected(nextSelected);
  }

  function checkPattern() {
    const sameSize = selected.size === puzzle.pattern.size;
    const allCorrect = [...puzzle.pattern].every((key) => selected.has(key));

    if (sameSize && allCorrect) {
      setStatus("correct");
    } else {
      setStatus("wrong");
      onMistake();
    }
  }

  return (
    <section className="panel">
      <div className="content">
        <BigOpeningDoor open={status === "correct"} label="Door 4" />

        <div className="lock-label">Door 4</div>
        <h2 className="lock-title">Shadow Door</h2>

        <p className="lock-desc">
          Memorize the glowing tiles. When they disappear, repeat the pattern.
        </p>

        <div className="shadow-board">
          {Array.from({ length: 9 }).map((_, index) => {
            const row = Math.floor(index / 3);
            const col = index % 3;
            const key = `${row},${col}`;

            const showGlow = phase === "watch" && puzzle.pattern.has(key);
            const isSelected = selected.has(key);

            return (
              <button
                type="button"
                key={key}
                className={`shadow-cell ${showGlow ? "shadow-glow" : ""} ${
                  isSelected ? "shadow-selected" : ""
                }`}
                onClick={() => toggleCell(row, col)}
              />
            );
          })}
        </div>

        <div className={status === "correct" ? "feedback good" : "feedback bad"}>
          {phase === "watch"
            ? "Watch carefully..."
            : status === "correct"
            ? "Correct. Shadow Shard unlocked."
            : status === "wrong"
            ? "Not quite. Try to remember the glowing positions."
            : "Repeat the shadow pattern."}
        </div>

        {phase === "repeat" && status !== "correct" && (
          <button type="button" className="secondary-btn" onClick={checkPattern}>
            Check Pattern
          </button>
        )}

        {status === "correct" && (
          <button type="button" className="primary-btn" onClick={onSolved}>
            Claim Shard
          </button>
        )}
      </div>
    </section>
  );
}

function CipherDoor({ puzzle, onMistake, onSolved }) {
  const [input, setInput] = useState("");
  const [status, setStatus] = useState(null);

  function pressDigit(digit) {
    if (status === "correct" || input.length >= 4) return;
    setInput((previous) => previous + digit);
  }

  function clear() {
    if (status === "correct") return;
    setInput("");
    setStatus(null);
  }

  function check() {
    if (input === puzzle.answer) {
      setStatus("correct");
    } else {
      setStatus("wrong");
      onMistake();
    }
  }

  return (
    <section className="panel">
      <div className="content">
        <BigOpeningDoor open={status === "correct"} label="Door 5" />

        <div className="lock-label">Door 5</div>
        <h2 className="lock-title">Cipher Door</h2>

        <p className="lock-desc">Decode the symbols and enter the final vault code.</p>

        <div className="cipher-key">
          {puzzle.map.map((item) => (
            <div key={item.symbol} className="cipher-map">
              <strong>{item.symbol}</strong>
              <span>=</span>
              <em>{item.value}</em>
            </div>
          ))}
        </div>

        <div className="cipher-code">
          {puzzle.codeSymbols.map((symbol, index) => (
            <div key={`${symbol}-${index}`} className="cipher-symbol">
              {symbol}
            </div>
          ))}
        </div>

        <div className="code-display">{input.padEnd(4, "•")}</div>

        <div className="keypad">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"].map(
            (digit) => (
              <button
                type="button"
                key={digit}
                className="key-btn"
                onClick={() => pressDigit(digit)}
              >
                {digit}
              </button>
            )
          )}
        </div>

        <div className="cipher-actions">
          <button type="button" className="secondary-btn" onClick={clear}>
            Clear
          </button>

          <button type="button" className="primary-btn no-top" onClick={check}>
            Unlock
          </button>
        </div>

        {status === "wrong" && (
          <div className="feedback bad">
            Wrong code. Decode each symbol carefully.
          </div>
        )}

        {status === "correct" && (
          <>
            <div className="feedback good">
              Correct. Cipher Shard unlocked. The Daily Badge is ready.
            </div>

            <button type="button" className="primary-btn" onClick={onSolved}>
              Forge Daily Badge
            </button>
          </>
        )}
      </div>
    </section>
  );
}

/* ---------------- CSS ---------------- */

const css = `
* {
  box-sizing: border-box;
}

html,
body,
#root {
  margin: 0;
  width: 100%;
  min-height: 100%;
  background: #07070b;
}

body {
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.screen {
  min-height: 100svh;
  width: 100%;
  color: white;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 18px 12px;
  background:
    radial-gradient(circle at top left, rgba(0, 240, 255, 0.18), transparent 32%),
    radial-gradient(circle at bottom right, rgba(255, 0, 122, 0.15), transparent 35%),
    linear-gradient(145deg, #07070b 0%, #11111b 52%, #08080c 100%);
}

.app {
  width: 100%;
  max-width: 520px;
}

.topline {
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: #78788a;
  font-size: 11px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  margin-bottom: 14px;
}

.topline.center {
  justify-content: center;
}

h1 {
  margin: 0;
  font-size: 48px;
  line-height: 0.95;
  font-weight: 950;
  letter-spacing: -0.07em;
}

.accent {
  color: #00f0ff;
  text-shadow: 0 0 28px rgba(0, 240, 255, 0.48);
}

.subtitle {
  color: #b7b7c7;
  line-height: 1.65;
  font-size: 15px;
  margin: 16px 0 0;
}

.no-margin {
  margin-bottom: 0;
}

.hero,
.panel,
.result-card {
  width: 100%;
  border: 1px solid rgba(255,255,255,0.10);
  background:
    linear-gradient(145deg, rgba(255,255,255,0.08), rgba(255,255,255,0.025)),
    rgba(14,14,22,0.94);
  border-radius: 32px;
  padding: 24px;
  box-shadow: 0 35px 90px rgba(0,0,0,0.5);
  position: relative;
  overflow: hidden;
}

.hero::before,
.panel::before,
.result-card::before {
  content: "";
  position: absolute;
  inset: -120px;
  background:
    radial-gradient(circle, rgba(0,240,255,0.12), transparent 35%),
    radial-gradient(circle at bottom right, rgba(112,0,255,0.16), transparent 34%);
  pointer-events: none;
}

.content {
  position: relative;
  z-index: 1;
}

.vault-mark {
  width: 54px;
  height: 54px;
  border-radius: 18px;
  background: rgba(0,240,255,0.10);
  border: 1px solid rgba(0,240,255,0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #00f0ff;
  font-size: 28px;
  margin-bottom: 18px;
  box-shadow: 0 0 30px rgba(0,240,255,0.2);
}

.primary-btn,
.start-btn {
  width: 100%;
  margin-top: 22px;
  border: 0;
  border-radius: 22px;
  padding: 17px 18px;
  background: #00f0ff;
  color: #030309;
  font-weight: 950;
  font-size: 15px;
  cursor: pointer;
  box-shadow: 0 0 34px rgba(0,240,255,0.35);
  transition: 180ms ease;
}

.primary-btn:hover,
.start-btn:hover {
  transform: translateY(-2px);
}

.primary-btn.no-top {
  margin-top: 0;
}

.secondary-btn {
  width: 100%;
  margin-top: 10px;
  border: 1px solid rgba(255,255,255,0.12);
  background: rgba(255,255,255,0.055);
  color: #ddddec;
  border-radius: 20px;
  padding: 14px;
  font-weight: 900;
  cursor: pointer;
}

.weekly-card,
.relic-card {
  margin-top: 20px;
  border: 1px solid rgba(255,255,255,0.10);
  background: rgba(255,255,255,0.045);
  border-radius: 22px;
  padding: 16px;
}

.weekly-card span,
.relic-card span {
  display: block;
  color: #78788a;
  font-size: 10px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  margin-bottom: 6px;
}

.weekly-card strong,
.relic-card strong {
  display: block;
  font-size: 22px;
  color: #00f0ff;
}

.weekly-card small,
.relic-card small {
  display: block;
  margin-top: 7px;
  color: #b7b7c7;
  line-height: 1.4;
}

.relic-card.unlocked {
  border-color: rgba(255, 0, 122, 0.55);
  box-shadow: 0 0 35px rgba(255,0,122,0.18);
}

.stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin: 16px 0;
}

.stat {
  border: 1px solid rgba(255,255,255,0.09);
  background: rgba(255,255,255,0.045);
  border-radius: 20px;
  padding: 13px;
}

.stat span {
  display: block;
  color: #767686;
  font-size: 10px;
  letter-spacing: 0.17em;
  text-transform: uppercase;
  margin-bottom: 5px;
}

.stat strong {
  font-size: 22px;
}

.stat:nth-child(1) strong {
  color: #00f0ff;
}

.stat:nth-child(3) strong {
  color: #ff007a;
}

.doors {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
  margin-bottom: 16px;
}

.door {
  height: 96px;
  border-radius: 18px;
  position: relative;
  overflow: hidden;
  background: linear-gradient(145deg, #171727, #0d0d15);
  border: 1px solid rgba(255,255,255,0.10);
  box-shadow:
    inset 0 0 25px rgba(255,255,255,0.025),
    0 20px 40px rgba(0,0,0,0.28);
}

.door.active {
  border-color: rgba(0,240,255,0.55);
  box-shadow: 0 0 28px rgba(0,240,255,0.18);
}

.door-left,
.door-right {
  position: absolute;
  top: 0;
  width: 50%;
  height: 100%;
  background:
    linear-gradient(160deg, rgba(0,240,255,0.12), transparent 36%),
    #11111d;
  border: 1px solid rgba(255,255,255,0.08);
  transition: transform 800ms cubic-bezier(0.25, 1, 0.5, 1);
}

.door-left {
  left: 0;
  transform-origin: left center;
}

.door-right {
  right: 0;
  transform-origin: right center;
}

.door.open .door-left {
  transform: perspective(500px) rotateY(-78deg);
}

.door.open .door-right {
  transform: perspective(500px) rotateY(78deg);
}

.door-light {
  position: absolute;
  inset: 14px;
  border-radius: 16px;
  background:
    radial-gradient(circle, rgba(0,240,255,0.42), transparent 48%),
    radial-gradient(circle at bottom, rgba(112,0,255,0.5), transparent 42%);
  opacity: 0;
  transition: opacity 600ms ease;
}

.door.open .door-light {
  opacity: 1;
}

.door-title {
  position: absolute;
  z-index: 3;
  bottom: 8px;
  left: 0;
  right: 0;
  text-align: center;
  color: #ddddec;
  font-size: 8px;
  letter-spacing: 0.10em;
  text-transform: uppercase;
  font-weight: 900;
}

.door-number {
  position: absolute;
  z-index: 3;
  top: 10px;
  left: 0;
  right: 0;
  text-align: center;
  color: #00f0ff;
  font-size: 18px;
  font-weight: 950;
}

.big-door {
  height: 165px;
  border-radius: 28px;
  margin-bottom: 20px;
  position: relative;
  overflow: hidden;
  background:
    radial-gradient(circle at center, rgba(0,240,255,0.12), transparent 45%),
    linear-gradient(145deg, #151522, #09090f);
  border: 1px solid rgba(255,255,255,0.10);
  box-shadow:
    inset 0 0 35px rgba(255,255,255,0.025),
    0 24px 60px rgba(0,0,0,0.38);
}

.big-door-left,
.big-door-right {
  position: absolute;
  top: 0;
  height: 100%;
  width: 50%;
  background:
    linear-gradient(160deg, rgba(0,240,255,0.16), transparent 38%),
    linear-gradient(90deg, #11111d, #18182a);
  border: 1px solid rgba(255,255,255,0.08);
  transition: transform 900ms cubic-bezier(0.25, 1, 0.5, 1);
  z-index: 2;
}

.big-door-left {
  left: 0;
  transform-origin: left center;
}

.big-door-right {
  right: 0;
  transform-origin: right center;
}

.big-door-open .big-door-left {
  transform: perspective(700px) rotateY(-82deg);
}

.big-door-open .big-door-right {
  transform: perspective(700px) rotateY(82deg);
}

.big-door-light {
  position: absolute;
  inset: 18px;
  border-radius: 24px;
  background:
    radial-gradient(circle, rgba(0,240,255,0.55), transparent 42%),
    radial-gradient(circle at bottom, rgba(112,0,255,0.7), transparent 48%);
  opacity: 0;
  transition: opacity 700ms ease;
  z-index: 1;
}

.big-door-open .big-door-light {
  opacity: 1;
}

.big-door-lock {
  position: absolute;
  z-index: 4;
  top: 45px;
  left: 0;
  right: 0;
  text-align: center;
  font-size: 44px;
  filter: drop-shadow(0 0 18px rgba(0,240,255,0.45));
}

.big-door-label {
  position: absolute;
  z-index: 4;
  bottom: 18px;
  left: 0;
  right: 0;
  text-align: center;
  color: #dedeef;
  font-size: 12px;
  font-weight: 950;
  letter-spacing: 0.22em;
  text-transform: uppercase;
}

.lock-label {
  color: #00f0ff;
  font-size: 11px;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  font-weight: 900;
}

.lock-title {
  margin: 8px 0 8px;
  font-size: 30px;
  line-height: 1;
  font-weight: 950;
  letter-spacing: -0.045em;
}

.lock-desc {
  color: #a7a7b8;
  font-size: 14px;
  line-height: 1.6;
  margin: 0 0 18px;
}

.pattern-grid,
.shadow-board {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 11px;
  margin: 18px 0;
}

.pattern-cell,
.shadow-cell {
  aspect-ratio: 1;
  border-radius: 22px;
  background: #0c0c13;
  border: 1px solid rgba(255,255,255,0.10);
  transition: 220ms ease;
}

.pattern-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 38px;
  font-weight: 900;
  box-shadow: inset 0 0 22px rgba(255,255,255,0.025);
}

.pattern-cell.missing {
  color: #00f0ff;
  border-color: rgba(0,240,255,0.38);
  box-shadow: 0 0 24px rgba(0,240,255,0.14);
}

.pattern-cell.filled {
  color: #00f0ff;
  border-color: rgba(0,240,255,0.65);
  box-shadow: 0 0 32px rgba(0,240,255,0.28);
  transform: scale(1.03);
}

.shadow-cell {
  cursor: pointer;
}

.shadow-glow {
  background: rgba(0,240,255,0.22);
  border-color: rgba(0,240,255,0.85);
  box-shadow: 0 0 34px rgba(0,240,255,0.45);
}

.shadow-selected {
  background: rgba(112,0,255,0.25);
  border-color: rgba(112,0,255,0.85);
  box-shadow: 0 0 28px rgba(112,0,255,0.32);
}

.options {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin-top: 14px;
}

.option-btn {
  aspect-ratio: 1;
  border-radius: 20px;
  border: 1px solid rgba(255,255,255,0.12);
  background: rgba(255,255,255,0.05);
  color: white;
  font-size: 32px;
  cursor: pointer;
  transition: 180ms ease;
}

.option-btn:hover {
  transform: translateY(-2px);
  border-color: rgba(0,240,255,0.48);
}

.feedback {
  margin-top: 14px;
  padding: 13px;
  border-radius: 18px;
  font-size: 14px;
  line-height: 1.5;
}

.feedback.good {
  background: rgba(0,240,255,0.10);
  color: #c8fbff;
  border: 1px solid rgba(0,240,255,0.25);
}

.feedback.bad {
  background: rgba(255,0,122,0.10);
  color: #ffd4e8;
  border: 1px solid rgba(255,0,122,0.22);
}

.maze {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
  margin-top: 18px;
  padding: 12px;
  border-radius: 24px;
  background: rgba(0,0,0,0.26);
  border: 1px solid rgba(255,255,255,0.08);
}

.maze-cell {
  aspect-ratio: 1;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  font-weight: 950;
  background: #101018;
  border: 1px solid rgba(255,255,255,0.08);
  color: #77778a;
  transition: 180ms ease;
}

.maze-cell.wall {
  background: #050508;
  border-color: rgba(255,255,255,0.04);
  color: #252531;
}

.maze-cell.exit {
  border-color: rgba(112,0,255,0.65);
  color: #bfa7ff;
  box-shadow: 0 0 24px rgba(112,0,255,0.2);
}

.maze-cell.orb {
  border-color: rgba(0,240,255,0.45);
  color: #00f0ff;
  box-shadow: 0 0 20px rgba(0,240,255,0.2);
}

.maze-cell.player {
  background: rgba(0,240,255,0.14);
  border-color: #00f0ff;
  box-shadow: 0 0 28px rgba(0,240,255,0.35);
  color: white;
}

.movement {
  margin-top: 14px;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.move-btn {
  border: 1px solid rgba(255,255,255,0.11);
  background: rgba(255,255,255,0.055);
  color: white;
  border-radius: 18px;
  padding: 14px;
  font-size: 19px;
  font-weight: 950;
  cursor: pointer;
}

.number-sequence {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 10px;
  margin-top: 20px;
}

.number-cell {
  aspect-ratio: 1;
  border-radius: 20px;
  border: 1px solid rgba(255,255,255,0.10);
  background: #0c0c13;
  color: white;
  font-size: 24px;
  font-weight: 950;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: inset 0 0 20px rgba(255,255,255,0.025);
  transition: 220ms ease;
}

.missing-number {
  color: #00f0ff;
  border-color: rgba(0,240,255,0.45);
  box-shadow: 0 0 24px rgba(0,240,255,0.18);
}

.number-filled {
  background: rgba(0,240,255,0.14);
  border-color: rgba(0,240,255,0.85);
  box-shadow:
    0 0 34px rgba(0,240,255,0.35),
    inset 0 0 24px rgba(0,240,255,0.08);
  transform: scale(1.05);
}

.number-options {
  margin-top: 16px;
}

.number-option {
  font-size: 22px;
  font-weight: 950;
}

.cipher-key {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-top: 18px;
}

.cipher-map {
  border: 1px solid rgba(255,255,255,0.10);
  background: rgba(255,255,255,0.045);
  border-radius: 18px;
  padding: 12px 8px;
  display: flex;
  justify-content: center;
  gap: 6px;
  align-items: center;
}

.cipher-map strong {
  color: #00f0ff;
  font-size: 22px;
}

.cipher-map span {
  color: #777789;
}

.cipher-map em {
  color: white;
  font-size: 18px;
  font-style: normal;
  font-weight: 950;
}

.cipher-code {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin-top: 16px;
}

.cipher-symbol {
  aspect-ratio: 1;
  border-radius: 20px;
  border: 1px solid rgba(0,240,255,0.32);
  background: rgba(0,240,255,0.08);
  color: #00f0ff;
  font-size: 28px;
  font-weight: 950;
  display: flex;
  align-items: center;
  justify-content: center;
}

.code-display {
  margin-top: 16px;
  border-radius: 20px;
  border: 1px solid rgba(255,255,255,0.12);
  background: #08080d;
  padding: 16px;
  color: white;
  font-size: 28px;
  text-align: center;
  letter-spacing: 0.35em;
  font-weight: 950;
}

.keypad {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
  margin-top: 14px;
}

.key-btn {
  border: 1px solid rgba(255,255,255,0.10);
  background: rgba(255,255,255,0.055);
  color: white;
  border-radius: 16px;
  padding: 13px;
  font-size: 18px;
  font-weight: 950;
  cursor: pointer;
}

.cipher-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 12px;
}

.result-card {
  text-align: center;
}

.vault-icon {
  font-size: 60px;
  margin-bottom: 12px;
}

.rank {
  font-size: 82px;
  line-height: 0.95;
  font-weight: 1000;
  letter-spacing: -0.08em;
  color: #00f0ff;
  text-shadow: 0 0 36px rgba(0,240,255,0.45);
  margin: 18px 0 8px;
}

.result-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin: 22px 0;
}

.daily-badge {
  margin: 22px 0 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.badge-ring {
  width: 112px;
  height: 112px;
  border-radius: 999px;
  border: 2px solid rgba(0,240,255,0.65);
  background:
    radial-gradient(circle, rgba(0,240,255,0.25), transparent 54%),
    rgba(255,255,255,0.04);
  box-shadow:
    0 0 50px rgba(0,240,255,0.25),
    inset 0 0 35px rgba(112,0,255,0.18);
  display: flex;
  align-items: center;
  justify-content: center;
}

.badge-core {
  width: 66px;
  height: 66px;
  border-radius: 22px;
  background: rgba(0,240,255,0.14);
  border: 1px solid rgba(0,240,255,0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #00f0ff;
  font-size: 34px;
}

.daily-badge strong {
  margin-top: 14px;
  font-size: 22px;
  color: white;
}

.daily-badge span {
  margin-top: 5px;
  color: #78788a;
  font-size: 11px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  background:
    radial-gradient(circle at center, rgba(0,240,255,0.12), transparent 42%),
    rgba(0,0,0,0.78);
  backdrop-filter: blur(14px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 22px;
  z-index: 9999;
}

.reward-card {
  width: 100%;
  max-width: 410px;
  text-align: center;
  padding: 34px 24px 26px;
  border-radius: 34px;
  border: 1px solid rgba(0,240,255,0.48);
  background:
    radial-gradient(circle at top, rgba(0,240,255,0.22), transparent 34%),
    radial-gradient(circle at bottom, rgba(112,0,255,0.25), transparent 42%),
    linear-gradient(145deg, rgba(255,255,255,0.11), rgba(255,255,255,0.03)),
    #10101a;
  box-shadow:
    0 0 90px rgba(0,240,255,0.20),
    0 40px 100px rgba(0,0,0,0.65),
    inset 0 0 40px rgba(255,255,255,0.035);
  position: relative;
  overflow: hidden;
  animation: rewardPop 420ms cubic-bezier(0.2, 1.2, 0.3, 1);
}

@keyframes rewardPop {
  from {
    transform: scale(0.88) translateY(18px);
    opacity: 0;
  }
  to {
    transform: scale(1) translateY(0);
    opacity: 1;
  }
}

.reward-header {
  color: #00f0ff;
  font-size: 11px;
  letter-spacing: 0.26em;
  text-transform: uppercase;
  font-weight: 950;
  margin-bottom: 18px;
}

.reward-burst span {
  position: absolute;
  color: rgba(0,240,255,0.72);
  font-size: 22px;
  animation: floatShard 2.4s ease-in-out infinite;
}

.reward-burst span:nth-child(1) {
  top: 24px;
  left: 36px;
}

.reward-burst span:nth-child(2) {
  top: 52px;
  right: 42px;
  animation-delay: 0.2s;
}

.reward-burst span:nth-child(3) {
  top: 150px;
  left: 30px;
  animation-delay: 0.4s;
}

.reward-burst span:nth-child(4) {
  top: 170px;
  right: 34px;
  animation-delay: 0.6s;
}

.reward-burst span:nth-child(5) {
  bottom: 92px;
  left: 62px;
  animation-delay: 0.8s;
}

.reward-burst span:nth-child(6) {
  bottom: 100px;
  right: 66px;
  animation-delay: 1s;
}

@keyframes floatShard {
  0%, 100% {
    transform: translateY(0) scale(1);
    opacity: 0.55;
  }

  50% {
    transform: translateY(-10px) scale(1.12);
    opacity: 1;
  }
}

.reward-medal-premium {
  width: 148px;
  height: 148px;
  margin: 0 auto 22px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: conic-gradient(from 90deg, #00f0ff, #7000ff, #ff007a, #00f0ff);
  box-shadow:
    0 0 65px rgba(0,240,255,0.34),
    0 0 95px rgba(112,0,255,0.22);
  animation: medalPulse 2.2s ease-in-out infinite;
}

@keyframes medalPulse {
  0%, 100% {
    transform: scale(1);
    filter: brightness(1);
  }

  50% {
    transform: scale(1.035);
    filter: brightness(1.2);
  }
}

.reward-medal-ring {
  width: 132px;
  height: 132px;
  border-radius: 999px;
  background:
    radial-gradient(circle, rgba(255,255,255,0.13), transparent 56%),
    #11111b;
  display: flex;
  align-items: center;
  justify-content: center;
}

.reward-medal-core {
  width: 86px;
  height: 86px;
  border-radius: 28px;
  background:
    radial-gradient(circle at top, rgba(0,240,255,0.28), transparent 58%),
    rgba(0,240,255,0.10);
  border: 1px solid rgba(0,240,255,0.72);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow:
    inset 0 0 28px rgba(0,240,255,0.13),
    0 0 34px rgba(0,240,255,0.26);
}

.reward-medal-core span {
  color: #00f0ff;
  font-size: 46px;
  font-weight: 1000;
  text-shadow: 0 0 20px rgba(0,240,255,0.7);
}

.reward-card h2 {
  margin: 0;
  font-size: 31px;
  line-height: 1.05;
  letter-spacing: -0.055em;
  color: #ffffff;
}

.reward-card p {
  color: #b7b7c7;
  margin: 11px 0 0;
  font-size: 15px;
}

.shard-progress {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
  margin: 24px auto 22px;
  max-width: 240px;
}

.shard-dot {
  height: 10px;
  border-radius: 999px;
  background: rgba(255,255,255,0.10);
  border: 1px solid rgba(255,255,255,0.08);
}

.shard-dot.filled {
  background: linear-gradient(90deg, #00f0ff, #7000ff);
  box-shadow: 0 0 18px rgba(0,240,255,0.35);
}

.claim-btn {
  width: 100%;
  border: 0;
  border-radius: 22px;
  padding: 17px 18px;
  background: linear-gradient(90deg, #00f0ff, #5ef7ff);
  color: #030309;
  font-weight: 1000;
  font-size: 15px;
  cursor: pointer;
  box-shadow:
    0 0 34px rgba(0,240,255,0.36),
    inset 0 -2px 0 rgba(0,0,0,0.16);
  transition: 180ms ease;
  position: relative;
  z-index: 5;
}

.footer {
  color: #696978;
  text-align: center;
  font-size: 12px;
  line-height: 1.6;
  margin-top: 16px;
}

@media (max-width: 768px) {
  .screen {
    min-height: 100svh;
    padding: 14px 10px;
    align-items: flex-start;
  }

  .app {
    width: 100%;
    max-width: 100%;
  }

  .hero,
  .panel,
  .result-card {
    width: 100%;
    border-radius: 26px;
    padding: 18px;
  }

  h1 {
    font-size: 46px;
  }

  .subtitle {
    font-size: 16px;
    line-height: 1.55;
  }

  .primary-btn,
  .start-btn {
    padding: 18px;
    font-size: 16px;
  }

  .doors {
    gap: 6px;
  }

  .door {
    height: 86px;
    border-radius: 15px;
  }

  .door-title {
    font-size: 7px;
  }

  .big-door {
    height: 145px;
  }

  .pattern-cell {
    font-size: 32px;
    border-radius: 18px;
  }

  .number-cell {
    font-size: 19px;
  }

  .option-btn {
    font-size: 25px;
  }

  .cipher-key {
    grid-template-columns: repeat(2, 1fr);
  }
}
`;
