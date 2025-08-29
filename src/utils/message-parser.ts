import { AgentResponse } from "@/types/chat";

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

		if (parsed?.contentType) {
			const contentType = parsed.contentType.toLowerCase();

			if (contentType.startsWith("image/")) {
				let imageData = "";

				if (parsed?.fileData && typeof parsed.fileData === "string") {
					imageData = parsed.fileData;
				} else if (parsed?.data && typeof parsed.data === "string") {
					imageData = parsed.data;
				}

				if (imageData) {
					return {
						content: `${contentType
							.split("/")[1]
							.toUpperCase()} image generated successfully`,
						imageData: imageData,
						isImage: true,
						contentType: contentType,
					};
				}
			} else if (
				contentType.startsWith("application/") ||
				contentType.startsWith("text/")
			) {
				let fileData = "";

				if (parsed?.fileData && typeof parsed.fileData === "string") {
					fileData = parsed.fileData;
				} else if (parsed?.data && typeof parsed.data === "string") {
					fileData = parsed.data;
				}

				if (fileData) {
					return {
						content: `${contentType} file generated successfully`,
						imageData: fileData,
						isImage: false,
						contentType: contentType,
					};
				}
			}
		}

		if (
			parsed?.data &&
			typeof parsed.data === "string" &&
			parsed.data.startsWith("/9j/")
		) {
			return {
				content: "JPEG image generated successfully",
				imageData: parsed.data,
				isImage: true,
				contentType: "image/jpeg",
			};
		}

		if (parsed?.fileData && typeof parsed.fileData === "string") {
			if (parsed.fileData.startsWith("/9j/")) {
				return {
					content: "JPEG image generated successfully",
					imageData: parsed.fileData,
					isImage: true,
					contentType: "image/jpeg",
				};
			} else if (parsed.fileData.startsWith("data:image/")) {
				const mimeType =
					parsed.fileData.match(/data:(.*?);/)?.[1] || "image/jpeg";
				return {
					content: `${mimeType
						.split("/")[1]
						.toUpperCase()} image generated successfully`,
					imageData: parsed.fileData,
					isImage: true,
					contentType: mimeType,
				};
			}
		}

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
		return { content: null };
	} catch {
		return { content: null };
	}
};
