const fs = require("fs");
const path = require("path");
const { mergeNominations } = require("./awards");

const ROOT = path.join(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data");
const NOMINATIONS_FILE = path.join(DATA_DIR, "nominations.json");
const VOTES_FILE = path.join(DATA_DIR, "votes.json");
const EMAIL_OUTBOX_FILE = path.join(DATA_DIR, "email-outbox.json");
const KEY_NOMINATIONS = "marketing-awards:nominations";
const KEY_VOTES = "marketing-awards:votes";
const KEY_OUTBOX = "marketing-awards:email-outbox";

async function getNominations() {
  const stored = await getJson(KEY_NOMINATIONS, NOMINATIONS_FILE, { updatedAt: null, categories: [] });
  return mergeNominations(stored);
}

async function setNominations(value) {
  await setJson(KEY_NOMINATIONS, NOMINATIONS_FILE, value);
  return getNominations();
}

async function getVotes() {
  const stored = await getJson(KEY_VOTES, VOTES_FILE, { votes: [] });
  return Array.isArray(stored.votes) ? stored.votes : [];
}

async function appendVote(vote) {
  const votes = await getVotes();
  votes.push(vote);
  await setJson(KEY_VOTES, VOTES_FILE, { votes });
}

async function appendOutbox(message) {
  const outbox = await getJson(KEY_OUTBOX, EMAIL_OUTBOX_FILE, { messages: [] });
  const messages = Array.isArray(outbox.messages) ? outbox.messages : [];
  messages.push({ ...message, createdAt: new Date().toISOString() });
  await setJson(KEY_OUTBOX, EMAIL_OUTBOX_FILE, { messages });
}

async function getJson(key, file, fallback) {
  if (hasKv()) {
    const value = await kvGet(key);
    return value === null ? fallback : value;
  }
  if (!allowsFileStorage()) return fallback;
  return readFileJson(file, fallback);
}

async function setJson(key, file, value) {
  if (hasKv()) {
    await kvSet(key, value);
    return;
  }
  if (!allowsFileStorage()) {
    throw new Error("Persistent storage is not configured. Add Vercel KV environment variables.");
  }
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function hasKv() {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

function allowsFileStorage() {
  return process.env.VERCEL !== "1" || process.env.ALLOW_FILE_STORAGE === "true";
}

function readFileJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    return fallback;
  }
}

async function kvGet(key) {
  const response = await fetch(`${process.env.KV_REST_API_URL}/get/${encodeURIComponent(key)}`, {
    headers: {
      Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`
    }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Unable to read from KV storage.");
  if (data.result === null) return null;
  return typeof data.result === "string" ? JSON.parse(data.result) : data.result;
}

async function kvSet(key, value) {
  const response = await fetch(`${process.env.KV_REST_API_URL}/set/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(JSON.stringify(value))
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Unable to write to KV storage.");
}

module.exports = {
  appendOutbox,
  appendVote,
  getNominations,
  getVotes,
  setNominations
};
