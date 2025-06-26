'use client';

import { useState, useEffect } from 'react';
import { M3Card, M3Button } from '@/components/ui/M3Components';
import { priceService } from '@/services/PriceService';
import { AVALANCHE_FUJI_TOKENS } from '@/utils/tokenMapping';

interface TokenData {
	symbol: string;
	name: string;
	price: number;
	change24h: number;
	volume24h?: number;
}

interface MarketSentiment {
	type: 'bullish' | 'bearish' | 'neutral';
	score: number; 
	description: string;
}

export default function MarketDataPage() {
	const [tokens, setTokens] = useState<TokenData[]>([]);
	const [sentiment, setSentiment] = useState<MarketSentiment | null>(null);
	const [loading, setLoading] = useState<boolean>(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const fetchMarketData = async () => {
			setLoading(true);
			setError(null);

			try {
				const tokenPromises = Object.values(AVALANCHE_FUJI_TOKENS).map(async (token) => {
					try {
						const [priceData, change24h] = await Promise.all([
							priceService.getTokenPrice(token.address),
							priceService.get24hPriceChange(token.address),
						]);

						return {
							symbol: token.symbol,
							name: token.name,
							price: priceData || 0,
							change24h: change24h || 0,
							volume24h: undefined, 
						};
					} catch (tokenError) {
						console.warn(`Failed to fetch data for ${token.symbol}:`, tokenError);
						return {
							symbol: token.symbol,
							name: token.name,
							price: 0,
							change24h: 0,
							volume24h: undefined,
						};
					}
				});

				const tokenData = await Promise.all(tokenPromises);
				setTokens(tokenData.filter((token) => token.price > 0));

				const averageChange = tokenData.reduce((sum, token) => sum + token.change24h, 0) / tokenData.length;
				const sentimentData: MarketSentiment = {
					type: averageChange > 2 ? 'bullish' : averageChange < -2 ? 'bearish' : 'neutral',
					score: Math.min(100, Math.max(0, 50 + averageChange * 5)),
					description: `Market showing ${averageChange > 0 ? 'positive' : 'negative'} momentum with ${Math.abs(
						averageChange
					).toFixed(1)}% average price change across tracked tokens.`,
				};
				setSentiment(sentimentData);
			} catch (error) {
				console.error('Error fetching market data:', error);
				setError('Failed to load market data. Please try again later.');
			} finally {
				setLoading(false);
			}
		};

		fetchMarketData();
	}, []);

	return (
		<div className="container mx-auto px-4 py-8">
			<h1 className="text-3xl font-bold mb-6 text-slate-900 dark:text-white">Market Data</h1>

			{loading ? (
				<div className="text-center py-12">
					<p className="text-slate-500 dark:text-slate-400">Loading market data...</p>
				</div>
			) : error ? (
				<div className="text-center py-12">
					<p className="text-red-500 mb-4">{error}</p>
					<M3Button variant="outlined" onClick={() => window.location.reload()}>
						Retry
					</M3Button>
				</div>
			) : (
				<>
					{}
					{sentiment && (
						<M3Card variant="elevated" className="mb-8 p-6">
							<h2 className="text-xl font-semibold mb-4 text-slate-900 dark:text-white">Market Sentiment</h2>
							<div className="flex items-center mb-4">
								<div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-4 mr-3">
									<div
										className={`h-4 rounded-full ${
											sentiment.type === 'bullish' ? 'bg-green-500' : sentiment.type === 'bearish' ? 'bg-red-500' : 'bg-yellow-500'
										}`}
										style={{ width: `${sentiment.score}%` }}
									></div>
								</div>
								<span className="font-bold">{sentiment.score}/100</span>
							</div>
							<p className="text-slate-700 dark:text-slate-300">{sentiment.description}</p>
						</M3Card>
					)}

					{}
					<h2 className="text-2xl font-semibold mb-4 text-slate-900 dark:text-white">Supported Tokens</h2>
					{tokens.length === 0 ? (
						<M3Card variant="outlined" className="p-6 text-center">
							<p className="text-slate-500 dark:text-slate-400">No token data available at the moment.</p>
						</M3Card>
					) : (
						<M3Card variant="outlined" className="mb-8">
							<div className="overflow-x-auto">
								<table className="w-full">
									<thead>
										<tr className="border-b border-slate-200 dark:border-slate-700">
											<th className="py-3 px-4 text-left text-sm font-medium text-slate-500 dark:text-slate-400">Token</th>
											<th className="py-3 px-4 text-right text-sm font-medium text-slate-500 dark:text-slate-400">Price</th>
											<th className="py-3 px-4 text-right text-sm font-medium text-slate-500 dark:text-slate-400">24h Change</th>
											<th className="py-3 px-4 text-right text-sm font-medium text-slate-500 dark:text-slate-400">24h Volume</th>
										</tr>
									</thead>
									<tbody>
										{tokens.map((token) => (
											<tr key={token.symbol} className="border-b border-slate-200 dark:border-slate-700 last:border-b-0">
												<td className="py-4 px-4">
													<div className="flex items-center">
														<div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 mr-3"></div>
														<div>
															<div className="font-medium text-slate-900 dark:text-white">{token.symbol}</div>
															<div className="text-sm text-slate-500 dark:text-slate-400">{token.name}</div>
														</div>
													</div>
												</td>
												<td className="py-4 px-4 text-right font-medium text-slate-900 dark:text-white">
													${token.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}
												</td>
												<td
													className={`py-4 px-4 text-right font-medium ${token.change24h >= 0 ? 'text-green-500' : 'text-red-500'}`}
												>
													{token.change24h >= 0 ? '+' : ''}
													{token.change24h.toFixed(2)}%
												</td>
												<td className="py-4 px-4 text-right text-slate-700 dark:text-slate-300">
													{token.volume24h ? `$${(token.volume24h / 1000000).toFixed(1)}M` : 'N/A'}
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</M3Card>
					)}
				</>
			)}
		</div>
	);
} 