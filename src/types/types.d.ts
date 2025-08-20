export interface ChatInputProps {
	onSend: (message: string, selectedAgentId?: string) => void;
	onStop?: () => void;
	onResume?: () => void;
	mode: "chat" | "agent";
	setMode: (value: "chat" | "agent") => void;
	prompt: string;
	setPrompt: (value: string) => void;
	hideModeSelection?: boolean;
	disableAgentSelection?: boolean;
	isExecuting?: boolean;
	workflowStatus?:
		| "running"
		| "stopped"
		| "completed"
		| "failed"
		| "awaiting_response"
		| "in_progress"
		| "waiting";
}
