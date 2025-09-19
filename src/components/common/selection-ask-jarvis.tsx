"use client";

import { useEffect, useState } from "react";
import { Button } from "../ui/button";
import { Copy, Layers, Quote } from "lucide-react";

interface SelectionTooltipProps {
	rootSelector: string;
	onAsk: (selectedText: string) => void;
	onInstructAgent: (selectedText: string) => void;
	onCopy: (selectedText: string) => void;
}

export default function SelectionTooltip({
	rootSelector,
	onAsk,
	onInstructAgent,
	onCopy,
}: SelectionTooltipProps) {
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
			const tooltipWidth = 320; // Approximate width for three buttons
			setPosition({
				top: Math.max(4, rect.top + window.scrollY - 55), // Position above selection with more space
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
			<div className="pointer-events-auto relative">
				<div className="flex gap-1 bg-[#bedfff] text-background rounded-lg shadow-lg border-b-2 border-[#0091ff] border-x-[1px] p-1">
					<div className="divide-x divide-border space-x-1 py-0.5 flex items-center h-8">
						<Button
							size="sm"
							variant="ghost"
							className="rounded-none h-6 px-3 text-sm flex items-center gap-2 hover:text-background/90 hover:bg-transparent"
							onMouseDown={(e) => e.preventDefault()}
							onClick={() => {
								onAsk(selectedText);
								setVisible(false);
							}}
						>
							<div className="flex items-center gap-2 scale-100 hover:scale-[102%] transition-all duration-200 cursor-pointer">
								<Quote />
								Ask Jarvis
							</div>
						</Button>
						<Button
							size="sm"
							variant="ghost"
							className="rounded-none h-6 px-3 text-sm flex items-center gap-2 hover:text-background/90 hover:bg-transparent"
							onMouseDown={(e) => e.preventDefault()}
							onClick={() => {
								onInstructAgent(selectedText);
								setVisible(false);
							}}
						>
							<div className="flex items-center gap-2 scale-100 hover:scale-[102%] transition-all duration-200 cursor-pointer">
								<Layers />
								Instruct Agent
							</div>
						</Button>
						<Button
							size="sm"
							variant="ghost"
							className="rounded-none h-6 px-3 text-sm flex items-center gap-2 hover:text-background/90 hover:bg-transparent"
							onMouseDown={(e) => e.preventDefault()}
							onClick={() => {
								onCopy(selectedText);
								setVisible(false);
							}}
						>
							<div className="flex items-center gap-2 scale-100 hover:scale-[104%] transition-all duration-200 cursor-pointer">
								<Copy />
							</div>
						</Button>
					</div>
				</div>
			</div>
			<div className="absolute top-full left-1/2 transform -translate-x-1/2">
				<div className="w-0 h-0 border-l-[8px] border-r-[8px] border-t-[7px] border-l-transparent border-r-transparent border-t-[#0091ff]"></div>
				<div className="w-0 h-0 border-l-[7px] border-r-[7px] border-t-[7px] border-l-transparent border-r-transparent border-t-[#bedfff] absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-[2px]"></div>
			</div>
		</div>
	);
}
