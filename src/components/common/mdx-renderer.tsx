"use client";

import React from "react";
import { MDXRemote, MDXRemoteSerializeResult } from "next-mdx-remote";
import { serialize } from "next-mdx-remote/serialize";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import { useState, useEffect } from "react";

// Function to detect and convert URLs to clickable links
// This function automatically detects URLs in text content and converts them to clickable links
// It handles both http and https URLs and ensures they open in new tabs
function convertUrlsToLinks(text: string): React.ReactNode {
	if (!text || typeof text !== "string") return text;

	// URL regex pattern to match http/https URLs
	// Matches URLs that start with http:// or https:// and continue until whitespace or end of string
	const urlRegex = /(https?:\/\/[^\s]+)/g;
	const parts = text.split(urlRegex);

	return parts.map((part, index) => {
		if (urlRegex.test(part)) {
			return (
				<a
					key={index}
					href={part}
					target="_blank"
					rel="noopener noreferrer"
					className="text-blue-400 hover:text-blue-300 underline transition-colors"
				>
					{part}
				</a>
			);
		}
		return part;
	});
}

// Custom components for MDX rendering
const components = {
	// Headings
	h1: ({ children, ...props }: any) => (
		<h1
			className="text-xl font-semibold text-white mb-4 mt-6 first:mt-0"
			{...props}
		>
			{children}
		</h1>
	),
	h2: ({ children, ...props }: any) => (
		<h2
			className="text-xl font-semibold text-white mb-3 mt-5 first:mt-0"
			{...props}
		>
			{children}
		</h2>
	),
	h3: ({ children, ...props }: any) => (
		<h3
			className="text-lg font-semibold text-white mb-2 mt-4 first:mt-0"
			{...props}
		>
			{children}
		</h3>
	),
	h4: ({ children, ...props }: any) => (
		<h4
			className="text-base font-semibold text-white mb-2 mt-3 first:mt-0"
			{...props}
		>
			{children}
		</h4>
	),
	h5: ({ children, ...props }: any) => (
		<h5
			className="text-sm font-semibold text-white mb-2 mt-3 first:mt-0"
			{...props}
		>
			{children}
		</h5>
	),
	h6: ({ children, ...props }: any) => (
		<h6
			className="text-xs font-semibold text-white mb-2 mt-3 first:mt-0"
			{...props}
		>
			{children}
		</h6>
	),

	// Paragraphs - now with URL detection
	p: ({ children, ...props }: any) => (
		<p className="text-gray-200 mb-4 leading-relaxed" {...props}>
			{typeof children === "string"
				? convertUrlsToLinks(children)
				: children}
		</p>
	),

	// Lists
	ul: ({ children, ...props }: any) => (
		<ul className="text-gray-200 mb-4" {...props}>
			{children}
		</ul>
	),
	ol: ({ children, ...props }: any) => (
		<ol className="text-gray-200 mb-4" {...props}>
			{children}
		</ol>
	),
	li: ({ children, ...props }: any) => (
		<li className="text-gray-200" {...props}>
			{typeof children === "string"
				? convertUrlsToLinks(children)
				: children}
		</li>
	),

	// Links - now properly using href
	a: ({ children, href, ...props }: any) => (
		<a
			href={href}
			className="text-blue-400 hover:text-blue-300 underline transition-colors"
			target="_blank"
			rel="noopener noreferrer"
			{...props}
		>
			{children}
		</a>
	),

	// Code blocks and inline code
	code: ({ children, className, ...props }: any) => {
		const isInline = !className;

		if (isInline) {
			return (
				<code
					className="bg-gray-800 text-gray-200 px-2 py-1 rounded text-sm font-mono"
					{...props}
				>
					{children}
				</code>
			);
		}

		return (
			<code className={className} {...props}>
				{children}
			</code>
		);
	},

	pre: ({ children, ...props }: any) => (
		<pre
			className="bg-gray-900 border border-gray-700 rounded-lg p-4 mb-4 overflow-x-auto"
			{...props}
		>
			{children}
		</pre>
	),

	// Blockquotes
	blockquote: ({ children, ...props }: any) => (
		<blockquote
			className="border-l-4 border-blue-500 pl-4 py-2 mb-4 bg-gray-800/50 rounded-r-lg"
			{...props}
		>
			<div className="text-gray-300 italic">{children}</div>
		</blockquote>
	),

	// Tables
	table: ({ children, ...props }: any) => (
		<div className="overflow-x-auto mb-4">
			<table
				className="min-w-full border-collapse border border-gray-600"
				{...props}
			>
				{children}
			</table>
		</div>
	),
	thead: ({ children, ...props }: any) => (
		<thead className="bg-gray-800" {...props}>
			{children}
		</thead>
	),
	tbody: ({ children, ...props }: any) => (
		<tbody {...props}>{children}</tbody>
	),
	tr: ({ children, ...props }: any) => (
		<tr className="border-b border-gray-600" {...props}>
			{children}
		</tr>
	),
	th: ({ children, ...props }: any) => (
		<th
			className="border border-gray-600 px-4 py-2 text-left text-white font-semibold"
			{...props}
		>
			{children}
		</th>
	),
	td: ({ children, ...props }: any) => (
		<td
			className="border border-gray-600 px-4 py-2 text-gray-200"
			{...props}
		>
			{children}
		</td>
	),

	// Horizontal rule
	hr: ({ ...props }: any) => (
		<hr className="border-gray-600 my-6" {...props} />
	),

	// Strong and emphasis
	strong: ({ children, ...props }: any) => (
		<strong className="font-bold text-white" {...props}>
			{children}
		</strong>
	),
	em: ({ children, ...props }: any) => (
		<em className="italic text-gray-200" {...props}>
			{children}
		</em>
	),

	// Images
	img: ({ src, alt, ...props }: any) => (
		<img
			src={src}
			alt={alt}
			className="max-w-full h-auto rounded-lg border border-gray-600 mb-4"
			{...props}
		/>
	),
};

interface MDXRendererProps {
	content: string;
	className?: string;
}

export function MDXRenderer({ content, className = "" }: MDXRendererProps) {
	const [mdxSource, setMdxSource] = useState<MDXRemoteSerializeResult | null>(
		null
	);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const serializeMDX = async () => {
			try {
				setIsLoading(true);
				setError(null);

				// Clean up the content by replacing escaped newlines with actual newlines
				const cleanedContent = content
					.replace(/\\n/g, "\n")
					.replace(/\\t/g, "\t")
					.replace(/\\r/g, "\r")
					// Convert the specific format to proper markdown
					.replace(/\*\*Key Points:\*\*/g, "# Key Points")
					.replace(/(\d+\.\s+\*\*.*?\*\*:)/g, "\n## $1")
					.replace(/(\n\s*-\s+)/g, "\n$1")
					.trim();

				console.log("Original content:", content);
				console.log("Cleaned content:", cleanedContent);

				const serialized = await serialize(cleanedContent, {
					mdxOptions: {
						remarkPlugins: [remarkGfm],
						rehypePlugins: [
							rehypeHighlight,
							rehypeSlug,
							[rehypeAutolinkHeadings, { behavior: "wrap" }],
						],
					},
				});

				setMdxSource(serialized);
			} catch (err) {
				console.error("Error serializing MDX:", err);
				setError("Failed to render markdown content");
			} finally {
				setIsLoading(false);
			}
		};

		if (content) {
			serializeMDX();
		} else {
			setIsLoading(false);
		}
	}, [content]);

	if (isLoading) {
		return (
			<div className={`animate-pulse ${className}`}>
				<div className="h-4 bg-gray-700 rounded mb-2"></div>
				<div className="h-4 bg-gray-700 rounded mb-2 w-3/4"></div>
				<div className="h-4 bg-gray-700 rounded mb-2 w-1/2"></div>
			</div>
		);
	}

	if (error) {
		return (
			<div
				className={`text-red-400 p-3 bg-red-900/20 border border-red-800 rounded-lg ${className}`}
			>
				<p>{error}</p>
				<details className="mt-2">
					<summary className="cursor-pointer text-sm text-red-300">
						Show raw content
					</summary>
					<pre className="mt-2 text-xs bg-red-900/30 p-2 rounded overflow-x-auto">
						{convertUrlsToLinks(content)}
					</pre>
				</details>
			</div>
		);
	}

	if (!mdxSource) {
		// Fallback: if MDX parsing fails, try to render as basic markdown with URL detection
		const cleanedContent = content
			.replace(/\\n/g, "\n")
			.replace(/\\t/g, "\t")
			.replace(/\\r/g, "\r");

		return (
			<div className={`text-gray-200 ${className}`}>
				<div className="whitespace-pre-wrap break-words overflow-hidden">
					{convertUrlsToLinks(cleanedContent)}
				</div>
			</div>
		);
	}

	return (
		<div className={`mdx-content ${className}`}>
			<MDXRemote {...mdxSource} components={components} />
		</div>
	);
}

// Simple function to check if content looks like markdown
export function isMarkdownContent(content: string): boolean {
	if (!content || typeof content !== "string") return false;

	// Clean up escaped characters for better detection
	const cleanedContent = content
		.replace(/\\n/g, "\n")
		.replace(/\\t/g, "\t")
		.replace(/\\r/g, "\r");

	// Check for common markdown patterns
	const markdownPatterns = [
		/^#{1,6}\s+/m, // Headers
		/^\*\*.*\*\*$/m, // Bold
		/^\*.*\*$/m, // Italic
		/^\- /m, // Unordered list
		/^\d+\. /m, // Ordered list
		/^> /m, // Blockquote
		/```[\s\S]*?```/, // Code blocks
		/`[^`]+`/, // Inline code
		/\[.*?\]\(.*?\)/, // Links
		/!\[.*?\]\(.*?\)/, // Images
		/\|.*\|.*\|/, // Tables
		/\\n.*\\n/m, // Multiple escaped newlines (indicates structured content)
		/^\d+\.\s+\*\*.*\*\*:/m, // Numbered lists with bold headers
	];

	// Special case: if content contains escaped newlines and bold text, treat as markdown
	if (cleanedContent.includes("\n") && cleanedContent.includes("**")) {
		return true;
	}

	return markdownPatterns.some((pattern) => pattern.test(cleanedContent));
}
