# Skynet Agent Workflow 

A complete Next.js 15 boilerplate for building agent workflow applications with Web3 integration, HTTP-based workflow execution, and Skynet blockchain integration.

## 🚀 Features

-   **Next.js 15** with TypeScript and App Router
-   **Web3 Integration** with Web3Auth for wallet connections
-   **Skynet Blockchain** integration with NFT-based access
-   **HTTP-based Workflow Execution** with polling for status updates
-   **Real-time Agent Generation** using Socket.IO
-   **Modern UI** with Tailwind CSS and Radix UI components
-   **State Management** with Zustand stores
-   **API Key Management** with caching and automatic renewal
-   **TypeScript** with comprehensive type definitions

## 📋 Prerequisites

-   Node.js 18+
-   npm or yarn
-   Web3Auth account (for wallet connections)
-   Skynet blockchain access

## 🛠️ Quick Start

### 1. Clone or Download

```bash
# Clone the repository
git clone <repository-url>
cd skynet-boilerplate

# Or download and extract the ZIP file
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Configuration

Copy the environment example file and configure your settings:

```bash
cp env.example .env.local
```

Edit `.env.local` with your configuration:

```bash
# API Configuration
NEXT_PUBLIC_API_BASE_URL=https://your-api-url.com
NEXT_PUBLIC_NFT_USER_AGENT_URL=https://nft-user-agent-url.com
NEXT_PUBLIC_REDIS_USER_AGENT_URL=https://redis-user-agent-url.com

# Skynet Configuration
NEXT_PUBLIC_STORAGE_API_URL=https://your-storage-url.com
NEXT_PUBLIC_SKYINTEL_API_URL=https://your-skyintel-url.com

# Web3Auth Configuration
NEXT_PUBLIC_WEB3AUTH_CLIENT_ID=your-web3auth-client-id

# Network Configuration
NEXT_PUBLIC_RPC_URL=https://rpc.skynet.io
NEXT_PUBLIC_EXPLORER_URL=https://explorer.skynet.io
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## 📁 Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── layout.tsx         # Root layout with providers
│   ├── page.tsx           # Main dashboard
│   ├── agents/            # Agent pages
│   └── globals.css        # Global styles
├── components/            # React components
│   ├── ui/               # Reusable UI components
│   ├── nft/              # NFT-related components
│   └── wallet/           # Wallet components
├── config/               # Configuration files
├── controllers/          # API controllers
├── hooks/               # Custom React hooks
├── lib/                 # Utility libraries
├── providers/           # Context providers
├── stores/              # Zustand stores
├── types/               # TypeScript definitions
└── utils/               # Business logic utilities
```

## 🔧 Core Components

### 1. Web3Auth Integration

The boilerplate includes Web3Auth for secure wallet connections:

```typescript
// src/providers/Web3AuthProvider.tsx
import { Web3AuthProvider } from "@/providers/Web3AuthProvider";

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<html lang="en">
			<body>
				<Web3AuthProvider>{children}</Web3AuthProvider>
			</body>
		</html>
	);
}
```

### 2. API Key Management

Automatic API key generation and caching:

```typescript
// src/utils/api-key-manager.ts
import { apiKeyManager } from "@/utils/api-key-manager";

const apiKey = await apiKeyManager.getApiKey(skyBrowser, web3Context);
```

### 3. Workflow Execution

HTTP-based workflow execution with polling:

```typescript
// src/utils/workflow-executor.ts
import { workflowExecutor } from "@/utils/workflow-executor";

const requestId = await workflowExecutor.executeWorkflow(
	payload,
	skyBrowser,
	web3Context
);
```

### 4. State Management

Zustand stores for global state:

```typescript
// src/stores/index.ts
import { useAgentStore } from "@/stores/agent-store";
import { useExecutionStatusStore } from "@/stores/execution-status-store";
import { useUIStore } from "@/stores/ui-store";
```

## 🎨 UI Components

The boilerplate includes a complete set of UI components:

-   **Button**: Multiple variants and sizes
-   **Input**: Form inputs with validation
-   **Label**: Accessible form labels
-   **Textarea**: Multi-line text inputs
-   **Toast**: Notification system with Sonner

## 🔌 Available Scripts

```bash
# Development
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
```

## 🌐 Environment Variables

| Variable                           | Description                 | Required |
| ---------------------------------- | --------------------------- | -------- |
| `NEXT_PUBLIC_API_BASE_URL`         | Base URL for API endpoints  | Yes      |
| `NEXT_PUBLIC_NFT_USER_AGENT_URL`   | NFT user agent endpoint     | Yes      |
| `NEXT_PUBLIC_REDIS_USER_AGENT_URL` | Redis user agent endpoint   | Yes      |
| `NEXT_PUBLIC_STORAGE_API_URL`      | Skynet storage API URL      | Yes      |
| `NEXT_PUBLIC_SKYINTEL_API_URL`     | Skynet intelligence API URL | Yes      |
| `NEXT_PUBLIC_WEB3AUTH_CLIENT_ID`   | Web3Auth client ID          | Yes      |
| `NEXT_PUBLIC_RPC_URL`              | Skynet RPC URL              | Yes      |
| `NEXT_PUBLIC_EXPLORER_URL`         | Skynet explorer URL         | Yes      |

## 🔑 Key Features

### 1. Agent Management

-   List and view agents
-   Select and execute agents
-   Agent workflow execution

### 2. NFT Integration

-   NFT minting and management
-   NFT-based access control
-   Collection management

### 3. Workflow Execution

-   HTTP-based execution
-   Real-time status polling
-   Full workflow execution

### 4. Web3 Integration

-   Multi-wallet support
-   Secure authentication
-   Blockchain interactions

## 🚀 Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy automatically

### Other Platforms

```bash
# Build the application
npm run build

# Start production server
npm run start
```

## 🔧 Customization

### Adding New Components

1. Create component in `src/components/`
2. Add to UI library if reusable
3. Import and use in pages

### Adding New API Endpoints

1. Add endpoint in `src/controllers/`
2. Update types in `src/types/`
3. Use in components or hooks

### Adding New Stores

1. Create store in `src/stores/`
2. Export from `src/stores/index.ts`
3. Use in components

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:

-   Create an issue in the repository
-   Check the documentation
-   Review the code examples

## 🔄 Updates

To update the boilerplate:

```bash
# Pull latest changes
git pull origin main

# Install new dependencies
npm install

# Check for breaking changes
npm run build
```

---

**Ready to build your Skynet agent workflow application?** 🚀

This boilerplate provides everything you need to get started with agent workflow development on the Skynet blockchain.
