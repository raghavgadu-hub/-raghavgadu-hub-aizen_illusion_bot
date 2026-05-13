const TELEGRAM_MESSAGE_LIMIT = 4000;

function trimChunk(text) {
  return text.trim();
}

function splitLongParagraph(paragraph, maxLength) {
  const chunks = [];
  let remaining = paragraph;

  while (remaining.length > maxLength) {
    let splitIndex = remaining.lastIndexOf(" ", maxLength);

    if (splitIndex < maxLength * 0.5) {
      splitIndex = maxLength;
    }

    chunks.push(trimChunk(remaining.slice(0, splitIndex)));
    remaining = remaining.slice(splitIndex).trim();
  }

  if (remaining) {
    chunks.push(trimChunk(remaining));
  }

  return chunks;
}

function splitMessage(text, maxLength = TELEGRAM_MESSAGE_LIMIT) {
  if (text.length <= maxLength) {
    return [text];
  }

  const paragraphs = text.split(/\n{2,}/);
  const chunks = [];
  let current = "";

  for (const paragraph of paragraphs) {
    const nextPiece = current ? `${current}\n\n${paragraph}` : paragraph;

    if (nextPiece.length <= maxLength) {
      current = nextPiece;
      continue;
    }

    if (current) {
      chunks.push(trimChunk(current));
      current = "";
    }

    if (paragraph.length <= maxLength) {
      current = paragraph;
      continue;
    }

    chunks.push(...splitLongParagraph(paragraph, maxLength));
  }

  if (current) {
    chunks.push(trimChunk(current));
  }

  return chunks.filter(Boolean);
}

export class TelegramBotClient {
  constructor(token) {
    this.baseUrl = `https://api.telegram.org/bot${token}`;
  }

  async call(method, payload = {}) {
    const response = await fetch(`${this.baseUrl}/${method}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(60_000)
    });

    const responseText = await response.text();
    let responseData;

    try {
      responseData = JSON.parse(responseText);
    } catch (error) {
      throw new Error(`Telegram returned a non-JSON response: ${responseText}`);
    }

    if (!response.ok || !responseData.ok) {
      const message =
        responseData?.description ||
        `Telegram request failed with status ${response.status}.`;
      throw new Error(message);
    }

    return responseData.result;
  }

  async getUpdates(offset, timeoutSeconds) {
    return this.call("getUpdates", {
      offset,
      timeout: timeoutSeconds,
      allowed_updates: ["message"]
    });
  }

  async sendChatAction(chatId, action = "typing") {
    return this.call("sendChatAction", {
      chat_id: chatId,
      action
    });
  }

  async sendMessage(chatId, text) {
    return this.call("sendMessage", {
      chat_id: chatId,
      text,
      disable_web_page_preview: false
    });
  }

  async sendLongMessage(chatId, text) {
    const chunks = splitMessage(text);

    for (const chunk of chunks) {
      await this.sendMessage(chatId, chunk);
    }
  }
}
