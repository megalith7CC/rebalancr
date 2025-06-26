'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { M3Card, M3Button, M3TextField } from '@/components/ui/M3Components';
import { DashboardNavigation } from '@/components/DashboardNavigation';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { strategiesService } from '@/services/StrategiesService';
import { walletTransactionService } from '@/services/WalletTransactionService';
import { getTokenByAddress, getTokenDisplayName, formatTokenAmount } from '@/utils/tokenMapping';

interface InvestPageProps {
	params: Promise<{
		id: string;
	}>;
}

export default function InvestPage({ params }: InvestPageProps) {
	const { address, isConnected } = useAccount();
	const [id, setId] = useState<string>('');
	const [loading, setLoading] = useState(true);
	const [strategy, setStrategy] = useState<any>(null);
	const [selectedToken, setSelectedToken] = useState<string>('');
	const [amount, setAmount] = useState<string>('');
	const [error, setError] = useState<string | null>(null);
	const [investing, setInvesting] = useState<boolean>(false);
	const [transactionHash, setTransactionHash] = useState<string | null>(null);

	useEffect(() => {
		const resolveParams = async () => {
			const resolvedParams = await params;
			setId(resolvedParams.id);
		};
		resolveParams();
	}, [params]);

	useEffect(() => {
		if (!id || !isConnected) return;

		const fetchStrategyDetails = async () => {
			setLoading(true);
			setError(null);

			try {
				await strategiesService.initialize();
				const strategyData = await strategiesService.getStrategyById(id);

				if (!strategyData) {
					setError('Strategy not found');
					return;
				}

				setStrategy(strategyData);

				if (strategyData.supportedTokens && strategyData.supportedTokens.length > 0) {
					setSelectedToken(strategyData.supportedTokens[0]);
				}
			} catch (err) {
				console.error('Error fetching strategy details:', err);
				setError('Failed to load strategy details. Please try again later.');
			} finally {
				setLoading(false);
			}
		};

		fetchStrategyDetails();
	}, [id, isConnected]);

	const getSelectedTokenDetails = () => {
		if (!strategy?.supportedTokens || !selectedToken) return null;

		const tokenInfo = getTokenByAddress(selectedToken);
		return {
			symbol: tokenInfo?.symbol || 'UNKNOWN',
			name: tokenInfo?.name || 'Unknown Token',
			address: selectedToken,
			balance: '0.0',
			valueUsd: '0.00',
		};
	};

	const handleInvest = async () => {
		if (!isConnected || !address) {
			setError('Please connect your wallet to invest.');
			return;
		}

		if (!selectedToken) {
			setError('Please select a token to invest.');
			return;
		}

		if (!amount || parseFloat(amount) <= 0) {
			setError('Please enter a valid amount to invest.');
			return;
		}

		if (parseFloat(amount) < strategy.minInvestment) {
			setError(`Minimum investment amount is ${strategy.minInvestment} ETH.`);
			return;
		}

		setError(null);
		setInvesting(true);

		try {
			const result = await walletTransactionService.deposit({
				tokenAddress: selectedToken,
				amount: amount,
				recipient: address, 
			});

			if (result.success && result.hash) {
				setTransactionHash(result.hash);
			} else {
				throw new Error(result.error || 'Transaction failed');
			}
		} catch (error) {
			console.error('Error investing in strategy:', error);
			setError('Failed to invest in strategy. Please try again later.');
		} finally {
			setInvesting(false);
		}
	};

	if (loading) {
		return (
			<div className="container mx-auto px-4 py-8">
				<DashboardNavigation />
				<div className="text-center py-12">
					<p className="text-slate-500 dark:text-slate-400">Loading investment options...</p>
				</div>
			</div>
		);
	}

	if (!isConnected) {
		return (
			<div className="container mx-auto px-4 py-8">
				<DashboardNavigation />
				<div className="text-center py-12">
					<p className="text-slate-500 dark:text-slate-400 mb-4">Please connect your wallet to invest</p>
					<ConnectButton />
				</div>
			</div>
		);
	}

	if (!strategy) {
		return (
			<div className="container mx-auto px-4 py-8">
				<DashboardNavigation />
				<div className="text-center py-12">
					<p className="text-red-500">Strategy not found</p>
					<Link href="/strategies" passHref>
						<M3Button variant="filled" className="mt-4">
							Back to Strategies
						</M3Button>
					</Link>
				</div>
			</div>
		);
	}

	if (transactionHash) {
		return (
			<div className="container mx-auto px-4 py-8">
				<DashboardNavigation />
				<M3Card variant="outlined" className="max-w-2xl mx-auto p-8">
					<div className="text-center">
						<div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
							<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-500" viewBox="0 0 20 20" fill="currentColor">
								<path
									fillRule="evenodd"
									d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
									clipRule="evenodd"
								/>
							</svg>
						</div>
						<h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Investment Successful!</h1>
						<p className="text-slate-600 dark:text-slate-300 mb-6">Your position has been opened in the {strategy.name}.</p>

						<div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg mb-6 text-left">
							<div className="grid grid-cols-2 gap-4">
								<div>
									<p className="text-sm text-slate-500 dark:text-slate-400">Transaction Hash</p>
									<p className="font-mono text-sm text-slate-900 dark:text-white truncate">{transactionHash}</p>
								</div>
								<div>
									<p className="text-sm text-slate-500 dark:text-slate-400">Amount</p>
									<p className="font-medium text-slate-900 dark:text-white">
										{amount} {getSelectedTokenDetails()?.symbol}
									</p>
								</div>
								<div>
									<p className="text-sm text-slate-500 dark:text-slate-400">Strategy</p>
									<p className="font-medium text-slate-900 dark:text-white">{strategy.name}</p>
								</div>
								<div>
									<p className="text-sm text-slate-500 dark:text-slate-400">Expected APY</p>
									<p className="font-medium text-primary-600 dark:text-primary-400">{strategy.apy}%</p>
								</div>
							</div>
						</div>

						<div className="flex flex-col sm:flex-row gap-4 justify-center">
							<Link href="/positions" passHref>
								<M3Button variant="filled">View My Positions</M3Button>
							</Link>
							<Link href="/dashboard" passHref>
								<M3Button variant="outlined">Go to Dashboard</M3Button>
							</Link>
						</div>
					</div>
				</M3Card>
			</div>
		);
	}

	return (
		<div className="container mx-auto px-4 py-8">
			<DashboardNavigation />
			<div className="mb-6">
				<Link href={`/strategies/${id}`} passHref>
					<M3Button variant="text">&larr; Back to Strategy</M3Button>
				</Link>
			</div>

			<div className="max-w-2xl mx-auto">
				<h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Invest in {strategy.name}</h1>
				<p className="text-slate-600 dark:text-slate-300 mb-8">
					Enter the amount you want to invest to start earning {strategy.apy}% APY.
				</p>

				<M3Card variant="outlined" className="p-6 mb-6">
					<h2 className="text-xl font-semibold mb-4 text-slate-900 dark:text-white">Select Asset</h2>

					<div className="space-y-3 mb-6">
						{strategy.supportedTokens &&
							strategy.supportedTokens.map((tokenAddress: string) => {
								const tokenInfo = getTokenByAddress(tokenAddress);
								return (
									<div
										key={tokenAddress}
										className={`p-4 rounded-lg cursor-pointer flex items-center justify-between ${
											selectedToken === tokenAddress
												? 'bg-primary-50 dark:bg-primary-900 border border-primary-200 dark:border-primary-700'
												: 'bg-slate-50 dark:bg-slate-800 border border-transparent'
										}`}
										onClick={() => setSelectedToken(tokenAddress)}
									>
										<div className="flex items-center">
											<div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 mr-3"></div>
											<div>
												<p className="font-medium text-slate-900 dark:text-white">{tokenInfo?.symbol || 'UNKNOWN'}</p>
												<p className="text-sm text-slate-500 dark:text-slate-400">{tokenInfo?.name || 'Unknown Token'}</p>
											</div>
										</div>
										<div className="text-right">
											<p className="font-medium text-slate-900 dark:text-white">0.0 {tokenInfo?.symbol || 'UNKNOWN'}</p>
											<p className="text-sm text-slate-500 dark:text-slate-400">$0.00</p>
										</div>
									</div>
								);
							})}
					</div>

					<div className="mb-6">
						<label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Amount to Invest</label>
						<M3TextField
							value={amount}
							onChange={(e) => setAmount(e.target.value)}
							type="number"
							placeholder={`Min: ${strategy.minInvestment}`}
							className="w-full"
						/>
						{selectedToken && (
							<div className="flex justify-between mt-2">
								<p className="text-sm text-slate-500 dark:text-slate-400">
									Available: {getSelectedTokenDetails()?.balance} {getSelectedTokenDetails()?.symbol}
								</p>
								<button
									className="text-sm text-primary-600 dark:text-primary-400"
									onClick={() => setAmount(getSelectedTokenDetails()?.balance || '0')}
								>
									Max
								</button>
							</div>
						)}
					</div>

					{error && <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg">{error}</div>}

					{}
					{amount && parseFloat(amount) > 0 && (
						<div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg mb-6">
							<h3 className="font-medium text-slate-900 dark:text-white mb-2">Investment Summary</h3>
							<div className="space-y-2">
								<div className="flex justify-between">
									<span className="text-slate-500 dark:text-slate-400">Amount</span>
									<span className="text-slate-900 dark:text-white">
										{amount} {getSelectedTokenDetails()?.symbol}
									</span>
								</div>
								<div className="flex justify-between">
									<span className="text-slate-500 dark:text-slate-400">Value in USD</span>
									<span className="text-slate-900 dark:text-white">$0.00</span>
								</div>
								<div className="flex justify-between">
									<span className="text-slate-500 dark:text-slate-400">Expected APY</span>
									<span className="text-primary-600 dark:text-primary-400">{strategy.apy}%</span>
								</div>
								<div className="flex justify-between">
									<span className="text-slate-500 dark:text-slate-400">Performance Fee</span>
									<span className="text-slate-900 dark:text-white">{strategy.performanceFee}%</span>
								</div>
							</div>
						</div>
					)}

					<M3Button
						variant="filled"
						fullWidth
						onClick={handleInvest}
						disabled={investing || !isConnected || !amount || parseFloat(amount) <= 0}
					>
						{investing ? 'Processing...' : 'Invest Now'}
					</M3Button>
				</M3Card>

				<M3Card variant="outlined" className="p-6">
					<h2 className="text-lg font-semibold mb-2 text-slate-900 dark:text-white">Important Information</h2>
					<ul className="list-disc pl-5 text-sm text-slate-600 dark:text-slate-300 space-y-1">
						<li>Minimum investment amount: {strategy.minInvestment} ETH</li>
						<li>Performance fee: {strategy.performanceFee}% on profits</li>
						<li>No lock-up period - you can withdraw anytime</li>
						<li>APY is variable and depends on market conditions</li>
						<li>All strategies include smart contract risk</li>
					</ul>
				</M3Card>
			</div>
		</div>
	);
} 