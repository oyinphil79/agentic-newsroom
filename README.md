# Agentic Newsroom

A 4-agent team (built with Vite + vanilla JS) that researches the latest AI news and turns it into
engaging content for **Facebook**, **TikTok** and **Instagram**.

```
 Research Agent ──► Human picks top 3 ──┬─► Facebook Agent  ─┐
 (SerpAPI + LLM,       (+ optional       ├─► TikTok Agent    ─┼─► Content pack (copy / Markdown)
  10 ideas)            feedback/regen)   └─► Instagram Agent ─┘
                                            (run in parallel)
```

1. **Research Agent** – queries SerpAPI (Google News) for fresh AI stories and asks the model to pitch 10 content ideas, each with hook, angle, "why now", engagement score and sources.
2. **Human-in-the-loop** – you select exactly 3 ideas. You can also send feedback and regenerate the batch.
3. **Facebook / TikTok / Instagram Agents** – once you approve, all three run simultaneously on the 3 ideas:
   - Facebook: headline, post body, engagement question, CTA, hashtags, visual idea
   - TikTok: 2-second hook, timed script (voiceover + on-screen text), caption, hashtags, sound, CTA
   - Instagram: carousel slides, caption, hashtags, Reel concept, alt text

## Run it

```bash
npm install
npm run dev
```

Open the printed URL, click **⚙ Settings**, and enter:

- **OpenAI API key**
- **OpenAI model** (defaults to `gpt-6.1-sol`; change it to any model id your account has access to)
- **SerpAPI key**

Keys are kept in memory, or in `localStorage` if you tick "Remember keys".

## How the API calls work

SerpAPI doesn't accept direct browser requests (CORS), so the Vite server proxies
`/api/serpapi` → `serpapi.com` and `/api/openai` → `api.openai.com` (see `vite.config.js`).
This proxy works in `npm run dev` and `npm run preview`. For a static production deploy,
add the same two rewrites on your host (e.g. Netlify/Vercel rewrites or a small serverless function).

The model is called via the OpenAI **Responses API** (`/v1/responses`) in JSON mode.

## Project layout

```
src/
  agents/research.js    Research Agent (SerpAPI search + idea generation)
  agents/platforms.js   Facebook / TikTok / Instagram agent prompts and runner
  lib/openai.js         OpenAI Responses API client
  lib/serpapi.js        SerpAPI Google News client
  lib/settings.js       API key settings (memory / localStorage)
  main.js               UI + orchestration
  style.css
```
