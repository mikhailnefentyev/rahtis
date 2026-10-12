import { readFlash } from '@/lib/forms/flash';
import { FlashToast } from './FlashToast';

/** Одноразовое сообщение об отказе действия — см. lib/forms/flash.ts. */
export async function FlashNotice() {
  const flash = await readFlash();
  if (!flash) return null;
  return <FlashToast key={flash.id} message={flash.message} />;
}
