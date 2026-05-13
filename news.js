import { config } from "./config.js";

function decodeXmlEntities(text) {
  return text
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

function stripCdata(text) {
  return text.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "");
}

function extractTag(block, tagName) {
  const match = block.match(new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i"));

  if (!match) {
    return "";
  }

  return decodeXmlEntities(stripCdata(match[1].trim()));
}

function extractSource(block) {
  const match = block.match(/<source\b[^>]*>([\s\S]*?)<\/source>/i);

  if (!match) {
    return "";
  }

  return decodeXmlEntities(stripCdata(match[1].trim()));
}

function normalizeTitle(title, source) {
  if (!source) {
    return title;
  }

  const suffixes = [` - ${source}`, ` | ${source}`];

  for (const suffix of suffixes) {
    if (title.endsWith(suffix)) {
      return title.slice(0, -suffix.length).trim();
    }
  }

  return title;
}

function buildNewsUrl(topic) {
  const baseUrl = new URL("https://news.google.com/rss");
  baseUrl.searchParams.set("hl", config.newsHl);
  baseUrl.searchParams.set("gl", config.newsGl);
  baseUrl.searchParams.set("ceid", config.newsCeid);

  if (topic) {
    baseUrl.pathname = "/rss/search";
    baseUrl.searchParams.set("q", topic);
  }

  return baseUrl.toString();
}

function parseRssItems(xmlText) {
  const itemBlocks = xmlText.match(/<item\b[\s\S]*?<\/item>/gi) || [];

  return itemBlocks.map((block) => {
    const source = extractSource(block);
    const title = normalizeTitle(extractTag(block, "title"), source);

    return {
      title,
      link: extractTag(block, "link"),
      pubDate: extractTag(block, "pubDate"),
      source
    };
  });
}

export async function fetchNewsArticles(topic) {
  const response = await fetch(buildNewsUrl(topic), {
    headers: {
      "User-Agent": "telegram-news-briefing-bot/0.1"
    },
    signal: AbortSignal.timeout(20_000)
  });

  if (!response.ok) {
    throw new Error(`News feed request failed with status ${response.status}.`);
  }

  const xmlText = await response.text();
  const items = parseRssItems(xmlText)
    .filter((item) => item.title && item.link)
    .slice(0, config.newsArticleLimit);

  if (items.length === 0) {
    throw new Error("No news articles were found for that topic.");
  }

  return items;
}
