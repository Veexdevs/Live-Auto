export async function executeOpenRouterBridge({ messages, modelCandidates, apiKey }) {
  let lastError = 'Falha ao consultar OpenRouter';

  for (const model of modelCandidates || ['openai/gpt-4o-mini']) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 9500);

      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.origin,
          'X-Title': 'TikTok Live Auto Quiz',
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.85,
          max_tokens: 350,
        }),
        signal: ctrl.signal,
      });

      clearTimeout(timer);

      if (!res.ok) {
        const errTxt = await res.text().catch(() => '');
        lastError = `OpenRouter HTTP ${res.status} (${model}): ${errTxt.slice(0, 100)}`;
        if (res.status === 401) {
          break;
        }
        continue;
      }

      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content;
      if (content) {
        return { content, model: data?.model || model };
      }
    } catch (err) {
      lastError = err?.message || 'Erro de rede na chamada OpenRouter';
    }
  }

  return { error: lastError };
}
