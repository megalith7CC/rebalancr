import { ethers } from 'ethers';

interface CoinGeckoPriceResponse {
	[coinId: string]: {
		usd: number;
		usd_24h_change: number;
	};
}

const TOKEN_TO_COINGECKO_ID: Record<string, string> = {
	'0x0000000000000000000000000000000000000000': 'avalanche-2', 
	'0x5425890298aed601595a70ab815c96711a31bc65': 'usd-coin', 
	'0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7': 'tether', 
	'0x0b9d5d9136855f6fec3c0993fee6e9ce8a297846': 'chainlink', 
};

const PRICE_FEED_ABI = [
	{
		inputs: [],
		name: 'latestRoundData',
		outputs: [
			{ internalType: 'uint80', name: 'roundId', type: 'uint80' },
			{ internalType: 'int256', name: 'answer', type: 'int256' },
			{ internalType: 'uint256', name: 'startedAt', type: 'uint256' },
			{ internalType: 'uint256', name: 'updatedAt', type: 'uint256' },
			{ internalType: 'uint80', name: 'answeredInRound', type: 'uint80' },
		],
		stateMutability: 'view',
		type: 'function',
	},
	{
		inputs: [],
		name: 'decimals',
		outputs: [{ internalType: 'uint8', name: '', type: 'uint8' }],
		stateMutability: 'view',
		type: 'function',
	},
];

const getPriceFeeds = (): Record<string, string> => {

	return {
		'0x0000000000000000000000000000000000000000':
			process.env.NEXT_PUBLIC_AVAX_USD_PRICE_FEED || '0x5498BB86BC934c8D34FDA08E81D444153d0D06aD',
		'0x5425890298aed601595a70ab815c96711a31bc65':
			process.env.NEXT_PUBLIC_USDC_USD_PRICE_FEED || '0x86d67c3D38D2bCeE722E601025C25a575021c6EA',
		'0xb452b513552aa0b57c4b1c9372efea78024e5936':
			process.env.NEXT_PUBLIC_USDT_USD_PRICE_FEED || '0x7898AcCC83587C3C55116c5230C17a6d441077C8',
		'0x0b9d5d9136855f6fec3c0993fee6e9ce8a297846':
			process.env.NEXT_PUBLIC_LINK_USD_PRICE_FEED || '0x34C4c526902d88a3Aa98DB8a9b802603EB1E3470',
	};
};

const FALLBACK_PRICES: Record<string, number> = {
	'0x0000000000000000000000000000000000000000': 40, 
	'0x5425890298aed601595a70AB815c96711a31Bc65': 1, 
	'0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7': 1, 
	'0x0b9d5D9136855f6FEc3c0993feE6E9CE8a297846': 15, 
};

export class PriceService {
	private static instance: PriceService;
	private provider: ethers.JsonRpcProvider;
	private priceCache: Map<string, { price: number; timestamp: number }> = new Map();
	private priceChangeCache: Map<string, { change: number; timestamp: number }> = new Map();
	private readonly CACHE_DURATION = 5 * 60 * 1000; 
	private readonly COINGECKO_API_KEY = process.env.NEXT_PUBLIC_COINGECKO_API_KEY;

	private constructor() {
		this.provider = new ethers.JsonRpcProvider('https://api.avax-test.network/ext/bc/C/rpc');
	}

	public static getInstance(): PriceService {
		if (!PriceService.instance) {
			PriceService.instance = new PriceService();
		}
		return PriceService.instance;
	}

	

	public async getTokenPrice(tokenAddress: string): Promise<number> {
		const normalizedAddress = tokenAddress.toLowerCase();

		const cached = this.priceCache.get(normalizedAddress);
		if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
			return cached.price;
		}

		try {
			const priceFeeds = getPriceFeeds();
			const priceFeedAddress = priceFeeds[normalizedAddress] as string | undefined;
			if (!priceFeedAddress) {
				console.warn(`No price feed for token ${tokenAddress}, using fallback`);
				return this.getFallbackPrice(normalizedAddress);
			}

			const priceFeedContract = new ethers.Contract(priceFeedAddress, PRICE_FEED_ABI, this.provider);

			const [, answer, , ,] = await priceFeedContract.latestRoundData();
			const decimals = await priceFeedContract.decimals();

			const answerNum = typeof answer === 'bigint' ? Number(answer) : answer;
			const decimalsNum = typeof decimals === 'bigint' ? Number(decimals) : decimals;
			
			const price = answerNum / Math.pow(10, decimalsNum);
			console.log(`[PriceService] -- Got price for ${tokenAddress}: ${price}`);

			this.priceCache.set(normalizedAddress, { price, timestamp: Date.now() });

			return price;
		} catch (error) {
			console.warn(`Failed to fetch price for ${tokenAddress}:`, error);
			return this.getFallbackPrice(normalizedAddress);
		}
	}

	

	public async getTokenPrices(tokenAddresses: string[]): Promise<Record<string, number>> {
		const prices: Record<string, number> = {};

		const pricePromises = tokenAddresses.map(async (address) => {
			const price = await this.getTokenPrice(address);
			return { address: address.toLowerCase(), price };
		});

		const results = await Promise.all(pricePromises);

		results.forEach(({ address, price }) => {
			prices[address] = price;
		});

		return prices;
	}

	

	private getFallbackPrice(tokenAddress: string): number {
		return FALLBACK_PRICES[tokenAddress] || 1.0;
	}

	

	public async calculatePortfolioValue(balances: Record<string, { balance: string; decimals: number }>): Promise<number> {
		let totalValue = 0;

		for (const [address, { balance, decimals }] of Object.entries(balances)) {
			const price = await this.getTokenPrice(address);
			const balanceNum = parseFloat(balance) / Math.pow(10, decimals);
			totalValue += balanceNum * price;
		}

		return totalValue;
	}

	

	public async calculatePriceImpact(fromToken: string, toToken: string, amount: string): Promise<number> {
		try {
			const fromPrice = await this.getTokenPrice(fromToken);
			const toPrice = await this.getTokenPrice(toToken);
			const amountNum = parseFloat(amount);

			const tradeSize = amountNum * fromPrice;

			let impact = 0;
			if (tradeSize > 10000) {
				impact = 0.5; 
			} else if (tradeSize > 1000) {
				impact = 0.3; 
			} else {
				impact = 0.1; 
			}

			return impact;
		} catch (error) {
			console.warn('Failed to calculate price impact:', error);
			return 0.3; 
		}
	}

	

	public async convertTokenAmount(fromToken: string, toToken: string, amount: string): Promise<string> {
		try {
			const fromPrice = await this.getTokenPrice(fromToken);
			const toPrice = await this.getTokenPrice(toToken);
			const amountNum = parseFloat(amount);

			const usdValue = amountNum * fromPrice;
			const convertedAmount = usdValue / toPrice;

			return convertedAmount.toString();
		} catch (error) {
			console.warn('Failed to convert token amount:', error);
			return amount; 
		}
	}

	

	public clearCache(): void {
		this.priceCache.clear();
		this.priceChangeCache.clear();
	}

	

	public async get24hPriceChange(tokenAddress: string): Promise<number> {
		const normalizedAddress = tokenAddress.toLowerCase();

		const cached = this.priceChangeCache.get(normalizedAddress);
		if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
			return cached.change;
		}

		try {
			const coinId = TOKEN_TO_COINGECKO_ID[normalizedAddress];
			if (!coinId) {
				console.warn(`No CoinGecko ID mapping for token ${tokenAddress}`);
				return 0;
			}

			let url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_change=true`;
			let response = await fetch(url, {
				method: 'GET',
				headers: {
					Accept: 'application/json',
					'Content-Type': 'application/json',
				},
			});


			if (!response.ok) {
				throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
			}

			const data: CoinGeckoPriceResponse = await response.json();
			const coinData = data[coinId];

			console.log(`Coingecko: ${data}`);

			if (!coinData || typeof coinData.usd_24h_change !== 'number') {
				throw new Error(`Invalid response from CoinGecko for ${coinId}`);
			}

			const change24h = coinData.usd_24h_change;

			this.priceChangeCache.set(normalizedAddress, {
				change: change24h,
				timestamp: Date.now(),
			});

			return change24h;
		} catch (error) {
			console.warn(`Failed to fetch 24h price change for ${tokenAddress}:`, error);
			return 0; 
		}
	}

	

	public async get24hPriceChanges(tokenAddresses: string[]): Promise<Record<string, number>> {
		const changes: Record<string, number> = {};

		const coinIds = tokenAddresses.map((addr) => TOKEN_TO_COINGECKO_ID[addr.toLowerCase()]).filter(Boolean);

		if (coinIds.length === 0) {
			tokenAddresses.forEach((addr) => {
				changes[addr.toLowerCase()] = 0;
			});
			return changes;
		}

		try {
			const coinIdsParam = coinIds.join(',');
			
			let url = this.COINGECKO_API_KEY
				? `https://pro-api.coingecko.com/api/v3/simple/price?ids=${coinIdsParam}&vs_currencies=usd&include_24hr_change=true&x_cg_pro_api_key=${this.COINGECKO_API_KEY}`
				: `https://api.coingecko.com/api/v3/simple/price?ids=${coinIdsParam}&vs_currencies=usd&include_24hr_change=true`;

			let response = await fetch(url, {
				method: 'GET',
				headers: {
					Accept: 'application/json',
					'Content-Type': 'application/json',
				},
			});

			if (!response.ok && this.COINGECKO_API_KEY) {
				console.warn(`Pro API failed (${response.status}), trying public API...`);
				url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinIdsParam}&vs_currencies=usd&include_24hr_change=true`;
				response = await fetch(url, {
					method: 'GET',
					headers: {
						Accept: 'application/json',
						'Content-Type': 'application/json',
					},
				});
			}

			if (!response.ok) {
				throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
			}

			const data: CoinGeckoPriceResponse = await response.json();

			tokenAddresses.forEach((address) => {
				const normalizedAddress = address.toLowerCase();
				const coinId = TOKEN_TO_COINGECKO_ID[normalizedAddress];

				if (coinId && data[coinId] && typeof data[coinId].usd_24h_change === 'number') {
					const change24h = data[coinId].usd_24h_change;
					changes[normalizedAddress] = change24h;

					this.priceChangeCache.set(normalizedAddress, {
						change: change24h,
						timestamp: Date.now(),
					});
				} else {
					changes[normalizedAddress] = 0;
				}
			});
		} catch (error) {
			console.warn('Failed to fetch batch 24h price changes:', error);
			tokenAddresses.forEach((addr) => {
				changes[addr.toLowerCase()] = 0;
			});
		}

		return changes;
	}

	

	public async getComprehensivePriceData(tokenAddress: string): Promise<{
		currentPrice: number;
		change24h: number;
	}> {
		try {
			const [currentPrice, change24h] = await Promise.all([this.getTokenPrice(tokenAddress), this.get24hPriceChange(tokenAddress)]);

			return {
				currentPrice,
				change24h,
			};
		} catch (error) {
			console.warn(`Failed to fetch comprehensive price data for ${tokenAddress}:`, error);
			return {
				currentPrice: this.getFallbackPrice(tokenAddress.toLowerCase()),
				change24h: 0,
			};
		}
	}
}

export const priceService = PriceService.getInstance();
