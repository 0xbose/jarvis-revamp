/* eslint-disable */

import { AgentResponse } from "@/types/chat";

// Helper function to check if URL needs proxying
const needsProxying = (url: string): boolean => {
	if (typeof window === "undefined") {
		// Server-side: check if it's an external domain that needs proxying
		try {
			const urlObj = new URL(url);
			const externalDomains = [
				"redisagent-c0n639.stackos.io",
				"stackos.io",
			];
			return externalDomains.some(
				(domain) =>
					urlObj.hostname === domain ||
					urlObj.hostname.endsWith(`.${domain}`)
			);
		} catch {
			return false;
		}
	} else {
		// Client-side: check if it's external to current origin
		return url.startsWith("http") && !url.includes(window.location.origin);
	}
};

export const createContentHash = (data: any): string => {
	if (!data) return "";
	const content = JSON.stringify({
		content: data.content,
		imageData: data.imageData,
		contentType: data.contentType,
	});
	return content;
};

export const parseAgentResponse = (subnetData: string): AgentResponse => {
	try {
		const parsed = JSON.parse(subnetData);

		// Handle fileUrl format (imagegen, etc.)
		if (parsed?.fileUrl && typeof parsed.fileUrl === "string") {
			const contentType = parsed.contentType || "image/jpeg";

			let imageUrl = parsed.fileUrl;

			// Check if this is an external URL that needs proxying
			if (needsProxying(imageUrl)) {
				// Use our proxy API to bypass CORS issues
				imageUrl = `/api/image/proxy?url=${encodeURIComponent(
					imageUrl
				)}`;
			}

			if (contentType.startsWith("image/")) {
				return {
					content: `${contentType
						.split("/")[1]
						.toUpperCase()} image generated successfully`,
					imageData: imageUrl,
					isImage: true,
					contentType: contentType,
				};
			} else {
				return {
					content: `${contentType} file generated successfully`,
					imageData: imageUrl,
					isImage: false,
					contentType: contentType,
				};
			}
		}

		if (
			parsed?.data?.data?.ipfsLinks &&
			typeof parsed.data.data.ipfsLinks === "string"
		) {
			// Extract the message content from IPFS response
			const message =
				parsed.data?.message || "File uploaded to IPFS successfully";
			return {
				content: message,
			};
		}

		// Handle text responses - check multiple possible structures
		if (parsed?.data?.data?.choices?.[0]?.message?.content) {
			return { content: parsed.data.data.choices[0].message.content };
		}
		if (parsed?.data?.choices?.[0]?.message?.content) {
			return { content: parsed.data.choices[0].message.content };
		}
		if (parsed?.data?.data?.message) {
			return { content: parsed.data.data.message };
		}
		if (parsed?.data?.message) {
			return { content: parsed.data.message };
		}
		if (parsed?.message) {
			return { content: parsed.message };
		}

		// Handle case where data is a string that contains the message
		if (typeof parsed?.data === "string") {
			try {
				const nestedData = JSON.parse(parsed.data);
				if (nestedData?.message) {
					return { content: nestedData.message };
				}
				if (nestedData?.data?.message) {
					return { content: nestedData.data.message };
				}
			} catch {
				// If parsing fails, treat the string as content
				return { content: parsed.data };
			}
		}

		return { content: null };
	} catch {
		return { content: null };
	}
};
