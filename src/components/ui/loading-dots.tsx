interface LoadingDotsProps {
	className?: string;
	dotClassName?: string;
}

export function LoadingDots({ className = "", dotClassName = "" }: LoadingDotsProps) {
	return (
		<div className={`flex items-center space-x-1 ${className}`}>
			<div
				className={`w-2 h-2 bg-gray-200/10 rounded-full animate-bounce ${dotClassName}`}
				style={{ animationDelay: "0ms" }}
			></div>
			<div
				className={`w-2 h-2 bg-gray-200/10 rounded-full animate-bounce ${dotClassName}`}
				style={{ animationDelay: "150ms" }}
			></div>
			<div
				className={`w-2 h-2 bg-gray-200/10 rounded-full animate-bounce ${dotClassName}`}
				style={{ animationDelay: "300ms" }}
			></div>
		</div>
	);
}
