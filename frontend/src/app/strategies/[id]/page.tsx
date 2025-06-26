'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAccount } from 'wagmi';
import { M3Card, M3Button } from '@/components/ui/M3Components';
import { DashboardNavigation } from '@/components/DashboardNavigation';
import strategiesService, { StrategyInfo } from '@/services/StrategiesService';
import { getTokenByAddress, getTokenDisplayName } from '@/utils/tokenMapping';

interface StrategyDetailProps {
	params: Promise<{
		id: string;
	}>;
}

export default function StrategyDetailPage({ params }: StrategyDetailProps) {
	const { isConnected } = useAccount();
	const [id, setId] = useState<string>('');
	const [loading, setLoading] = useState(true);
	const [strategy, setStrategy] = useState<StrategyInfo | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const resolveParams = async () => {
			const resolvedParams = await params;
			setId(resolvedParams.id);
		};
		resolveParams();
	}, [params]);

	useEffect(() => {
		if (!id) return; 

		const fetchStrategyDetails = async () => {
			if (!isConnected) {
				setLoading(false);
				return;
			}

			setLoading(true);
			setError(null);

			try {
				await strategiesService.initialize();
				const strategyData = await strategiesService.getStrategyById(id);

				if (strategyData) {
					console.log('Loaded strategy from contract:', strategyData);
					setStrategy(strategyData);
				} else {
					setError('Strategy not found');
				}
			} catch (err) {
				console.error('Error fetching strategy details:', err);
				setError(err instanceof Error ? err.message : 'Failed to load strategy details');
			} finally {
				setLoading(false);
			}
		};

		fetchStrategyDetails();
	}, [id, isConnected]);

	if (loading) {
		return (
			<div className="container mx-auto px-4 py-8">
				<DashboardNavigation />
				<div className="text-center py-12">
					<p className="text-slate-500 dark:text-slate-400">Loading strategy details...</p>
				</div>
			</div>
		);
	}

	if (error || !strategy) {
		return (
			<div className="container mx-auto px-4 py-8">
				<DashboardNavigation />
				<div className="text-center py-12">
					<p className="text-red-500">{error || 'Strategy not found'}</p>
					<Link href="/strategies" passHref>
						<M3Button variant="filled" className="mt-4">
							Back to Strategies
						</M3Button>
					</Link>
				</div>
			</div>
		);
	}

	const getRiskColor = (level: string) => {
		switch (level) {
			case 'LOW':
				return 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900';
			case 'MEDIUM':
				return 'text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900';
			case 'HIGH':
				return 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900';
			default:
				return 'text-slate-600 bg-slate-100 dark:text-slate-400 dark:bg-slate-800';
		}
	};

	return (
		<div className="container mx-auto px-4 py-8">
			<DashboardNavigation />

			<div className="mb-6">
				<Link href="/strategies" passHref>
					<M3Button variant="text">&larr; Back to Strategies</M3Button>
				</Link>
			</div>

			<div className="max-w-4xl mx-auto">
				<div className="mb-8">
					<h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-4">{strategy.name}</h1>
					<p className="text-lg text-slate-600 dark:text-slate-300 mb-6">{strategy.description}</p>

					<div className="flex flex-wrap gap-4 mb-6">
						<span className={`px-3 py-1 rounded-full text-sm font-medium ${getRiskColor(strategy.riskLevel)}`}>
							{strategy.riskLevel} Risk
						</span>
						<span className="px-3 py-1 rounded-full text-sm font-medium bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300">
							{strategy.apy}% APY
						</span>
						<span className="px-3 py-1 rounded-full text-sm font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
							${(parseFloat(strategy.tvl || '0') / 1000000).toFixed(1)}M TVL
						</span>
					</div>
				</div>

				<div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
					{}
					<div className="lg:col-span-2 space-y-6">
						<M3Card variant="outlined" className="p-6">
							<h2 className="text-xl font-semibold mb-4 text-slate-900 dark:text-white">Strategy Details</h2>

							<div className="grid grid-cols-2 gap-6">
								<div>
									<p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Expected APY</p>
									<p className="text-2xl font-bold text-primary-600 dark:text-primary-400">{strategy.apy}%</p>
								</div>
								<div>
									<p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Total Value Locked</p>
									<p className="text-2xl font-bold text-slate-900 dark:text-white">
										${(parseFloat(strategy.tvl || '0') / 1000000).toFixed(1)}M
									</p>
								</div>
								<div>
									<p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Performance Fee</p>
									<p className="text-lg font-medium text-slate-900 dark:text-white">{strategy.performanceFee}%</p>
								</div>
								<div>
									<p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Min Investment</p>
									<p className="text-lg font-medium text-slate-900 dark:text-white">{strategy.minInvestment} ETH</p>
								</div>
								<div>
									<p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Risk Score</p>
									<p className="text-lg font-medium text-slate-900 dark:text-white">{strategy.riskScore}/100</p>
								</div>
								<div>
									<p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Status</p>
									<span
										className={`inline-block px-2 py-1 rounded text-sm font-medium ${
											strategy.active
												? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
												: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
										}`}
									>
										{strategy.active ? 'Active' : 'Inactive'}
									</span>
								</div>
							</div>
						</M3Card>

						<M3Card variant="outlined" className="p-6">
							<h2 className="text-xl font-semibold mb-4 text-slate-900 dark:text-white">Supported Assets</h2>

							<div className="space-y-3">
								{strategy.supportedTokens.map((tokenAddress) => {
									const tokenInfo = getTokenByAddress(tokenAddress);
									return (
										<div key={tokenAddress} className="flex items-center p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
											<div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 mr-3"></div>
											<div className="flex-1">
												<p className="font-medium text-slate-900 dark:text-white">{tokenInfo?.name || 'Unknown Token'}</p>
												<p className="text-sm text-slate-500 dark:text-slate-400">
													{tokenInfo?.symbol || getTokenDisplayName(tokenAddress)}
												</p>
											</div>
											<div className="text-right">
												<p className="text-sm text-slate-500 dark:text-slate-400">Contract</p>
												<p className="text-xs font-mono text-slate-600 dark:text-slate-400">
													{tokenAddress.slice(0, 6)}...{tokenAddress.slice(-4)}
												</p>
											</div>
										</div>
									);
								})}
							</div>
						</M3Card>
					</div>

					{}
					<div className="space-y-6">
						<M3Card variant="outlined" className="p-6 text-center">
							<h3 className="text-lg font-semibold mb-4 text-slate-900 dark:text-white">Ready to Invest?</h3>

							<div className="mb-4">
								<p className="text-3xl font-bold text-primary-600 dark:text-primary-400 mb-1">{strategy.apy}%</p>
								<p className="text-sm text-slate-500 dark:text-slate-400">Expected Annual Return</p>
							</div>

							<Link href={`/strategies/${id}/invest`} passHref>
								<M3Button variant="filled" fullWidth>
									Invest Now
								</M3Button>
							</Link>

							<p className="text-xs text-slate-500 dark:text-slate-400 mt-3">Min. investment: {strategy.minInvestment} ETH</p>
						</M3Card>

						<M3Card variant="outlined" className="p-6">
							<h3 className="text-lg font-semibold mb-4 text-slate-900 dark:text-white">Risk Information</h3>

							<div className="space-y-4">
								<div>
									<div className="flex justify-between mb-2">
										<span className="text-sm text-slate-500 dark:text-slate-400">Risk Level</span>
										<span
											className={`text-sm font-medium ${getRiskColor(strategy.riskLevel)
												.split(' ')
												.filter((c) => c.startsWith('text-'))
												.join(' ')}`}
										>
											{strategy.riskLevel}
										</span>
									</div>
									<div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
										<div
											className={`h-2 rounded-full ${
												strategy.riskLevel === 'LOW'
													? 'bg-green-500'
													: strategy.riskLevel === 'MEDIUM'
													? 'bg-yellow-500'
													: 'bg-red-500'
											}`}
											style={{
												width: `${strategy.riskLevel === 'LOW' ? 30 : strategy.riskLevel === 'MEDIUM' ? 60 : 90}%`,
											}}
										></div>
									</div>
								</div>

								<div>
									<p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Smart Contract Risk</p>
									<p className="text-sm text-slate-600 dark:text-slate-300">
										All funds are held in audited smart contracts with time-tested protocols.
									</p>
								</div>
							</div>
						</M3Card>
					</div>
				</div>
			</div>
		</div>
	);
}
