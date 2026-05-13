import { config } from "./config.js";
import { fetchNewsArticles } from "./news.js";
import { generateChatReply, generateNewsBriefing } from "./openai.js";
import { TelegramBotClient } from "./telegram.js";

const MAX_HISTORY_MESSAGES = 12;
const conversations = new Map();
let isShuttingDown = false;

function sleep(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function normalizeCommand(rawText) {
  if (!rawText.startsWith("/")) {
    return null;
  }

  const parts = rawText.trim().split(/\s+/);
  const commandPart = parts.shift() || "";
  const name = commandPart.slice(1).split("@")[0].toLowerCase();
  const args = parts.join(" ").trim();

  return { name, args };
}

function trimHistory(history) {
  if (history.length <= MAX_HISTORY_MESSAGES) {
    return history;
  }

  return history.slice(-MAX_HISTORY_MESSAGES);
}

function getConversation(chatId) {
  return conversations.get(chatId) || [];
}

function setConversation(chatId, history) {
  conversations.set(chatId, trimHistory(history));
}

function clearConversation(chatId) {
  conversations.delete(chatId);
}

function setupShutdownHandlers() {
  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.once(signal, () => {
      isShuttingDown = true;
      console.log(`${signal} received. Stopping bot after the current request.`);
    });
  }
}

function buildWelcomeMessage() {
  return [
    "This bot can do two things for you:",
    "",
    "1. `/news` or `/news ai`",
    "Get a detailed news briefing based on the latest Google News RSS headlines.",
    "",
    "2. Send any normal message",
    "Chat with the bot using your OpenAI API key.",
    "",
    "Helpful commands:",
    "- `/start` shows this welcome message",
    "- `/help` shows quick usage tips",
    "- `/news <topic>` gives a topic-based briefing",
    "- `/clear` resets the chat memory"
  ].join("\n");
}

function buildHelpMessage() {
  return [
    "Quick examples:",
    "",
    "- `/news`",
    "- `/news india economy`",
    "- `/news artificial intelligence`",
    "- `Explain the stock market in simple words`",
    "",
    "Tip: `/news` is best for fresh events, while regular chat is better for questions and conversations."
  ].join("\n");
}

function buildNewsReply(topic, briefing, articles) {
  const sourceLines = articles.map((article, index) => {
    return `${index + 1}. ${article.title} (${article.source || "Unknown source"})`;
  });

  return [
    briefing,
    "",
    "Headline list used:",
    sourceLines.join("\n")
  ].join("\n");
}

async function handleNewsCommand(telegram, message, topic) {
  const chatId = message.chat.id;
  const normalizedTopic = topic.trim();

  await telegram.sendChatAction(chatId, "typing");

  const articles = await fetchNewsArticles(normalizedTopic);
  const briefing = await generateNewsBriefing({
    topic: normalizedTopic,
    articles
  });

  await telegram.sendLongMessage(chatId, buildNewsReply(normalizedTopic, briefing, articles));
}

async function handleChatMessage(telegram, message) {
  const chatId = message.chat.id;
  const userText = message.text.trim();
  const history = getConversation(chatId);
  const nextHistory = [...history, { role: "user", content: userText }];

  await telegram.sendChatAction(chatId, "typing");

  const reply = await generateChatReply(nextHistory);
  setConversation(chatId, [...nextHistory, { role: "assistant", content: reply }]);

  await telegram.sendLongMessage(chatId, reply);
}

async function handleMessage(telegram, update) {
  const message = update.message;

  if (!message?.text) {
    return;
  }

  const text = message.text.trim();
  const command = normalizeCommand(text);
  const chatId = message.chat.id;

  if (!command) {
    await handleChatMessage(telegram, message);
    return;
  }

  if (command.name === "start") {
    await telegram.sendMessage(chatId, buildWelcomeMessage());
    return;
  }

  if (command.name === "help") {
    await telegram.sendMessage(chatId, buildHelpMessage());
    return;
  }

  if (command.name === "clear") {
    clearConversation(chatId);
    await telegram.sendMessage(chatId, "Chat memory cleared. Start a fresh conversation any time.");
    return;
  }

  if (command.name === "news") {
    await handleNewsCommand(telegram, message, command.args);
    return;
  }

  await telegram.sendMessage(
    chatId,
    "Unknown command. Use /help to see what this bot can do.",
  );
}

async function handleMessageSafely(telegram, update) {
  const chatId = update?.message?.chat?.id;

  try {
    await handleMessage(telegram, update);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ${error.message}`);

    if (!chatId) {
      return;
    }

    try {
      await telegram.sendMessage(
        chatId,
        `I hit a problem while handling that request: ${error.message}`,
      );
    } catch (sendError) {
      console.error(
        `[${new Date().toISOString()}] Failed to send error message: ${sendError.message}`,
      );
    }
  }
}

async function run() {
  const telegram = new TelegramBotClient(config.telegramBotToken);
  let offset = 0;

  setupShutdownHandlers();
  console.log(`Bot starting with model ${config.openaiModel}...`);

  while (!isShuttingDown) {
    try {
      const updates = await telegram.getUpdates(offset, config.pollingTimeoutSeconds);

      for (const update of updates) {
        if (isShuttingDown) {
          break;
        }

        offset = update.update_id + 1;
        await handleMessageSafely(telegram, update);
      }
    } catch (error) {
      console.error(`[${new Date().toISOString()}] ${error.message}`);
      await sleep(3_000);
    }
  }

  console.log("Bot stopped.");
}

run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
