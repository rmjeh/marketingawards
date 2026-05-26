const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const net = require("net");
const tls = require("tls");
const { spawn } = require("child_process");

const ROOT = __dirname;
loadDotEnv(path.join(ROOT, ".env"));

const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = path.join(ROOT, "data");
const NOMINATIONS_FILE = path.join(DATA_DIR, "nominations.json");
const VOTES_FILE = path.join(DATA_DIR, "votes.json");
const EMAIL_OUTBOX_FILE = path.join(DATA_DIR, "email-outbox.json");
const PORT = Number(process.env.PORT || 3000);

const AWARDS = [
  {
    id: "business-impact",
    name: "Business Impact Award",
    focus: "for outcomes",
    description:
      "Recognizes work that moves the business forward: pipeline, sales adoption, breakthrough story telling, creative elevation, customer engagement and other measurable business outcomes."
  },
  {
    id: "execution-excellence",
    name: "Execution Excellence Award",
    focus: "for operational rigor",
    description:
      "Recognizes work that drives increase in business efficiency, process improvements, team productivity, experimentation, stepping into stretch assignments, or turning chaos into clarity."
  },
  {
    id: "team-player",
    name: "Team Player Award",
    focus: "for cross collaboration",
    description:
      "Recognizes making complex cross-functional work easier, especially with product, sales, customer success, regional teams, executives and others."
  },
  {
    id: "ai-transformation",
    name: "AI Transformation Award",
    focus: "for innovation through AI",
    description:
      "Recognizes showcasing new, innovative use of AI to boost productivity and marketing impact."
  },
  {
    id: "marketing-visionary",
    name: "Marketing Visionary Award",
    focus: "for leadership and strategic thinking",
    description:
      "Recognizes thinking beyond immediate execution to shape the future of marketing, the business, and the organization, with strategic leadership and bold ideas to inspire transformational thinking elevating the brand and business over the long term."
  }
];

function loadDotEnv(file) {
  if (!fs.existsSync(file)) return;
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (!key || process.env[key] !== undefined) continue;
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png"
};

function ensureDataFiles() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(NOMINATIONS_FILE)) {
    writeJson(NOMINATIONS_FILE, {
      updatedAt: null,
      categories: AWARDS.map((award) => ({ awardId: award.id, nominees: [] }))
    });
  }
  if (!fs.existsSync(VOTES_FILE)) {
    writeJson(VOTES_FILE, { votes: [] });
  }
  if (!fs.existsSync(EMAIL_OUTBOX_FILE)) {
    writeJson(EMAIL_OUTBOX_FILE, { messages: [] });
  }
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    return fallback;
  }
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function sendJson(res, statusCode, value) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(value));
}

function sendError(res, statusCode, message) {
  sendJson(res, statusCode, { error: message });
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        req.destroy();
        reject(new Error("Request body is too large."));
      }
    });
    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error("Invalid JSON."));
      }
    });
    req.on("error", reject);
  });
}

function readNominations() {
  const data = readJson(NOMINATIONS_FILE, { categories: [] });
  const byAward = new Map((data.categories || []).map((category) => [category.awardId, category]));

  return {
    updatedAt: data.updatedAt || null,
    categories: AWARDS.map((award) => {
      const saved = byAward.get(award.id) || {};
      return {
        ...award,
        nominees: normalizeNominees(saved.nominees || [])
      };
    })
  };
}

function normalizeNominees(nominees) {
  const used = new Set();
  return nominees
    .map((nominee) => {
      const name = String(nominee.name || "").trim();
      if (!name) return null;
      const id = createStableId(nominee.id || name, used);
      return {
        id,
        name,
        nominationText: String(nominee.nominationText || "").trim()
      };
    })
    .filter(Boolean);
}

function createStableId(value, used) {
  const base =
    String(value || "nominee")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "nominee";

  let id = base;
  let counter = 2;
  while (used.has(id)) {
    id = `${base}-${counter}`;
    counter += 1;
  }
  used.add(id);
  return id;
}

function saveNominations(categories) {
  const awardIds = new Set(AWARDS.map((award) => award.id));
  const cleanCategories = AWARDS.map((award) => {
    const incoming = categories.find((category) => category.awardId === award.id);
    return {
      awardId: award.id,
      nominees: incoming && Array.isArray(incoming.nominees) ? normalizeNominees(incoming.nominees) : []
    };
  }).filter((category) => awardIds.has(category.awardId));

  writeJson(NOMINATIONS_FILE, {
    updatedAt: new Date().toISOString(),
    categories: cleanCategories
  });

  return readNominations();
}

function readVotes() {
  const data = readJson(VOTES_FILE, { votes: [] });
  return Array.isArray(data.votes) ? data.votes : [];
}

function appendVote(vote) {
  const votes = readVotes();
  votes.push(vote);
  writeJson(VOTES_FILE, { votes });
}

function getBallot() {
  const nominations = readNominations();
  return {
    updatedAt: nominations.updatedAt,
    awards: nominations.categories.filter((category) => category.nominees.length > 0)
  };
}

function getAdminData() {
  const nominations = readNominations();
  return {
    updatedAt: nominations.updatedAt,
    awards: nominations.categories
  };
}

function getResults() {
  const nominations = readNominations();
  const votes = readVotes();

  const results = nominations.categories
    .filter((category) => category.nominees.length > 0)
    .map((category) => {
      const counts = new Map(category.nominees.map((nominee) => [nominee.id, 0]));

      for (const vote of votes) {
        const selected = vote.choices && vote.choices[category.id];
        if (counts.has(selected)) {
          counts.set(selected, counts.get(selected) + 1);
        }
      }

      const nominees = category.nominees
        .map((nominee) => ({
          ...nominee,
          votes: counts.get(nominee.id) || 0
        }))
        .sort((a, b) => b.votes - a.votes || a.name.localeCompare(b.name));

      return {
        id: category.id,
        name: category.name,
        focus: category.focus,
        description: category.description,
        nominees,
        totalVotes: nominees.reduce((sum, nominee) => sum + nominee.votes, 0)
      };
    });

  return {
    generatedAt: new Date().toISOString(),
    totalBallots: votes.length,
    awards: results
  };
}

function validateVote(body) {
  const choices = body && body.choices && typeof body.choices === "object" ? body.choices : {};
  const ballot = getBallot();
  const cleanChoices = {};
  const errors = [];

  for (const category of ballot.awards) {
    const selected = String(choices[category.id] || "");
    if (!selected) {
      errors.push(`Choose a nominee for ${category.name}.`);
      continue;
    }
    if (!category.nominees.some((nominee) => nominee.id === selected)) {
      errors.push(`The selected nominee for ${category.name} is not valid.`);
      continue;
    }
    cleanChoices[category.id] = selected;
  }

  if (ballot.awards.length === 0) {
    errors.push("No award categories currently have nominations.");
  }

  return { errors, choices: cleanChoices, ballot };
}

function isAdmin(reqUrl) {
  const requiredToken = process.env.ADMIN_TOKEN;
  if (!requiredToken) return true;
  return reqUrl.searchParams.get("token") === requiredToken;
}

function getVoteSummary(vote, ballot) {
  return ballot.awards.map((category) => {
    const nominee = category.nominees.find((item) => item.id === vote.choices[category.id]);
    return {
      award: category.name,
      nominee: nominee ? nominee.name : "Unknown nominee"
    };
  });
}

async function handleVote(req, res) {
  const body = await parseBody(req);
  const validation = validateVote(body);
  if (validation.errors.length) {
    sendJson(res, 400, { errors: validation.errors });
    return;
  }

  const vote = {
    id: crypto.randomUUID(),
    submittedAt: new Date().toISOString(),
    choices: validation.choices
  };
  appendVote(vote);

  const summary = getVoteSummary(vote, validation.ballot);
  const email = await notifyVoteSubmitted(vote, summary);

  sendJson(res, 201, {
    receiptId: vote.id,
    submittedAt: vote.submittedAt,
    email,
    results: getResults()
  });
}

async function notifyVoteSubmitted(vote, summary) {
  const to = process.env.EMAIL_TO;
  const from = process.env.SMTP_FROM || "Marketing Awards <awards@example.com>";
  const subject = "Marketing awards vote submitted";
  const text = [
    "An anonymous marketing awards ballot was submitted.",
    "",
    `Receipt: ${vote.id}`,
    `Submitted: ${vote.submittedAt}`,
    "",
    "Selections:",
    ...summary.map((item) => `- ${item.award}: ${item.nominee}`)
  ].join("\n");

  if (!to) {
    saveOutbox({ to: null, from, subject, text, status: "not_configured" });
    return { status: "saved_to_outbox", detail: "EMAIL_TO is not configured." };
  }

  if (process.env.SMTP_HOST) {
    try {
      await sendSmtpMail({ to, from, subject, text });
      return { status: "sent", channel: "smtp" };
    } catch (error) {
      saveOutbox({ to, from, subject, text, status: "smtp_failed", error: error.message });
      return { status: "saved_to_outbox", detail: error.message };
    }
  }

  if (process.env.SENDMAIL_PATH) {
    try {
      await sendSendmail({ to, from, subject, text });
      return { status: "sent", channel: "sendmail" };
    } catch (error) {
      saveOutbox({ to, from, subject, text, status: "sendmail_failed", error: error.message });
      return { status: "saved_to_outbox", detail: error.message };
    }
  }

  saveOutbox({ to, from, subject, text, status: "missing_mail_transport" });
  return { status: "saved_to_outbox", detail: "SMTP_HOST or SENDMAIL_PATH is not configured." };
}

function saveOutbox(message) {
  const outbox = readJson(EMAIL_OUTBOX_FILE, { messages: [] });
  outbox.messages.push({
    ...message,
    createdAt: new Date().toISOString()
  });
  writeJson(EMAIL_OUTBOX_FILE, outbox);
}

function sendSendmail({ to, from, subject, text }) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.env.SENDMAIL_PATH, ["-t"]);
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`sendmail exited with code ${code}`));
    });
    child.stdin.end(`To: ${to}\nFrom: ${from}\nSubject: ${subject}\n\n${text}\n`);
  });
}

function sendSmtpMail({ to, from, subject, text }) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = String(process.env.SMTP_SECURE || "false").toLowerCase() === "true";
  const user = process.env.SMTP_USER || "";
  const pass = process.env.SMTP_PASS || "";
  const fromAddress = extractEmail(from);
  const recipients = to.split(",").map((item) => item.trim()).filter(Boolean);
  const message = [
    `From: ${from}`,
    `To: ${recipients.join(", ")}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "",
    text
  ].join("\r\n");

  return new Promise((resolve, reject) => {
    const socket = secure ? tls.connect(port, host) : net.connect(port, host);
    let buffer = "";
    let securedSocket = socket;
    let step = 0;

    const commands = [
      () => write(`EHLO marketing-awards.local\r\n`),
      () => {
        if (!secure && port === 587) write("STARTTLS\r\n");
        else step += 1;
      },
      () => {
        if (!secure && port === 587) {
          securedSocket = tls.connect({ socket, servername: host }, () => write("EHLO marketing-awards.local\r\n"));
        } else {
          step += 1;
        }
      },
      () => {
        if (user && pass) write("AUTH LOGIN\r\n");
        else step += 3;
      },
      () => write(`${Buffer.from(user).toString("base64")}\r\n`),
      () => write(`${Buffer.from(pass).toString("base64")}\r\n`),
      () => write(`MAIL FROM:<${fromAddress}>\r\n`),
      ...recipients.map((recipient) => () => write(`RCPT TO:<${recipient}>\r\n`)),
      () => write("DATA\r\n"),
      () => write(`${escapeSmtpData(message)}\r\n.\r\n`),
      () => write("QUIT\r\n"),
      () => resolve()
    ];

    socket.setTimeout(15000);
    socket.on("timeout", () => reject(new Error("SMTP connection timed out.")));
    socket.on("error", reject);
    socket.on("data", handleData);

    function write(command) {
      securedSocket.write(command);
    }

    function handleData(chunk) {
      buffer += chunk.toString("utf8");
      const lines = buffer.split(/\r?\n/);
      if (lines.some((line) => /^[45]\d\d/.test(line))) {
        reject(new Error(lines.find((line) => /^[45]\d\d/.test(line))));
        securedSocket.end();
        return;
      }
      if (!lines.some((line) => /^\d\d\d /.test(line))) return;
      buffer = "";
      const command = commands[step];
      step += 1;
      if (command) command();
    }
  });
}

function extractEmail(value) {
  const match = String(value).match(/<([^>]+)>/);
  return match ? match[1] : String(value).trim();
}

function escapeSmtpData(message) {
  return message.replace(/^\./gm, "..");
}

async function handleApi(req, res, reqUrl) {
  if (req.method === "GET" && reqUrl.pathname === "/api/awards") {
    sendJson(res, 200, reqUrl.searchParams.get("all") === "1" ? getAdminData() : getBallot());
    return;
  }

  if (req.method === "GET" && reqUrl.pathname === "/api/results") {
    sendJson(res, 200, getResults());
    return;
  }

  if (req.method === "POST" && reqUrl.pathname === "/api/vote") {
    await handleVote(req, res);
    return;
  }

  if (req.method === "POST" && reqUrl.pathname === "/api/nominations") {
    if (!isAdmin(reqUrl)) {
      sendError(res, 401, "Admin token is missing or incorrect.");
      return;
    }
    const body = await parseBody(req);
    if (!Array.isArray(body.categories)) {
      sendError(res, 400, "Expected a categories array.");
      return;
    }
    sendJson(res, 200, saveNominations(body.categories));
    return;
  }

  sendError(res, 404, "Not found.");
}

function serveStatic(req, res, reqUrl) {
  let pathname = reqUrl.pathname;
  if (pathname === "/") pathname = "/index.html";
  if (pathname === "/admin") pathname = "/admin.html";
  if (pathname === "/results") pathname = "/results.html";

  const file = path.normalize(path.join(PUBLIC_DIR, pathname));
  if (!file.startsWith(PUBLIC_DIR)) {
    sendError(res, 403, "Forbidden.");
    return;
  }

  fs.readFile(file, (error, data) => {
    if (error) {
      sendError(res, 404, "Not found.");
      return;
    }
    const ext = path.extname(file);
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    res.end(data);
  });
}

ensureDataFiles();

const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (reqUrl.pathname.startsWith("/api/")) {
      await handleApi(req, res, reqUrl);
      return;
    }
    serveStatic(req, res, reqUrl);
  } catch (error) {
    sendError(res, 500, error.message || "Unexpected server error.");
  }
});

server.listen(PORT, () => {
  console.log(`Marketing awards voting app running at http://localhost:${PORT}`);
});
