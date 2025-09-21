"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import { Label } from "@/components/ui/label";
import {
	Clock,
	Activity,
	Settings,
	Copy,
	Pencil,
	Check,
	X,
	ExternalLink,
	Clock as PendingIcon,
	ExternalLinkIcon,
	CheckCheckIcon,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useParams, useSearchParams } from "next/navigation";
import { getAgentDetailByCollectionAndNftId } from "@/controllers/agents/agents.query";
import { updateUserAgent } from "@/controllers/agents/agent.mutations";
import { AgentImage } from "@/components/market-place/agent-image";
import Link from "next/link";
import { QUERY_KEYS } from "@/utils/query-keys";
import { MarketplaceLoaderSkeleton } from "@/components/market-place/loader-skeleton";
import AgentTabs from "@/components/user-agents/agent-tabs";
import { AgentDetailResponse } from "@/types/agents";
import { getAgentUserAuthStatus } from "@/controllers/user-auth/user-auth.query";
import { getAgentUserAuthLink } from "@/controllers/user-auth/user-auth.mutations";
import { useWallet } from "@/hooks/use-wallet";
import { getSubnetsByID } from "@/controllers/subnets/subnets.query";
import { ExtendedSubnet } from "@/types/subnet";

const useAgentData = (agentAddress: string, nftId: string) =>
	useQuery({
		queryKey: [QUERY_KEYS.USER_AGENTS_BY_ADDRESS, agentAddress, nftId],
		queryFn: async () =>
			agentAddress
				? (await getAgentDetailByCollectionAndNftId(
						agentAddress,
						nftId
				  )) || null
				: null,
		enabled: !!agentAddress,
		staleTime: 5 * 60 * 1000,
		gcTime: 10 * 60 * 1000,
		retry: 3,
	});

const useEditableField = (
	initialValue: string,
	onSave: (v: string) => Promise<void>
) => {
	const [value, setValue] = useState(initialValue);
	const [isEditing, setIsEditing] = useState(false);
	const [draft, setDraft] = useState(initialValue);

	const startEdit = useCallback(() => {
		setDraft(value);
		setIsEditing(true);
	}, [value]);
	const cancelEdit = useCallback(() => {
		setDraft(value);
		setIsEditing(false);
	}, [value]);
	const saveEdit = useCallback(async () => {
		if (draft === value) return setIsEditing(false);
		await onSave(draft);
		setValue(draft);
		setIsEditing(false);
	}, [draft, value, onSave]);
	useEffect(() => {
		setValue(initialValue);
		if (!isEditing) setDraft(initialValue);
	}, [initialValue, isEditing]);
	return {
		value,
		draft,
		isEditing,
		setDraft,
		startEdit,
		cancelEdit,
		saveEdit,
	};
};

const EditableInput = ({
	value,
	draft,
	isEditing,
	onChange,
	onSave,
	onCancel,
	onEdit,
	className = "",
	placeholder = "",
	multiline = false,
}: {
	value: string;
	draft: string;
	isEditing: boolean;
	onChange: (v: string) => void;
	onSave: () => void;
	onCancel: () => void;
	onEdit: () => void;
	className?: string;
	placeholder?: string;
	multiline?: boolean;
}) =>
	isEditing ? (
		<div className="flex items-start gap-2">
			{multiline ? (
				<textarea
					value={draft}
					onChange={(e) => onChange(e.target.value)}
					className={`bg-transparent border-b border-border focus:outline-none focus:border-primary ${className}`}
					placeholder={placeholder}
					autoFocus
					rows={4}
				/>
			) : (
				<input
					value={draft}
					onChange={(e) => onChange(e.target.value)}
					className={`bg-transparent border-b border-border focus:outline-none focus:border-primary ${className}`}
					placeholder={placeholder}
					autoFocus
				/>
			)}
			<div className="flex items-center gap-1">
				<Button
					size="icon"
					variant="ghost"
					onClick={onSave}
					className="h-8 w-8"
				>
					<Check className="h-4 w-4" />
				</Button>
				<Button
					size="icon"
					variant="ghost"
					onClick={onCancel}
					className="h-8 w-8"
				>
					<X className="h-4 w-4" />
				</Button>
			</div>
		</div>
	) : (
		<div className="flex items-center gap-2">
			<span className={className}>{value || placeholder}</span>
			<Button
				size="icon"
				variant="ghost"
				onClick={onEdit}
				className="h-8 w-8"
			>
				<Pencil className="h-4 w-4" />
			</Button>
		</div>
	);

const StatusInfo = ({
	icon,
	text,
	className = "",
}: {
	icon: React.ReactNode;
	text: string;
	className?: string;
}) => (
	<div className={`flex items-center gap-2 ${className}`}>
		{icon}
		<span>{text}</span>
	</div>
);

const AddressInfo = ({
	label,
	value,
	onCopy,
}: {
	label: string;
	value?: string;
	onCopy: () => void;
}) => (
	<div className="space-y-3">
		<div className="flex flex-col">
			<Label className="font-medium text-muted-foreground tracking-wide">
				{label}
			</Label>
			<div className="flex items-center gap-1">
				<code className="text-sm font-mono text-foreground">
					{value && value.length > 10
						? `${value.slice(0, 8)}...${value.slice(-6)}`
						: value || "N/A"}
				</code>
				<Button
					size="sm"
					variant="ghost"
					onClick={onCopy}
					className="h-8 w-8 p-0 hover:bg-background/80 active:scale-80 transition-transform duration-100"
				>
					<Copy className="h-4 w-4" />
				</Button>
			</div>
		</div>
	</div>
);

export default function Page() {
	const params = useParams<{ agentAddress: string }>();
	const agentAddress = params.agentAddress;
	const searchParams = useSearchParams();
	const nftId = searchParams.get("nftid") || "";
	const { skyBrowser, address } = useWallet();

	const [updateLoading, setUpdateLoading] = useState(false);
	const [authLinkLoading, setAuthLinkLoading] = useState<string | null>(null);
	const [pollingSubnets, setPollingSubnets] = useState<Set<string>>(
		new Set()
	);
	const [pollingIntervals, setPollingIntervals] = useState<
		Map<string, NodeJS.Timeout>
	>(new Map());

	const {
		data: agentData,
		refetch,
		isLoading,
		isFetching,
		isFetched,
	} = useAgentData(agentAddress, nftId);

	const updateAgent = useCallback(
		async (updates: Partial<{ name: string; description: string }>) => {
			if (!agentData) return;
			setUpdateLoading(true);
			try {
				const payload = {
					collection_address: agentData.collection_id || agentAddress,
					nft_id: nftId,
					name: updates.name ?? agentData.name ?? "",
					description:
						updates.description ?? agentData.description ?? "",
					image: agentData.image || "",
				};
				await updateUserAgent(agentData.user_address || "", payload);
				await refetch();
			} finally {
				setUpdateLoading(false);
			}
		},
		[agentData, agentAddress, nftId, refetch]
	);

	const nameField = useEditableField(agentData?.name || "", (name) =>
		updateAgent({ name })
	);
	const descriptionField = useEditableField(
		agentData?.description || "",
		(description) => updateAgent({ description })
	);

	const handleCopyAddress = useCallback(() => {
		const addressToCopy = agentData?.collection_id || agentData?.id || "";
		navigator.clipboard.writeText(addressToCopy);
	}, [agentData?.collection_id, agentData?.id]);

	const startPolling = useCallback(
		(subnetId: string) => {
			setPollingSubnets((prev) => new Set(prev).add(subnetId));
			let attempts = 0,
				maxAttempts = 3,
				interval = 5000;
			const pollInterval = setInterval(async () => {
				attempts++;
				try {
					await refetch();
				} catch {}
				if (attempts >= maxAttempts) {
					clearInterval(pollInterval);
					setPollingSubnets((prev) => {
						const s = new Set(prev);
						s.delete(subnetId);
						return s;
					});
					setPollingIntervals((prev) => {
						const m = new Map(prev);
						m.delete(subnetId);
						return m;
					});
				}
			}, interval);
			setPollingIntervals((prev) =>
				new Map(prev).set(subnetId, pollInterval)
			);
			return pollInterval;
		},
		[refetch]
	);

	const handleAuthLinkRequest = useCallback(
		async (subnet: ExtendedSubnet) => {
			if (!skyBrowser || !address) return;
			setAuthLinkLoading(subnet.unique_id);
			try {
				const fullUrl = subnet.subnet_url || "";
				const normalizedUrl = (() => {
					try {
						const u = new URL(fullUrl);
						return `${u.protocol}//${u.host}`;
					} catch {
						return "";
					}
				})();
				if (!normalizedUrl) throw new Error("Invalid subnet URL");
				const authLinkResponse = await getAgentUserAuthLink({
					subnetUrl: normalizedUrl,
					agentCollection: { agentAddress, agentID: nftId },
					skyBrowser,
					web3Context: { address },
				});
				if (authLinkResponse?.success && authLinkResponse.data?.link) {
					window.open(
						authLinkResponse.data.link,
						"_blank",
						"noopener,noreferrer"
					);
					startPolling(subnet.unique_id);
				}
			} catch {
			} finally {
				setAuthLinkLoading(null);
			}
		},
		[skyBrowser, address, agentAddress, nftId, startPolling]
	);

	useEffect(
		() => () => {
			pollingIntervals.forEach(clearInterval);
		},
		[pollingIntervals]
	);

	const formattedDate = useMemo(
		() =>
			agentData?.updated_at
				? new Date(agentData.updated_at).toLocaleString("en-US", {
						month: "short",
						day: "numeric",
						hour: "numeric",
						minute: "2-digit",
						hour12: true,
				  })
				: "Unknown",
		[agentData?.updated_at]
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
				text: `Cordinates with ${
					agentData?.subnet_list?.length || 0
				} agent${agentData?.subnet_list?.length === 1 ? "" : "s"}`,
			},
		],
		[agentData?.is_deployed, agentData?.subnet_list?.length, formattedDate]
	);

	const agentSubnets = agentData?.subnet_list || [];
	const subnetIds = agentSubnets.map((s) => s.unique_id).filter(Boolean);

	const { data: rawSubnetDetails } = useQuery<ExtendedSubnet[]>({
		queryKey: ["agent-subnets", subnetIds],
		queryFn: async () => {
			if (!subnetIds.length) return [];
			const results = await Promise.all(
				subnetIds.map((id) => getSubnetsByID(id))
			);
			const seen = new Set();
			return results.flat().filter((subnet) => {
				const key = subnet.unique_id;
				if (seen.has(key)) return false;
				seen.add(key);
				return true;
			});
		},
		enabled: subnetIds.length > 0,
		staleTime: 5 * 60 * 1000, // 5 minutes - subnet data stays fresh for 5 minutes
		gcTime: 10 * 60 * 1000, // 10 minutes - keep in cache for 10 minutes
		refetchOnMount: false, // Use global setting
		refetchOnWindowFocus: false, // Use global setting
		refetchOnReconnect: false, // Use global setting
	});

	const subnetDetailsMap = useMemo(() => {
		const map = new Map();
		rawSubnetDetails?.forEach((subnet) =>
			map.set(subnet.unique_id, subnet)
		);
		return map;
	}, [rawSubnetDetails]);

	const authRequiredSubnets = useMemo(
		() => rawSubnetDetails?.filter((s) => s.auth_required) || [],
		[rawSubnetDetails]
	);
	const authRequiredSubnetIds = useMemo(
		() => authRequiredSubnets.map((s) => s.unique_id),
		[authRequiredSubnets]
	);

	const {
		data: subnetAuthDetails,
		isLoading: isLoadingSubnetAuthDetails,
		isError: isErrorSubnetAuthDetails,
	} = useQuery<any[]>({
		queryKey: [QUERY_KEYS.USER_AGENT_AUTH_STATUS, authRequiredSubnetIds],
		queryFn: async () => {
			if (!authRequiredSubnetIds.length) return [];
			const results = await Promise.all(
				authRequiredSubnetIds.map(async (id) => {
					const subnet = subnetDetailsMap.get(id);
					const fullUrl = subnet?.subnet_url || "";
					const normalizedUrl = (() => {
						try {
							const u = new URL(fullUrl);
							return `${u.protocol}//${u.host}`;
						} catch {
							return "";
						}
					})();
					const authResponse = await getAgentUserAuthStatus({
						subnetUrl: normalizedUrl,
						agentCollection: { agentAddress, agentID: nftId },
						skyBrowser,
						web3Context: { address },
					});
					return {
						...authResponse,
						subnet_id: id,
						subnet_url: normalizedUrl,
						original_subnet_url: fullUrl,
					};
				})
			);
			const seen = new Set();
			return results.flat().filter((subnet) => {
				const key = subnet.subnet_url;
				if (seen.has(key)) return false;
				seen.add(key);
				return true;
			});
		},
		enabled: authRequiredSubnetIds.length > 0 && !!address && !!skyBrowser,
		staleTime: 5 * 60 * 1000, // 5 minutes - auth subnet data stays fresh for 5 minutes
		gcTime: 10 * 60 * 1000, // 10 minutes - keep in cache for 10 minutes
		retry: 1,
	});

	const subnetDetailsWithAuth = useMemo(() => {
		if (!rawSubnetDetails) return [];
		if (!Array.isArray(subnetAuthDetails))
			return rawSubnetDetails.map((subnet) => ({
				...subnet,
				authStatus: null,
			}));
		return rawSubnetDetails.map((subnet) => {
			let authStatus = null;
			if (subnet.auth_required) {
				const normalizedSubnetUrl = (() => {
					try {
						const u = new URL(subnet.subnet_url || "");
						return `${u.protocol}//${u.host}`;
					} catch {
						return subnet.subnet_url || "";
					}
				})();
				authStatus =
					subnetAuthDetails.find(
						(detail) =>
							(detail?.subnet_id &&
								detail.subnet_id === subnet.unique_id) ||
							(detail?.subnet_url &&
								detail.subnet_url === normalizedSubnetUrl)
					) || null;
			}
			return { ...subnet, authStatus };
		});
	}, [rawSubnetDetails, subnetAuthDetails]);

	if (isLoading || isFetching || !isFetched)
		return <MarketplaceLoaderSkeleton />;
	if (!agentData && isFetched && !isLoading && !isFetching)
		return (
			<div className="min-h-screen bg-background flex items-center justify-center">
				<div className="text-center space-y-4">
					<h2 className="text-xl font-semibold">Agent Not Found</h2>
					<p className="text-muted-foreground">
						The agent you're looking for doesn't exist.
					</p>
				</div>
			</div>
		);

	const showSubnetAuthStatus =
		subnetDetailsWithAuth.some((subnet) => subnet.auth_required) &&
		!isLoadingSubnetAuthDetails &&
		!isErrorSubnetAuthDetails;

	const subnetAuthStatusContent = showSubnetAuthStatus && (
		<div className="flex flex-col gap-2 md:mt-4">
			<Label className="font-medium text-muted-foreground tracking-wide mb-1">
				Subnet Auth Status
			</Label>
			<div className="flex flex-col gap-1">
				{subnetDetailsWithAuth
					.filter((s) => s.auth_required)
					.map((subnet) => {
						const authStatus = subnet.authStatus;
						const isPolling = pollingSubnets.has(subnet.unique_id);
						let icon,
							statusText,
							isNotAuthenticated = false;
						if (
							authStatus &&
							typeof authStatus === "object" &&
							"success" in authStatus
						) {
							if (
								authStatus.success &&
								authStatus.data === true
							) {
								icon = (
									<CheckCheckIcon className="w-4 h-4 text-green-500" />
								);
								statusText = "Authenticated";
							} else {
								icon = isPolling ? (
									<PendingIcon className="w-4 h-4 text-blue-500 animate-spin" />
								) : (
									<ExternalLinkIcon className="w-4 h-4 text-red-500" />
								);
								statusText = isPolling
									? "Checking..."
									: "Not Authenticated";
								isNotAuthenticated = !isPolling;
							}
						} else {
							icon = isPolling ? (
								<PendingIcon className="w-4 h-4 text-blue-500 animate-spin" />
							) : (
								<ExternalLinkIcon className="w-4 h-4 text-red-500" />
							);
							statusText = isPolling
								? "Checking..."
								: "Not Authenticated";
							isNotAuthenticated = !isPolling;
						}
						return (
							<div
								key={subnet.unique_id}
								className={`w-fit flex items-center justify-center gap-2 px-3 py-1 rounded-full border capitalize text-sm font-medium ${
									isNotAuthenticated
										? "border-red-500/30 bg-red-500/20 text-red-500 cursor-pointer hover:bg-red-500/30 transition-colors"
										: "border-border bg-border/40 text-icon"
								} ${
									isNotAuthenticated &&
									authLinkLoading === subnet.unique_id
										? "opacity-50 cursor-not-allowed"
										: ""
								}`}
								onClick={
									isNotAuthenticated &&
									authLinkLoading !== subnet.unique_id &&
									!isPolling
										? () => handleAuthLinkRequest(subnet)
										: undefined
								}
							>
								<span className="font-normal">
									Connect {subnet.subnet_name}
								</span>
								{authLinkLoading === subnet.unique_id ? (
									<PendingIcon className="w-4 h-4 animate-spin" />
								) : (
									icon
								)}
							</div>
						);
					})}
			</div>
		</div>
	);

	return (
		<div className="md:py-12 flex flex-col gap-8">
			<div className="md:p-6 flex flex-col gap-8 h-[calc(100dvh-4rem)] overflow-y-auto scrollbar-hide">
				<div className="flex flex-col md:flex-row gap-12 items-start justify-between">
					<div className="flex flex-col md:flex-row gap-8 items-start flex-1">
						<AgentImage
							src={agentData?.image || ""}
							alt="Agent"
							isVerified={agentData?.isVerified}
						/>
						<div className="w-full grid grid-cols-1 md:grid-cols-3 gap-8">
							<div className="flex-1 space-y-6 col-span-2">
								<div className="space-y-5 md:space-y-4">
									<div className="flex flex-col gap-5">
										<EditableInput
											value={nameField.value}
											draft={nameField.draft}
											isEditing={nameField.isEditing}
											onChange={nameField.setDraft}
											onSave={nameField.saveEdit}
											onCancel={nameField.cancelEdit}
											onEdit={nameField.startEdit}
											className="text-4xl font-bold text-foreground tracking-tight"
											placeholder="Agent Name"
										/>
										<Link
											href={`/marketplace/${agentAddress}`}
											className="text-sm text-muted-foreground flex items-center gap-1 group"
										>
											<span className="group-hover:underline underline-offset-2 ">
												{agentData?.agent_name}
											</span>
											<ExternalLink className="w-4 h-4 mb-0.5" />
										</Link>
									</div>
									<div className="flex flex-wrap items-center gap-x-8 gap-y-4 text-sm text-muted-foreground">
										{statusInfo.map((info, i) => (
											<StatusInfo
												key={i}
												icon={info.icon}
												text={info.text}
											/>
										))}
									</div>
								</div>
								<div className="flex gap-x-10">
									<AddressInfo
										label="Collection Address"
										value={agentData?.collection_id}
										onCopy={handleCopyAddress}
									/>
									<AddressInfo
										label="Agent ID"
										value={agentData?.nft_id}
										onCopy={handleCopyAddress}
									/>
								</div>
							</div>
							<div className="flex flex-col gap-4 col-span-1">
								{subnetAuthStatusContent}
							</div>
						</div>
					</div>
				</div>
				<div>
					<AgentTabs
						agentData={agentData as AgentDetailResponse}
						agentAddress={agentAddress}
						nftId={nftId}
						descriptionField={descriptionField}
						updateLoading={updateLoading}
					/>
				</div>
			</div>
		</div>
	);
}
