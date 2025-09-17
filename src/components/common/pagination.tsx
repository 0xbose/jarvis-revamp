"use client";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "../ui/button";

interface PaginationProps {
	maxPages: number;
	currentLocation?: string;
	total: number;
	// Cursor mode support
	cursorMode?: boolean;
	hasNextPage?: boolean;
	hasPreviousPage?: boolean;
	onPrevious?: () => void;
	onNext?: () => void;
}

const DataPagination: React.FC<PaginationProps> = ({
	maxPages,
	currentLocation,
	total,
	cursorMode,
	hasNextPage,
	hasPreviousPage,
	onPrevious,
	onNext,
}) => {
	const router = useRouter();
	const searchParams = useSearchParams();
	const currentPage = searchParams.get("page") || "1";

	const usePreviousSearchParams = ({
		newSearchParams,
	}: {
		newSearchParams: URLSearchParams;
	}) => {
		for (const [key, value] of searchParams.entries()) {
			if (value) {
				newSearchParams.set(key, value);
			}
		}
	};

	const handlePreviousPage = () => {
		if (cursorMode && onPrevious) {
			onPrevious();
			return;
		}
		const newSearchParams = new URLSearchParams();
		usePreviousSearchParams({ newSearchParams });
		newSearchParams.set("page", (parseInt(currentPage) - 1).toString());
		const newUrl = `${
			currentLocation || "/history"
		}?${newSearchParams.toString()}`;
		router.push(newUrl);
	};

	const handleNextPage = () => {
		if (cursorMode && onNext) {
			onNext();
			return;
		}
		const newSearchParams = new URLSearchParams();
		usePreviousSearchParams({ newSearchParams });
		newSearchParams.set("page", (parseInt(currentPage) + 1).toString());
		const newUrl = `${
			currentLocation || "/history"
		}?${newSearchParams.toString()}`;
		router.push(newUrl);
	};

	const handlePageClick = (pageNumber: number) => {
		const newSearchParams = new URLSearchParams();
		usePreviousSearchParams({ newSearchParams });
		newSearchParams.set("page", pageNumber.toString());
		const newUrl = `${
			currentLocation || "/history"
		}?${newSearchParams.toString()}`;
		router.push(newUrl);
	};

	// Calculate correct item ranges (starting from 1, not 0)
	const itemsPerPage = 10;
	const currentPageNumber = parseInt(currentPage);
	const startItem = (currentPageNumber - 1) * itemsPerPage + 1;
	const endItem = Math.min(currentPageNumber * itemsPerPage, total);

	// Calculate which page buttons to show
	const getPageButtons = () => {
		// Define a type that can be a number or a special value for ellipsis
		type PageItem = number | "ellipsis";

		if (maxPages <= 10) {
			// Show all pages if 10 or fewer
			return Array.from(
				{ length: maxPages },
				(_, i) => i + 1
			) as PageItem[];
		} else {
			// Complex pagination with ellipsis
			let pages: PageItem[] = [1, 2, 3, 4];

			// Add middle section based on current page
			if (currentPageNumber > 4 && currentPageNumber < maxPages - 3) {
				pages = [
					1,
					"ellipsis",
					currentPageNumber - 1,
					currentPageNumber,
					currentPageNumber + 1,
					"ellipsis",
					maxPages,
				];
			} else if (currentPageNumber <= 4) {
				pages = [1, 2, 3, 4, 5, "ellipsis", maxPages];
			} else {
				pages = [
					1,
					"ellipsis",
					maxPages - 4,
					maxPages - 3,
					maxPages - 2,
					maxPages - 1,
					maxPages,
				];
			}

			return pages;
		}
	};

	const pageButtons = getPageButtons();

	return (
		<footer className="flex flex-1 select-none items-center justify-between mt-4 mr-7">
			<div className="text-sm ml-4">
				{total > 0
					? `Showing ${startItem} to ${endItem} of ${total}`
					: "No items to display"}
			</div>
			<div className="flex items-center space-x-1">
				{!cursorMode && (
					<>
						<Button
							disabled={currentPageNumber === 1}
							type="button"
							onClick={handlePreviousPage}
							variant="ghost"
							className={cn(
								"h-8 w-8 p-0",
								currentPageNumber === 1
									? "text-gray-500 cursor-not-allowed"
									: "text-gray-300 hover:bg-gray-700 hover:text-white"
							)}
						>
							<ChevronLeft className="size-4" />
						</Button>

						{pageButtons.map((page, index) =>
							page === "ellipsis" ? (
								<span
									key={`ellipsis-${index}`}
									className="h-8 w-8 flex items-center justify-center text-gray-400"
								>
									...
								</span>
							) : (
								<Button
									key={`page-${page}`}
									type="button"
									variant="ghost"
									onClick={() => handlePageClick(page)}
									className={cn(
										"h-8 w-8 p-0 text-sm",
										currentPageNumber === page
											? "bg-muted text-white hover:bg-muted/80"
											: "text-gray-300 hover:bg-gray-700 hover:text-white"
									)}
									aria-current={
										currentPageNumber === page
											? "page"
											: undefined
									}
								>
									{page}
								</Button>
							)
						)}
					</>
				)}
				{cursorMode && (
					<Button
						disabled={!hasPreviousPage}
						type="button"
						onClick={handlePreviousPage}
						variant="ghost"
						className={cn(
							"h-8 w-8 p-0",
							!hasPreviousPage
								? "text-gray-500 cursor-not-allowed"
								: "text-gray-300 hover:bg-gray-700 hover:text-white"
						)}
					>
						<ChevronLeft className="size-4" />
					</Button>
				)}
				<Button
					disabled={
						cursorMode
							? !hasNextPage
							: currentPageNumber >= maxPages
					}
					type="button"
					onClick={handleNextPage}
					variant="ghost"
					className={cn(
						"h-8 w-8 p-0",
						cursorMode
							? !hasNextPage
								? "text-gray-500 cursor-not-allowed"
								: "text-gray-300 hover:bg-gray-700 hover:text-white"
							: currentPageNumber >= maxPages
							? "text-gray-500 cursor-not-allowed"
							: "text-gray-300 hover:bg-gray-700 hover:text-white"
					)}
				>
					<ChevronRight className="size-4" />
				</Button>
			</div>
		</footer>
	);
};

export default DataPagination;
