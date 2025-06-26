import { ethers } from 'ethers';
import { PositionManagerABI } from '../../generated/abis/PositionManager';
import { addresses } from '@/addresses';
import { getTokenByAddress } from '@/utils/tokenMapping';
import { priceService } from './PriceService';

export interface Position {
	id: string;
	owner: string;
	strategyId: string;
	tokens: string[];
	amounts: string[];
	entryTimestamp: number;
	lastUpdateTimestamp: number;
	status: 'ACTIVE' | 'CLOSED' | 'LIQUIDATED';
	extraData: string;
}

export interface EnrichedPosition extends Position {
	strategyName: string;
	currentValue: string;
	entryValue: string;
	performancePercentage: number;
	healthScore: number;
	tokenDetails: Array<{
		symbol: string;
		name: string;
		address: string;
		amount: string;
		valueUsd: string;
	}>;
}

class PositionsService {
	private provider: ethers.BrowserProvider | null = null;
	private signer: ethers.Signer | null = null;
	private positionManager: ethers.Contract | null = null;

	public async initialize(): Promise<void> {
		if (typeof window !== 'undefined' && window.ethereum) {
			this.provider = new ethers.BrowserProvider(window.ethereum);
			this.signer = await this.provider.getSigner();

			if (!addresses.PositionManager) {
				throw new Error('PositionManager contract not deployed');
			}

			this.positionManager = new ethers.Contract(addresses.PositionManager, PositionManagerABI, this.signer);
		} else {
			throw new Error('MetaMask or compatible wallet not found');
		}
	}

	private async ensureInitialized(): Promise<void> {
		if (!this.provider || !this.signer || !this.positionManager) {
			await this.initialize();
		}
	}

	

	public async getUserPositions(userAddress: string): Promise<Position[]> {
		await this.ensureInitialized();

		if (!this.positionManager) {
			throw new Error('PositionManager not initialized');
		}

		try {
			const activePositionIds = await this.positionManager.getActivePositions(userAddress);
			const positions: Position[] = [];

			for (const positionId of activePositionIds) {
				const positionData = await this.positionManager.getPosition(positionId);

				positions.push({
					id: positionId.toString(),
					owner: positionData.owner,
					strategyId: positionData.strategyId,
					tokens: positionData.tokens,
					amounts: positionData.amounts.map((amount: bigint) => ethers.formatUnits(amount, 18)),
					entryTimestamp: Number(positionData.entryTimestamp) * 1000, 
					lastUpdateTimestamp: Number(positionData.lastUpdateTimestamp) * 1000,
					status: this.parsePositionStatus(positionData.status),
					extraData: positionData.extraData,
				});
			}

			return positions;
		} catch (error) {
			console.error('Failed to fetch user positions:', error);
			throw new Error('Failed to fetch positions from contract');
		}
	}

	

	public async getEnrichedUserPositions(userAddress: string): Promise<EnrichedPosition[]> {
		const positions = await this.getUserPositions(userAddress);
		const enrichedPositions: EnrichedPosition[] = [];

		for (const position of positions) {
			try {
				const strategyName = await this.getStrategyName(position.strategyId);

				const tokenDetails = await this.getTokenDetails(position.tokens, position.amounts);
				const currentValue = this.calculateTotalValue(tokenDetails);
				const entryValue = await this.calculateEntryValue(position);
				const performancePercentage = this.calculatePerformance(entryValue, currentValue);
				const healthScore = await this.calculateHealthScore(position);

				enrichedPositions.push({
					...position,
					strategyName,
					currentValue: currentValue.toFixed(2),
					entryValue: entryValue.toFixed(2),
					performancePercentage,
					healthScore,
					tokenDetails,
				});
			} catch (error) {
				console.error(`Failed to enrich position ${position.id}:`, error);
				enrichedPositions.push({
					...position,
					strategyName: 'Unknown Strategy',
					currentValue: '0',
					entryValue: '0',
					performancePercentage: 0,
					healthScore: 0,
					tokenDetails: [],
				});
			}
		}

		return enrichedPositions;
	}

	

	private async getStrategyName(strategyId: string): Promise<string> {
		if (!this.positionManager) {
			throw new Error('PositionManager not initialized');
		}

		try {
			const registeredStrategies = await this.positionManager.getRegisteredStrategies();

			const strategyMapping: Record<string, string> = {
				[ethers.id('0xAaveAdapterV2')]: 'Aave Yield Strategy V2',
				[ethers.id('0xBalancerAdapterV2')]: 'Balancer LP Strategy V2',
				[ethers.id('0xConservativeAdapterV2')]: 'Conservative Yield Strategy',
				[ethers.id('0xAggressiveAdapterV2')]: 'Aggressive DeFi Strategy',
			};

			return strategyMapping[strategyId] || `Strategy ${strategyId.slice(0, 8)}...`;
		} catch (error) {
			console.error('Failed to get strategy name:', error);
			return 'Unknown Strategy';
		}
	}

	

	private async getTokenDetails(
		tokenAddresses: string[],
		amounts: string[]
	): Promise<
		Array<{
			symbol: string;
			name: string;
			address: string;
			amount: string;
			valueUsd: string;
		}>
	> {
		const tokenDetails = [];

		for (let i = 0; i < tokenAddresses.length; i++) {
			const tokenAddress = tokenAddresses[i];
			const amount = amounts[i];
			const tokenInfo = getTokenByAddress(tokenAddress);

			if (!tokenInfo) {
				console.warn(`Unknown token: ${tokenAddress}`);
				continue;
			}

			try {
				const currentPrice = await priceService.getTokenPrice(tokenAddress);
				const valueUsd = (parseFloat(amount) * currentPrice).toFixed(2);

				tokenDetails.push({
					symbol: tokenInfo.symbol,
					name: tokenInfo.name,
					address: tokenAddress,
					amount: parseFloat(amount).toFixed(4),
					valueUsd,
				});
			} catch (error) {
				console.error(`Failed to get price for ${tokenInfo.symbol}:`, error);
				tokenDetails.push({
					symbol: tokenInfo.symbol,
					name: tokenInfo.name,
					address: tokenAddress,
					amount: parseFloat(amount).toFixed(4),
					valueUsd: '0.00',
				});
			}
		}

		return tokenDetails;
	}

	

	private calculateTotalValue(tokenDetails: Array<{ valueUsd: string }>): number {
		return tokenDetails.reduce((total, token) => total + parseFloat(token.valueUsd), 0);
	}

	

	private async calculateEntryValue(position: Position): Promise<number> {
		const tokenDetails = await this.getTokenDetails(position.tokens, position.amounts);
		return this.calculateTotalValue(tokenDetails);
	}

	

	private calculatePerformance(entryValue: number, currentValue: number): number {
		if (entryValue === 0) return 0;
		return ((currentValue - entryValue) / entryValue) * 100;
	}

	

	private async calculateHealthScore(position: Position): Promise<number> {
		try {

			const daysSinceEntry = (Date.now() - position.entryTimestamp) / (1000 * 60 * 60 * 24);
			const ageScore = Math.max(0, 100 - daysSinceEntry); 

			const baseScore = position.status === 'ACTIVE' ? 75 : 25;

			const healthScore = Math.min(100, Math.max(0, (baseScore + ageScore) / 2));

			return Math.round(healthScore);
		} catch (error) {
			console.error('Failed to calculate health score:', error);
			return 50; 
		}
	}

	

	private parsePositionStatus(status: number): 'ACTIVE' | 'CLOSED' | 'LIQUIDATED' {
		switch (status) {
			case 0:
				return 'ACTIVE';
			case 1:
				return 'CLOSED';
			case 2:
				return 'LIQUIDATED';
			default:
				return 'ACTIVE';
		}
	}

	

	public async getTotalPortfolioValue(userAddress: string): Promise<number> {
		const enrichedPositions = await this.getEnrichedUserPositions(userAddress);
		return enrichedPositions.reduce((total, position) => total + parseFloat(position.currentValue), 0);
	}

	

	public async closePosition(positionId: string): Promise<{ success: boolean; hash?: string; error?: string }> {
		await this.ensureInitialized();

		if (!this.positionManager) {
			throw new Error('PositionManager not initialized');
		}

		try {
			const emptyData = '0x';
			const tx = await this.positionManager.closePosition(positionId, emptyData);
			const receipt = await tx.wait();

			return {
				success: receipt?.status === 1,
				hash: tx.hash,
			};
		} catch (error) {
			console.error('Failed to close position:', error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error',
			};
		}
	}

	

	public async modifyPosition(positionId: string, newAmount: string): Promise<{ success: boolean; hash?: string; error?: string }> {
		await this.ensureInitialized();

		if (!this.positionManager) {
			throw new Error('PositionManager not initialized');
		}

		try {
			const newAmountBN = ethers.parseUnits(newAmount, 18);
			const emptyData = '0x';
			const tx = await this.positionManager.modifyPosition(positionId, newAmountBN, emptyData);
			const receipt = await tx.wait();

			return {
				success: receipt?.status === 1,
				hash: tx.hash,
			};
		} catch (error) {
			console.error('Failed to modify position:', error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error',
			};
		}
	}
}

export const positionsService = new PositionsService();
export default positionsService;
