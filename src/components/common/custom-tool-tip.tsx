import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";

export default function CustomTooltip({
	children,
	content,
	disabled,
}: {
	children: React.ReactNode;
	content: string;
	disabled?: boolean;
}) {
	if (disabled) {
		return <>{children}</>;
	}
	return (
		<Tooltip>
			<TooltipTrigger>{children}</TooltipTrigger>
			<TooltipContent side="right" align="center">
				<p>{content}</p>
			</TooltipContent>
		</Tooltip>
	);
}
