import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const imageUrl = searchParams.get("url");

		if (!imageUrl) {
			return NextResponse.json(
				{ error: "Missing image URL" },
				{ status: 400 }
			);
		}

		// Validate that the URL is from a trusted domain
		const allowedDomains = [
			"redisagent-c0n639.stackos.io",
			"stackos.io",
			// Add other trusted domains as needed
		];

		const url = new URL(imageUrl);
		const isAllowedDomain = allowedDomains.some(
			(domain) =>
				url.hostname === domain || url.hostname.endsWith(`.${domain}`)
		);

		if (!isAllowedDomain) {
			return NextResponse.json(
				{ error: "Domain not allowed" },
				{ status: 403 }
			);
		}

		// Fetch the image from the external URL
		const response = await fetch(imageUrl, {
			headers: {
				"User-Agent": "Mozilla/5.0 (compatible; ImageProxy/1.0)",
			},
		});

		if (!response.ok) {
			return NextResponse.json(
				{ error: "Failed to fetch image" },
				{ status: response.status }
			);
		}

		const imageBuffer = await response.arrayBuffer();
		const contentType =
			response.headers.get("content-type") || "image/jpeg";

		// Return the image with appropriate headers
		return new NextResponse(imageBuffer, {
			status: 200,
			headers: {
				"Content-Type": contentType,
				"Cache-Control": "public, max-age=31536000, immutable", // Cache for 1 year
				"Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Methods": "GET",
				"Access-Control-Allow-Headers": "Content-Type",
			},
		});
	} catch (error) {
		console.error("Image proxy error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
	}
}
