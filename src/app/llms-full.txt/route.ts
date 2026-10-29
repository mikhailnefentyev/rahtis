import { llmsFullTxt } from '@/lib/llms';

/** /llms-full.txt — полная справка о RAHTIS: модули, цены, вопросы-ответы (lib/llms.ts). */
export const dynamic = 'force-static';

export function GET() {
  return new Response(llmsFullTxt(), {
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' },
  });
}
