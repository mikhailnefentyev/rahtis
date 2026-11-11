'use client';

import { createContext, useContext } from 'react';

/**
 * Закрыта ли новая работа экспедитора до документов (11.11.2026) — для
 * кнопок в глубине кабинета: выбрать отклик, отдать машине, запросить
 * место. Ставит раскладка кабинета заказчика; вне её — открыто. Запрет
 * в базе, здесь только то, что видно глазами.
 */
const DocsBlockedContext = createContext(false);

export function DocsGateProvider({ blocked, children }: { blocked: boolean; children: React.ReactNode }) {
  return <DocsBlockedContext.Provider value={blocked}>{children}</DocsBlockedContext.Provider>;
}

export function useDocsBlocked(): boolean {
  return useContext(DocsBlockedContext);
}
