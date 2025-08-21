"use client";
import { createContext, useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Address } from "viem";
import { useWeb3Auth } from "@/providers/Web3AuthProvider";
import { Web3RPC } from "@/utils/rpc/web3RPC";

export interface IWeb3State {
	address: string;
	isAuthenticated: boolean;
}

export enum CONNECT_STATES {
	INITIALIZING = "INITIALIZING",
	IDLE = "IDLE",
	CONNECTING = "CONNECTING",
	CONNECTED = "CONNECTED",
	ERROR = "ERROR",
	DISCONNECTING = "DISCONNECTING",
}

export enum CONNECT_ERROR {
	NO_WALLET,
	UNALLOWED_CHAIN,
	MISC,
}

interface IWeb3ContextConnected extends IWeb3State {
	status: CONNECT_STATES.CONNECTED;
	address: Address;
	isAuthenticated: boolean;
	login: () => Promise<void>;
	logout: () => Promise<void>;
}

export type IWeb3Context =
	| {
			status: CONNECT_STATES.INITIALIZING;
			isAuthenticated: false;
			login: () => Promise<void>;
			logout: () => Promise<void>;
	  }
	| {
			status: CONNECT_STATES.IDLE | CONNECT_STATES.CONNECTING;
			isAuthenticated: boolean;
			login: () => Promise<void>;
			logout: () => Promise<void>;
	  }
	| IWeb3ContextConnected
	| {
			status: CONNECT_STATES.DISCONNECTING | CONNECT_STATES.ERROR;
			isAuthenticated: boolean;
			type?: CONNECT_ERROR;
			message?: string;
			login: () => Promise<void>;
			logout: () => Promise<void>;
	  };

export const Web3Context = createContext<IWeb3Context>({
	status: CONNECT_STATES.INITIALIZING,
	isAuthenticated: false,
	login: () => Promise.resolve(),
	logout: () => Promise.resolve(),
});

export function isConnectedState(
	state: IWeb3Context
): state is IWeb3ContextConnected {
	return state.status === CONNECT_STATES.CONNECTED;
}

const Web3ContextProvider = ({ children }: { children: React.ReactNode }) => {
	const router = useRouter();
	const { provider, logout: web3Logout, connect: web3Login } = useWeb3Auth();

	// Create a ref for the functions to avoid circular dependency
	const loginRef = useRef(async () => {});
	const logoutRef = useRef(async () => {});

	const [connectState, setConnectState] = useState<IWeb3Context>({
		status: CONNECT_STATES.INITIALIZING,
		isAuthenticated: false,
		login: async () => loginRef.current(),
		logout: async () => logoutRef.current(),
	});

	// Define the actual functions
	loginRef.current = async () => {
		if (connectState.status === CONNECT_STATES.CONNECTING) return;

		setConnectState((prev) => ({
			...prev,
			status: CONNECT_STATES.CONNECTING,
			isAuthenticated: false,
		}));

		try {
			await web3Login();
			if (!provider) throw new Error("Provider not initialized");

			const web3RPC = new Web3RPC(provider);
			const address = (await web3RPC.getAccounts()) as Address;

			setConnectState((prev) => ({
				...prev,
				status: CONNECT_STATES.CONNECTED,
				address,
				isAuthenticated: true,
			}));
		} catch (err: unknown) {
			const error = err as Error;
			setConnectState((prev) => ({
				...prev,
				status: CONNECT_STATES.ERROR,
				type: CONNECT_ERROR.MISC,
				message: error.message,
				isAuthenticated: false,
			}));
		}
	};

	logoutRef.current = async () => {
		if (connectState.status !== CONNECT_STATES.CONNECTED) return;

		setConnectState((prev) => ({
			...prev,
			status: CONNECT_STATES.DISCONNECTING,
			isAuthenticated: false,
		}));

		try {
			await web3Logout();
			setConnectState((prev) => ({
				...prev,
				status: CONNECT_STATES.IDLE,
				isAuthenticated: false,
			}));
			router.push("/");
		} catch (error) {
			console.error("Logout failed:", error);
			setConnectState((prev) => ({
				...prev,
				status: CONNECT_STATES.ERROR,
				isAuthenticated: false,
			}));
		}
	};

	useEffect(() => {
		if (!provider) {
			setConnectState({
				status: CONNECT_STATES.IDLE,
				isAuthenticated: false,
				login: async () => loginRef.current(),
				logout: async () => logoutRef.current(),
			});
			return;
		}

		const initializeUser = async () => {
			try {
				const web3RPC = new Web3RPC(provider);
				const address = (await web3RPC.getAccounts()) as Address;
				setConnectState({
					status: CONNECT_STATES.CONNECTED,
					address,
					isAuthenticated: true,
					login: async () => loginRef.current(),
					logout: async () => logoutRef.current(),
				});
			} catch (error) {
				console.error("Failed to initialize user:", error);
			}
		};

		initializeUser();
	}, [provider]);

	return (
		<Web3Context.Provider value={connectState}>
			{children}
		</Web3Context.Provider>
	);
};

export default Web3ContextProvider;
