import { llmsTxt } from '@/lib/llms';

/**
 * /llms.txt — короткая справка о RAHTIS для ответчиков на языковых
 * моделях. Текст и источники цен — в lib/llms.ts; полная версия —
 * /llms-full.txt.
 */
export const dynamic = 'force-static';

export function GET() {
  return new Response(llmsTxt(), {
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' },
  });
}
