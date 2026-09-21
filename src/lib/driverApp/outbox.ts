/**
 * Очередь действий водителя на телефоне (IndexedDB).
 *
 * Каждое действие — день, перерыв, прибытие, отметка точки, снимок,
 * подпись — сначала ложится сюда, а потом уходит на сервер. Без связи оно
 * ждёт и не теряется: IndexedDB переживает закрытие приложения и
 * перезагрузку телефона, в отличие от памяти страницы.
 *
 * Модуль без React: это хранилище, а когда и как отправлять, решает
 * OutboxProvider.
 */

export type OutboxKind = 'SHIFT' | 'ARRIVE' | 'COMPLETE' | 'UPLOAD';

export type OutboxEvent = {
  /** Идентификатор действия: по нему сервер отличает повтор от нового. */
  id: string;
  kind: OutboxKind;
  /** Поля формы для серверного действия. */
  fields: Record<string, string>;
  /** Файл снимка или подписи — у UPLOAD. */
  blob?: Blob;
  /** Момент нажатия. В учёт идёт он, а не время отправки. */
  pressedAt: string;
};

const DB = 'rahtis-driver';
const STORE = 'outbox';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const request = work(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export function putEvent(event: OutboxEvent): Promise<IDBValidKey> {
  return run('readwrite', (store) => store.put(event));
}

export function deleteEvent(id: string): Promise<undefined> {
  return run('readwrite', (store) => store.delete(id));
}

/** В порядке нажатия: отметки точек обязаны прийти по порядку. */
export async function allEvents(): Promise<OutboxEvent[]> {
  const events = await run<OutboxEvent[]>('readonly', (store) => store.getAll());
  return events.sort((a, b) => a.pressedAt.localeCompare(b.pressedAt));
}

/** При выходе: чужой вход на том же телефоне не должен отправить наше. */
export function clearEvents(): Promise<undefined> {
  return run('readwrite', (store) => store.clear());
}
