// Minimal OpenAI Responses API client that asks for a JSON object back.
export async function generateJSON({ apiKey, model, system, user, signal }) {
  if (!apiKey) throw new Error('Missing OpenAI API key. Open Settings to add it.');

  const res = await fetch('/api/openai/v1/responses', {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      instructions: system,
      input: user,
      text: { format: { type: 'json_object' } },
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`OpenAI error (${res.status}): ${data?.error?.message || res.statusText}`);
  }

  const text =
    data.output_text ??
    (data.output || [])
      .flatMap((item) => item.content || [])
      .filter((c) => c.type === 'output_text')
      .map((c) => c.text)
      .join('');

  try {
    return JSON.parse(text);
  } catch {
    throw new Error('The model did not return valid JSON. Try running the agent again.');
  }
}
