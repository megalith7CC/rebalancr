


export interface TokenInfo {
	symbol: string;
	name: string;
	decimals: number;
	address: string;
	logoUrl?: string;
}

export const AVALANCHE_FUJI_TOKENS: Record<string, TokenInfo> = {
	AVAX: {
		symbol: 'AVAX',
		name: 'Avalanche',
		decimals: 18,
		address: '0x0000000000000000000000000000000000000000',
		logoUrl: '/tokens/avax.png',
	},
	USDC: {
		symbol: 'USDC',
		name: 'USD Coin',
		decimals: 6,
		address: '0x5425890298aed601595a70ab815c96711a31bc65',
		logoUrl: '/tokens/usdc.png',
	},
	USDT: {
		symbol: 'USDT',
		name: 'Tether USD',
		decimals: 6,
		address: '0xb452b513552aa0B57c4b1C9372eFEa78024e5936',
		logoUrl: '/tokens/usdt.png',
	},
	LINK: {
		symbol: 'LINK',
		name: 'Chainlink',
		decimals: 18,
		address: '0x0b9d5d9136855f6fec3c0993fee6e9ce8a297846',
		logoUrl: '/tokens/link.png',
	},
};



export function getTokenByAddress(address: string): TokenInfo | undefined {
	return Object.values(AVALANCHE_FUJI_TOKENS).find((token) => token.address.toLowerCase() === address.toLowerCase());
}



export function getTokenBySymbol(symbol: string): TokenInfo | undefined {
	return AVALANCHE_FUJI_TOKENS[symbol.toUpperCase()];
}



export function formatTokenAmount(amount: string, tokenAddress: string): string {
	const token = getTokenByAddress(tokenAddress);
	if (!token) return amount;

	const numAmount = parseFloat(amount);
	if (token.decimals === 6) {
		return numAmount.toFixed(2); 
	}
	return numAmount.toFixed(4); 
}



export function getTokenDisplayName(address: string): string {
	const token = getTokenByAddress(address);
	return token ? token.symbol : `${address.slice(0, 6)}...${address.slice(-4)}`;
}
