'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AlertCircle, TrendingUp, TrendingDown, Zap, Activity, ArrowRight, Wallet, RefreshCw, Plus, Minus } from 'lucide-react';
import { M3Card, M3Button } from './ui/M3Components';
import { useRouter } from 'next/navigation';
import contractService from '@/services/ContractService';
import { getTokenByAddress, AVALANCHE_FUJI_TOKENS } from '@/utils/tokenMapping';
import { useWallet } from '@/hooks/useWallet';
import { useWalletData } from '@/hooks/useWalletData';
import { walletTransactionService } from '@/services/WalletTransactionService';
import { priceService } from '@/services/PriceService';
import { ethers } from 'ethers';

interface PortfolioData {
	totalValue: number;
	assets: Array<{
		symbol: string;
		balance: number;
		value: number;
		change24h: number;
		address: string;
	}>;
	performance: {
		daily: number;
		weekly: number;
		monthly: number;
	};
	settings: {
		autoRebalance: boolean;
		yieldOptimization: boolean;
		riskMonitoring: boolean;
		rebalanceThreshold: number;
		maxSlippage: number;
	};
	riskLevel: 'conservative' | 'moderate' | 'aggressive';
	lastUpdated: number;
}

interface UserPreferences {
	portfolioSettings: {
		autoRebalance: boolean;
		yieldOptimization: boolean;
		riskMonitoring: boolean;
		rebalanceThreshold: number;
		maxSlippage: number;
	};
	defaultRiskLevel: 'conservative' | 'moderate' | 'aggressive';
}

export default function RealtimePortfolio() {
	const router = useRouter();
	const { isConnected, address } = useWallet();
	const walletData = useWalletData();

	const [mounted, setMounted] = useState(false);
	const [portfolioData, setPortfolioData] = useState<PortfolioData | null>(null);
	const [isLoading, setIsLoading] = useState<boolean>(true);
	const [error, setError] = useState<string | null>(null);
	const [portfolioCreationMode, setPortfolioCreationMode] = useState(false);
	const [transactionLoading, setTransactionLoading] = useState<string | null>(null);
	const [priceUpdateLoading, setPriceUpdateLoading] = useState<boolean>(false);
	const [depositAmount, setDepositAmount] = useState<string>('');
	const [withdrawAmount, setWithdrawAmount] = useState<string>('');
	const [selectedAssetForTransaction, setSelectedAssetForTransaction] = useState<string>('AVAX');

	const [portfolioAssets, setPortfolioAssets] = useState<Array<{ symbol: string; allocation: number; address: string }>>([
		{ symbol: 'AVAX', allocation: 40, address: AVALANCHE_FUJI_TOKENS.AVAX.address },
		{ symbol: 'USDC', allocation: 30, address: AVALANCHE_FUJI_TOKENS.USDC.address },
		{ symbol: 'USDT', allocation: 20, address: AVALANCHE_FUJI_TOKENS.USDT.address },
		{ symbol: 'LINK', allocation: 10, address: AVALANCHE_FUJI_TOKENS.LINK.address },
	]);
	const [riskLevel, setRiskLevel] = useState<'conservative' | 'moderate' | 'aggressive'>('moderate');
	const [userPreferences, setUserPreferences] = useState<UserPreferences>({
		portfolioSettings: {
			autoRebalance: true,
			yieldOptimization: true,
			riskMonitoring: true,
			rebalanceThreshold: 5,
			maxSlippage: 1,
		},
		defaultRiskLevel: 'moderate',
	});

	const saveToLocalStorage = (key: string, data: any) => {
		try {
			localStorage.setItem(key, JSON.stringify(data));
		} catch (error) {
			console.error(`Failed to save ${key} to localStorage:`, error);
		}
	};

	const loadFromLocalStorage = (key: string, defaultValue: any = null) => {
		try {
			const item = localStorage.getItem(key);
			return item ? JSON.parse(item) : defaultValue;
		} catch (error) {
			console.error(`Failed to load ${key} from localStorage:`, error);
			return defaultValue;
		}
	};

	useEffect(() => {
		setMounted(true);
	}, []);

	useEffect(() => {
		if (!process.env.NEXT_PUBLIC_COINGECKO_API_KEY) {
			console.warn('NEXT_PUBLIC_COINGECKO_API_KEY not configured. Using public CoinGecko API with rate limits.');
		}

		const savedPortfolio = loadFromLocalStorage('user_portfolio');
		const savedPreferences = loadFromLocalStorage('user_preferences', userPreferences);
		const savedAssets = loadFromLocalStorage('portfolio_assets', portfolioAssets);
		const savedRiskLevel = loadFromLocalStorage('risk_level', riskLevel);

		setUserPreferences(savedPreferences);
		setPortfolioAssets(savedAssets);
		setRiskLevel(savedRiskLevel);

		if (savedPortfolio) {
			setPortfolioData(savedPortfolio);
		}

		if (isConnected && address) {
			fetchPortfolioData();
		} else {
			setIsLoading(false);
		}

		const interval = setInterval(async () => {
			if (portfolioData && isConnected) {
				try {
					setPriceUpdateLoading(true);
					const updatedPortfolio = await updatePortfolioWithLiveData(portfolioData);
					setPortfolioData(updatedPortfolio);
					saveToLocalStorage('user_portfolio', updatedPortfolio);
				} catch (error) {
					console.warn('Failed to update portfolio prices:', error);
				} finally {
					setPriceUpdateLoading(false);
				}
			}
		}, 30000);

		return () => clearInterval(interval);
	}, [isConnected, address]);

	const get24hPriceChange = async (tokenAddress: string): Promise<number> => {
		try {
			return await priceService.get24hPriceChange(tokenAddress);
		} catch (error) {
			console.warn(`Failed to get 24h price change for ${tokenAddress}:`, error);
			return 0;
		}
	};

	const getPortfolioPerformance = async (): Promise<{ daily: number; weekly: number; monthly: number }> => {
		try {
			if (!isConnected || !address) {
				return { daily: 0, weekly: 0, monthly: 0 };
			}

			const positions = await contractService.getUserPositions(address);

			if (positions.length === 0) {
				return { daily: 0, weekly: 0, monthly: 0 };
			}

			let totalEntryValue = 0;
			let totalCurrentValue = 0;

			for (const position of positions) {
				const entryValue = position.amounts.reduce((sum, amount) => sum + parseFloat(amount), 0);
				totalEntryValue += entryValue;

				let currentValue = 0;
				for (let i = 0; i < position.tokens.length; i++) {
					const tokenPrice = await priceService.getTokenPrice(position.tokens[i]);
					const tokenAmount = parseFloat(position.amounts[i]);
					currentValue += tokenPrice * tokenAmount;
				}
				totalCurrentValue += currentValue;
			}

			const totalReturn = totalEntryValue > 0 ? ((totalCurrentValue - totalEntryValue) / totalEntryValue) * 100 : 0;

			return {
				daily: totalReturn * 0.1, 
				weekly: totalReturn * 0.3, 
				monthly: totalReturn, 
			};
		} catch (error) {
			console.warn('Failed to get portfolio performance:', error);
			return { daily: 0, weekly: 0, monthly: 0 };
		}
	};

	const processContractPositions = async (positions: any[]): Promise<Partial<PortfolioData>> => {
		try {
			const contractAssets = [];
			let totalContractValue = 0;

			for (const position of positions) {
				for (let i = 0; i < position.tokens.length; i++) {
					const tokenAddress = position.tokens[i];
					const tokenAmount = parseFloat(position.amounts[i]);
					const tokenPrice = await priceService.getTokenPrice(tokenAddress);
					const tokenValue = tokenAmount * tokenPrice;

					const tokenInfo = getTokenByAddress(tokenAddress);
					const symbol = tokenInfo?.symbol || 'UNKNOWN';

					const existingAssetIndex = contractAssets.findIndex((asset) => asset.address === tokenAddress);
					if (existingAssetIndex >= 0) {
						contractAssets[existingAssetIndex].balance += tokenAmount;
						contractAssets[existingAssetIndex].value += tokenValue;
					} else {
						const change24h = await get24hPriceChange(tokenAddress);
						contractAssets.push({
							symbol,
							balance: tokenAmount,
							value: tokenValue,
							change24h,
							address: tokenAddress,
						});
					}

					totalContractValue += tokenValue;
				}
			}

			return {
				assets: contractAssets,
				totalValue: totalContractValue,
			};
		} catch (error) {
			console.error('Failed to process contract positions:', error);
			return {};
		}
	};

	const fetchPortfolioData = async () => {
		setIsLoading(true);
		setError(null);

		try {
			if (!isConnected || !address) {
				setIsLoading(false);
				return;
			}

			try {
				if (!contractService.isInitialized() && window.ethereum) {
					const provider = new ethers.BrowserProvider(window.ethereum);
					console.log(`[RealtimePortfolio] -- provider is ${provider == null}`)
					contractService.initialize(provider);
				}
			} catch (providerError) {
				console.warn('Failed to initialize contract service:', providerError);
			}

			await walletData.refetch();

			const savedPortfolio = loadFromLocalStorage('user_portfolio');
			if (savedPortfolio || walletData.tokenBalances.length > 0) {
				const realPortfolio = await createPortfolioFromWalletData();
				setPortfolioData(realPortfolio);
				saveToLocalStorage('user_portfolio', realPortfolio);
			}

			try {
				const positions = await contractService.getUserPositions(address);
				if (positions.length > 0) {
					const contractPortfolio = await processContractPositions(positions);
					setPortfolioData((prev) => {
						if (!prev) return null;
						return {
							...prev,
							assets: contractPortfolio.assets || prev.assets,
							totalValue: contractPortfolio.totalValue || prev.totalValue,
						};
					});
				}
			} catch (contractError) {
				console.warn('Contract positions unavailable, using wallet data only:', contractError);
			}
		} catch (err) {
			console.error('Error fetching portfolio data:', err);
			setError('Failed to load portfolio data. Please try again.');
		} finally {
			setIsLoading(false);
		}
	};

	const createPortfolioFromWalletData = async (): Promise<PortfolioData> => {
		const totalValue = walletData.tokenBalances.reduce((sum, balance) => sum + (balance.usdValue || 0), 0);

		const validBalances = walletData.tokenBalances.filter((balance) => parseFloat(balance.balanceFormatted) > 0);

		const tokenAddresses = validBalances.map((balance) => balance.address);

		const priceChanges = await priceService.get24hPriceChanges(tokenAddresses);

		const assets = validBalances.map((balance) => {
			const change24h = priceChanges[balance.address.toLowerCase()] || 0;

			return {
				symbol: balance.symbol,
				balance: parseFloat(balance.balanceFormatted),
				value: balance.usdValue || 0,
				change24h,
				address: balance.address,
			};
		});

		const performance = await getPortfolioPerformance();

		return {
			totalValue,
			assets,
			performance,
			settings: userPreferences.portfolioSettings,
			riskLevel,
			lastUpdated: Date.now(),
		};
	};

	const updatePortfolioWithLiveData = async (portfolio: PortfolioData): Promise<PortfolioData> => {
		try {
			const updatedAssets = await Promise.all(
				portfolio.assets.map(async (asset) => {
					try {
						const currentPrice = await priceService.getTokenPrice(asset.address);
						const newValue = asset.balance * currentPrice;

						const change24h = await get24hPriceChange(asset.address);

						return {
							...asset,
							value: newValue,
							change24h,
						};
					} catch (error) {
						console.warn(`Failed to update price for ${asset.symbol}:`, error);
						return asset; 
					}
				})
			);

			const totalValue = updatedAssets.reduce((sum, asset) => sum + asset.value, 0);

			const performance = await getPortfolioPerformance();

			return {
				...portfolio,
				assets: updatedAssets,
				totalValue,
				performance,
				lastUpdated: Date.now(),
			};
		} catch (error) {
			console.error('Failed to update portfolio with live data:', error);
			return {
				...portfolio,
				lastUpdated: Date.now(),
			};
		}
	};

	const formatCurrency = (amount: number) => {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD',
		}).format(amount);
	};

	const formatPercentage = (value: number) => {
		return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
	};

	const AssetRowSkeleton = () => (
		<tr style={{ borderBottom: '1px solid var(--md-sys-color-outline-variant)' }}>
			<td className="px-6 py-4">
				<div className="flex items-center">
					<div
						className="w-8 h-8 rounded-full mr-3 animate-pulse"
						style={{ backgroundColor: 'var(--md-sys-color-surface-variant)' }}
					/>
					<div
						className="h-4 bg-gray-300 rounded animate-pulse w-16"
						style={{ backgroundColor: 'var(--md-sys-color-surface-variant)' }}
					/>
				</div>
			</td>
			<td className="px-6 py-4">
				<div
					className="h-4 bg-gray-300 rounded animate-pulse w-20"
					style={{ backgroundColor: 'var(--md-sys-color-surface-variant)' }}
				/>
			</td>
			<td className="px-6 py-4">
				<div
					className="h-4 bg-gray-300 rounded animate-pulse w-16"
					style={{ backgroundColor: 'var(--md-sys-color-surface-variant)' }}
				/>
			</td>
			<td className="px-6 py-4">
				<div className="flex items-center">
					<div
						className="h-4 bg-gray-300 rounded animate-pulse w-12"
						style={{ backgroundColor: 'var(--md-sys-color-surface-variant)' }}
					/>
					<div
						className="w-4 h-4 ml-2 bg-gray-300 rounded animate-pulse"
						style={{ backgroundColor: 'var(--md-sys-color-surface-variant)' }}
					/>
				</div>
			</td>
		</tr>
	);

	const handleCreatePortfolio = async () => {
		setIsLoading(true);
		setError(null);

		try {
			if (totalAllocation !== 100) {
				setError('Portfolio allocation must total exactly 100%');
				setIsLoading(false);
				return;
			}

			if (portfolioAssets.some((asset) => !asset.symbol.trim())) {
				setError('All assets must have valid symbols');
				setIsLoading(false);
				return;
			}

			const portfolioValue = 10000; 
			const newPortfolio: PortfolioData = {
				totalValue: portfolioValue,
				assets: await Promise.all(
					portfolioAssets.map(async (asset) => {
						try {
							const tokenInfo = getTokenByAddress(asset.address);
							const allocationValue = (portfolioValue * asset.allocation) / 100;
							const tokenPrice = await priceService.getTokenPrice(asset.address);
							const balance = allocationValue / tokenPrice;

							const change24h = await get24hPriceChange(asset.address);

							return {
								symbol: asset.symbol,
								balance,
								value: allocationValue,
								change24h,
								address: asset.address,
							};
						} catch (error) {
							console.warn(`Failed to get price for ${asset.symbol}:`, error);
							const allocationValue = (portfolioValue * asset.allocation) / 100;
							return {
								symbol: asset.symbol,
								balance: 0,
								value: allocationValue,
								change24h: 0,
								address: asset.address,
							};
						}
					})
				),
				performance: {
					daily: 0,
					weekly: 0,
					monthly: 0,
				},
				settings: userPreferences.portfolioSettings,
				riskLevel,
				lastUpdated: Date.now(),
			};

			setPortfolioData(newPortfolio);
			saveToLocalStorage('user_portfolio', newPortfolio);
			saveToLocalStorage('portfolio_assets', portfolioAssets);
			saveToLocalStorage('risk_level', riskLevel);
			saveToLocalStorage('user_preferences', userPreferences);

			setPortfolioCreationMode(false);

			try {
				if (contractService.isInitialized() && isConnected && address) {
					console.log('Portfolio created in UI. User can now deposit funds to create on-chain positions.');
				}
			} catch (contractError) {
				console.warn('Contract portfolio creation not available:', contractError);
			}
		} catch (err) {
			console.error('Error creating portfolio:', err);
			setError('Failed to create portfolio. Please try again.');
		} finally {
			setIsLoading(false);
		}
	};

	const updatePortfolioSettings = (setting: keyof UserPreferences['portfolioSettings'], value: boolean | number) => {
		const updatedPreferences = {
			...userPreferences,
			portfolioSettings: {
				...userPreferences.portfolioSettings,
				[setting]: value,
			},
		};
		setUserPreferences(updatedPreferences);
		saveToLocalStorage('user_preferences', updatedPreferences);

		if (portfolioData) {
			const updatedPortfolio = {
				...portfolioData,
				settings: updatedPreferences.portfolioSettings,
			};
			setPortfolioData(updatedPortfolio);
			saveToLocalStorage('user_portfolio', updatedPortfolio);
		}
	};

	const addAsset = () => {
		const newAssets = [...portfolioAssets, { symbol: '', allocation: 0, address: '' }];
		setPortfolioAssets(newAssets);
		saveToLocalStorage('portfolio_assets', newAssets);
	};

	const removeAsset = (index: number) => {
		const newAssets = portfolioAssets.filter((_, i) => i !== index);
		setPortfolioAssets(newAssets);
		saveToLocalStorage('portfolio_assets', newAssets);
	};

	const updateAssetAllocation = (index: number, newAllocation: number) => {
		const updatedAssets = [...portfolioAssets];
		updatedAssets[index].allocation = newAllocation;
		setPortfolioAssets(updatedAssets);
		saveToLocalStorage('portfolio_assets', updatedAssets);
	};

	const updateAssetSymbol = (index: number, symbol: string) => {
		const updatedAssets = [...portfolioAssets];
		updatedAssets[index].symbol = symbol;

		const tokenInfo = Object.values(AVALANCHE_FUJI_TOKENS).find((token) => token.symbol === symbol);
		if (tokenInfo) {
			updatedAssets[index].address = tokenInfo.address;
		}

		setPortfolioAssets(updatedAssets);
		saveToLocalStorage('portfolio_assets', updatedAssets);
	};

	const handleDeposit = async () => {
		if (!isConnected || !address) {
			setError('Please connect your wallet first');
			return;
		}

		if (!depositAmount || parseFloat(depositAmount) <= 0) {
			setError('Please enter a valid deposit amount');
			return;
		}

		const selectedToken = walletData.tokenBalances.find((token) => token.symbol === selectedAssetForTransaction);
		if (!selectedToken) {
			setError('Selected token not found in wallet');
			return;
		}

		const depositAmountNum = parseFloat(depositAmount);
		const availableBalance = parseFloat(selectedToken.balanceFormatted);

		if (depositAmountNum > availableBalance) {
			setError(`Insufficient balance. Available: ${availableBalance} ${selectedToken.symbol}`);
			return;
		}

		setTransactionLoading('deposit');
		setError(null);

		try {
			const result = await walletTransactionService.deposit({
				tokenAddress: selectedToken.address,
				amount: depositAmount,
			});

			if (result.success) {
				setDepositAmount('');
				await fetchPortfolioData(); 
				alert(`Deposit successful! Transaction: ${result.hash}`);
			} else {
				setError(result.error || 'Deposit failed');
			}
		} catch (err) {
			console.error('Deposit error:', err);
			setError('Deposit failed. Please try again.');
		} finally {
			setTransactionLoading(null);
		}
	};

	const handleWithdraw = async () => {
		if (!isConnected || !address) {
			setError('Please connect your wallet first');
			return;
		}

		if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
			setError('Please enter a valid withdrawal amount');
			return;
		}

		if (!portfolioData) {
			setError('No portfolio found');
			return;
		}

		const selectedAsset = portfolioData.assets.find((asset) => asset.symbol === selectedAssetForTransaction);
		if (!selectedAsset) {
			setError('Selected asset not found in portfolio');
			return;
		}

		const withdrawAmountNum = parseFloat(withdrawAmount);
		if (withdrawAmountNum > selectedAsset.balance) {
			setError(`Insufficient portfolio balance. Available: ${selectedAsset.balance} ${selectedAsset.symbol}`);
			return;
		}

		setTransactionLoading('withdraw');
		setError(null);

		try {
			const result = await walletTransactionService.withdraw({
				tokenAddress: selectedAsset.address,
				amount: withdrawAmount,
			});

			if (result.success) {
				setWithdrawAmount('');
				await fetchPortfolioData(); 
				alert(`Withdrawal successful! Transaction: ${result.hash}`);
			} else {
				setError(result.error || 'Withdrawal failed');
			}
		} catch (err) {
			console.error('Withdrawal error:', err);
			setError('Withdrawal failed. Please try again.');
		} finally {
			setTransactionLoading(null);
		}
	};

	const handleManualRebalance = async () => {
		if (!isConnected || !address) {
			setError('Please connect your wallet first');
			return;
		}

		if (!portfolioData || portfolioData.assets.length === 0) {
			setError('No portfolio to rebalance');
			return;
		}

		setTransactionLoading('rebalance');
		setError(null);

		try {
			const fromTokens = portfolioData.assets.map((asset) => ({
				address: asset.address,
				amount: asset.balance.toString(),
			}));

			const toTokens = portfolioAssets.map((asset) => ({
				address: asset.address,
				targetAllocation: asset.allocation,
			}));

			const result = await walletTransactionService.rebalance({
				fromTokens,
				toTokens,
			});

			if (result.success) {
				await fetchPortfolioData(); 
				alert(`Rebalancing successful! Transaction: ${result.hash}`);
			} else {
				setError(result.error || 'Rebalancing failed');
			}
		} catch (err) {
			console.error('Rebalancing error:', err);
			setError('Rebalancing failed. Please try again.');
		} finally {
			setTransactionLoading(null);
		}
	};

	const totalAllocation = portfolioAssets.reduce((sum, asset) => sum + asset.allocation, 0);
	const remainingAllocation = 100 - totalAllocation;

	return (
		<div className="flex flex-col gap-6">
			{}
			{!mounted && (
				<M3Card variant="filled" className="p-4">
					<div className="flex items-center space-x-2">
						<div className="animate-spin h-4 w-4 border-2 border-primary-600 border-t-transparent rounded-full" />
						<span style={{ color: 'var(--md-sys-color-on-surface)' }}>Initializing...</span>
					</div>
				</M3Card>
			)}

			{mounted && isLoading && (
				<M3Card variant="filled" className="p-4">
					<div className="flex items-center space-x-2">
						<div className="animate-spin h-4 w-4 border-2 border-primary-600 border-t-transparent rounded-full" />
						<span style={{ color: 'var(--md-sys-color-on-surface)' }}>Loading portfolio data...</span>
					</div>
				</M3Card>
			)}

			{mounted && error && (
				<M3Card variant="filled" className="p-4" style={{ backgroundColor: 'var(--md-sys-color-error-container)' }}>
					<div className="flex items-center space-x-2">
						<AlertCircle className="w-4 h-4" style={{ color: 'var(--md-sys-color-on-error-container)' }} />
						<span style={{ color: 'var(--md-sys-color-on-error-container)' }}>{error}</span>
					</div>
				</M3Card>
			)}

			{}
			{mounted && (
				<div className="flex-1 space-y-6">
					{}
					<div className="flex items-center justify-between">
						<h2
							style={{
								fontFamily: 'var(--md-sys-typescale-headline-small-font)',
								fontSize: 'var(--md-sys-typescale-headline-small-size)',
								color: 'var(--md-sys-color-on-surface)',
							}}
						>
							{portfolioData ? 'Your Portfolio' : 'Create Your Portfolio'}
						</h2>
						<div className="flex space-x-3">
							{portfolioData ? (
								<M3Button variant="outlined" size="medium" onClick={() => setPortfolioCreationMode(true)}>
									Adjust Portfolio
								</M3Button>
							) : (
								<M3Button variant="filled" size="medium" onClick={() => setPortfolioCreationMode(true)}>
									Create Portfolio
								</M3Button>
							)}
						</div>
					</div>

					{}
					{!portfolioData && !portfolioCreationMode && (
						<>
							<M3Card variant="filled" className="p-4">
								<div className="flex items-center justify-between">
									<div className="flex items-center space-x-2">
										{!mounted ? (
											<>
												<div className="w-3 h-3 rounded-full bg-surface-variant animate-pulse" />
												<span
													style={{
														fontFamily: 'var(--md-sys-typescale-body-medium-font)',
														color: 'var(--md-sys-color-on-surface-variant)',
													}}
												>
													Loading wallet status...
												</span>
											</>
										) : isConnected ? (
											<>
												<div className="w-3 h-3 rounded-full bg-success" />
												<span
													style={{
														fontFamily: 'var(--md-sys-typescale-body-medium-font)',
														color: 'var(--md-sys-color-success)',
													}}
												>
													Wallet Connected: {address?.slice(0, 6)}...{address?.slice(-4)}
												</span>
												<span
													style={{
														fontFamily: 'var(--md-sys-typescale-body-small-font)',
														color: 'var(--md-sys-color-on-surface-variant)',
														marginLeft: '8px',
													}}
												>
													{walletData.network}
												</span>
											</>
										) : (
											<>
												<div className="w-3 h-3 rounded-full bg-warning" />
												<span
													style={{
														fontFamily: 'var(--md-sys-typescale-body-medium-font)',
														color: 'var(--md-sys-color-warning)',
													}}
												>
													Connect wallet to view your portfolio
												</span>
											</>
										)}
									</div>
									{mounted && isConnected && (
										<div className="flex items-center space-x-2">
											<M3Button
												variant="text"
												size="small"
												onClick={() => walletData.refetch()}
												icon={<RefreshCw className="w-4 h-4" />}
												disabled={walletData.isLoading}
											>
												Refresh
											</M3Button>
										</div>
									)}
								</div>
							</M3Card>

							{}
							{mounted && isConnected && walletData.tokenBalances.length > 0 && (
								<M3Card variant="elevated" className="p-6">
									<h3
										style={{
											fontFamily: 'var(--md-sys-typescale-title-large-font)',
											fontSize: 'var(--md-sys-typescale-title-large-size)',
											color: 'var(--md-sys-color-on-surface)',
											marginBottom: '1rem',
										}}
									>
										Your Wallet Assets
									</h3>
									<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
										{walletData.tokenBalances.slice(0, 4).map((balance) => (
											<div
												key={balance.symbol}
												className="p-4 rounded-lg"
												style={{ backgroundColor: 'var(--md-sys-color-surface-container)' }}
											>
												<div className="flex items-center justify-between mb-2">
													<span
														style={{
															fontFamily: 'var(--md-sys-typescale-title-small-font)',
															color: 'var(--md-sys-color-on-surface)',
														}}
													>
														{balance.symbol}
													</span>
													<Wallet className="w-4 h-4" style={{ color: 'var(--md-sys-color-primary)' }} />
												</div>
												<div>
													<p
														style={{
															fontFamily: 'var(--md-sys-typescale-body-large-font)',
															color: 'var(--md-sys-color-on-surface)',
															fontWeight: 'bold',
														}}
													>
														{parseFloat(balance.balanceFormatted).toFixed(4)}
													</p>
													<p
														style={{
															fontFamily: 'var(--md-sys-typescale-body-small-font)',
															color: 'var(--md-sys-color-on-surface-variant)',
														}}
													>
														${(balance.usdValue || 0).toFixed(2)}
													</p>
												</div>
											</div>
										))}
									</div>
									<div className="text-center">
										<p
											style={{
												fontFamily: 'var(--md-sys-typescale-body-large-font)',
												color: 'var(--md-sys-color-on-surface-variant)',
												marginBottom: '1rem',
											}}
										>
											Total Wallet Value: $
											{walletData.tokenBalances.reduce((sum, balance) => sum + (balance.usdValue || 0), 0).toFixed(2)}
										</p>
										<M3Button variant="filled" size="medium" onClick={() => setPortfolioCreationMode(true)}>
											Create Portfolio from Wallet
										</M3Button>
									</div>
								</M3Card>
							)}

							{}
							<M3Card variant="elevated" className="p-6">
								<div className="text-center space-y-4">
									<h3
										style={{
											fontFamily: 'var(--md-sys-typescale-title-large-font)',
											fontSize: 'var(--md-sys-typescale-title-large-size)',
											color: 'var(--md-sys-color-on-surface)',
										}}
									>
										Welcome to Rebalancr
									</h3>
									<p
										style={{
											fontFamily: 'var(--md-sys-typescale-body-large-font)',
											color: 'var(--md-sys-color-on-surface-variant)',
											maxWidth: '600px',
											margin: '0 auto',
										}}
									>
										Get started by exploring our yield strategies, then create your portfolio to begin automated DeFi management.
									</p>

									<div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
										<M3Button
											variant="outlined"
											size="medium"
											onClick={() => router.push('/strategies')}
											icon={<ArrowRight className="w-4 h-4" />}
										>
											Browse Strategies
										</M3Button>
										<M3Button variant="filled" size="medium" onClick={() => setPortfolioCreationMode(true)}>
											Create Portfolio
										</M3Button>
									</div>

									{}
									<div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
										<div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--md-sys-color-surface-container)' }}>
											<h4
												style={{
													fontFamily: 'var(--md-sys-typescale-title-medium-font)',
													color: 'var(--md-sys-color-on-surface)',
													marginBottom: '0.5rem',
												}}
											>
												Aave Yield Strategy
											</h4>
											<p
												style={{
													fontFamily: 'var(--md-sys-typescale-body-medium-font)',
													color: 'var(--md-sys-color-on-surface-variant)',
													fontSize: '0.875rem',
												}}
											>
												Earn yield through Aave V3 lending protocols
											</p>
										</div>
										<div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--md-sys-color-surface-container)' }}>
											<h4
												style={{
													fontFamily: 'var(--md-sys-typescale-title-medium-font)',
													color: 'var(--md-sys-color-on-surface)',
													marginBottom: '0.5rem',
												}}
											>
												Balancer LP Strategy
											</h4>
											<p
												style={{
													fontFamily: 'var(--md-sys-typescale-body-medium-font)',
													color: 'var(--md-sys-color-on-surface-variant)',
													fontSize: '0.875rem',
												}}
											>
												Provide liquidity and earn trading fees
											</p>
										</div>
									</div>
								</div>
							</M3Card>
						</>
					)}

					{portfolioCreationMode ? (
						
						<M3Card variant="elevated" className="p-6">
							<h3
								style={{
									fontFamily: 'var(--md-sys-typescale-title-large-font)',
									fontSize: 'var(--md-sys-typescale-title-large-size)',
									color: 'var(--md-sys-color-on-surface)',
									marginBottom: '1rem',
								}}
							>
								{portfolioData ? 'Adjust Portfolio' : 'Create New Portfolio'}
							</h3>

							<div className="space-y-6">
								{}
								<div>
									<div className="flex justify-between items-center mb-3">
										<h4
											style={{
												fontFamily: 'var(--md-sys-typescale-title-medium-font)',
												fontSize: 'var(--md-sys-typescale-title-medium-size)',
												color: 'var(--md-sys-color-on-surface)',
											}}
										>
											Asset Allocation
										</h4>
										<span
											style={{
												fontFamily: 'var(--md-sys-typescale-body-medium-font)',
												color: remainingAllocation < 0 ? 'var(--md-sys-color-error)' : 'var(--md-sys-color-on-surface-variant)',
											}}
										>
											Remaining: {remainingAllocation}%
										</span>
									</div>

									<div className="space-y-3 mb-4">
										{portfolioAssets.map((asset, index) => (
											<div key={index} className="flex items-center space-x-3">
												<div className="w-1/3">
													<input
														type="text"
														value={asset.symbol}
														onChange={(e) => updateAssetSymbol(index, e.target.value.toUpperCase())}
														placeholder="Symbol"
														className="w-full p-2 border rounded"
														style={{
															borderColor: 'var(--md-sys-color-outline)',
															backgroundColor: 'var(--md-sys-color-surface-container)',
															color: 'var(--md-sys-color-on-surface)',
														}}
													/>
												</div>
												<div className="flex-1 flex items-center space-x-2">
													<input
														type="range"
														min="0"
														max="100"
														value={asset.allocation}
														onChange={(e) => updateAssetAllocation(index, parseInt(e.target.value))}
														className="flex-1"
													/>
													<span
														className="w-12 text-center"
														style={{
															fontFamily: 'var(--md-sys-typescale-body-medium-font)',
															color: 'var(--md-sys-color-on-surface)',
														}}
													>
														{asset.allocation}%
													</span>
												</div>
												<button
													onClick={() => removeAsset(index)}
													className="p-1 rounded-full hover:bg-error/10"
													style={{ color: 'var(--md-sys-color-error)' }}
												>
													<svg
														xmlns="http://www.w3.org/2000/svg"
														width="20"
														height="20"
														viewBox="0 0 24 24"
														fill="none"
														stroke="currentColor"
														strokeWidth="2"
														strokeLinecap="round"
														strokeLinejoin="round"
													>
														<line x1="18" y1="6" x2="6" y2="18"></line>
														<line x1="6" y1="6" x2="18" y2="18"></line>
													</svg>
												</button>
											</div>
										))}
									</div>

									<M3Button variant="text" size="small" onClick={addAsset}>
										+ Add Asset
									</M3Button>
								</div>

								{}
								<div>
									<h4
										style={{
											fontFamily: 'var(--md-sys-typescale-title-medium-font)',
											fontSize: 'var(--md-sys-typescale-title-medium-size)',
											color: 'var(--md-sys-color-on-surface)',
											marginBottom: '0.5rem',
										}}
									>
										Risk Level
									</h4>
									<div className="flex space-x-4">
										{(['conservative', 'moderate', 'aggressive'] as const).map((risk) => (
											<label key={risk} className="flex items-center space-x-2 cursor-pointer">
												<input
													type="radio"
													name="riskLevel"
													value={risk}
													checked={riskLevel === risk}
													onChange={() => setRiskLevel(risk)}
													className="accent-primary"
												/>
												<span
													style={{
														fontFamily: 'var(--md-sys-typescale-body-medium-font)',
														color: 'var(--md-sys-color-on-surface)',
														textTransform: 'capitalize',
													}}
												>
													{risk}
												</span>
											</label>
										))}
									</div>
								</div>

								{}
								<div className="flex justify-end space-x-3">
									<M3Button variant="text" size="medium" onClick={() => setPortfolioCreationMode(false)}>
										Cancel
									</M3Button>
									<M3Button
										variant="filled"
										size="medium"
										onClick={handleCreatePortfolio}
										disabled={isLoading || totalAllocation !== 100}
									>
										{portfolioData ? 'Update Portfolio' : 'Create Portfolio'}
									</M3Button>
								</div>
							</div>
						</M3Card>
					) : 
					portfolioData ? (
						<>
							{}
							<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
								<M3Card variant="elevated" className="p-6">
									<div className="flex items-center justify-between mb-2">
										<h3
											style={{
												fontFamily: 'var(--md-sys-typescale-title-medium-font)',
												fontSize: 'var(--md-sys-typescale-title-medium-size)',
												color: 'var(--md-sys-color-on-surface)',
											}}
										>
											Total Value
										</h3>
										{priceUpdateLoading && (
											<div className="flex items-center space-x-1">
												<div
													className="animate-spin h-3 w-3 border border-primary-600 border-t-transparent rounded-full"
													style={{ borderColor: 'var(--md-sys-color-primary)' }}
												/>
												<span
													style={{
														fontSize: '0.75rem',
														color: 'var(--md-sys-color-on-surface-variant)',
														fontFamily: 'var(--md-sys-typescale-body-small-font)',
													}}
												>
													Updating...
												</span>
											</div>
										)}
									</div>
									<p
										style={{
											fontFamily: 'var(--md-sys-typescale-headline-large-font)',
											fontSize: 'var(--md-sys-typescale-headline-large-size)',
											color: 'var(--md-sys-color-primary)',
										}}
									>
										{formatCurrency(portfolioData.totalValue)}
									</p>
								</M3Card>

								<M3Card variant="elevated" className="p-6">
									<h3
										style={{
											fontFamily: 'var(--md-sys-typescale-title-medium-font)',
											fontSize: 'var(--md-sys-typescale-title-medium-size)',
											color: 'var(--md-sys-color-on-surface)',
										}}
										className="mb-2"
									>
										24h Change
									</h3>
									<p
										style={{
											fontFamily: 'var(--md-sys-typescale-headline-large-font)',
											fontSize: 'var(--md-sys-typescale-headline-large-size)',
											color: portfolioData.performance.daily >= 0 ? 'var(--md-sys-color-success)' : 'var(--md-sys-color-error)',
										}}
									>
										{formatPercentage(portfolioData.performance.daily)}
									</p>
								</M3Card>

								<M3Card variant="elevated" className="p-6">
									<h3
										style={{
											fontFamily: 'var(--md-sys-typescale-title-medium-font)',
											fontSize: 'var(--md-sys-typescale-title-medium-size)',
											color: 'var(--md-sys-color-on-surface)',
										}}
										className="mb-2"
									>
										Assets
									</h3>
									<p
										style={{
											fontFamily: 'var(--md-sys-typescale-headline-large-font)',
											fontSize: 'var(--md-sys-typescale-headline-large-size)',
											color: 'var(--md-sys-color-on-surface)',
										}}
									>
										{portfolioData.assets.length}
									</p>
								</M3Card>
							</div>

							{}
							{mounted && isConnected && (
								<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
									{}
									<M3Card variant="elevated" className="p-6">
										<h3
											style={{
												fontFamily: 'var(--md-sys-typescale-title-medium-font)',
												fontSize: 'var(--md-sys-typescale-title-medium-size)',
												color: 'var(--md-sys-color-on-surface)',
												marginBottom: '1rem',
											}}
										>
											<Plus className="w-5 h-5 inline mr-2" />
											Deposit to Portfolio
										</h3>
										<div className="space-y-4">
											<div>
												<label
													style={{
														fontFamily: 'var(--md-sys-typescale-body-medium-font)',
														color: 'var(--md-sys-color-on-surface)',
														display: 'block',
														marginBottom: '0.5rem',
													}}
												>
													Asset
												</label>
												<select
													value={selectedAssetForTransaction}
													onChange={(e) => setSelectedAssetForTransaction(e.target.value)}
													className="w-full p-2 border rounded"
													style={{
														borderColor: 'var(--md-sys-color-outline)',
														backgroundColor: 'var(--md-sys-color-surface-container)',
														color: 'var(--md-sys-color-on-surface)',
													}}
												>
													{walletData.tokenBalances.map((balance) => (
														<option key={balance.symbol} value={balance.symbol}>
															{balance.symbol} - Available: {parseFloat(balance.balanceFormatted).toFixed(4)}
														</option>
													))}
												</select>
											</div>
											<div>
												<label
													style={{
														fontFamily: 'var(--md-sys-typescale-body-medium-font)',
														color: 'var(--md-sys-color-on-surface)',
														display: 'block',
														marginBottom: '0.5rem',
													}}
												>
													Amount
												</label>
												<input
													type="number"
													value={depositAmount}
													onChange={(e) => setDepositAmount(e.target.value)}
													placeholder="0.00"
													min="0"
													step="0.0001"
													className="w-full p-2 border rounded"
													style={{
														borderColor: 'var(--md-sys-color-outline)',
														backgroundColor: 'var(--md-sys-color-surface-container)',
														color: 'var(--md-sys-color-on-surface)',
													}}
												/>
											</div>
											<M3Button
												variant="filled"
												size="medium"
												onClick={handleDeposit}
												disabled={transactionLoading === 'deposit' || !depositAmount || parseFloat(depositAmount) <= 0}
												className="w-full"
											>
												{transactionLoading === 'deposit' ? 'Processing...' : 'Deposit'}
											</M3Button>
										</div>
									</M3Card>

									{}
									<M3Card variant="elevated" className="p-6">
										<h3
											style={{
												fontFamily: 'var(--md-sys-typescale-title-medium-font)',
												fontSize: 'var(--md-sys-typescale-title-medium-size)',
												color: 'var(--md-sys-color-on-surface)',
												marginBottom: '1rem',
											}}
										>
											<Minus className="w-5 h-5 inline mr-2" />
											Withdraw from Portfolio
										</h3>
										<div className="space-y-4">
											<div>
												<label
													style={{
														fontFamily: 'var(--md-sys-typescale-body-medium-font)',
														color: 'var(--md-sys-color-on-surface)',
														display: 'block',
														marginBottom: '0.5rem',
													}}
												>
													Asset
												</label>
												<select
													value={selectedAssetForTransaction}
													onChange={(e) => setSelectedAssetForTransaction(e.target.value)}
													className="w-full p-2 border rounded"
													style={{
														borderColor: 'var(--md-sys-color-outline)',
														backgroundColor: 'var(--md-sys-color-surface-container)',
														color: 'var(--md-sys-color-on-surface)',
													}}
												>
													{portfolioData.assets.map((asset) => (
														<option key={asset.symbol} value={asset.symbol}>
															{asset.symbol} - Available: {asset.balance.toFixed(4)}
														</option>
													))}
												</select>
											</div>
											<div>
												<label
													style={{
														fontFamily: 'var(--md-sys-typescale-body-medium-font)',
														color: 'var(--md-sys-color-on-surface)',
														display: 'block',
														marginBottom: '0.5rem',
													}}
												>
													Amount
												</label>
												<input
													type="number"
													value={withdrawAmount}
													onChange={(e) => setWithdrawAmount(e.target.value)}
													placeholder="0.00"
													min="0"
													step="0.0001"
													className="w-full p-2 border rounded"
													style={{
														borderColor: 'var(--md-sys-color-outline)',
														backgroundColor: 'var(--md-sys-color-surface-container)',
														color: 'var(--md-sys-color-on-surface)',
													}}
												/>
											</div>
											<M3Button
												variant="outlined"
												size="medium"
												onClick={handleWithdraw}
												disabled={transactionLoading === 'withdraw' || !withdrawAmount || parseFloat(withdrawAmount) <= 0}
												className="w-full"
											>
												{transactionLoading === 'withdraw' ? 'Processing...' : 'Withdraw'}
											</M3Button>
										</div>
									</M3Card>
								</div>
							)}

							{}
							<M3Card variant="elevated" className="p-6">
								<div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
									<div>
										<h3
											style={{
												fontFamily: 'var(--md-sys-typescale-title-medium-font)',
												fontSize: 'var(--md-sys-typescale-title-medium-size)',
												color: 'var(--md-sys-color-on-surface)',
											}}
										>
											Portfolio Management
										</h3>
										<p
											style={{
												fontFamily: 'var(--md-sys-typescale-body-medium-font)',
												color: 'var(--md-sys-color-on-surface-variant)',
												marginTop: '0.25rem',
											}}
										>
											Manually rebalance your portfolio or adjust settings
										</p>
									</div>
									<div className="flex gap-3">
										<M3Button
											variant="outlined"
											size="medium"
											onClick={handleManualRebalance}
											disabled={transactionLoading === 'rebalance'}
											icon={<RefreshCw className="w-4 h-4" />}
										>
											{transactionLoading === 'rebalance' ? 'Rebalancing...' : 'Rebalance Now'}
										</M3Button>
										<M3Button variant="filled" size="medium" onClick={() => setPortfolioCreationMode(true)}>
											Adjust Portfolio
										</M3Button>
									</div>
								</div>
							</M3Card>

							{}
							<M3Card variant="elevated" className="overflow-hidden">
								<div className="p-4 border-b" style={{ borderColor: 'var(--md-sys-color-outline-variant)' }}>
									<h3
										style={{
											fontFamily: 'var(--md-sys-typescale-title-large-font)',
											fontSize: 'var(--md-sys-typescale-title-large-size)',
											color: 'var(--md-sys-color-on-surface)',
										}}
									>
										Asset Breakdown
									</h3>
								</div>
								<div className="overflow-x-auto">
									<table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
										<thead>
											<tr style={{ backgroundColor: 'var(--md-sys-color-surface-container)' }}>
												<th
													className="px-6 py-3 text-left"
													style={{
														fontFamily: 'var(--md-sys-typescale-label-small-font)',
														fontSize: 'var(--md-sys-typescale-label-small-size)',
														color: 'var(--md-sys-color-on-surface-variant)',
													}}
												>
													Asset
												</th>
												<th
													className="px-6 py-3 text-left"
													style={{
														fontFamily: 'var(--md-sys-typescale-label-small-font)',
														fontSize: 'var(--md-sys-typescale-label-small-size)',
														color: 'var(--md-sys-color-on-surface-variant)',
													}}
												>
													Balance
												</th>
												<th
													className="px-6 py-3 text-left"
													style={{
														fontFamily: 'var(--md-sys-typescale-label-small-font)',
														fontSize: 'var(--md-sys-typescale-label-small-size)',
														color: 'var(--md-sys-color-on-surface-variant)',
													}}
												>
													Value
												</th>
												<th
													className="px-6 py-3 text-left"
													style={{
														fontFamily: 'var(--md-sys-typescale-label-small-font)',
														fontSize: 'var(--md-sys-typescale-label-small-size)',
														color: 'var(--md-sys-color-on-surface-variant)',
													}}
												>
													24h Change
												</th>
											</tr>
										</thead>
										<tbody>
											{priceUpdateLoading ? (
												Array.from({ length: Math.max(3, portfolioData?.assets?.length || 3) }, (_, index) => (
													<AssetRowSkeleton key={`skeleton-${index}`} />
												))
											) : portfolioData && portfolioData.assets.length > 0 ? (
												portfolioData.assets.map((asset, index) => (
													<tr
														key={index}
														style={{
															borderBottom: '1px solid var(--md-sys-color-outline-variant)',
														}}
														className="hover:bg-surface-container/50 transition-colors"
													>
														<td className="px-6 py-4">
															<div className="flex items-center">
																<div
																	className="w-8 h-8 rounded-full flex items-center justify-center mr-3"
																	style={{
																		backgroundColor: 'var(--md-sys-color-primary-container)',
																		color: 'var(--md-sys-color-on-primary-container)',
																		fontSize: '0.75rem',
																		fontWeight: 'bold',
																	}}
																>
																	{asset.symbol.slice(0, 2)}
																</div>
																<div
																	style={{
																		fontFamily: 'var(--md-sys-typescale-body-medium-font)',
																		color: 'var(--md-sys-color-on-surface)',
																		fontWeight: '500',
																	}}
																>
																	{asset.symbol}
																</div>
															</div>
														</td>
														<td className="px-6 py-4">
															<div
																style={{
																	fontFamily: 'var(--md-sys-typescale-body-medium-font)',
																	color: 'var(--md-sys-color-on-surface)',
																}}
															>
																{asset.balance.toFixed(6)}
															</div>
														</td>
														<td className="px-6 py-4">
															<div
																style={{
																	fontFamily: 'var(--md-sys-typescale-body-medium-font)',
																	color: 'var(--md-sys-color-on-surface)',
																	fontWeight: '500',
																}}
															>
																{formatCurrency(asset.value)}
															</div>
														</td>
														<td className="px-6 py-4">
															<div className="flex items-center">
																<div
																	style={{
																		fontFamily: 'var(--md-sys-typescale-body-medium-font)',
																		color: asset.change24h >= 0 ? 'var(--md-sys-color-success)' : 'var(--md-sys-color-error)',
																		fontWeight: '500',
																	}}
																>
																	{formatPercentage(asset.change24h)}
																</div>
																{asset.change24h !== 0 && (
																	<div
																		className="ml-2"
																		style={{
																			color: asset.change24h >= 0 ? 'var(--md-sys-color-success)' : 'var(--md-sys-color-error)',
																		}}
																	>
																		{asset.change24h >= 0 ? '↗' : '↘'}
																	</div>
																)}
															</div>
														</td>
													</tr>
												))
											) : (
												<tr>
													<td colSpan={4} className="px-6 py-8 text-center">
														<div
															style={{
																fontFamily: 'var(--md-sys-typescale-body-large-font)',
																color: 'var(--md-sys-color-on-surface-variant)',
															}}
														>
															No assets in portfolio. Create a portfolio to get started.
														</div>
													</td>
												</tr>
											)}
										</tbody>
									</table>
								</div>
							</M3Card>

							{}
							<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
								<M3Card variant="filled" className="p-6">
									<h3
										style={{
											fontFamily: 'var(--md-sys-typescale-title-medium-font)',
											fontSize: 'var(--md-sys-typescale-title-medium-size)',
											color: 'var(--md-sys-color-on-surface)',
										}}
										className="mb-3"
									>
										Portfolio Actions
									</h3>
									<div className="flex flex-col space-y-3">
										<M3Button variant="outlined" size="medium" onClick={handleDeposit}>
											Deposit Funds
										</M3Button>
										<M3Button variant="outlined" size="medium" onClick={handleWithdraw}>
											Withdraw Funds
										</M3Button>
										<M3Button variant="outlined" size="medium" onClick={handleManualRebalance}>
											Manual Rebalance
										</M3Button>
									</div>
								</M3Card>

								<M3Card variant="filled" className="p-6">
									<h3
										style={{
											fontFamily: 'var(--md-sys-typescale-title-medium-font)',
											fontSize: 'var(--md-sys-typescale-title-medium-size)',
											color: 'var(--md-sys-color-on-surface)',
										}}
										className="mb-3"
									>
										Portfolio Settings
									</h3>
									<div className="space-y-3">
										<label className="flex items-center justify-between">
											<span
												style={{
													fontFamily: 'var(--md-sys-typescale-body-medium-font)',
													color: 'var(--md-sys-color-on-surface)',
												}}
											>
												Auto-Rebalance
											</span>
											<input
												type="checkbox"
												checked={userPreferences.portfolioSettings.autoRebalance}
												onChange={(e) => updatePortfolioSettings('autoRebalance', e.target.checked)}
												className="toggle toggle-primary"
											/>
										</label>

										<label className="flex items-center justify-between">
											<span
												style={{
													fontFamily: 'var(--md-sys-typescale-body-medium-font)',
													color: 'var(--md-sys-color-on-surface)',
												}}
											>
												Yield Optimization
											</span>
											<input
												type="checkbox"
												checked={userPreferences.portfolioSettings.yieldOptimization}
												onChange={(e) => updatePortfolioSettings('yieldOptimization', e.target.checked)}
												className="toggle toggle-primary"
											/>
										</label>

										<label className="flex items-center justify-between">
											<span
												style={{
													fontFamily: 'var(--md-sys-typescale-body-medium-font)',
													color: 'var(--md-sys-color-on-surface)',
												}}
											>
												Risk Monitoring
											</span>
											<input
												type="checkbox"
												checked={userPreferences.portfolioSettings.riskMonitoring}
												onChange={(e) => updatePortfolioSettings('riskMonitoring', e.target.checked)}
												className="toggle toggle-primary"
											/>
										</label>
									</div>
								</M3Card>
							</div>

							{}
							<M3Card variant="elevated" className="p-6">
								<div className="flex items-center justify-between mb-4">
									<h3
										style={{
											fontFamily: 'var(--md-sys-typescale-title-large-font)',
											fontSize: 'var(--md-sys-typescale-title-large-size)',
											color: 'var(--md-sys-color-on-surface)',
										}}
									>
										Strategy Management
									</h3>
									<M3Button
										variant="outlined"
										size="medium"
										onClick={() => router.push('/strategies')}
										icon={<ArrowRight className="w-4 h-4" />}
									>
										Browse All Strategies
									</M3Button>
								</div>

								<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
									<div
										className="p-4 rounded-lg border"
										style={{
											backgroundColor: 'var(--md-sys-color-surface-container)',
											borderColor: 'var(--md-sys-color-outline-variant)',
										}}
									>
										<h4
											style={{
												fontFamily: 'var(--md-sys-typescale-title-medium-font)',
												color: 'var(--md-sys-color-on-surface)',
												marginBottom: '0.5rem',
											}}
										>
											Active Strategies
										</h4>
										<p
											style={{
												fontFamily: 'var(--md-sys-typescale-body-medium-font)',
												color: 'var(--md-sys-color-on-surface-variant)',
												fontSize: '0.875rem',
												marginBottom: '1rem',
											}}
										>
											Manage your current strategy positions
										</p>{' '}
										<M3Button variant="text" size="small" onClick={() => router.push('/positions')}>
											View Positions
										</M3Button>
									</div>

									<div
										className="p-4 rounded-lg border"
										style={{
											backgroundColor: 'var(--md-sys-color-surface-container)',
											borderColor: 'var(--md-sys-color-outline-variant)',
										}}
									>
										<h4
											style={{
												fontFamily: 'var(--md-sys-typescale-title-medium-font)',
												color: 'var(--md-sys-color-on-surface)',
												marginBottom: '0.5rem',
											}}
										>
											Discover Strategies
										</h4>
										<p
											style={{
												fontFamily: 'var(--md-sys-typescale-body-medium-font)',
												color: 'var(--md-sys-color-on-surface-variant)',
												fontSize: '0.875rem',
												marginBottom: '1rem',
											}}
										>
											Explore new yield opportunities
										</p>
										<M3Button variant="text" size="small" onClick={() => router.push('/strategies')}>
											Browse Strategies
										</M3Button>
									</div>
								</div>
							</M3Card>
						</>
					) : (
						
						<div className="flex items-center justify-center min-h-[300px]">
							<div className="text-center max-w-md">
								<div
									className="mb-6 p-6 rounded-full mx-auto w-24 h-24 flex items-center justify-center"
									style={{ backgroundColor: 'var(--md-sys-color-primary-container)' }}
								>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="40"
										height="40"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="2"
										strokeLinecap="round"
										strokeLinejoin="round"
										style={{ color: 'var(--md-sys-color-on-primary-container)' }}
									>
										<path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"></path>
										<path d="M3 5v14a2 2 0 0 0 2 2h16v-5"></path>
										<path d="M18 12a2 2 0 0 0 0 4h4v-4Z"></path>
									</svg>
								</div>
								<h3
									style={{
										fontFamily: 'var(--md-sys-typescale-headline-small-font)',
										fontSize: 'var(--md-sys-typescale-headline-small-size)',
										color: 'var(--md-sys-color-on-surface)',
										marginBottom: '0.5rem',
									}}
								>
									No Portfolio Yet
								</h3>
								<p
									style={{
										fontFamily: 'var(--md-sys-typescale-body-medium-font)',
										color: 'var(--md-sys-color-on-surface-variant)',
										marginBottom: '1.5rem',
									}}
								>
									Create your first portfolio to start automated DeFi management and yield optimization.
								</p>
								<M3Button variant="filled" size="large" onClick={() => setPortfolioCreationMode(true)}>
									Create Portfolio
								</M3Button>
							</div>
						</div>
					)}
				</div>
			)}
		</div>
	);
}
