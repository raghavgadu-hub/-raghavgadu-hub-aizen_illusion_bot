# Telegram News Briefing Bot

This project gives you a Telegram bot with two core features:

- detailed news briefings with `/news <topic>`
- OpenAI-powered chat for normal messages

It is built with plain Node.js, so you do not need to install any npm packages to get started.

## What the bot does

- `/news`
  - pulls the latest headlines from Google News RSS
  - sends those headlines to the OpenAI Responses API
  - returns a more elaborate briefing in readable sections
- normal chat messages
  - uses your OpenAI API key to answer user questions
  - keeps a small in-memory conversation history per chat
- `/clear`
  - resets the stored chat history for that Telegram chat

## Setup

1. Create a Telegram bot with `@BotFather`
2. Copy `.env.example` to `.env`
3. Fill in:
   - `TELEGRAM_BOT_TOKEN`
   - `OPENAI_API_KEY`
4. Start the bot:

```powershell
Copy-Item .env.example .env
node src/bot.js
```

You can also use:

```powershell
npm start
```

## Deploy with GitHub and Railway

This bot is ready to deploy as a single long-running Railway service.

1. Create a new GitHub repository.
2. Push this project to GitHub.
3. In Railway, create a new project and choose `Deploy from GitHub repo`.
4. Select your repository and deploy it.
5. Open the Railway service `Variables` tab and add these required variables:
   - `TELEGRAM_BOT_TOKEN`
   - `OPENAI_API_KEY`
6. Add or keep these optional variables if you want to tune behavior:
   - `OPENAI_MODEL=gpt-5.4-mini`
   - `OPENAI_MAX_OUTPUT_TOKENS=900`
   - `NEWS_ARTICLE_LIMIT=6`
   - `POLLING_TIMEOUT_SECONDS=30`
   - `NEWS_HL=en-IN`
   - `NEWS_GL=IN`
   - `NEWS_CEID=IN:en`
7. Railway should run `npm start` automatically. The included `railway.json` also sets that start command explicitly.
8. Keep the Railway service to one replica, because Telegram long polling should only have one active bot process.

Do not upload your real `.env` file to GitHub. Keep real tokens only in Railway Variables.

Useful Git commands:

```powershell
git init
git add .
git commit -m "Initial Telegram news bot"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git push -u origin main
```

## Environment variables

```env
TELEGRAM_BOT_TOKEN=123456789:replace-with-your-bot-token
OPENAI_API_KEY=sk-replace-with-your-openai-key
OPENAI_MODEL=gpt-5.4-mini
OPENAI_MAX_OUTPUT_TOKENS=900
NEWS_ARTICLE_LIMIT=6
POLLING_TIMEOUT_SECONDS=30
NEWS_HL=en-IN
NEWS_GL=IN
NEWS_CEID=IN:en
```

## Example commands

- `/start`
- `/help`
- `/news`
- `/news india economy`
- `/news artificial intelligence`
- `Summarize inflation in simple words`

## Notes

- News briefings are based on headline-level RSS data, so the AI is instructed not to invent details beyond the feed.
- Chat history is stored only in memory while the process is running.
- If you want richer news data later, we can add a dedicated news API and category commands next.
