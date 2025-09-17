"use client";

import { useEffect, useState } from "react";
import { Button } from "../ui/button";

interface SelectionAskJarvisProps {
	// Any element matching this selector will be treated as the selectable area
	rootSelector: string;
	// Called when the user clicks Ask Jarvis
	onAsk: (selectedText: string) => void;
	// Optional: label override
	label?: string;
}

// Lightweight floating tooltip that appears near current selection
export default function SelectionAskJarvis({
	rootSelector,
	onAsk,
	label = "Ask Jarvis",
}: SelectionAskJarvisProps) {
	const [visible, setVisible] = useState(false);
	const [position, setPosition] = useState<{ top: number; left: number }>({
		top: 0,
		left: 0,
	});
	const [selectedText, setSelectedText] = useState("");

	useEffect(() => {
		const showTooltipForSelection = (
			selection: Selection,
			range: Range
		) => {
			const containerEl = document.querySelector(rootSelector);
			if (!containerEl) return;

			// Ensure selection is inside root container
			const common = range.commonAncestorContainer as HTMLElement | null;
			const nodeEl = (
				common?.nodeType === 1 ? common : common?.parentElement
			) as HTMLElement | null;
			if (!nodeEl || !containerEl.contains(nodeEl)) {
				setVisible(false);
				setSelectedText("");
				return;
			}

			const rect = range.getBoundingClientRect();
			if (!rect || rect.width === 0 || rect.height === 0) {
				setVisible(false);
				setSelectedText("");
				return;
			}

			const text = selection.toString().trim();
			if (!text) {
				setVisible(false);
				setSelectedText("");
				return;
			}

			setSelectedText(text);
			const tooltipWidth = 120; // Approximate width of the tooltip
			setPosition({
				top: Math.max(4, rect.top + window.scrollY - 45), // Position above selection
				left: Math.max(
					8,
					rect.left +
						window.scrollX +
						rect.width / 2 -
						tooltipWidth / 2
				), // Center horizontally
			});
			setVisible(true);
		};

		const handleSelectionChange = () => {
			const selection = window.getSelection?.();
			if (!selection || selection.isCollapsed) {
				setVisible(false);
				setSelectedText("");
				return;
			}

			const range = selection.getRangeAt(0);
			if (!range) {
				setVisible(false);
				setSelectedText("");
				return;
			}

			showTooltipForSelection(selection, range);
		};

		const handleDoubleClick = (e: MouseEvent) => {
			const containerEl = document.querySelector(rootSelector);
			if (!containerEl || !containerEl.contains(e.target as Node)) return;

			// Small delay to allow selection to be made
			setTimeout(() => {
				const selection = window.getSelection?.();
				if (!selection || selection.isCollapsed) return;

				const range = selection.getRangeAt(0);
				if (!range) return;

				showTooltipForSelection(selection, range);
			}, 10);
		};

		const hide = () => setVisible(false);

		document.addEventListener("selectionchange", handleSelectionChange);
		document.addEventListener("dblclick", handleDoubleClick);
		window.addEventListener("scroll", hide, { passive: true });
		window.addEventListener("resize", hide);

		return () => {
			document.removeEventListener(
				"selectionchange",
				handleSelectionChange
			);
			document.removeEventListener("dblclick", handleDoubleClick);
			window.removeEventListener("scroll", hide);
			window.removeEventListener("resize", hide);
		};
	}, [rootSelector]);

	if (!visible) return null;

	return (
		<div
			className="fixed z-50 pointer-events-none"
			style={{
				top: position.top,
				left: position.left,
			}}
		>
			<div className="pointer-events-auto">
				<Button
					size="sm"
					className="h-8 px-3 rounded-md bg-background hover:bg-background/80 border border-border/50 text-white text-sm flex items-center gap-2 transition-all duration-200 hover:cursor-pointer"
					onMouseDown={(e) => e.preventDefault()}
					onClick={() => {
						onAsk(selectedText);
						setVisible(false);
					}}
				>
					<svg
						width="14"
						height="14"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
						className="flex-shrink-0"
					>
						<path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z" />
						<path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z" />
					</svg>
					{label}
				</Button>
			</div>
		</div>
	);
}
