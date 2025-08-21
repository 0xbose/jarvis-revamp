"use client";
import React from "react";
import { Button } from "@/components/ui/button";

interface TransactionSuccessMessageProps {
	onClose: () => void;
}

export const TransactionSuccessMessage: React.FC<
	TransactionSuccessMessageProps
> = ({ onClose }) => {
	return (
		<div
			className="wallet_balance_modal_content"
			style={{ textAlign: "center" }}
		>
			<h2
				className="f-size-p1 f-weight-500 mb-6 text-center"
				style={{ color: "#4ade80" }}
			>
				Transaction Successful!
			</h2>
			<p className="text-sm text-gray-400 mb-6">
				Your funds have been added and bridged successfully.
			</p>
			<Button variant="outline" className="w-full" onClick={onClose}>
				Close
			</Button>
		</div>
	);
};
