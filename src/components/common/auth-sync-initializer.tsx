"use client";

import { useEffect } from "react";
import { authSync } from "@/utils/auth-sync";

/**
 * Component to initialize auth sync functionality
 * This runs on the client side to set up auth state synchronization
 */
export default function AuthSyncInitializer() {
	useEffect(() => {
		// Initialize auth sync
		authSync.startListening();

		// Initial sync
		authSync.syncAuthToCookies();

		console.log("🔄 AuthSyncInitializer: Auth sync initialized");
	}, []);

	// This component doesn't render anything
	return null;
}
