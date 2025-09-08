import type { NextConfig } from "next";
import createMDX from "@next/mdx";

const nextConfig: NextConfig = {
	// Enable standalone output for Docker
	output: "standalone",
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
		esmExternals: "loose",
	},
	images: {
		remotePatterns: [
			{
				protocol: "https",
				hostname: "**",
			},
		],
		unoptimized: true,
	},
	// Configure pageExtensions to include md and mdx files
	pageExtensions: ["js", "jsx", "md", "mdx", "ts", "tsx"],
};

// Merge MDX config with Next.js config
const withMDX = createMDX({
	// Add markdown plugins here, as desired
});

export default withMDX(nextConfig);
