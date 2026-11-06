// SerpAPI Google News search. Routed through the Vite proxy (SerpAPI blocks browser CORS).
export async function searchNews({ apiKey, query, signal }) {
  if (!apiKey) throw new Error('Missing SerpAPI key. Open Settings to add it.');

  const params = new URLSearchParams({
    engine: 'google_news',
    q: query,
    gl: 'us',
    hl: 'en',
    api_key: apiKey,
  });
  const res = await fetch(`/api/serpapi/search.json?${params}`, { signal });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    throw new Error(`SerpAPI error (${res.status}): ${data.error || res.statusText}`);
  }

  // Google News results can contain "stories" clusters; flatten them.
  const items = [];
  for (const r of data.news_results || []) {
    if (r.link) items.push(r);
    for (const s of r.stories || []) if (s.link) items.push(s);
  }
  return items.map((r) => ({
    title: r.title,
    link: r.link,
    source: r.source?.name || r.source || '',
    date: r.date || '',
    snippet: r.snippet || '',
  }));
}
