'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAccount } from 'wagmi';
import { M3Card, M3Button, M3TextField } from '@/components/ui/M3Components';
import { DashboardNavigation } from '@/components/DashboardNavigation';
import strategiesService, { StrategyInfo } from '@/services/StrategiesService';

export default function StrategiesPage() {
	const { isConnected } = useAccount();
	const [strategies, setStrategies] = useState<StrategyInfo[]>([]);
	const [loading, setLoading] = useState<boolean>(true);
	const [error, setError] = useState<string | null>(null);
	const [searchTerm, setSearchTerm] = useState<string>('');
	const [riskFilter, setRiskFilter] = useState<string | null>(null);

	useEffect(() => {
		const fetchStrategies = async () => {
			setLoading(true);
			setError(null);

			try {
				if (!isConnected) {
					setLoading(false);
					return;
				}

				await strategiesService.initialize();
				const strategiesData = await strategiesService.getActiveStrategies();

				console.log('Loaded strategies from contract:', strategiesData);
				setStrategies(strategiesData);
			} catch (err) {
				console.error('Error fetching strategies:', err);
				setError(err instanceof Error ? err.message : 'Failed to load strategies');
			} finally {
				setLoading(false);
			}
		};

		fetchStrategies();
	}, [isConnected]);

	const filteredStrategies = strategies.filter((strategy: any) => {
		const matchesSearch =
			strategy.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
			strategy.description.toLowerCase().includes(searchTerm.toLowerCase());

		const matchesRisk = riskFilter ? strategy.riskLevel === riskFilter : true;

		return matchesSearch && matchesRisk;
	});

	const riskFilterOptions = [
		{ value: null, label: 'All Risk Levels' },
		{ value: 'LOW', label: 'Low Risk' },
		{ value: 'MEDIUM', label: 'Medium Risk' },
		{ value: 'HIGH', label: 'High Risk' },
	];

	return (
		<div className="container mx-auto px-4 py-8">
			<DashboardNavigation />
			<h1 className="text-3xl font-bold mb-6 text-slate-900 dark:text-white">Yield Strategies</h1>

			{}
			<div className="mb-6 flex flex-col md:flex-row gap-4">
				<M3TextField
					value={searchTerm}
					onChange={(e) => setSearchTerm(e.target.value)}
					placeholder="Search strategies..."
					className="md:w-1/3"
				/>

				<div className="flex flex-wrap gap-2">
					{riskFilterOptions.map((option) => (
						<M3Button
							key={option.value || 'all'}
							variant={riskFilter === option.value ? 'filled' : 'outlined'}
							onClick={() => setRiskFilter(option.value)}
							className="min-w-[120px]"
						>
							{option.label}
						</M3Button>
					))}
				</div>
			</div>

			{}
			{!isConnected ? (
				<div className="text-center py-12">
					<p className="text-slate-500 dark:text-slate-400 mb-4">Connect your wallet to view available strategies.</p>
				</div>
			) : loading ? (
				<div className="text-center py-12">
					<p className="text-slate-500 dark:text-slate-400">Loading strategies from contract...</p>
				</div>
			) : error ? (
				<div className="text-center py-12">
					<p className="text-red-500">{error}</p>
					<M3Button
						variant="outlined"
						className="mt-4"
						onClick={() => {
							if (isConnected) {
								setLoading(true);
								setError(null);
								strategiesService
									.getActiveStrategies()
									.then(setStrategies)
									.catch((err) => setError(err.message))
									.finally(() => setLoading(false));
							}
						}}
					>
						Retry
					</M3Button>
				</div>
			) : filteredStrategies.length === 0 ? (
				<div className="text-center py-12">
					<p className="text-slate-500 dark:text-slate-400">No strategies found matching your filters.</p>
				</div>
			) : (
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
					{filteredStrategies.map((strategy) => (
						<StrategyCard key={strategy.id} strategy={strategy} />
					))}
				</div>
			)}
		</div>
	);
}

function StrategyCard({ strategy }: { strategy: StrategyInfo }) {
	const getRiskColor = (risk: string) => {
		switch (risk) {
			case 'LOW':
				return 'text-green-500';
			case 'MEDIUM':
				return 'text-yellow-500';
			case 'HIGH':
				return 'text-red-500';
			default:
				return 'text-slate-500';
		}
	};

	return (
		<M3Card variant="outlined" className="flex flex-col h-full">
			<div className="p-5 flex-1">
				<div className="flex justify-between items-start mb-3">
					<h2 className="text-xl font-semibold text-slate-900 dark:text-white">{strategy.name}</h2>
					<span className={`font-medium text-sm ${getRiskColor(strategy.riskLevel)}`}>{strategy.riskLevel} RISK</span>
				</div>

				<p className="text-slate-600 dark:text-slate-300 mb-4">{strategy.description}</p>

				<div className="grid grid-cols-2 gap-4 mb-4">
					<div>
						<h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">APY</h3>
						<p className="text-xl font-bold text-primary-600 dark:text-primary-400">{strategy.apy}%</p>
					</div>

					<div>
						<h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">TVL</h3>
						<p className="text-xl font-bold text-slate-900 dark:text-white">${parseFloat(strategy.tvl || '0').toLocaleString()}</p>
					</div>

					<div>
						<h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Min Investment</h3>
						<p className="text-lg font-medium text-slate-900 dark:text-white">{strategy.minInvestment} ETH</p>
					</div>

					<div>
						<h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Fee</h3>
						<p className="text-lg font-medium text-slate-900 dark:text-white">{strategy.performanceFee}%</p>
					</div>
				</div>
			</div>

			<div className="p-5 border-t border-slate-200 dark:border-slate-700">
				<div className="flex gap-2">
					<Link href={`/strategies/${strategy.id}`} passHref className="flex-1">
						<M3Button variant="outlined" fullWidth>
							Details
						</M3Button>
					</Link>
					<Link href={`/strategies/${strategy.id}/invest`} passHref className="flex-1">
						<M3Button variant="filled" fullWidth>
							Invest
						</M3Button>
					</Link>
				</div>
			</div>
		</M3Card>
	);
}
