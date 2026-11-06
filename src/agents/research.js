import { generateJSON } from '../lib/openai.js';
import { searchNews } from '../lib/serpapi.js';

const QUERIES = [
  'artificial intelligence news',
  'OpenAI OR Anthropic OR Google Gemini announcement',
  'AI startup funding',
  'new AI model release',
  'AI regulation',
];

const SYSTEM = `You are the Research Agent in an AI-news content team.
You turn fresh AI news headlines into scroll-stopping social content ideas
for a broad, engagement-hungry audience on Facebook, TikTok and Instagram.
Only use facts that appear in the provided headlines. Prefer the most recent,
surprising, useful or debate-worthy stories. Avoid duplicate angles.
Always respond with a single JSON object.`;

export async function runResearchAgent({ settings, feedback, previousIdeas, onStatus, signal }) {
  onStatus?.('Searching the web for the latest AI news…');
  const results = await Promise.allSettled(
    QUERIES.map((query) => searchNews({ apiKey: settings.serpKey, query, signal }))
  );

  const failures = results.filter((r) => r.status === 'rejected');
  if (failures.length === results.length) throw failures[0].reason;

  const seen = new Set();
  const articles = results
    .flatMap((r) => (r.status === 'fulfilled' ? r.value.slice(0, 12) : []))
    .filter((a) => a.title && !seen.has(a.link) && seen.add(a.link))
    .slice(0, 50);

  if (!articles.length) throw new Error('No news results came back from SerpAPI.');

  onStatus?.(`Found ${articles.length} articles. Brainstorming 10 content ideas…`);

  const headlines = articles
    .map((a, i) => `[${i + 1}] ${a.title} — ${a.source} (${a.date})\n${a.snippet}\n${a.link}`)
    .join('\n\n');

  let user = `Today's date: ${new Date().toDateString()}.

Latest AI news headlines:
${headlines}

Produce exactly 10 content ideas. Return JSON of the form:
{
  "ideas": [
    {
      "title": "short punchy idea title",
      "hook": "one-line hook that would stop a scroll",
      "summary": "2-3 sentence explanation of the news and the angle",
      "angle": "e.g. explainer, hot take, myth-buster, how-to, reaction, prediction",
      "why_now": "why this matters to a general audience right now",
      "engagement_score": 1-10,
      "sources": [{ "title": "article title", "link": "url" }]
    }
  ]
}`;

  if (feedback || previousIdeas?.length) {
    user += `\n\nThe human editor reviewed a previous batch and gave this feedback — follow it closely:
"${feedback || '(no written feedback — give a fresh, different set)'}"
Previous idea titles (avoid repeating unless asked): ${(previousIdeas || [])
      .map((i) => i.title)
      .join(' | ')}`;
  }

  const data = await generateJSON({
    apiKey: settings.openaiKey,
    model: settings.model,
    system: SYSTEM,
    user,
    signal,
  });

  const ideas = Array.isArray(data.ideas) ? data.ideas.slice(0, 10) : [];
  if (!ideas.length) throw new Error('The Research Agent returned no ideas.');
  return { ideas, articles };
}
