import { ethers } from 'ethers';
import { StrategyRouterABI } from '@/abis/StrategyRouter';
import { PositionManagerABI } from '@/abis/PositionManager';
import { BaseStrategyAgentABI } from '@/abis/BaseStrategyAgent';
import { addresses } from '@/addresses';
import { AaveYieldStrategyABI } from '@/abis/AaveYieldStrategy';

export interface StrategyInfo {
	id: string;
	name: string;
	description: string;
	supportedTokens: string[];
	minInvestment: string;
	riskLevel: string;
	performanceFee: string;
	active: boolean;
	implementation: string;
	apy?: string;
	tvl?: string;
	riskScore?: string;
}

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

class ContractService {
	private provider: ethers.BrowserProvider | null = null;
	private signer: ethers.Signer | null = null;

	private strategyRouter: ethers.Contract | null = null;
	private positionManager: ethers.Contract | null = null;

	private strategiesCache: Map<string, StrategyInfo> = new Map();
	private positionsCache: Map<string, Position> = new Map();

	public async initialize(provider: ethers.BrowserProvider): Promise<void> {
		this.provider = provider;

		try {
			this.signer = await provider.getSigner();

			console.log('[ContractService] -- Initializing contract service for signer: ', await this.signer.getAddress());
			this.strategyRouter = new ethers.Contract(addresses.StrategyRouter, StrategyRouterABI, this.signer);
			this.positionManager = new ethers.Contract(addresses.PositionManager, PositionManagerABI, this.signer);
		} catch (error) {
			console.error('Failed to get signer:', error);
			throw error;
		}
	}

	public isInitialized(): boolean {
		const isInit = this.provider !== null && this.signer !== null && this.strategyRouter !== null && this.positionManager !== null;
		if (!isInit) {
			console.log(
				`[ContractService] -- Initialization status: provider=${this.provider !== null}, signer=${
					this.signer !== null
				}, strategyRouter=${this.strategyRouter !== null}, positionManager=${this.positionManager !== null}`
			);
		}
		return isInit;
	}

	public async getActiveStrategies(): Promise<StrategyInfo[]> {
		if (!this.strategyRouter || !this.provider) {
			console.warn('[ContractService] -- Strategy router or provider not available');
			throw new Error('ContractService not initialized - please connect wallet first');
		}

		try {
			console.log('[ContractService] -- Fetching active strategies...');
			const strategyIds = await this.strategyRouter.getActiveStrategies();
			console.log('[ContractService] -- Found strategy IDs:', strategyIds);

			const strategies: StrategyInfo[] = [];

			for (const strategyId of strategyIds) {
				if (this.strategiesCache.has(strategyId)) {
					strategies.push(this.strategiesCache.get(strategyId)!);
					continue;
				}

				try {
					const implAddress = await this.strategyRouter.getStrategyImplementation(strategyId);
					console.log('[ContractService] -- Strategy implementation for', strategyId, ':', implAddress);

					const strategyContract = new ethers.Contract(implAddress, AaveYieldStrategyABI, this.provider);

					const info = await strategyContract.getStrategyInfo();
					const apy = await strategyContract.getAPY();
					const tvl = await strategyContract.getTVL();
					const riskScore = await strategyContract.getRiskScore();

					const strategyInfo: StrategyInfo = {
						id: info.id,
						name: info.name,
						description: info.description,
						supportedTokens: info.supportedTokens,
						minInvestment: ethers.formatEther(info.minInvestment),
						riskLevel: ethers.decodeBytes32String(info.riskLevel),
						performanceFee: info.performanceFee.toString(),
						active: info.active,
						implementation: info.implementation,
						apy: ethers.formatUnits(apy, 2), 
						tvl: ethers.formatEther(tvl),
						riskScore: riskScore.toString(),
					};

					this.strategiesCache.set(strategyId, strategyInfo);
					strategies.push(strategyInfo);
				} catch (strategyError) {
					console.warn(`[ContractService] -- Failed to fetch strategy ${strategyId}:`, strategyError);
				}
			}

			console.log('[ContractService] -- Successfully fetched', strategies.length, 'strategies');
			return strategies;
		} catch (error) {
			console.error('Error fetching active strategies:', error);
			throw error;
		}
	}

	public async getUserPositions(userAddress: string): Promise<Position[]> {
		if (!this.positionManager || !this.provider) {
			console.warn('[ContractService] -- Position manager or provider not available');
			throw new Error('ContractService not initialized - please connect wallet first');
		}

		try {
			console.log('[ContractService] -- Fetching positions for user:', userAddress);

			let positionIds: any[] = [];
			try {
				positionIds = await this.positionManager.getActivePositions(userAddress);
				console.log('[ContractService] -- Found position IDs:', positionIds);
			} catch (decodeError) {
				const errorMessage = decodeError instanceof Error ? decodeError.message : String(decodeError);
				if (errorMessage.includes('could not decode result data') && errorMessage.includes('value="0x"')) {
					console.log('[ContractService] -- No positions found for user (empty contract response)');
					return [];
				}
				throw decodeError;
			}

			if (!positionIds || positionIds.length === 0) {
				console.log('[ContractService] -- No positions found for user');
				return [];
			}

			const positions: Position[] = [];

			for (const positionId of positionIds) {
				const positionIdString = positionId.toString();

				if (this.positionsCache.has(positionIdString)) {
					positions.push(this.positionsCache.get(positionIdString)!);
					continue;
				}

				try {
					const posData = await this.positionManager.getPosition(positionId);
					console.log('[ContractService] -- Position data for', positionId, ':', posData);

					const position: Position = {
						id: posData.id.toString(),
						owner: posData.owner,
						strategyId: posData.strategyId,
						tokens: posData.tokens,
						amounts: posData.amounts.map((amount: bigint) => ethers.formatEther(amount)),
						entryTimestamp: Number(posData.entryTimestamp),
						lastUpdateTimestamp: Number(posData.lastUpdateTimestamp),
						status: ['ACTIVE', 'CLOSED', 'LIQUIDATED'][Number(posData.status)] as 'ACTIVE' | 'CLOSED' | 'LIQUIDATED',
						extraData: posData.extraData,
					};

					this.positionsCache.set(positionIdString, position);
					positions.push(position);
				} catch (positionError) {
					console.warn(`[ContractService] -- Failed to fetch position ${positionId}:`, positionError);
				}
			}

			console.log('[ContractService] -- Successfully fetched', positions.length, 'positions');
			return positions;
		} catch (error) {
			console.error('Error fetching user positions:', error);
			const errorMessage = error instanceof Error ? error.message : String(error);
			if (
				errorMessage.includes('No positions found') ||
				errorMessage.includes('could not decode result data') ||
				errorMessage.includes('value="0x"')
			) {
				console.log('[ContractService] -- No positions found for user, returning empty array');
				return [];
			}
			throw error;
		}
	}

	public async openPosition(strategyId: string, token: string, amount: string, data: string): Promise<string> {
		if (!this.positionManager || !this.provider) {
			throw new Error('ContractService not initialized - please connect wallet first');
		}

		try {
			console.log('[ContractService] -- Opening position:', { strategyId, token, amount });
			const amountBN = ethers.parseEther(amount);
			const tx = await this.positionManager.openPosition(strategyId, token, amountBN, data);
			console.log('[ContractService] -- Transaction sent:', tx.hash);

			const receipt = await tx.wait();
			console.log('[ContractService] -- Transaction confirmed:', receipt?.hash);

			const positionId = '123'; 

			this.positionsCache.clear();

			return positionId;
		} catch (error) {
			console.error('Error opening position:', error);
			throw error;
		}
	}

	public async executeStrategy(strategyId: string, data: string): Promise<boolean> {
		if (!this.isInitialized() || !this.strategyRouter) {
			throw new Error('ContractService not initialized');
		}

		try {
			const tx = await this.strategyRouter.executeStrategy(strategyId, data);
			const receipt = await tx.wait();

			return receipt.status === 1;
		} catch (error) {
			console.error('Error executing strategy:', error);
			throw error;
		}
	}
}

export const contractService = new ContractService();
export default contractService;
