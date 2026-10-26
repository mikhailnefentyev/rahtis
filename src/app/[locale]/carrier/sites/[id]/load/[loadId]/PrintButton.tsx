'use client';

import { Button } from '@/components/ui';

export function PrintButton() {
  return (
    <Button size="sm" onClick={() => window.print()}>
      PDF / Tulosta
    </Button>
  );
}
