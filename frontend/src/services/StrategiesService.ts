import { ethers } from 'ethers';
import { PositionManagerABI } from '../../generated/abis/PositionManager';
import { addresses } from '@/addresses';

export interface StrategyInfo {
	id: string;
	name: string;
	description: string;
	supportedTokens: string[];
	minInvestment: string;
	riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
	performanceFee: string;
	active: boolean;
	implementation: string;
	apy: string;
	tvl: string;
	riskScore: string;
}

class StrategiesService {
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

	

	public async getActiveStrategies(): Promise<StrategyInfo[]> {
		await this.ensureInitialized();

		if (!this.positionManager) {
			throw new Error('PositionManager not initialized');
		}

		try {
			const registeredStrategies = await this.positionManager.getRegisteredStrategies();
			console.log(`Found ${registeredStrategies.length} registered strategies`);
			const strategies: StrategyInfo[] = [];

			const strategyMappings = this.getKnownStrategyMappings();

			for (const strategyAddress of registeredStrategies) {
				const mapping = strategyMappings[strategyAddress.toLowerCase()];
				if (mapping) {
					strategies.push({
						...mapping,
						implementation: strategyAddress,
						active: true,
					});
				} else {
					strategies.push({
						id: ethers.id(strategyAddress).slice(0, 10),
						name: `Strategy ${strategyAddress.slice(0, 8)}...`,
						description: 'External strategy contract',
						supportedTokens: [], 
						minInvestment: '0.1',
						riskLevel: 'MEDIUM',
						performanceFee: '3.0',
						active: true,
						implementation: strategyAddress,
						apy: '0.0',
						tvl: '0',
						riskScore: '50',
					});
				}
			}

			return strategies;
		} catch (error) {
			console.error('Failed to fetch strategies from contract:', error);
			throw new Error('Failed to fetch strategies from contract');
		}
	}

	

	public async getStrategyById(strategyId: string): Promise<StrategyInfo | null> {
		const strategies = await this.getActiveStrategies();
		return strategies.find((s) => s.id === strategyId) || null;
	}

	

	public async isStrategyRegistered(strategyAddress: string): Promise<boolean> {
		await this.ensureInitialized();

		if (!this.positionManager) {
			throw new Error('PositionManager not initialized');
		}

		try {
			const strategyId = ethers.id(strategyAddress);
			return await this.positionManager.isStrategyRegistered(strategyId);
		} catch (error) {
			console.error('Failed to check strategy registration:', error);
			return false;
		}
	}

	

	private getKnownStrategyMappings(): Record<string, Omit<StrategyInfo, 'implementation' | 'active'>> {
		return {
			'aave-yield-v2': {
				id: '1',
				name: 'Aave Yield Strategy V2',
				description:
					'Earn yield through Aave V3 lending pools on Avalanche. Automated rebalancing optimizes returns while managing risk through our adapter system.',
				supportedTokens: [
					'0x0000000000000000000000000000000000000000', 
					'0x5425890298aed601595a70AB815c96711a31Bc65', 
				],
				minInvestment: '0.1',
				riskLevel: 'LOW',
				performanceFee: '2.5',
				apy: '5.2',
				tvl: '1500000',
				riskScore: '25',
			},
			'balancer-lp-v2': {
				id: '2',
				name: 'Balancer LP Strategy V2',
				description:
					'Provide liquidity to Balancer V2 pools on Avalanche and earn trading fees plus BAL rewards. Includes automated position management.',
				supportedTokens: [
					'0x0000000000000000000000000000000000000000', 
					'0x5425890298aed601595a70AB815c96711a31Bc65', 
				],
				minInvestment: '0.5',
				riskLevel: 'MEDIUM',
				performanceFee: '3.0',
				apy: '8.7',
				tvl: '850000',
				riskScore: '45',
			},
			'conservative-yield': {
				id: '3',
				name: 'Conservative Yield Strategy',
				description:
					'Low-risk strategy focusing on stablecoin yields through multiple protocols on Avalanche. Perfect for capital preservation.',
				supportedTokens: [
					'0x5425890298aed601595a70AB815c96711a31Bc65', 
					'0xb452b513552aa0B57c4b1C9372eFEa78024e5936', 
				],
				minInvestment: '100',
				riskLevel: 'LOW',
				performanceFee: '1.5',
				apy: '3.8',
				tvl: '2200000',
				riskScore: '15',
			},
			'aggressive-defi': {
				id: '4',
				name: 'Aggressive DeFi Strategy',
				description: 'High-yield opportunities across multiple DeFi protocols on Avalanche. Higher risk, higher potential returns.',
				supportedTokens: [
					'0x0000000000000000000000000000000000000000', 
					'0x0b9d5d9136855f6fec3c0993fee6e9ce8a297846', 
				],
				minInvestment: '1.0',
				riskLevel: 'HIGH',
				performanceFee: '4.0',
				apy: '12.3',
				tvl: '980000',
				riskScore: '75',
			},
		};
	}

	

	public async getStrategyMetrics(strategyAddress: string): Promise<{
		apy: string;
		tvl: string;
		totalPositions: number;
	}> {
		await this.ensureInitialized();

		return {
			apy: '0.0',
			tvl: '0',
			totalPositions: 0,
		};
	}
}

export const strategiesService = new StrategiesService();
export default strategiesService;
