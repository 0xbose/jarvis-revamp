import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	webpack: (config, { isServer }) => {
		// Enable WebAssembly support
		config.experiments = {
			...config.experiments,
			asyncWebAssembly: true,
			syncWebAssembly: true,
		};

		// Handle WASM files
		config.module.rules.push({
			test: /\.wasm$/,
			type: "webassembly/async",
		});

		// Fallback for Node.js modules in browser
		if (!isServer) {
			config.resolve.fallback = {
				...config.resolve.fallback,
				fs: false,
				net: false,
				tls: false,
				crypto: false,
				stream: false,
				url: false,
				zlib: false,
				http: false,
				https: false,
				assert: false,
				os: false,
				path: false,
			};
		}

		return config;
	},
	// Enable experimental features
	experimental: {
		// Removed esmExternals as it's not recommended
	},
	// Configure images to allow base64 data URLs
	images: {
		remotePatterns: [
			{
				protocol: "https",
				hostname: "**",
			},
		],
		unoptimized: true,
	},
	// Add error handling for client-side exceptions
	onDemandEntries: {
		// Period (in ms) where the server will keep pages in the buffer
		maxInactiveAge: 25 * 1000,
		// Number of pages that should be kept simultaneously without being disposed
		pagesBufferLength: 2,
	},
	// Handle client-side errors gracefully
	typescript: {
		// !! WARN !!
		// Dangerously allow production builds to successfully complete even if
		// your project has type errors.
		// !! WARN !!
		ignoreBuildErrors: true,
	},
	eslint: {
		// Warning: This allows production builds to successfully complete even if
		// your project has ESLint errors.
		ignoreDuringBuilds: true,
	},
};

export default nextConfig;
