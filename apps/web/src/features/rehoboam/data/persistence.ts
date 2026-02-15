import type { WorldEvent } from "../engine/types";
import { runEventPipeline } from "./source";
import type { EventPipelineOptions } from "./source";

const DEFAULT_DATABASE_NAME = "rehoboam-v2";
const DEFAULT_OBJECT_STORE_NAME = "event-snapshots";
const DEFAULT_RECORD_KEY = "events";
const DEFAULT_DATABASE_VERSION = 1;

type PersistedEventsRecord = Readonly<{
  version: 1;
  savedAtMs: number;
  events: readonly unknown[];
}>;

type NormalizedIndexedDbStoreOptions = Readonly<{
  indexedDbFactory: IDBFactory | null;
  databaseName: string;
  objectStoreName: string;
  recordKey: string;
  databaseVersion: number;
}>;

export type EventPersistenceStore = Readonly<{
  read: () => Promise<unknown>;
  write: (value: unknown) => Promise<void>;
  clear: () => Promise<void>;
}>;

export type IndexedDbStoreOptions = Readonly<{
  indexedDbFactory?: IDBFactory | null;
  databaseName?: string;
  objectStoreName?: string;
  recordKey?: string;
  databaseVersion?: number;
}>;

export type EventPersistenceOptions = Readonly<{
  pipeline?: EventPipelineOptions;
  now?: () => number;
  store?: EventPersistenceStore;
  indexedDb?: IndexedDbStoreOptions;
}>;

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const getIndexedDbFactory = (
  options: IndexedDbStoreOptions
): IDBFactory | null => {
  if (options.indexedDbFactory !== undefined) {
    return options.indexedDbFactory;
  }

  if (typeof indexedDB === "undefined") {
    return null;
  }

  return indexedDB;
};

const normalizeIndexedDbStoreOptions = (
  options: IndexedDbStoreOptions = {}
): NormalizedIndexedDbStoreOptions => {
  return {
    indexedDbFactory: getIndexedDbFactory(options),
    databaseName: options.databaseName ?? DEFAULT_DATABASE_NAME,
    objectStoreName: options.objectStoreName ?? DEFAULT_OBJECT_STORE_NAME,
    recordKey: options.recordKey ?? DEFAULT_RECORD_KEY,
    databaseVersion: Math.max(
      1,
      Math.trunc(options.databaseVersion ?? DEFAULT_DATABASE_VERSION)
    ),
  };
};

const toRequestPromise = <T>(request: IDBRequest<T>): Promise<T> => {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => {
      reject(request.error ?? new Error("IndexedDB request failed"));
    };
  });
};

const toTransactionPromise = (transaction: IDBTransaction): Promise<void> => {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => {
      resolve();
    };
    transaction.onabort = () => {
      reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
    };
    transaction.onerror = () => {
      reject(transaction.error ?? new Error("IndexedDB transaction failed"));
    };
  });
};

const openDatabase = async (
  options: NormalizedIndexedDbStoreOptions
): Promise<IDBDatabase | null> => {
  if (options.indexedDbFactory === null) {
    return null;
  }

  try {
    const request = options.indexedDbFactory.open(
      options.databaseName,
      options.databaseVersion
    );
    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(options.objectStoreName)) {
        database.createObjectStore(options.objectStoreName);
      }
    };

    const database = await toRequestPromise(request);
    database.onversionchange = () => {
      database.close();
    };

    return database;
  } catch {
    return null;
  }
};

const withDatabase = async <T>(
  options: NormalizedIndexedDbStoreOptions,
  operation: (database: IDBDatabase) => Promise<T>
): Promise<T | undefined> => {
  const database = await openDatabase(options);

  if (database === null) {
    return undefined;
  }

  try {
    return await operation(database);
  } finally {
    database.close();
  }
};

export const createIndexedDbEventStore = (
  options: IndexedDbStoreOptions = {}
): EventPersistenceStore => {
  const normalized = normalizeIndexedDbStoreOptions(options);

  const read: EventPersistenceStore["read"] = async () => {
    const value: unknown = await withDatabase(normalized, async (database) => {
      const transaction = database.transaction(
        normalized.objectStoreName,
        "readonly"
      );
      const store = transaction.objectStore(normalized.objectStoreName);
      const request = store.get(normalized.recordKey) as IDBRequest<unknown>;
      const result = await toRequestPromise(request);
      await toTransactionPromise(transaction);

      return result;
    });

    return value;
  };

  const write: EventPersistenceStore["write"] = async (value) => {
    await withDatabase(normalized, async (database) => {
      const transaction = database.transaction(
        normalized.objectStoreName,
        "readwrite"
      );
      const store = transaction.objectStore(normalized.objectStoreName);
      const request = store.put(value, normalized.recordKey);
      await toRequestPromise(request);
      await toTransactionPromise(transaction);
    });
  };

  const clear: EventPersistenceStore["clear"] = async () => {
    await withDatabase(normalized, async (database) => {
      const transaction = database.transaction(
        normalized.objectStoreName,
        "readwrite"
      );
      const store = transaction.objectStore(normalized.objectStoreName);
      const request = store.delete(normalized.recordKey);
      await toRequestPromise(request);
      await toTransactionPromise(transaction);
    });
  };

  return {
    read,
    write,
    clear,
  };
};

const toPersistedEventPayload = (value: unknown): readonly unknown[] => {
  if (Array.isArray(value)) {
    return value.filter((item) => isRecord(item));
  }

  if (!isRecord(value)) {
    return [];
  }

  const maybeEvents = value.events;

  return Array.isArray(maybeEvents)
    ? maybeEvents.filter((item) => isRecord(item))
    : [];
};

const getNow = (): number => {
  return Date.now();
};

const resolveStore = (
  options: EventPersistenceOptions
): EventPersistenceStore => {
  return options.store ?? createIndexedDbEventStore(options.indexedDb);
};

const buildPersistedEventsRecord = (
  events: readonly WorldEvent[],
  now: () => number
): PersistedEventsRecord => {
  return {
    version: 1,
    savedAtMs: Math.trunc(now()),
    events,
  };
};

export const loadPersistedEvents = async (
  options: EventPersistenceOptions = {}
): Promise<readonly WorldEvent[]> => {
  try {
    const storedValue = await resolveStore(options).read();

    return runEventPipeline(
      toPersistedEventPayload(storedValue),
      options.pipeline
    );
  } catch {
    return [];
  }
};

export const savePersistedEvents = async (
  events: readonly WorldEvent[],
  options: EventPersistenceOptions = {}
): Promise<void> => {
  const pipelineSnapshot = runEventPipeline(events, options.pipeline);
  const persistedRecord = buildPersistedEventsRecord(
    pipelineSnapshot,
    options.now ?? getNow
  );

  try {
    await resolveStore(options).write(persistedRecord);
  } catch {
    // Persistence should never interrupt runtime rendering.
  }
};

export const clearPersistedEvents = async (
  options: EventPersistenceOptions = {}
): Promise<void> => {
  try {
    await resolveStore(options).clear();
  } catch {
    // Clearing persisted cache is best effort.
  }
};
