import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { MongoClient } from "mongodb";
import crypto from "crypto";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.text({ type: "text/plain" }));

// Environment Variables
const PORT = Number(process.env.PORT || 3000);
const GEMINI_KEY = process.env.GEMINI_API_KEY;
const MODEL_NAME = process.env.GEMINI_MODEL || "gemini-flash-latest";
const MONGODB_URI = process.env.MONGODB_URI || "";
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_OPERATOR_CHAT_ID = process.env.TELEGRAM_OPERATOR_CHAT_ID || "";
const MAX_CONVERSATIONS = 200;
const HUMAN_ACTIVE_WINDOW_MS = 10 * 60 * 1000;
const CONVERSATION_IDLE_MS = 24 * 60 * 60 * 1000;
const TELEGRAM_POLL_INTERVAL_MS = 2500;
const IS_VERCEL = process.env.VERCEL === "1";

// Gemini AI setup
const genAI = new GoogleGenerativeAI(GEMINI_KEY);
const model = genAI.getGenerativeModel({
  model: MODEL_NAME,
  systemInstruction: `You are a helpful assistant on Carla Gidacan's personal portfolio website.
Carla is an IT student and aspiring backend developer based in the Philippines.
Her skills include Java, JavaScript, HTML/CSS, Python, SQL, and frameworks like REST APIs and Node.js.
Her projects include AquaCultura (hydroponics farm management system), Paws & Claws (vet clinic platform), and TrainTrack (EdTech training management).
Her IEEE-published paper is about WeLink.
Answer questions about Carla's skills, projects, experience, and how to contact her. Keep responses concise and friendly.
Reply in plain text only. Do not use Markdown or link shortcuts; provide full URLs if sharing links.`
});

// Data structures
const conversations = new Map(); 
const telegramChatToConversation = new Map(); 
let telegramLastUpdateId = 0;
let telegramPollTimer = null;
let aiRateLimitedUntil = 0;
let mongoClient = null;
let conversationsCollection = null;
let operatorMappingsCollection = null;
let startupPromise = null;

// Utilities
function nowIso() {
  return new Date().toISOString();
}

function serializeConversationForDb(conversation) {
  return {
    id: conversation.id,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    messages: Array.isArray(conversation.messages) ? conversation.messages : [],
    humanActiveUntil: conversation.humanActiveUntil || null,
    operatorLastSeenAt: conversation.operatorLastSeenAt || null,
    websiteLastSeenAt: conversation.websiteLastSeenAt || null,
  };
}

function hydrateConversationFromDb(doc) {
  if (!doc) return null;
  return {
    id: doc.id,
    createdAt: doc.createdAt || nowIso(),
    updatedAt: doc.updatedAt || nowIso(),
    messages: Array.isArray(doc.messages) ? doc.messages : [],
    humanActiveUntil: doc.humanActiveUntil || null,
    operatorLastSeenAt: doc.operatorLastSeenAt || null,
    websiteLastSeenAt: doc.websiteLastSeenAt || nowIso(),
  };
}

async function initMongo() {
  if (!MONGODB_URI) {
    console.log("MongoDB not configured. Using in-memory chat storage.");
    return;
  }

  try {
    mongoClient = new MongoClient(MONGODB_URI);
    await mongoClient.connect();
    const db = mongoClient.db("portfolio-chatbot");
    conversationsCollection = db.collection("conversations");
    operatorMappingsCollection = db.collection("operator_mappings");

    await conversationsCollection.createIndex({ id: 1 }, { unique: true });
    await operatorMappingsCollection.createIndex({ chatId: 1 }, { unique: true });
    console.log("MongoDB connected. Persistent chat storage enabled.");
  } catch (error) {
    conversationsCollection = null;
    operatorMappingsCollection = null;
    console.error("MongoDB connection failed. Falling back to in-memory storage.", error.message || String(error));
  }
}

async function saveConversation(conversation) {
  if (!conversationsCollection || !conversation?.id) return;
  try {
    await conversationsCollection.updateOne(
      { id: conversation.id },
      { $set: serializeConversationForDb(conversation) },
      { upsert: true }
    );
  } catch (error) {
    console.error("Failed to save conversation:", error.message || String(error));
  }
}

async function loadConversation(conversationId) {
  if (!conversationsCollection || !conversationId) return null;
  try {
    const doc = await conversationsCollection.findOne({ id: conversationId });
    const conversation = hydrateConversationFromDb(doc);
    if (conversation) {
      conversations.set(conversation.id, conversation);
    }
    return conversation;
  } catch (error) {
    console.error("Failed to load conversation:", error.message || String(error));
    return null;
  }
}

async function saveOperatorMapping(chatId, conversationId) {
  if (!operatorMappingsCollection || !chatId || !conversationId) return;
  try {
    await operatorMappingsCollection.updateOne(
      { chatId },
      { $set: { chatId, conversationId, updatedAt: nowIso() } },
      { upsert: true }
    );
  } catch (error) {
    console.error("Failed to save operator mapping:", error.message || String(error));
  }
}

async function loadOperatorMapping(chatId) {
  if (!operatorMappingsCollection || !chatId) return "";
  try {
    const doc = await operatorMappingsCollection.findOne({ chatId });
    return typeof doc?.conversationId === "string" ? doc.conversationId : "";
  } catch (error) {
    console.error("Failed to load operator mapping:", error.message || String(error));
    return "";
  }
}

function createMessage(role, text, source = "website") {
  return {
    id: crypto.randomUUID(),
    role,
    text,
    source,
    createdAt: nowIso()
  };
}

function pruneConversations() {
  const cutoff = Date.now() - CONVERSATION_IDLE_MS;
  for (const [id, convo] of conversations.entries()) {
    if (new Date(convo.updatedAt).getTime() < cutoff) conversations.delete(id);
  }
  while (conversations.size > MAX_CONVERSATIONS) {
    const oldest = [...conversations.entries()].sort((a, b) => new Date(a[1].updatedAt) - new Date(b[1].updatedAt))[0];
    if (!oldest) break;
    conversations.delete(oldest[0]);
  }
}

function ensureConversation(conversationId) {
  const id = conversationId || crypto.randomUUID();
  let convo = conversations.get(id);
  if (!convo) {
    convo = {
      id,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      messages: [],
      humanActiveUntil: null,
      operatorLastSeenAt: null,
      websiteLastSeenAt: nowIso()
    };
    conversations.set(id, convo);
    pruneConversations();
  }
  return convo;
}

function addConversationMessage(conversation, role, text, source = "website") {
  const message = createMessage(role, text, source);
  conversation.messages.push(message);
  conversation.updatedAt = message.createdAt;
  if (source === "telegram") {
    conversation.humanActiveUntil = new Date(Date.now() + HUMAN_ACTIVE_WINDOW_MS).toISOString();
    conversation.operatorLastSeenAt = message.createdAt;
  }
  return message;
}

function getConversationStatus(conversation) {
  const humanActive = conversation.humanActiveUntil && new Date(conversation.humanActiveUntil).getTime() > Date.now();
  return {
    humanActive,
    humanActiveUntil: conversation.humanActiveUntil,
    operatorLastSeenAt: conversation.operatorLastSeenAt,
    updatedAt: conversation.updatedAt,
  };
}

function serializeConversationMessages(conversation, since) {
  const sinceTime = since ? new Date(since).getTime() : 0;
  return conversation.messages.filter(msg => new Date(msg.createdAt).getTime() > sinceTime);
}

function buildPortfolioPrompt(message) {
  return `Use only the facts below when answering. Conflicting questions must follow these facts.

FACTS:
- Carla Gidacan is an IT student and aspiring backend developer in the Philippines.
- Projects:
  1. AquaCultura - hydroponics farm capstone.
  2. Paws & Claws - vet clinic platform.
  3. TrainTrack - EdTech platform.
- IEEE-published paper: WeLink.
- AquaCultura is NOT the IEEE-published paper.
- Email: carlagidacan2917@gmail.com
- LinkedIn: https://www.linkedin.com/in/carla-gidacan-2b80702ab/
- GitHub: https://github.com/carlagidacan

USER QUESTION:
${message}`;
}

function buildAutoReplyPrompt(message, conversation) {
  const transcript = conversation.messages.slice(-8).map(m => {
    const speaker = m.role === "user" ? "Visitor" : m.source === "telegram" ? "Carla" : "Assistant";
    return `${speaker}: ${m.text}`;
  }).join("\n");
  return `${buildPortfolioPrompt(message)}

CONVERSATION CONTEXT:
${transcript || "No prior messages."}

INSTRUCTIONS:
- Give a helpful first reply for the website visitor.
- Keep it short, clear, and plain text.
- Do not claim Carla personally typed the reply unless operator has joined.
- Mention hiring/collaboration/contact only once.`;
}

function parseRetryDelayMsFromError(errorMessage) {
  const text = String(errorMessage || "");
  const secondsMatch = text.match(/retry in\s+([0-9]+(?:\.[0-9]+)?)s/i);
  if (secondsMatch) {
    return Math.max(1000, Math.ceil(Number(secondsMatch[1]) * 1000));
  }

  const retryInfoMatch = text.match(/"retryDelay":"([0-9]+)s"/i);
  if (retryInfoMatch) {
    return Math.max(1000, Number(retryInfoMatch[1]) * 1000);
  }

  return 60 * 1000;
}

function isRateLimitError(errorMessage) {
  const text = String(errorMessage || "").toLowerCase();
  return text.includes("429") || text.includes("quota exceeded") || text.includes("too many requests");
}

function buildFallbackReply(message) {
  const lower = String(message || "").toLowerCase();

  if (lower.includes("project")) {
    return "Carla's projects are AquaCultura, Paws & Claws, and TrainTrack. If you want details about one project, tell me which one and Carla can follow up personally.";
  }

  if (lower.includes("published") || lower.includes("ieee") || lower.includes("paper")) {
    return "Carla's IEEE-published paper is about WeLink. AquaCultura is a separate capstone project.";
  }

  if (lower.includes("contact") || lower.includes("email") || lower.includes("linkedin") || lower.includes("github")) {
    return "You can contact Carla via email: carlagidacan2917@gmail.com, LinkedIn: https://www.linkedin.com/in/carla-gidacan-2b80702ab/, and GitHub: https://github.com/carlagidacan.";
  }

  return "The AI assistant is temporarily rate-limited, but your message was received. Carla can still reply via this chat. You can also reach her at carlagidacan2917@gmail.com.";
}

// Telegram messaging
async function sendTelegramMessage(text, chatId = TELEGRAM_OPERATOR_CHAT_ID) {
  if (!TELEGRAM_BOT_TOKEN || !chatId) return { delivered: false, reason: "telegram-not-configured" };
  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true })
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Telegram send failed (${res.status}): ${body}`);
  }
  return { delivered: true };
}

async function notifyTelegramOfVisitorMessage(conversation, visitorMessage) {
  const text = [
    `New website chat message`,
    `Conversation: #${conversation.id}`,
    `Message: ${visitorMessage.text}`,
    `Operator can reply directly in this chat.`,
    `Recent chat:`,
    ...conversation.messages.slice(-6).map(m => `${m.role === "user" ? "Visitor" : m.source === "telegram" ? "Carla" : "AI"}: ${m.text}`)
  ].join("\n");
  try { await sendTelegramMessage(text); } catch(e) { console.error("Telegram notify error:", e); }
}

async function processTelegramMessage(incomingMessage, chatId) {
  if (!incomingMessage.trim()) return { ok: true, ignored: "no-text-message" };
  if (chatId !== TELEGRAM_OPERATOR_CHAT_ID) return { ok: false, status: 403, error: "Unauthorized Telegram chat" };

  let conversationId = telegramChatToConversation.get(chatId);
  if (!conversationId) {
    conversationId = await loadOperatorMapping(chatId);
    if (conversationId) {
      telegramChatToConversation.set(chatId, conversationId);
    }
  }
  if (!conversationId) return { ok: true, ignored: "no-active-conversation" };

  let conversation = conversations.get(conversationId);
  if (!conversation) {
    conversation = await loadConversation(conversationId);
  }
  if (!conversation) return { ok: false, status: 404, error: "Conversation not found" };

  addConversationMessage(conversation, "assistant", incomingMessage, "telegram");
  await saveConversation(conversation);
  return { ok: true, conversationId, status: getConversationStatus(conversation) };
}

async function pollTelegramUpdates() {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_OPERATOR_CHAT_ID) return;

  try {
    const params = new URLSearchParams();
    params.set("timeout", "0");
    if (telegramLastUpdateId > 0) {
      params.set("offset", String(telegramLastUpdateId + 1));
    }

    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates?${params.toString()}`);
    const payload = await response.json();

    if (!response.ok || !payload?.ok || !Array.isArray(payload?.result)) {
      return;
    }

    for (const update of payload.result) {
      telegramLastUpdateId = Math.max(telegramLastUpdateId, Number(update.update_id || 0));
      const text = update.message?.text || update.edited_message?.text || "";
      const chatId = String(update.message?.chat?.id || update.edited_message?.chat?.id || "");
      await processTelegramMessage(text, chatId);
    }
  } catch (error) {
    console.error("Telegram poll error:", error.message || String(error));
  }
}

async function maybeStartTelegramPolling() {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_OPERATOR_CHAT_ID) return;

  try {
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo`);
    const payload = await response.json();
    const webhookUrl = payload?.result?.url || "";

    if (!webhookUrl) {
      console.log("Telegram webhook is not set. Using getUpdates polling fallback.");
      if (!telegramPollTimer) {
        telegramPollTimer = setInterval(() => {
          void pollTelegramUpdates();
        }, TELEGRAM_POLL_INTERVAL_MS);
      }
      void pollTelegramUpdates();
    }
  } catch (error) {
    console.error("Telegram webhook check failed:", error.message || String(error));
  }
}

// Routes

// Health routes
app.get("/", (req, res) => {
  res.json({
    ok: true,
    service: "personal-portfolio-backend",
    status: "online",
  });
});

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    status: "healthy",
    model: MODEL_NAME,
  });
});

// Get conversation messages
app.get("/conversations/:conversationId", async (req, res) => {
  const { conversationId } = req.params;
  const since = typeof req.query.since === "string" ? req.query.since : "";
  let conversation = conversations.get(conversationId);
  if (!conversation) {
    conversation = await loadConversation(conversationId);
  }
  if (!conversation) return res.status(404).json({ error: "Conversation not found" });
  conversation.websiteLastSeenAt = nowIso();
  await saveConversation(conversation);
  return res.json({
    conversationId,
    messages: serializeConversationMessages(conversation, since),
    status: getConversationStatus(conversation)
  });
});

// Website visitor sends message
app.post("/chat", async (req, res) => {
  try {
    const message = typeof req.body?.message === "string" ? req.body.message : typeof req.body === "string" ? req.body : "";
    const requestedConversationId = typeof req.body?.conversationId === "string" ? req.body.conversationId.trim() : "";
    if (!message.trim()) return res.status(400).json({ error: "Invalid request", details: "Message is empty." });

    const conversation = ensureConversation(requestedConversationId);
    addConversationMessage(conversation, "user", message.trim(), "website");

    // Map operator chat to conversation
    telegramChatToConversation.set(TELEGRAM_OPERATOR_CHAT_ID, conversation.id);
    await saveOperatorMapping(TELEGRAM_OPERATOR_CHAT_ID, conversation.id);
    await saveConversation(conversation);

    // Notify operator
    void notifyTelegramOfVisitorMessage(conversation, { text: message.trim() });

    let aiReply = "";
    let usedFallback = false;
    // AI auto-reply only if operator hasn't replied yet
    if (!conversation.humanActiveUntil || new Date(conversation.humanActiveUntil).getTime() < Date.now()) {
      if (Date.now() < aiRateLimitedUntil) {
        aiReply = buildFallbackReply(message.trim());
        usedFallback = true;
      } else {
        try {
          const aiResult = await model.generateContent(buildAutoReplyPrompt(message.trim(), conversation));
          aiReply = aiResult.response.text();
        } catch (aiError) {
          const aiErrorMessage = aiError?.message || String(aiError);
          if (isRateLimitError(aiErrorMessage)) {
            const delayMs = parseRetryDelayMsFromError(aiErrorMessage);
            aiRateLimitedUntil = Date.now() + delayMs;
            aiReply = buildFallbackReply(message.trim());
            usedFallback = true;
          } else {
            throw aiError;
          }
        }
      }
      addConversationMessage(conversation, "assistant", aiReply, "ai");
      await saveConversation(conversation);
    }

    res.json({
      conversationId: conversation.id,
      reply: aiReply,
      status: getConversationStatus(conversation),
      aiFallback: usedFallback,
      aiRateLimitedUntil: aiRateLimitedUntil > Date.now() ? new Date(aiRateLimitedUntil).toISOString() : null,
    });
  } catch (error) {
    console.error("Chat error:", error);
    res.status(500).json({ error: "AI error", details: error.message || String(error) });
  }
});

// Telegram webhook for operator replies
app.post("/telegram/webhook", async (req, res) => {
  try {
    const update = req.body || {};
    const incomingMessage = update.message?.text || update.edited_message?.text || "";
    const chatId = String(update.message?.chat?.id || update.edited_message?.chat?.id || "");
    const result = await processTelegramMessage(incomingMessage, chatId);

    if (result.ok) {
      return res.json(result);
    }

    return res.status(result.status || 500).json({ error: result.error || "Telegram webhook error" });
  } catch (error) {
    console.error("Telegram webhook error:", error);
    res.status(500).json({ error: "Telegram webhook error", details: error.message || String(error) });
  }
});

async function ensureStartup() {
  if (startupPromise) return startupPromise;

  startupPromise = (async () => {
    await initMongo();

    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_OPERATOR_CHAT_ID) {
      console.log("Telegram operator bridge is disabled. Set TELEGRAM_BOT_TOKEN and TELEGRAM_OPERATOR_CHAT_ID.");
      return;
    }

    // Polling is only for local fallback. On Vercel use webhook delivery only.
    if (!IS_VERCEL) {
      await maybeStartTelegramPolling();
    }
  })();

  return startupPromise;
}

if (!IS_VERCEL) {
  void ensureStartup().then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT} using model: ${MODEL_NAME}`);
    });
  });
}

export { app, ensureStartup };
export default app;