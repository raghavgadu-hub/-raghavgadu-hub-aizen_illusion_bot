import { config } from "./config.js";

const CHAT_INSTRUCTIONS = `
You are a helpful Telegram assistant.
Be clear, warm, and practical.
Keep answers concise by default, but be willing to explain more when the user asks.
If the user asks about current news, remind them that /news is the best way to get a fresh briefing in this bot.
`.trim();

const NEWS_BRIEFING_INSTRUCTIONS = `
You are a careful news editor creating a detailed but readable briefing from a small set of headlines.
Use only the provided article list and do not invent facts beyond what those headlines and sources support.
If the source material is limited, say that the briefing is based on headline-level information.
Write in a polished, easy-to-scan style with these sections:
1. Big picture
2. Key developments
3. Why it matters
4. What to watch next
End with a short "Source watchlist" section that names the source outlets referenced.
`.trim();

function extractOutputText(responseData) {
  if (typeof responseData.output_text === "string" && responseData.output_text) {
    return responseData.output_text.trim();
  }

  const outputItems = Array.isArray(responseData.output) ? responseData.output : [];
  const textParts = [];

  for (const item of outputItems) {
    if (!Array.isArray(item.content)) {
      continue;
    }

    for (const contentItem of item.content) {
      if (contentItem?.type === "output_text" && typeof contentItem.text === "string") {
        textParts.push(contentItem.text);
      }
    }
  }

  return textParts.join("\n").trim();
}

async function createResponse({ instructions, input, maxOutputTokens }) {
  const response = await fetch(`${config.openaiBaseUrl}/responses`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${config.openaiApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: config.openaiModel,
      instructions,
      input,
      max_output_tokens: maxOutputTokens ?? config.openaiMaxOutputTokens,
      store: false
    }),
    signal: AbortSignal.timeout(90_000)
  });

  const responseText = await response.text();
  let responseData;

  try {
    responseData = JSON.parse(responseText);
  } catch (error) {
    throw new Error(`OpenAI returned a non-JSON response: ${responseText}`);
  }

  if (!response.ok) {
    const message =
      responseData?.error?.message ||
      responseData?.message ||
      `OpenAI request failed with status ${response.status}.`;
    throw new Error(message);
  }

  const outputText = extractOutputText(responseData);

  if (!outputText) {
    throw new Error("OpenAI returned no text output.");
  }

  return outputText;
}

export async function generateChatReply(history) {
  return createResponse({
    instructions: CHAT_INSTRUCTIONS,
    input: history,
    maxOutputTokens: config.openaiMaxOutputTokens
  });
}

export async function generateNewsBriefing({ topic, articles }) {
  const articleLines = articles.map((article, index) => {
    const published = article.pubDate ? ` | Published: ${article.pubDate}` : "";
    return [
      `${index + 1}. ${article.title}`,
      `Source: ${article.source || "Unknown"}${published}`,
      `Link: ${article.link}`
    ].join("\n");
  });

  const userPrompt = [
    `Topic requested: ${topic || "Top headlines"}`,
    "",
    "Articles:",
    articleLines.join("\n\n")
  ].join("\n");

  return createResponse({
    instructions: NEWS_BRIEFING_INSTRUCTIONS,
    input: [
      {
        role: "user",
        content: userPrompt
      }
    ],
    maxOutputTokens: config.openaiMaxOutputTokens
  });
}
