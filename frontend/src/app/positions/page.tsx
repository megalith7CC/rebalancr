'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { M3Card, M3Button } from '@/components/ui/M3Components';
import { DashboardNavigation } from '@/components/DashboardNavigation';
import positionsService, { EnrichedPosition } from '@/services/PositionsService';
import walletTransactionService from '@/services/WalletTransactionService';
import { getTokenByAddress } from '@/utils/tokenMapping';

export default function PositionsPage() {
  const { address, isConnected } = useAccount();
	const [positions, setPositions] = useState<EnrichedPosition[]>([]);
	const [loading, setLoading] = useState<boolean>(true);
	const [error, setError] = useState<string | null>(null);
	const [totalPortfolioValue, setTotalPortfolioValue] = useState<number>(0);

	useEffect(() => {
		const fetchPositions = async () => {
			if (!isConnected || !address) {
				setLoading(false);
				return;
			}

			setLoading(true);
			setError(null);

			try {
				await positionsService.initialize();

				const enrichedPositions = await positionsService.getEnrichedUserPositions(address);
				setPositions(enrichedPositions);

				const totalValue = await positionsService.getTotalPortfolioValue(address);
				setTotalPortfolioValue(totalValue);
			} catch (err) {
				console.error('Error fetching positions:', err);
				setError(err instanceof Error ? err.message : 'Failed to load positions');
			} finally {
				setLoading(false);
			}
		};

		fetchPositions();
	}, [isConnected, address]);

	const handleClosePosition = async (positionId: string) => {
		try {
			setError(null);
			const result = await positionsService.closePosition(positionId);

			if (result.success) {
				if (address) {
					const updatedPositions = await positionsService.getEnrichedUserPositions(address);
					setPositions(updatedPositions);

					const updatedTotalValue = await positionsService.getTotalPortfolioValue(address);
					setTotalPortfolioValue(updatedTotalValue);
				}
			} else {
				setError(result.error || 'Failed to close position');
			}
		} catch (err) {
			console.error('Error closing position:', err);
			setError(err instanceof Error ? err.message : 'Failed to close position');
		}
	};

	const handleRebalancePosition = async (position: EnrichedPosition) => {
		try {
			setError(null);

			const newAmount = (parseFloat(position.amounts[0]) * 1.1).toString(); 

			const result = await positionsService.modifyPosition(position.id, newAmount);

			if (result.success) {
				if (address) {
					const updatedPositions = await positionsService.getEnrichedUserPositions(address);
					setPositions(updatedPositions);
				}
			} else {
				setError(result.error || 'Failed to rebalance position');
			}
		} catch (err) {
			console.error('Error rebalancing position:', err);
			setError(err instanceof Error ? err.message : 'Failed to rebalance position');
		}
	};

	return (
		<div className="container mx-auto px-4 py-8">
			<DashboardNavigation />
			<h1 className="text-3xl font-bold mb-6 text-slate-900 dark:text-white">My Positions</h1>

			{!isConnected ? (
				<div className="text-center py-12">
					<p className="text-slate-500 dark:text-slate-400 mb-4">Connect your wallet to view your positions.</p>
					<ConnectButton />
				</div>
			) : loading ? (
				<div className="text-center py-12">
					<p className="text-slate-500 dark:text-slate-400">Loading positions from contract...</p>
				</div>
			) : error ? (
				<div className="text-center py-12">
					<p className="text-red-500">{error}</p>
					<M3Button
						variant="outlined"
						className="mt-4"
						onClick={() => {
							if (address) {
								setLoading(true);
								setError(null);
								positionsService
									.getEnrichedUserPositions(address)
									.then(setPositions)
									.catch((err) => setError(err.message))
									.finally(() => setLoading(false));
							}
						}}
					>
						Retry
					</M3Button>
				</div>
			) : positions.length === 0 ? (
				<div className="text-center py-12">
					<p className="text-slate-500 dark:text-slate-400 mb-4">You don't have any active positions.</p>
					<Link href="/strategies" passHref>
						<M3Button variant="filled">Explore Strategies</M3Button>
					</Link>
				</div>
			) : (
				<>
					{}
					<M3Card variant="elevated" className="mb-8 p-6">
						<div className="flex flex-col md:flex-row md:justify-between md:items-center">
							<div>
								<h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Portfolio Summary</h2>
								<p className="text-sm text-slate-500 dark:text-slate-400">
									{positions.length} active position{positions.length !== 1 ? 's' : ''}
								</p>
							</div>
							<div className="mt-4 md:mt-0 text-right">
								<p className="text-sm text-slate-500 dark:text-slate-400">Total Value</p>
								<p className="text-3xl font-bold text-slate-900 dark:text-white">
									${totalPortfolioValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
								</p>
							</div>
						</div>
					</M3Card>

					{}
					<div className="space-y-6">
						{positions.map((position) => (
							<PositionCard
								key={position.id}
								position={position}
								onClose={() => handleClosePosition(position.id)}
								onRebalance={() => handleRebalancePosition(position)}
							/>
						))}
					</div>
				</>
			)}
		</div>
	);
}

function PositionCard({
	position,
	onClose,
	onRebalance,
}: {
	position: EnrichedPosition;
	onClose: () => void;
	onRebalance: () => void;
}) {
	const getHealthColor = (score: number) => {
		if (score >= 80) return 'bg-green-500';
		if (score >= 50) return 'bg-yellow-500';
		return 'bg-red-500';
	};

	const getPerformanceColor = (percentage: number) => {
		if (percentage > 0) return 'text-green-600 dark:text-green-400';
		if (percentage < 0) return 'text-red-600 dark:text-red-400';
		return 'text-slate-600 dark:text-slate-400';
	};

	const daysHeld = Math.floor((Date.now() - position.entryTimestamp) / (1000 * 60 * 60 * 24));

	return (
		<M3Card variant="outlined" className="overflow-hidden">
			<div className="grid grid-cols-1 md:grid-cols-4">
				<div className="p-6 md:col-span-3">
					<div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
						<div>
							<h2 className="text-xl font-semibold text-slate-900 dark:text-white">{position.strategyName}</h2>
							<p className="text-sm text-slate-500 dark:text-slate-400">
								Position #{position.id} • {daysHeld} days
							</p>
						</div>
						<div className="mt-3 md:mt-0 flex items-center">
							<div className="flex items-center space-x-2">
								<span className="text-sm text-slate-500 dark:text-slate-400">Health:</span>
								<div className="flex items-center space-x-1">
									<div className={`w-3 h-3 rounded-full ${getHealthColor(position.healthScore)}`}></div>
									<span className="text-sm font-medium text-slate-900 dark:text-white">{position.healthScore}%</span>
								</div>
							</div>
						</div>
					</div>

					<div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
						<div>
							<h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Current Value</h3>
							<p className="text-lg font-bold text-slate-900 dark:text-white">
								${parseFloat(position.currentValue).toLocaleString(undefined, { minimumFractionDigits: 2 })}
							</p>
						</div>

						<div>
							<h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Entry Value</h3>
							<p className="text-lg font-bold text-slate-900 dark:text-white">
								${parseFloat(position.entryValue).toLocaleString(undefined, { minimumFractionDigits: 2 })}
							</p>
						</div>

						<div>
							<h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Performance</h3>
							<p className={`text-lg font-bold ${getPerformanceColor(position.performancePercentage)}`}>
								{position.performancePercentage > 0 ? '+' : ''}
								{position.performancePercentage.toFixed(2)}%
							</p>
						</div>

						<div>
							<h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Status</h3>
							<span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
								{position.status}
							</span>
						</div>
					</div>

					<div className="space-y-2">
						<h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">Assets:</h4>
						<div className="flex flex-wrap gap-2">
							{position.tokenDetails.map((token) => (
								<div
									key={token.address}
									className="flex items-center space-x-2 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg"
								>
									<span className="text-sm font-medium text-slate-900 dark:text-white">
										{token.amount} {token.symbol}
									</span>
									<span className="text-xs text-slate-500 dark:text-slate-400">(${token.valueUsd})</span>
								</div>
							))}
						</div>
					</div>
				</div>

				<div className="bg-slate-50 dark:bg-slate-800 p-6 flex flex-col justify-center border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-700">
					<Link href={`/positions/${position.id}`} passHref>
						<M3Button variant="outlined" className="mb-3" fullWidth>
							View Details
						</M3Button>
					</Link>

					<M3Button variant="filled" className="mb-3" fullWidth onClick={onRebalance}>
						Rebalance
					</M3Button>

					<M3Button variant="outlined" color="error" fullWidth onClick={onClose}>
						Exit Position
					</M3Button>
				</div>
			</div>
		</M3Card>
	);
} 