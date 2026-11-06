import { generateJSON } from '../lib/openai.js';

const AUDIENCE = `Audience: a broad, highly engaged crowd who love trending tech but are not
experts. Write in plain, energetic language. Lead with curiosity, surprise or emotion,
invite comments (questions, polls, "would you…?"), and never invent facts beyond the brief.`;

export const PLATFORMS = {
  facebook: {
    name: 'Facebook',
    agent: 'Facebook Agent',
    system: `You are the Facebook Agent in an AI-news content team. You write Facebook posts
that spark comments and shares in feeds and groups. ${AUDIENCE}
Always respond with a single JSON object.`,
    schema: `{
  "posts": [
    {
      "idea_title": "the idea this post is for",
      "headline": "bold first line that stops the scroll",
      "post": "full post body, 80-180 words, short paragraphs, 2-4 emojis max",
      "engagement_question": "question to drive comments",
      "cta": "call to action",
      "hashtags": ["#tag", "..."],
      "visual_suggestion": "image or link-preview idea"
    }
  ]
}`,
  },
  tiktok: {
    name: 'TikTok',
    agent: 'TikTok Agent',
    system: `You are the TikTok Agent in an AI-news content team. You write short-form
video scripts (30-60 seconds) for TikTok with a killer first 2 seconds, fast pacing and
a loop-friendly ending. ${AUDIENCE}
Always respond with a single JSON object.`,
    schema: `{
  "videos": [
    {
      "idea_title": "the idea this video is for",
      "hook": "what is said/shown in the first 2 seconds",
      "duration": "e.g. 45s",
      "script": [
        { "time": "0-3s", "voiceover": "spoken line", "on_screen": "text overlay / visual" }
      ],
      "caption": "TikTok caption, under 150 characters",
      "hashtags": ["#tag", "..."],
      "sound_suggestion": "trending sound style or music mood",
      "cta": "e.g. follow for daily AI news / comment your take"
    }
  ]
}`,
  },
  instagram: {
    name: 'Instagram',
    agent: 'Instagram Agent',
    system: `You are the Instagram Agent in an AI-news content team. You create save-worthy
carousel posts plus a Reel concept for each idea. Visual-first, punchy slide copy. ${AUDIENCE}
Always respond with a single JSON object.`,
    schema: `{
  "posts": [
    {
      "idea_title": "the idea this post is for",
      "carousel": [
        { "slide": 1, "text": "slide headline/copy (max ~20 words)", "visual": "design direction" }
      ],
      "caption": "caption, 60-150 words, line breaks, emojis welcome, ends with a question",
      "hashtags": ["#tag", "... up to 15"],
      "reel_idea": "one-paragraph Reel concept for the same idea",
      "alt_text": "accessible description of the cover slide"
    }
  ]
}`,
  },
};

export async function runPlatformAgent({ platform, settings, ideas, notes, signal }) {
  const cfg = PLATFORMS[platform];
  const brief = ideas
    .map(
      (idea, i) => `Idea ${i + 1}: ${idea.title}
Hook: ${idea.hook}
Summary: ${idea.summary}
Angle: ${idea.angle}
Why now: ${idea.why_now}
Sources: ${(idea.sources || []).map((s) => s.link).join(', ')}`
    )
    .join('\n\n');

  const user = `Create ${cfg.name} content for EACH of these ${ideas.length} approved ideas (one item per idea, same order).

${brief}
${notes ? `\nEditor notes for all platforms: ${notes}\n` : ''}
Return JSON of the form:
${cfg.schema}`;

  return generateJSON({
    apiKey: settings.openaiKey,
    model: settings.model,
    system: cfg.system,
    user,
    signal,
  });
}
