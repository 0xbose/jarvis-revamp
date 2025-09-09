import React, { useMemo } from "react";
import {
	ColumnDef,
	flexRender,
	Table as ReactTable,
} from "@tanstack/react-table";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "./table-components";
import { Skeleton } from "@/components/ui/skeleton";

interface DataTableProps<T> {
	table: ReactTable<T>;
	columns: ColumnDef<T>[];
	isLoading: boolean;
}

function DataTable<T>({ table, columns, isLoading }: DataTableProps<T>) {
	// Memoize skeleton rows to prevent recreation on every render
	const skeletonRows = useMemo(
		() =>
			[...Array(10)].map((_, index) => (
				<TableRow key={`skeleton-${index}`}>
					<TableCell colSpan={columns.length}>
						<Skeleton className="w-full h-8" />
					</TableCell>
				</TableRow>
			)),
		[columns.length]
	);

	// Memoize header groups to prevent unnecessary re-renders
	const headerGroups = useMemo(() => table.getHeaderGroups(), [table]);

	// Memoize rows to prevent unnecessary re-renders
	const rows = useMemo(() => table.getRowModel().rows, [table]);

	return (
		<div className="border-[1.5px] rounded-lg overflow-hidden">
			<div className="max-h-[calc(100svh-14rem)] overflow-y-auto">
				<Table className="rounded-lg overflow-hidden">
					<TableHeader className="bg-primaryColor/5 sticky top-0">
						{headerGroups.map((headerGroup) => (
							<TableRow key={headerGroup.id}>
								{headerGroup.headers.map((header) => (
									<TableHead
										key={header.id}
										className="!font-extrabold py-5"
									>
										{header.isPlaceholder
											? null
											: flexRender(
													header.column.columnDef
														.header,
													header.getContext()
											  )}
									</TableHead>
								))}
							</TableRow>
						))}
					</TableHeader>
					<TableBody>
						{isLoading ? (
							skeletonRows
						) : rows.length ? (
							rows.map((row) => (
								<TableRow
									key={row.id}
									data-state={
										row.getIsSelected() && "selected"
									}
								>
									{row.getVisibleCells().map((cell) => (
										<TableCell key={cell.id}>
											{flexRender(
												cell.column.columnDef.cell,
												cell.getContext()
											)}
										</TableCell>
									))}
								</TableRow>
							))
						) : (
							<TableRow>
								<TableCell
									colSpan={columns.length}
									className="h-24 text-center"
								>
									No results.
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</div>
		</div>
	);
}

// Export memoized component to prevent unnecessary re-renders
export default React.memo(DataTable) as typeof DataTable;
