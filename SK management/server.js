const express = require("express");
const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const app = express();
const PORT = Number.parseInt(process.env.PORT || "3000", 10);

const PROJECT_ROOT = __dirname;
const DATABASE_DIR = path.join(PROJECT_ROOT, "Database");
const DATABASE_PATH = path.join(DATABASE_DIR, "sk_management.db");

if (!fs.existsSync(DATABASE_DIR)) {
  fs.mkdirSync(DATABASE_DIR, { recursive: true });
}

const db = new sqlite3.Database(DATABASE_PATH);

const DEFAULT_NOTES = [
  {
    type: "update",
    text: "SK event planning for the quarter is underway.",
  },
  {
    type: "update",
    text: "New venue options have been approved.",
  },
  {
    type: "change",
    text: "Meeting timeframes updated to accommodate all members.",
  },
  {
    type: "reminder",
    text: "Confirm participant list one day before each event.",
  },
];

const DEFAULT_EVENTS = [
  {
    name: "Barangay Cleanup Drive",
    place: "Community Center",
    date: "2026-04-12",
    time: "08:00",
    type: "activity",
    notes: "Bring gloves and sacks.",
    done: 0,
    status: "Scheduled",
  },
  {
    name: "Youth Scholarship Orientation",
    place: "Barangay Hall",
    date: "2026-04-18",
    time: "09:30",
    type: "scholarship",
    notes: "Prepare application checklist.",
    done: 0,
    status: "Scheduled",
  },
  {
    name: "Monthly SK Meeting",
    place: "Session Room",
    date: "2026-03-25",
    time: "14:00",
    type: "meeting",
    notes: "Budget and event recap.",
    done: 1,
    status: "Completed",
  },
  {
    name: "Chairperson Birthday",
    place: "Barangay Hall",
    date: "2001-09-15",
    time: "10:00",
    type: "birthday",
    notes: "Prepare simple celebration.",
    done: 0,
    status: "Scheduled",
  },
];

const DEFAULT_TRANSACTIONS = [
  {
    type: "add",
    amount: 10000,
    category: "donation",
    details: "Seed fund from community donors",
    date: "2026-04-01",
    receipt: null,
  },
  {
    type: "deduct",
    amount: 2500,
    category: "materials",
    details: "Event banner and printing",
    date: "2026-04-03",
    receipt: null,
  },
  {
    type: "add",
    amount: 4000,
    category: "fundraising",
    details: "Proceeds from youth bazaar",
    date: "2026-04-05",
    receipt: null,
  },
];

const DEFAULT_ORG_CHART = [
  [
    {
      title: "SK Coordinator",
      description: "Leads the team, approves events, and oversees meetings.",
      photo: null,
    },
  ],
  [
    {
      title: "Event Planner",
      description:
        "Creates event plans, coordinates schedules, and manages logistics.",
      photo: null,
    },
    {
      title: "Communications",
      description: "Shares updates, reminders, and event announcements.",
      photo: null,
    },
  ],
  [
    {
      title: "Meeting Lead",
      description:
        "Tracks attendance, closes completed meetings, and reports outcomes.",
      photo: null,
    },
    {
      title: "Support Team",
      description: "Provides follow-up, document uploads, and task reminders.",
      photo: null,
    },
  ],
];

function run(query, params = []) {
  return new Promise((resolve, reject) => {
    db.run(query, params, function handleRun(error) {
      if (error) {
        reject(error);
        return;
      }

      resolve(this);
    });
  });
}

function get(query, params = []) {
  return new Promise((resolve, reject) => {
    db.get(query, params, (error, row) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(row);
    });
  });
}

function all(query, params = []) {
  return new Promise((resolve, reject) => {
    db.all(query, params, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(rows);
    });
  });
}

function eventMapper(row) {
  return {
    ...row,
    done: Number(row.done) === 1,
  };
}

function sanitizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function sanitizeNullableText(value) {
  const sanitized = sanitizeText(value);
  return sanitized || null;
}

const MIN_PASSWORD_LENGTH = 6;

async function normalizeOrgChartPositions() {
  const positions = await all(
    `
      SELECT id, row_index, position_index
      FROM orgchart_positions
      ORDER BY row_index ASC, position_index ASC, id ASC
    `,
  );

  const groupedRows = new Map();

  for (const position of positions) {
    if (!groupedRows.has(position.row_index)) {
      groupedRows.set(position.row_index, []);
    }

    groupedRows.get(position.row_index).push(position.id);
  }

  const sortedRowIndexes = [...groupedRows.keys()].sort((a, b) => a - b);

  for (
    let newRowIndex = 0;
    newRowIndex < sortedRowIndexes.length;
    newRowIndex += 1
  ) {
    const oldRowIndex = sortedRowIndexes[newRowIndex];
    const positionIds = groupedRows.get(oldRowIndex) || [];

    for (
      let newPositionIndex = 0;
      newPositionIndex < positionIds.length;
      newPositionIndex += 1
    ) {
      await run(
        "UPDATE orgchart_positions SET row_index = ?, position_index = ? WHERE id = ?",
        [newRowIndex, newPositionIndex, positionIds[newPositionIndex]],
      );
    }
  }
}

async function getOrgChartRows() {
  const positions = await all(
    `
      SELECT id, row_index, position_index, title, description, photo
      FROM orgchart_positions
      ORDER BY row_index ASC, position_index ASC, id ASC
    `,
  );

  const rowsByIndex = new Map();

  for (const position of positions) {
    if (!rowsByIndex.has(position.row_index)) {
      rowsByIndex.set(position.row_index, []);
    }

    rowsByIndex.get(position.row_index).push({
      id: position.id,
      title: position.title,
      description: position.description,
      photo: position.photo,
    });
  }

  return [...rowsByIndex.entries()]
    .sort((a, b) => a[0] - b[0])
    .map((entry) => entry[1]);
}

async function initializeDatabase() {
  await run("PRAGMA foreign_keys = ON");

  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      full_name TEXT
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK(type IN ('update', 'change', 'reminder')),
      text TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      place TEXT NOT NULL,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      type TEXT NOT NULL,
      notes TEXT,
      done INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'Scheduled',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS fund_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK(type IN ('add', 'deduct')),
      amount REAL NOT NULL,
      category TEXT NOT NULL,
      details TEXT,
      date TEXT NOT NULL,
      receipt TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS orgchart_positions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      row_index INTEGER NOT NULL,
      position_index INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      photo TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const usersCount = await get("SELECT COUNT(*) AS count FROM users");
  if (usersCount.count === 0) {
    await run(
      "INSERT INTO users (username, password, full_name) VALUES (?, ?, ?)",
      ["admin", "admin123", "SK Administrator"],
    );
  }

  const notesCount = await get("SELECT COUNT(*) AS count FROM notes");
  if (notesCount.count === 0) {
    for (const note of DEFAULT_NOTES) {
      await run("INSERT INTO notes (type, text) VALUES (?, ?)", [
        note.type,
        note.text,
      ]);
    }
  }

  const eventsCount = await get("SELECT COUNT(*) AS count FROM events");
  if (eventsCount.count === 0) {
    for (const event of DEFAULT_EVENTS) {
      await run(
        `
        INSERT INTO events (name, place, date, time, type, notes, done, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
        [
          event.name,
          event.place,
          event.date,
          event.time,
          event.type,
          event.notes,
          event.done,
          event.status,
        ],
      );
    }
  }

  const fundsCount = await get(
    "SELECT COUNT(*) AS count FROM fund_transactions",
  );
  if (fundsCount.count === 0) {
    for (const transaction of DEFAULT_TRANSACTIONS) {
      await run(
        `
        INSERT INTO fund_transactions (type, amount, category, details, date, receipt)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
        [
          transaction.type,
          transaction.amount,
          transaction.category,
          transaction.details,
          transaction.date,
          transaction.receipt,
        ],
      );
    }
  }

  const orgChartCount = await get(
    "SELECT COUNT(*) AS count FROM orgchart_positions",
  );
  if (orgChartCount.count === 0) {
    for (let rowIndex = 0; rowIndex < DEFAULT_ORG_CHART.length; rowIndex += 1) {
      const row = DEFAULT_ORG_CHART[rowIndex];

      for (
        let positionIndex = 0;
        positionIndex < row.length;
        positionIndex += 1
      ) {
        const position = row[positionIndex];

        await run(
          `
            INSERT INTO orgchart_positions (
              row_index,
              position_index,
              title,
              description,
              photo
            )
            VALUES (?, ?, ?, ?, ?)
          `,
          [
            rowIndex,
            positionIndex,
            position.title,
            position.description,
            position.photo,
          ],
        );
      }
    }
  }
}

app.use(express.json({ limit: "15mb" }));
app.use(express.static(PROJECT_ROOT));

app.get("/api/health", (request, response) => {
  response.json({ ok: true });
});

app.post("/api/login", async (request, response, next) => {
  try {
    const username = sanitizeText(request.body.username);
    const password = sanitizeText(request.body.password);

    if (!username || !password) {
      response
        .status(400)
        .json({ message: "Username and password are required." });
      return;
    }

    const user = await get(
      "SELECT id, username, full_name FROM users WHERE username = ? AND password = ?",
      [username, password],
    );

    if (!user) {
      response.status(401).json({ message: "Invalid username or password." });
      return;
    }

    response.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
      },
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/register", async (request, response, next) => {
  try {
    const fullName = sanitizeText(request.body.fullName || "");
    const username = sanitizeText(request.body.username);
    const password = sanitizeText(request.body.password);

    if (!username || !password) {
      response
        .status(400)
        .json({ message: "Username and password are required." });
      return;
    }

    if (username.length < 3) {
      response
        .status(400)
        .json({ message: "Username must be at least 3 characters long." });
      return;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      response.status(400).json({
        message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`,
      });
      return;
    }

    const existingUser = await get(
      "SELECT id FROM users WHERE LOWER(username) = LOWER(?)",
      [username],
    );

    if (existingUser) {
      response
        .status(409)
        .json({ message: "Username already exists. Please use another one." });
      return;
    }

    const result = await run(
      "INSERT INTO users (username, password, full_name) VALUES (?, ?, ?)",
      [username, password, fullName || null],
    );

    const createdUser = await get(
      "SELECT id, username, full_name FROM users WHERE id = ?",
      [result.lastID],
    );

    response.status(201).json({
      success: true,
      message: "Registration successful.",
      user: {
        id: createdUser.id,
        username: createdUser.username,
        fullName: createdUser.full_name,
      },
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/change-password", async (request, response, next) => {
  try {
    const username = sanitizeText(request.body.username);
    const currentPassword = sanitizeText(request.body.currentPassword);
    const newPassword = sanitizeText(request.body.newPassword);

    if (!username || !currentPassword || !newPassword) {
      response.status(400).json({
        message:
          "Username, current password, and new password are all required.",
      });
      return;
    }

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      response.status(400).json({
        message: `New password must be at least ${MIN_PASSWORD_LENGTH} characters long.`,
      });
      return;
    }

    if (currentPassword === newPassword) {
      response.status(400).json({
        message: "New password must be different from the current password.",
      });
      return;
    }

    const user = await get(
      "SELECT id FROM users WHERE LOWER(username) = LOWER(?) AND password = ?",
      [username, currentPassword],
    );

    if (!user) {
      response.status(401).json({
        message: "Invalid username or current password.",
      });
      return;
    }

    await run("UPDATE users SET password = ? WHERE id = ?", [
      newPassword,
      user.id,
    ]);

    response.json({
      success: true,
      message: "Password changed successfully.",
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/notes", async (request, response, next) => {
  try {
    const notes = await all(
      "SELECT id, type, text, created_at FROM notes ORDER BY id DESC",
    );
    response.json({ notes });
  } catch (error) {
    next(error);
  }
});

app.post("/api/notes", async (request, response, next) => {
  try {
    const type = sanitizeText(request.body.type).toLowerCase();
    const text = sanitizeText(request.body.text);
    const validTypes = new Set(["update", "change", "reminder"]);

    if (!validTypes.has(type) || !text) {
      response
        .status(400)
        .json({ message: "Valid note type and text are required." });
      return;
    }

    const result = await run("INSERT INTO notes (type, text) VALUES (?, ?)", [
      type,
      text,
    ]);

    const created = await get(
      "SELECT id, type, text, created_at FROM notes WHERE id = ?",
      [result.lastID],
    );

    response.status(201).json({ note: created });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/notes/:id", async (request, response, next) => {
  try {
    const noteId = Number.parseInt(request.params.id, 10);

    if (!Number.isInteger(noteId)) {
      response.status(400).json({ message: "Invalid note id." });
      return;
    }

    const result = await run("DELETE FROM notes WHERE id = ?", [noteId]);

    if (result.changes === 0) {
      response.status(404).json({ message: "Note not found." });
      return;
    }

    response.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.delete("/api/notes", async (request, response, next) => {
  try {
    await run("DELETE FROM notes");
    response.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.get("/api/events", async (request, response, next) => {
  try {
    const status = sanitizeText(request.query.status || "all").toLowerCase();
    let query =
      "SELECT id, name, place, date, time, type, notes, done, status FROM events";
    const params = [];

    if (status === "done") {
      query += " WHERE done = 1";
    } else if (status === "upcoming") {
      query += " WHERE done = 0";
    }

    query += " ORDER BY date ASC, time ASC, id ASC";

    const events = await all(query, params);
    response.json({ events: events.map(eventMapper) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/events", async (request, response, next) => {
  try {
    const name = sanitizeText(request.body.name);
    const place = sanitizeText(request.body.place);
    const date = sanitizeText(request.body.date);
    const time = sanitizeText(request.body.time);
    const type = sanitizeText(request.body.type);
    const notes = sanitizeText(request.body.notes || "");

    if (!name || !place || !date || !time || !type) {
      response.status(400).json({ message: "Missing required event fields." });
      return;
    }

    const result = await run(
      `
      INSERT INTO events (name, place, date, time, type, notes, done, status)
      VALUES (?, ?, ?, ?, ?, ?, 0, 'Scheduled')
    `,
      [name, place, date, time, type, notes],
    );

    const created = await get(
      "SELECT id, name, place, date, time, type, notes, done, status FROM events WHERE id = ?",
      [result.lastID],
    );

    response.status(201).json({ event: eventMapper(created) });
  } catch (error) {
    next(error);
  }
});

app.put("/api/events/:id", async (request, response, next) => {
  try {
    const eventId = Number.parseInt(request.params.id, 10);

    if (!Number.isInteger(eventId)) {
      response.status(400).json({ message: "Invalid event id." });
      return;
    }

    const name = sanitizeText(request.body.name);
    const place = sanitizeText(request.body.place);
    const date = sanitizeText(request.body.date);
    const time = sanitizeText(request.body.time);
    const type = sanitizeText(request.body.type);
    const notes = sanitizeText(request.body.notes || "");

    if (!name || !place || !date || !time || !type) {
      response.status(400).json({ message: "Missing required event fields." });
      return;
    }

    const result = await run(
      `
      UPDATE events
      SET name = ?, place = ?, date = ?, time = ?, type = ?, notes = ?, status = 'Scheduled'
      WHERE id = ?
    `,
      [name, place, date, time, type, notes, eventId],
    );

    if (result.changes === 0) {
      response.status(404).json({ message: "Event not found." });
      return;
    }

    const updated = await get(
      "SELECT id, name, place, date, time, type, notes, done, status FROM events WHERE id = ?",
      [eventId],
    );

    response.json({ event: eventMapper(updated) });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/events/:id/complete", async (request, response, next) => {
  try {
    const eventId = Number.parseInt(request.params.id, 10);

    if (!Number.isInteger(eventId)) {
      response.status(400).json({ message: "Invalid event id." });
      return;
    }

    const result = await run(
      "UPDATE events SET done = 1, status = 'Completed' WHERE id = ?",
      [eventId],
    );

    if (result.changes === 0) {
      response.status(404).json({ message: "Event not found." });
      return;
    }

    const updated = await get(
      "SELECT id, name, place, date, time, type, notes, done, status FROM events WHERE id = ?",
      [eventId],
    );

    response.json({ event: eventMapper(updated) });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/events/done", async (request, response, next) => {
  try {
    await run("DELETE FROM events WHERE done = 1");
    response.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.get("/api/orgchart", async (request, response, next) => {
  try {
    const rows = await getOrgChartRows();
    response.json({ rows });
  } catch (error) {
    next(error);
  }
});

app.post("/api/orgchart/rows", async (request, response, next) => {
  try {
    const title = sanitizeText(request.body.title);
    const description = sanitizeText(request.body.description);
    const photo = sanitizeNullableText(request.body.photo);

    if (!title || !description) {
      response
        .status(400)
        .json({ message: "Title and description are required." });
      return;
    }

    const maxRow = await get(
      "SELECT COALESCE(MAX(row_index), -1) AS maxRowIndex FROM orgchart_positions",
    );
    const nextRowIndex = Number(maxRow.maxRowIndex) + 1;

    await run(
      `
        INSERT INTO orgchart_positions (
          row_index,
          position_index,
          title,
          description,
          photo
        )
        VALUES (?, 0, ?, ?, ?)
      `,
      [nextRowIndex, title, description, photo],
    );

    const rows = await getOrgChartRows();
    response.status(201).json({ rows });
  } catch (error) {
    next(error);
  }
});

app.post("/api/orgchart/positions", async (request, response, next) => {
  try {
    const title = sanitizeText(request.body.title);
    const description = sanitizeText(request.body.description);
    const photo = sanitizeNullableText(request.body.photo);
    const providedRowIndex = Number.parseInt(request.body.rowIndex, 10);

    if (!title || !description) {
      response
        .status(400)
        .json({ message: "Title and description are required." });
      return;
    }

    let targetRowIndex = providedRowIndex;

    if (!Number.isInteger(targetRowIndex)) {
      const maxRow = await get(
        "SELECT COALESCE(MAX(row_index), -1) AS maxRowIndex FROM orgchart_positions",
      );
      targetRowIndex = Number(maxRow.maxRowIndex);
      if (targetRowIndex < 0) {
        targetRowIndex = 0;
      }
    }

    const maxPosition = await get(
      `
        SELECT COALESCE(MAX(position_index), -1) AS maxPositionIndex
        FROM orgchart_positions
        WHERE row_index = ?
      `,
      [targetRowIndex],
    );
    const nextPositionIndex = Number(maxPosition.maxPositionIndex) + 1;

    await run(
      `
        INSERT INTO orgchart_positions (
          row_index,
          position_index,
          title,
          description,
          photo
        )
        VALUES (?, ?, ?, ?, ?)
      `,
      [targetRowIndex, nextPositionIndex, title, description, photo],
    );

    await normalizeOrgChartPositions();
    const rows = await getOrgChartRows();
    response.status(201).json({ rows });
  } catch (error) {
    next(error);
  }
});

app.put("/api/orgchart/positions/:id", async (request, response, next) => {
  try {
    const positionId = Number.parseInt(request.params.id, 10);

    if (!Number.isInteger(positionId)) {
      response.status(400).json({ message: "Invalid position id." });
      return;
    }

    const title = sanitizeText(request.body.title);
    const description = sanitizeText(request.body.description);
    const photo = sanitizeNullableText(request.body.photo);

    if (!title || !description) {
      response
        .status(400)
        .json({ message: "Title and description are required." });
      return;
    }

    const result = await run(
      `
        UPDATE orgchart_positions
        SET title = ?, description = ?, photo = ?
        WHERE id = ?
      `,
      [title, description, photo, positionId],
    );

    if (result.changes === 0) {
      response.status(404).json({ message: "Position not found." });
      return;
    }

    const rows = await getOrgChartRows();
    response.json({ rows });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/orgchart/positions/:id", async (request, response, next) => {
  try {
    const positionId = Number.parseInt(request.params.id, 10);

    if (!Number.isInteger(positionId)) {
      response.status(400).json({ message: "Invalid position id." });
      return;
    }

    const result = await run("DELETE FROM orgchart_positions WHERE id = ?", [
      positionId,
    ]);

    if (result.changes === 0) {
      response.status(404).json({ message: "Position not found." });
      return;
    }

    await normalizeOrgChartPositions();
    response.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.get("/api/funds", async (request, response, next) => {
  try {
    const transactions = await all(
      `
      SELECT id, type, amount, category, details, date, receipt, created_at
      FROM fund_transactions
      ORDER BY date DESC, id DESC
    `,
    );

    const balanceRow = await get(`
      SELECT COALESCE(SUM(CASE WHEN type = 'add' THEN amount ELSE -amount END), 0) AS balance
      FROM fund_transactions
    `);

    response.json({
      transactions,
      balance: Number(balanceRow.balance || 0),
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/funds/transactions", async (request, response, next) => {
  try {
    const type = sanitizeText(request.body.type).toLowerCase();
    const amount = Number.parseFloat(request.body.amount);
    const category = sanitizeText(request.body.category);
    const details = sanitizeText(request.body.details || "");
    const date = sanitizeText(request.body.date);
    const receipt = sanitizeText(request.body.receipt || "");

    if (!["add", "deduct"].includes(type)) {
      response.status(400).json({ message: "Invalid transaction type." });
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      response
        .status(400)
        .json({ message: "Amount must be greater than zero." });
      return;
    }

    if (!category || !date) {
      response.status(400).json({ message: "Category and date are required." });
      return;
    }

    const result = await run(
      `
      INSERT INTO fund_transactions (type, amount, category, details, date, receipt)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
      [type, amount, category, details || null, date, receipt || null],
    );

    const created = await get(
      `
      SELECT id, type, amount, category, details, date, receipt, created_at
      FROM fund_transactions
      WHERE id = ?
    `,
      [result.lastID],
    );

    response.status(201).json({ transaction: created });
  } catch (error) {
    next(error);
  }
});

app.use((error, request, response, next) => {
  console.error("[SERVER ERROR]", error);
  response.status(500).json({ message: "Internal server error." });
});

async function startServer() {
  await initializeDatabase();

  app.listen(PORT, () => {
    console.log(`SK Management server running at http://127.0.0.1:${PORT}`);
    console.log(`SQLite database: ${DATABASE_PATH}`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start server", error);
  process.exit(1);
});
