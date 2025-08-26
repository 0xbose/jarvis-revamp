"use client";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { useState } from "react";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { createIDBPersister } from "@/lib/indexdb-persister";

const QueryProviderWrapper = ({ children }: { children: React.ReactNode }) => {
	const [client] = useState(
		new QueryClient({
			defaultOptions: {
				queries: {
					refetchOnWindowFocus: false,
					refetchOnMount: false,
					refetchOnReconnect: false,
					gcTime: 1000 * 60 * 60 * 168, // 7 days
				},
				mutations: {
					retry: 1,
				},
			},
		})
	);

	const [persister] = useState(() => createIDBPersister('jarvis-query-cache'));

	return (
		<PersistQueryClientProvider
			client={client}
			persistOptions={{ 
				persister,
				maxAge: 1000 * 60 * 60 * 168, // 7 days
			}}
		>
			{children}
			<ReactQueryDevtools />
		</PersistQueryClientProvider>
	);
};

export default QueryProviderWrapper;
