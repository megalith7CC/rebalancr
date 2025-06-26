import { useState, useEffect } from 'react';
import { useAccount, useBalance, usePublicClient } from 'wagmi';
import { ethers } from 'ethers';
import { AVALANCHE_FUJI_TOKENS } from '@/utils/tokenMapping';
import { priceService } from '../services/PriceService';

export interface TokenBalance {
	symbol: string;
	address: string;
	balance: string;
	balanceFormatted: string;
	decimals: number;
	usdValue?: number;
}

export interface WalletData {
	address: string | null;
	network: string | null;
	nativeBalance: string;
	tokenBalances: TokenBalance[];
	isLoading: boolean;
	error: string | null;
	refetch: () => Promise<void>;
}

const ERC20_ABI = [
	{
		constant: true,
		inputs: [{ name: '_owner', type: 'address' }],
		name: 'balanceOf',
		outputs: [{ name: 'balance', type: 'uint256' }],
		type: 'function',
	},
	{
		constant: true,
		inputs: [],
		name: 'decimals',
		outputs: [{ name: '', type: 'uint8' }],
		type: 'function',
	},
];

export function useWalletData(): WalletData {
	const { address, isConnected, chain } = useAccount();
	const { data: nativeBalance } = useBalance({ address });
	const publicClient = usePublicClient();

	const [tokenBalances, setTokenBalances] = useState<TokenBalance[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const fetchTokenBalances = async () => {
		if (!address || !isConnected || !publicClient) {
			setTokenBalances([]);
			return;
		}

		setIsLoading(true);
		setError(null);

		try {
			const balances: TokenBalance[] = [];

			const tokenAddresses = Object.values(AVALANCHE_FUJI_TOKENS).map((token) => token.address);
			const prices = await priceService.getTokenPrices(tokenAddresses);

			for (const [symbol, tokenInfo] of Object.entries(AVALANCHE_FUJI_TOKENS)) {
				try {
					if (symbol === 'AVAX') continue;

					const balance = (await publicClient.readContract({
						address: tokenInfo.address as `0x${string}`,
						abi: ERC20_ABI,
						functionName: 'balanceOf',
						args: [address],
					})) as bigint;

					const balanceFormatted = ethers.formatUnits(balance, tokenInfo.decimals);
					const balanceNum = parseFloat(balanceFormatted);
					const usdValue = balanceNum * (prices[tokenInfo.address.toLowerCase()] || 0);

					balances.push({
						symbol: tokenInfo.symbol,
						address: tokenInfo.address,
						balance: balance.toString(),
						balanceFormatted,
						decimals: tokenInfo.decimals,
						usdValue,
					});
				} catch (tokenError) {
					console.warn(`Failed to fetch balance for ${symbol}:`, tokenError);
					balances.push({
						symbol: tokenInfo.symbol,
						address: tokenInfo.address,
						balance: '0',
						balanceFormatted: '0',
						decimals: tokenInfo.decimals,
						usdValue: 0,
					});
				}
			}

			if (nativeBalance) {
				const avaxBalance = parseFloat(ethers.formatEther(nativeBalance.value));
				const avaxUsdValue = avaxBalance * (prices['0x0000000000000000000000000000000000000000'] || 0);

				balances.unshift({
					symbol: 'AVAX',
					address: AVALANCHE_FUJI_TOKENS.AVAX.address,
					balance: nativeBalance.value.toString(),
					balanceFormatted: ethers.formatEther(nativeBalance.value),
					decimals: 18,
					usdValue: avaxUsdValue,
				});
			}

			setTokenBalances(balances);
		} catch (err) {
			console.error('Error fetching token balances:', err);
			setError('Failed to fetch wallet balances');
		} finally {
			setIsLoading(false);
		}
	};

	useEffect(() => {
		if (isConnected && address) {
			fetchTokenBalances();
		} else {
			setTokenBalances([]);
		}
	}, [address, isConnected, nativeBalance, publicClient]);

	return {
		address: address || null,
		network: chain?.name || null,
		nativeBalance: nativeBalance ? ethers.formatEther(nativeBalance.value) : '0',
		tokenBalances,
		isLoading,
		error,
		refetch: fetchTokenBalances,
	};
}

export function useTokenBalance(tokenAddress: string): TokenBalance | null {
	const { tokenBalances } = useWalletData();
	return tokenBalances.find((balance) => balance.address.toLowerCase() === tokenAddress.toLowerCase()) || null;
}
