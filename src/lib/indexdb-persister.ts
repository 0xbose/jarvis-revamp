import { get, set, del } from 'idb-keyval';
import { PersistedClient, Persister } from '@tanstack/react-query-persist-client';

export function createIDBPersister(idbValidKey: string = 'jarvis-query-cache'): Persister {
  return {
    persistClient: async (client: PersistedClient) => {
      await set(idbValidKey, client);
    },
    restoreClient: async (): Promise<PersistedClient | undefined> => {
      return await get(idbValidKey);
    },
    removeClient: async () => {
      await del(idbValidKey);
    },
  };
}
