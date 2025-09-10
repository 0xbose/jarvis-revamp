import { get, set, del } from "idb-keyval";
import {
	PersistedClient,
	Persister,
} from "@tanstack/react-query-persist-client";

// Helper function to serialize non-cloneable objects
function serializeForIndexedDB(obj: any): any {
	if (obj === null || obj === undefined) {
		return obj;
	}

	if (obj instanceof Map) {
		return {
			__type: "Map",
			entries: Array.from(obj.entries()),
		};
	}

	if (obj instanceof Set) {
		return {
			__type: "Set",
			values: Array.from(obj.values()),
		};
	}

	if (obj instanceof Date) {
		return {
			__type: "Date",
			value: obj.toISOString(),
		};
	}

	if (obj instanceof RegExp) {
		return {
			__type: "RegExp",
			source: obj.source,
			flags: obj.flags,
		};
	}

	if (typeof obj === "function") {
		return {
			__type: "Function",
			name: obj.name || "anonymous",
		};
	}

	if (typeof obj === "object") {
		if (Array.isArray(obj)) {
			return obj.map(serializeForIndexedDB);
		}

		const serialized: any = {};
		for (const [key, value] of Object.entries(obj)) {
			serialized[key] = serializeForIndexedDB(value);
		}
		return serialized;
	}

	return obj;
}

// Helper function to deserialize objects back to their original types
function deserializeFromIndexedDB(obj: any): any {
	if (obj === null || obj === undefined) {
		return obj;
	}

	if (typeof obj === "object" && obj.__type) {
		switch (obj.__type) {
			case "Map":
				return new Map(obj.entries);
			case "Set":
				return new Set(obj.values);
			case "Date":
				return new Date(obj.value);
			case "RegExp":
				return new RegExp(obj.source, obj.flags);
			case "Function":
				// Functions can't be fully restored, return a placeholder
				return () =>
					console.warn("Function was not restored from persistence");
			default:
				return obj;
		}
	}

	if (typeof obj === "object") {
		if (Array.isArray(obj)) {
			return obj.map(deserializeFromIndexedDB);
		}

		const deserialized: any = {};
		for (const [key, value] of Object.entries(obj)) {
			deserialized[key] = deserializeFromIndexedDB(value);
		}
		return deserialized;
	}

	return obj;
}

export function createIDBPersister(
	idbValidKey: string = "jarvis-query-cache"
): Persister {
	return {
		persistClient: async (client: PersistedClient) => {
			try {
				const serializedClient = serializeForIndexedDB(client);
				await set(idbValidKey, serializedClient);
			} catch (error) {
				console.error("Failed to persist client to IndexedDB:", error);
				// If serialization fails, try to persist a minimal version
				const minimalClient = {
					...client,
					clientState: {
						...client.clientState,
						queries: client.clientState.queries.map((query) => ({
							...query,
							state: {
								...query.state,
								data: query.state.data
									? "Data removed due to serialization error"
									: query.state.data,
							},
						})),
					},
				};
				await set(idbValidKey, minimalClient);
			}
		},
		restoreClient: async (): Promise<PersistedClient | undefined> => {
			try {
				const serializedClient = await get(idbValidKey);
				if (!serializedClient) return undefined;
				return deserializeFromIndexedDB(serializedClient);
			} catch (error) {
				console.error(
					"Failed to restore client from IndexedDB:",
					error
				);
				return undefined;
			}
		},
		removeClient: async () => {
			await del(idbValidKey);
		},
	};
}
