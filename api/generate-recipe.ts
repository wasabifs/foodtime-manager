// Vercel Serverless Function：AI 食譜生成中繼
// 將 Anthropic API Key 保留在伺服器端，前端只呼叫 /api/generate-recipe
// 環境變數：ANTHROPIC_API_KEY（設定於 Vercel → Settings → Environment Variables）

export const config = { runtime: 'edge' };

interface RequestBody {
  ingredients: { name: string; amount: number; unit: string }[];
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return json({ error: '伺服器尚未設定 ANTHROPIC_API_KEY，請至 Vercel 環境變數設定後重新部署。' }, 500);
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: '請求格式錯誤' }, 400);
  }

  const list = Array.isArray(body?.ingredients) ? body.ingredients : [];
  if (list.length === 0 || list.length > 50) {
    return json({ error: '請提供 1–50 樣食材' }, 400);
  }

  const names = list
    .map(i => `${String(i.name).slice(0, 50)}（${Number(i.amount) || 1}${String(i.unit || '份').slice(0, 10)}）`)
    .join('、');

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1500,
        messages: [{
          role: 'user',
          content: `我想使用冰箱裡的這些食材：${names}。請根據這些食材推薦一個簡單的家常食譜，盡量把這些食材都用上，可以搭配常見的基本調味料。使用繁體中文。

請只回傳 JSON，不要包含任何其他文字或 Markdown 標記，格式如下：
{"title": "食譜名稱", "description": "食譜簡介", "ingredients": [{"name": "食材名", "amount": "份量"}], "steps": ["步驟一", "步驟二"]}`,
        }],
      }),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => null);
      const msg = errBody?.error?.message || `Anthropic API 回應錯誤（${res.status}）`;
      return json({ error: msg }, 502);
    }

    const data = await res.json();
    const text = (data.content || [])
      .filter((b: { type: string }) => b.type === 'text')
      .map((b: { text: string }) => b.text)
      .join('');
    const clean = text.replace(/```json|```/g, '').trim();

    let recipe;
    try {
      recipe = JSON.parse(clean);
    } catch {
      return json({ error: 'AI 回應格式異常，請再試一次' }, 502);
    }

    if (!recipe?.title || !Array.isArray(recipe?.ingredients) || !Array.isArray(recipe?.steps)) {
      return json({ error: 'AI 回應內容不完整，請再試一次' }, 502);
    }

    return json({ recipe }, 200);
  } catch {
    return json({ error: '無法連線至 AI 服務，請稍後再試' }, 502);
  }
}

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
