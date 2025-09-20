"use client";
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";
import {
	Clock,
	Activity,
	Settings,
	Zap,
	Copy,
	Rocket,
	X,
	AlertCircle,
} from "lucide-react";
import { getCollectionsByAddress } from "@/controllers/collections/collections.query";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { canMintAgent, mintAgentNFTWithHelper } from "@/utils/agent-minting";
import { useWallet } from "@/hooks/use-wallet";
import { createUserAgent } from "@/controllers/agents/agent.mutations";
import { useWeb3AuthSafe } from "@/providers/Web3AuthProvider";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ImageQuickSelect } from "@/components/common/image-select";
import { IMAGES } from "@/constants/images";
import { AgentImage } from "@/components/market-place/agent-image";
import { QUERY_KEYS } from "@/utils/query-keys";
import { MarketplaceLoaderSkeleton } from "@/components/market-place/loader-skeleton";

// Types
interface MintFormData {
	name: string;
	description: string;
	image: string;
}

const useAgentAddress = (params: any) => {
	return useMemo(() => {
		if (typeof params?.agentAddress === "string")
			return params.agentAddress;
		if (Array.isArray(params?.agentAddress)) return params.agentAddress[0];
		return "";
	}, [params?.agentAddress]);
};

const useAgentData = (agentAddress: string, skyBrowser: any, web3Auth: any) => {
	return useQuery({
		queryKey: [QUERY_KEYS.MARKETPLACE_COLLECTION_BY_ADDRESS, agentAddress],
		queryFn: async () => {
			if (!agentAddress) return null;
			const data = await getCollectionsByAddress(
				agentAddress,
				skyBrowser,
				web3Auth
			);
			return data?.data || null;
		},
		enabled: !!agentAddress && !!skyBrowser && !!web3Auth,
		staleTime: 30000,
		gcTime: 30000,
		retry: 3,
	});
};

const useMintForm = (defaultData?: Partial<MintFormData>) => {
	const [formData, setFormData] = useState<MintFormData>({
		name: defaultData?.name || "",
		description: defaultData?.description || "",
		image: defaultData?.image || "",
	});
	const [error, setError] = useState<string | null>(null);

	const updateField = useCallback(
		(field: keyof MintFormData, value: string) => {
			setFormData((prev) => ({ ...prev, [field]: value.trim() }));
			if (error) setError(null);
		},
		[error]
	);

	const validateForm = useCallback((): boolean => {
		if (!formData.name.trim()) {
			setError("Agent name is required.");
			return false;
		}
		if (!formData.description.trim()) {
			setError("Agent description is required.");
			return false;
		}
		if (!formData.image.trim()) {
			setError("Please select or enter an image URL.");
			return false;
		}

		// Validate URL format
		try {
			new URL(formData.image.trim());
		} catch {
			setError("Please enter a valid image URL.");
			return false;
		}

		setError(null);
		return true;
	}, [formData]);

	const resetForm = useCallback((newData?: Partial<MintFormData>) => {
		setFormData({
			name: newData?.name || "",
			description: newData?.description || "",
			image: newData?.image || "",
		});
		setError(null);
	}, []);

	return {
		formData,
		error,
		updateField,
		validateForm,
		resetForm,
		setError,
	};
};

const StatusInfo = React.memo(
	({ icon, text }: { icon: React.ReactNode; text: string }) => (
		<div className="flex items-center gap-2">
			{icon}
			<span>{text}</span>
		</div>
	)
);

const ErrorMessage = React.memo(({ message }: { message: string }) => (
	<div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-200 dark:border-red-800">
		<AlertCircle className="w-4 h-4 flex-shrink-0" />
		<span>{message}</span>
	</div>
));

const MintAgentDialog = React.memo(function MintAgentDialog({
	open,
	onClose,
	onMint,
	defaultData,
	loading,
}: {
	open: boolean;
	onClose: () => void;
	onMint: (data: MintFormData) => void;
	defaultData?: Partial<MintFormData>;
	loading?: boolean;
}) {
	const { formData, error, updateField, validateForm, resetForm } =
		useMintForm(defaultData);

	useEffect(() => {
		if (open) {
			resetForm(defaultData);
		}
	}, [open, defaultData, resetForm]);

	// Handle ESC key
	useEffect(() => {
		const handleEsc = (e: KeyboardEvent) => {
			if (e.key === "Escape" && !loading) {
				onClose();
			}
		};

		if (open) {
			document.addEventListener("keydown", handleEsc);
			return () => document.removeEventListener("keydown", handleEsc);
		}
	}, [open, onClose, loading]);

	const handleSubmit = useCallback(
		(e: React.FormEvent) => {
			e.preventDefault();
			if (validateForm()) {
				onMint(formData);
			}
		},
		[validateForm, formData, onMint]
	);

	if (!open) return null;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
			<div className="bg-background rounded-2xl shadow-2xl p-8 w-full max-w-2xl mx-4 relative max-h-[90vh] overflow-y-auto">
				<button
					className="absolute top-6 right-6 text-muted-foreground hover:text-foreground transition-colors"
					onClick={onClose}
					disabled={loading}
					aria-label="Close dialog"
				>
					<X className="w-5 h-5" />
				</button>

				<h2 className="text-2xl font-bold mb-6">Mint Agent NFT</h2>

				<form onSubmit={handleSubmit} className="space-y-6">
					<div className="space-y-2">
						<Label htmlFor="mint-name">Name *</Label>
						<Input
							id="mint-name"
							value={formData.name}
							onChange={(e) =>
								updateField("name", e.target.value)
							}
							placeholder="Enter agent name"
							disabled={loading}
							required
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="mint-description">Description *</Label>
						<Textarea
							id="mint-description"
							value={formData.description}
							onChange={(e) =>
								updateField("description", e.target.value)
							}
							placeholder="Describe your agent"
							disabled={loading}
							required
							className="min-h-[100px] resize-none"
						/>
					</div>

					<ImageQuickSelect
						options={IMAGES}
						value={formData.image}
						onChange={(value) => updateField("image", value)}
						label="Choose an image *"
						showUrlInput
					/>

					{error && <ErrorMessage message={error} />}

					<div className="flex gap-3 pt-4">
						<Button
							type="button"
							variant="outline"
							onClick={onClose}
							disabled={loading}
							className="flex-1"
						>
							Cancel
						</Button>
						<Button
							type="submit"
							disabled={loading}
							className="flex-1 bg-green-500 hover:bg-green-600 text-black"
						>
							{loading ? (
								<>
									<div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin mr-2" />
									Minting...
								</>
							) : (
								<>
									<Rocket className="w-4 h-4 mr-2" />
									Mint & Save Agent
								</>
							)}
						</Button>
					</div>
				</form>
			</div>
		</div>
	);
});

export default function Page() {
	const params = useParams();
	const router = useRouter();
	const agentAddress = useAgentAddress(params);

	const [mintDialogOpen, setMintDialogOpen] = useState(false);
	const [mintLoading, setMintLoading] = useState(false);
	const [mintError, setMintError] = useState<string | null>(null);

	const { skyBrowser, address } = useWallet();
	const { web3Auth } = useWeb3AuthSafe();

	// --- Fix: Track if query has ever been called and finished ---
	const {
		data: agentData,
		isLoading,
		isFetching,
		isError,
		isFetched,
		isSuccess,
	} = useAgentData(agentAddress, skyBrowser, web3Auth);

	// Memoized values
	const formattedDate = useMemo(() => {
		if (!agentData?.updated_at) return "Unknown";
		return new Date(agentData.updated_at).toLocaleString("en-US", {
			month: "short",
			day: "numeric",
			hour: "numeric",
			minute: "2-digit",
			hour12: true,
		});
	}, [agentData?.updated_at]);

	const canMint = useMemo(
		() => canMintAgent(agentData as any, skyBrowser),
		[agentData, skyBrowser]
	);

	const statusInfo = useMemo(
		() => [
			{
				icon: <Activity className="w-4 h-4 text-green-500" />,
				text: agentData?.is_deployed ? "Deployed" : "Not Deployed",
			},
			{
				icon: <Clock className="w-4 h-4" />,
				text: `Updated ${formattedDate}`,
			},
			{
				icon: <Settings className="w-4 h-4" />,
				text: `${
					agentData?.subnet_list?.length || 0
				} subnets configured`,
			},
		],
		[agentData?.is_deployed, agentData?.subnet_list?.length, formattedDate]
	);

	// Event handlers
	const handleMintAndSave = useCallback(
		async (formData: MintFormData) => {
			if (!skyBrowser || !address || !web3Auth) {
				setMintError("Wallet not connected.");
				return;
			}
			if (!agentData) {
				setMintError("Agent data not available.");
				return;
			}

			setMintLoading(true);
			setMintError(null);

			try {
				const agentForMinting = {
					id: agentAddress,
					name: formData.name,
					description: formData.description,
					agent_address: agentAddress,
					is_deployed: agentData.is_deployed || false,
					created_at:
						agentData.created_at || new Date().toISOString(),
					updated_at:
						agentData.updated_at || new Date().toISOString(),
				};

				const mintResult = await mintAgentNFTWithHelper(
					agentForMinting,
					skyBrowser,
					address,
					{},
					agentAddress
				);

				if (!mintResult.success || !mintResult.agentId) {
					throw new Error(mintResult.error || "Failed to mint NFT.");
				}

				await createUserAgent(address, {
					collection_address: agentAddress,
					nft_id: mintResult.agentId,
					name: formData.name,
					description: formData.description,
					image: formData.image,
				});

				setMintDialogOpen(false);
				router.push(
					`/user-agents/${agentAddress}?nftid=${mintResult.agentId}`
				);
			} catch (err: any) {
				console.error("Minting error:", err);
				setMintError(err?.message || "Failed to mint and save agent.");
			} finally {
				setMintLoading(false);
			}
		},
		[skyBrowser, address, web3Auth, agentData, agentAddress, router]
	);

	const handleCopyAddress = useCallback(() => {
		const addressToCopy =
			agentData?.collection_id || agentData?.id || agentAddress;
		navigator.clipboard.writeText(addressToCopy);
	}, [agentData?.collection_id, agentData?.id, agentAddress]);

	const handleOpenDialog = useCallback(() => {
		setMintDialogOpen(true);
		setMintError(null);
	}, []);

	const handleCloseDialog = useCallback(() => {
		if (!mintLoading) {
			setMintDialogOpen(false);
			setMintError(null);
		}
	}, [mintLoading]);

	if (isLoading || isFetching || !isFetched) {
		return <MarketplaceLoaderSkeleton />;
	}

	if (!agentData && isFetched && !isLoading && !isFetching) {
		return (
			<div className="min-h-screen bg-background flex items-center justify-center">
				<div className="text-center space-y-4">
					<AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
					<h2 className="text-xl font-semibold">Agent Not Found</h2>
					<p className="text-muted-foreground">
						The agent you're looking for doesn't exist.
					</p>
					<Button onClick={() => router.back()}>Go Back</Button>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-background">
			<MintAgentDialog
				open={mintDialogOpen}
				onClose={handleCloseDialog}
				onMint={handleMintAndSave}
				defaultData={{
					name: agentData?.name || "",
					description: agentData?.description || "",
					image: "",
				}}
				loading={mintLoading}
			/>

			<div className="py-6 md:py-12 flex flex-col gap-8">
				{/* Global Error Display */}
				{mintError && <ErrorMessage message={mintError} />}

				<div className="flex flex-col md:flex-row gap-8 md:gap-12 items-start justify-between">
					<div className="flex flex-col md:flex-row gap-8 items-start flex-1">
						<div className="hidden md:block">
							<AgentImage
								src={agentData?.image || "/agent-mock.webp"}
								alt="Agent"
								isVerified={agentData?.isVerified}
							/>
						</div>

						<div className="flex-1 space-y-6">
							<div className="space-y-4">
								<h1 className="text-4xl font-bold text-foreground tracking-tight">
									{agentData?.name || "Unnamed Agent"}
								</h1>

								{/* Status Info Bar - less cluttered, more spaced out */}
								<div className="pt-4 md:pt-0 flex flex-wrap items-center gap-x-10 gap-y-6 md:gap-y-2 text-sm text-muted-foreground">
									{statusInfo.map((info, index) => (
										<div
											key={index}
											className="flex items-center gap-2 min-w-[140px]"
										>
											{info.icon}
											<span>{info.text}</span>
										</div>
									))}
								</div>
							</div>

							<div className="space-y-3 md:pt-3">
								<div className="flex flex-col">
									<Label className="font-medium text-muted-foreground tracking-wide">
										Collection Address
									</Label>
									<div className="flex items-center gap-2 mt-1">
										<code className="text-sm font-mono text-foreground break-all">
											{String(
												(agentData?.collection_id || "")
													.split("")
													.slice(0, 12)
													.join("") +
												"..." +
												(agentData?.collection_id || agentData?.id || agentAddress || "N/A")
													.split("")
													.slice(-8)
													.join("")
											)}
										</code>
										<Button
											size="sm"
											variant="ghost"
											onClick={handleCopyAddress}
											className="h-8 w-8 p-0 hover:bg-background/80 active:scale-80 transition-transform duration-100"
											title="Copy address"
										>
											<Copy className="h-4 w-4" />
										</Button>
									</div>
								</div>
							</div>
						</div>
					</div>

					<div className="space-y-3 w-full md:w-fit">
						<Button
							onClick={handleOpenDialog}
							disabled={!canMint || mintLoading}
							className="w-full md:w-fit hover:bg-green-500/80 bg-green-500 text-black disabled:opacity-50 disabled:cursor-not-allowed"
						>
							<Rocket className="w-4 h-4 mr-2" />
							{mintLoading ? "Minting..." : "Mint Agent"}
						</Button>

						{!canMint && !mintLoading && (
							<p className="text-xs text-muted-foreground">
								Minting not available for this agent
							</p>
						)}
					</div>
				</div>

				<div className="space-y-3">
					<Label className="text-lg font-semibold text-foreground">
						Agent Description
					</Label>
					<div className="relative">
						<div className="min-h-[140px] bg-background/50 border border-border/60 rounded-xl p-6 text-base leading-relaxed">
							{agentData?.description ||
								"No description provided for this agent."}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
