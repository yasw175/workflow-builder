const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

export async function callLLM(prompt: string): Promise<{ output: string; raw: any }> {
  if (!GROQ_API_KEY) {
    // Stubbed fallback with disclosed artificial delay — spec allows this if no key
    await new Promise((r) => setTimeout(r, 1200));
    return { output: `[STUBBED LLM RESPONSE] Echo: ${prompt.slice(0, 200)}`, raw: { stubbed: true } };
  }

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    throw new Error(`Groq API error: ${res.status} ${await res.text()}`);
  }

  const json = await res.json();
  return { output: json.choices[0].message.content, raw: json };
}
