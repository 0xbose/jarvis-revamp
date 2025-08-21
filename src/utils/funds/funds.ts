// Utility functions for FundsModal
import { ethers } from "ethers";

export function isAmountInvalid(
	amount: string,
	balance: string | null,
	quote?: any,
	tokenDecimals?: number
): boolean {
	const parsedAmount = parseFloat(amount);
	const parsedBalance = parseFloat(balance ?? "0");
	const minAmount = 0.001;

	// Basic validation
	const basicValidation =
		!amount ||
		isNaN(parsedAmount) ||
		parsedAmount < minAmount ||
		parsedAmount > parsedBalance;

	if (basicValidation) {
		return true;
	}

	// USD validation - minimum $5
	if (quote && tokenDecimals !== undefined) {
		const fromAmount = quote.action?.fromAmount;
		const fromTokenPrice = quote.action?.fromToken?.priceUSD;

		if (fromAmount && fromTokenPrice) {
			const fromAmountInDecimals = Number(
				ethers.formatUnits(fromAmount, tokenDecimals)
			);
			const usdValue = fromAmountInDecimals * fromTokenPrice;

			if (usdValue < 5) {
				return true;
			}
		}
	}

	return false;
}

export function formatBalance(balance: string | null, symbol?: string) {
	if (!balance) return "-";
	return `${balance} ${symbol ?? ""}`.trim();
}

export function formatQuoteDetails(
	quote: any,
	tokenDecimals: number,
	tokenSymbol: string
) {
	if (!quote) return null;
	const from =
		quote.action?.fromAmount != null
			? `${ethers.formatUnits(
					quote.action.fromAmount,
					tokenDecimals
			  )} ${tokenSymbol}`
			: "N/A";
	const to =
		quote.estimate?.toAmount != null
			? `${parseFloat(
					ethers.formatUnits(quote.estimate.toAmount, 18)
			  ).toFixed(6)} ETH (Arbitrum)`
			: "N/A";
	return {
		from,
		to,
		estimatedGas: quote.estimate?.gasCosts?.[0]?.estimate || "N/A",
		route: quote.route?.steps?.[0]?.type || "N/A",
		receivingAddress: quote.action?.toAddress || "N/A",
	};
}

export function calculateUSDValue(
	quote: any,
	tokenDecimals: number
): { fromUSD: number; toUSD: number } | null {
	console.log("quote", quote);
	if (!quote) return null;

	try {
		// Calculate from token USD value
		const fromAmount = quote.action?.fromAmount;
		const fromTokenPrice = quote.action?.fromToken?.priceUSD;
		let fromUSD = 0;
		if (fromAmount && fromTokenPrice) {
			const fromAmountInDecimals = Number(
				ethers.formatUnits(fromAmount, tokenDecimals)
			);
			fromUSD = fromAmountInDecimals * fromTokenPrice;
		}

		// Calculate to token USD value (use action.toToken for price/decimals)
		const toAmount = quote.estimate?.toAmount;
		const toTokenPrice = quote.action?.toToken?.priceUSD;
		const toTokenDecimals = quote.action?.toToken?.decimals ?? 18;
		let toUSD = 0;
		if (toAmount && toTokenPrice) {
			const toAmountInDecimals = Number(
				ethers.formatUnits(toAmount, toTokenDecimals)
			);
			toUSD = toAmountInDecimals * toTokenPrice;
		}

		return {
			fromUSD,
			toUSD,
		};
	} catch (error) {
		console.error("Error calculating USD values:", error);
		return null;
	}
}

export function getFromTokenUSDValue(
	quote: any,
	tokenDecimals: number
): number | null {
	if (!quote?.action?.fromAmount || !quote?.action?.fromToken?.priceUSD) {
		return null;
	}

	try {
		const fromAmount = quote.action.fromAmount;
		const fromTokenPrice = quote.action.fromToken.priceUSD;
		const fromAmountInDecimals = Number(
			ethers.formatUnits(fromAmount, tokenDecimals)
		);
		return fromAmountInDecimals * fromTokenPrice;
	} catch (error) {
		console.error("Error calculating from token USD value:", error);
		return null;
	}
}

export function conversionPrice(quote: any) {
	if (!quote?.estimate?.toAmount || !quote?.action?.toToken?.priceUSD) {
		return null;
	}

	const toAmount = quote.estimate.toAmount;
	const toTokenPrice = quote.action.toToken.priceUSD;
	const toTokenDecimals = quote.action.toToken.decimals ?? 18;

	const toAmountInDecimals = Number(
		ethers.formatUnits(toAmount, toTokenDecimals)
	);
	const toUSD = toAmountInDecimals * toTokenPrice;

	return {
		toUSD,
		toAmount: toAmountInDecimals,
	};
}
