import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
	const { pathname } = request.nextUrl;

	// Skip middleware for static files, API routes, and the landing page
	if (
		pathname.startsWith("/_next") ||
		pathname.startsWith("/api") ||
		pathname.startsWith("/favicon") ||
		pathname === "/" ||
		pathname.startsWith("/public") ||
		pathname.includes(".") // Skip files with extensions
	) {
		return NextResponse.next();
	}

	// Check if the route is protected (under route-group)
	const isProtectedRoute =
		pathname.startsWith("/create") ||
		pathname.startsWith("/chat") ||
		pathname.startsWith("/add-funds") ||
		pathname.startsWith("/history") ||
		pathname.startsWith("/marketplace") ||
		pathname.startsWith("/user-agents");

	if (!isProtectedRoute) {
		return NextResponse.next();
	}

	// Get API key and wallet address from cookies
	const apiKeyCookie = request.cookies.get("skynet_api_key");
	const walletAddressCookie = request.cookies.get("wallet_address");

	// Check if API key exists and is valid
	const hasValidApiKey =
		apiKeyCookie &&
		apiKeyCookie.value &&
		apiKeyCookie.value !== "null" &&
		apiKeyCookie.value !== "undefined" &&
		apiKeyCookie.value.length > 0;

	const hasWalletAddress =
		walletAddressCookie &&
		walletAddressCookie.value &&
		walletAddressCookie.value !== "null" &&
		walletAddressCookie.value !== "undefined" &&
		walletAddressCookie.value.length > 0;

	// If no valid API key or wallet address, redirect to home page
	if (!hasValidApiKey || !hasWalletAddress) {
		console.log(
			"🔒 Middleware: No valid API key or wallet address found, redirecting to home page",
			{
				pathname,
				hasValidApiKey,
				hasWalletAddress,
				apiKeyValue: apiKeyCookie?.value ? "present" : "missing",
				walletValue: walletAddressCookie?.value ? "present" : "missing",
			}
		);

		const redirectUrl = new URL("/", request.url);
		redirectUrl.searchParams.set("redirect", pathname);
		return NextResponse.redirect(redirectUrl);
	}

	return NextResponse.next();
}

export const config = {
	matcher: [
		/*
		 * Match all request paths except for the ones starting with:
		 * - api (API routes)
		 * - _next/static (static files)
		 * - _next/image (image optimization files)
		 * - favicon.ico (favicon file)
		 * - public (public files)
		 */
		"/((?!api|_next/static|_next/image|favicon.ico|public).*)",
	],
};
