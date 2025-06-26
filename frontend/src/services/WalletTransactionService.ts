import { ethers } from 'ethers';
import { parseEther, parseUnits } from 'viem';
import { getTokenByAddress, AVALANCHE_FUJI_TOKENS } from '@/utils/tokenMapping';
import { addresses } from '../../generated/addresses';
import { priceService } from './PriceService';
import { PositionManagerABI } from '../../generated/abis/PositionManager';
import { AaveYieldStrategyV2ABI } from '../../generated/abis/AaveYieldStrategyV2';
import { StrategyRouterABI } from '../../generated/abis/StrategyRouter';

export interface TransactionResult {
	success: boolean;
	hash?: string;
	error?: string;
}

export interface DepositParams {
	tokenAddress: string;
	amount: string;
	recipient?: string;
}

export interface WithdrawParams {
	tokenAddress: string;
	amount: string;
	recipient?: string;
}

export interface RebalanceParams {
	fromTokens: Array<{ address: string; amount: string }>;
	toTokens: Array<{ address: string; targetAllocation: number }>;
}

const ERC20_ABI = [
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address owner) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)"
];

const TRADER_JOE_ROUTER_ABI = [
	{
		inputs: [
			{ name: 'amountIn', type: 'uint256' },
			{ name: 'amountOutMin', type: 'uint256' },
			{ name: 'path', type: 'address[]' },
			{ name: 'to', type: 'address' },
			{ name: 'deadline', type: 'uint256' },
		],
		name: 'swapExactTokensForTokens',
		outputs: [{ name: 'amounts', type: 'uint256[]' }],
		type: 'function',
	},
	{
		inputs: [
			{ name: 'amountOutMin', type: 'uint256' },
			{ name: 'path', type: 'address[]' },
			{ name: 'to', type: 'address' },
			{ name: 'deadline', type: 'uint256' },
		],
		name: 'swapExactAVAXForTokens',
		outputs: [{ name: 'amounts', type: 'uint256[]' }],
		type: 'function',
		payable: true,
	},
	{
		inputs: [
			{ name: 'amountIn', type: 'uint256' },
			{ name: 'amountOutMin', type: 'uint256' },
			{ name: 'path', type: 'address[]' },
			{ name: 'to', type: 'address' },
			{ name: 'deadline', type: 'uint256' },
		],
		name: 'swapExactTokensForAVAX',
		outputs: [{ name: 'amounts', type: 'uint256[]' }],
		type: 'function',
	},
];

const getRouterAddress = () => {
	return process.env.NEXT_PUBLIC_TRADER_JOE_ROUTER_ADDRESS || '0xd7f655E3376cE2D7A2b08fF01Eb3B1023191A901';
};

class WalletTransactionService {
	private provider: ethers.BrowserProvider | null = null;
	private signer: ethers.Signer | null = null;

	public async initialize(): Promise<void> {
		if (typeof window !== 'undefined' && window.ethereum) {
			this.provider = new ethers.BrowserProvider(window.ethereum);
			this.signer = await this.provider.getSigner();
		} else {
			throw new Error('No compatible wallet found');
		}
	}

	private async ensureInitialized(): Promise<void> {
		if (!this.provider || !this.signer) {
			await this.initialize();
		}
	}

	

	public async deposit(params: DepositParams): Promise<TransactionResult> {
		try {
			await this.ensureInitialized();

			if (!this.signer) {
				throw new Error('Wallet not connected');
			}

			const tokenInfo = getTokenByAddress(params.tokenAddress);
			if (!tokenInfo) {
				throw new Error('Unsupported token');
			}

			const amount = parseUnits(params.amount, tokenInfo.decimals);
			const userAddress = await this.signer.getAddress();

			if (tokenInfo.symbol === 'AVAX') {
				const balance = await this.provider!.getBalance(userAddress);
				if (balance < amount) {
					throw new Error('Insufficient AVAX balance');
				}
			} else {
				const tokenContract = new ethers.Contract(params.tokenAddress, ERC20_ABI, this.signer);
				const balance = await tokenContract.balanceOf(userAddress);
				if (balance < amount) {
					throw new Error(`Insufficient ${tokenInfo.symbol} balance`);
				}
			}

			let tx;

			const targetAddress = addresses.PositionManager || params.recipient || userAddress; 

			if (tokenInfo.symbol === 'AVAX') {
				tx = await this.signer.sendTransaction({
					to: targetAddress,
					value: amount,
				});
			} else {
				const tokenContract = new ethers.Contract(params.tokenAddress, ERC20_ABI, this.signer);
				
				console.log('Starting deposit process...');
				
				const strategyAddress = addresses.AaveYieldStrategyV2;
				const strategyContract = new ethers.Contract(strategyAddress, AaveYieldStrategyV2ABI, this.signer);
				
				try {
					const strategyInfo = await strategyContract.getStrategyInfo();
					console.log('Strategy info:', strategyInfo);
					
						const isActive = await strategyContract.isActive();
					if (!isActive) {
						throw new Error('Strategy is not active. Please contact support.');
					}
					
					const isTokenSupported = await strategyContract.isTokenSupported(params.tokenAddress);
					if (!isTokenSupported) {
						throw new Error(`Token ${tokenInfo.symbol} is not supported by this strategy`);
					}
					
					const minInvestment = strategyInfo.minInvestment;
					if (amount < minInvestment) {
						const minInvestmentFormatted = ethers.formatUnits(minInvestment, tokenInfo.decimals);
						throw new Error(`Minimum investment is ${minInvestmentFormatted} ${tokenInfo.symbol}`);
					}
					
					console.log('Strategy validation passed');
				} catch (validationError) {
					console.error('Strategy validation failed:', validationError);
					throw validationError;
				}
				
				console.log('Checking and approving token transfer...');
				const allowance = await tokenContract.allowance(userAddress, strategyAddress);
				if (allowance < amount) {
					console.log(`Current allowance: ${ethers.formatUnits(allowance, tokenInfo.decimals)}, Required: ${params.amount}`);
					const approveTx = await tokenContract.approve(strategyAddress, amount);
					const approveReceipt = await approveTx.wait();
					if (approveReceipt?.status !== 1) {
						throw new Error('Token approval failed');
					}
					console.log('Token approval successful');
				} else {
					console.log('Sufficient allowance already exists');
				}
				
				console.log('Creating position through strategy...');
				console.log(`Calling entryPosition with token: ${params.tokenAddress}, amount: ${amount.toString()}`);
				
				try {
					const gasEstimate = await strategyContract.entryPosition.estimateGas(params.tokenAddress, amount);
					console.log('Gas estimate:', gasEstimate.toString());
				} catch (gasError) {
					console.error('Gas estimation failed:', gasError);
					throw new Error('Transaction would fail. Please check your balance and try again.');
				}
				
				tx = await strategyContract.entryPosition(params.tokenAddress, amount);
				console.log('Position created successfully, hash:', tx.hash);
			}

			const receipt = await tx.wait();

			return {
				success: receipt?.status === 1,
				hash: tx.hash,
			};
		} catch (error) {
			console.error('Deposit failed:', error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error',
			};
		}
	}

	

	public async withdraw(params: WithdrawParams): Promise<TransactionResult> {
		try {
			await this.ensureInitialized();

			if (!this.signer) {
				throw new Error('Wallet not connected');
			}

			const tokenInfo = getTokenByAddress(params.tokenAddress);
			if (!tokenInfo) {
				throw new Error('Unsupported token');
			}

			const amount = parseUnits(params.amount, tokenInfo.decimals);
			const userAddress = await this.signer.getAddress();

			const portfolioAddress = addresses.PositionManager;

			if (!portfolioAddress) {
				throw new Error('Portfolio contracts not deployed - withdrawals not available');
			}

			let tx;

			try {
				const positionManager = new ethers.Contract(portfolioAddress, PositionManagerABI, this.signer);

				const activePositions = await positionManager.getActivePositions(userAddress);
				
				if (activePositions.length === 0) {
					throw new Error('No active positions found for withdrawal');
				}

				let targetPositionId = null;
				
				for (const positionId of activePositions) {
					const position = await positionManager.getPosition(positionId);
					if (position.tokens.includes(params.tokenAddress)) {
						targetPositionId = positionId;
						break;
					}
				}

				if (!targetPositionId) {
					throw new Error(`No position found containing ${tokenInfo.symbol}`);
				}

				const emptyData = "0x"; 
				tx = await positionManager.closePosition(targetPositionId, emptyData);

				const receipt = await tx.wait();

				return {
					success: receipt?.status === 1,
					hash: tx.hash,
				};
			} catch (contractError) {
				console.error('Portfolio contract interaction failed:', contractError);
				throw new Error('Withdrawal failed - contract interaction error');
			}
		} catch (error) {
			console.error('Withdrawal failed:', error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error',
			};
		}
	}

	

	public async rebalance(params: RebalanceParams): Promise<TransactionResult> {
		try {
			await this.ensureInitialized();

			if (!this.signer) {
				throw new Error('Wallet not connected');
			}

			const userAddress = await this.signer.getAddress();

			const strategyRouterAddress = addresses.StrategyRouter;
			const positionManagerAddress = addresses.PositionManager;
			
			if (!strategyRouterAddress || !positionManagerAddress) {
				throw new Error('Core contracts not deployed - rebalancing not available');
			}

			const strategyRouter = new ethers.Contract(strategyRouterAddress, StrategyRouterABI, this.signer);
			const positionManager = new ethers.Contract(positionManagerAddress, PositionManagerABI, this.signer);

			console.log('Starting production rebalancing process...');

			const activePositions = await positionManager.getActivePositions(userAddress);
			if (activePositions.length === 0) {
				throw new Error('No active positions found for rebalancing');
			}

			const firstPosition = await positionManager.getPosition(activePositions[0]);
			const strategyId = firstPosition.strategyId;
			
			console.log('Rebalancing strategy:', strategyId);

			let totalPortfolioValue = 0;
			const currentAllocations: Record<string, { amount: bigint; value: number; positionId: number }> = {};

			for (const positionId of activePositions) {
				const position = await positionManager.getPosition(positionId);
				
				for (let i = 0; i < position.tokens.length; i++) {
					const tokenAddress = position.tokens[i];
					const amount = position.amounts[i];
					const tokenInfo = getTokenByAddress(tokenAddress);
					
					if (!tokenInfo) continue;

					const tokenPrice = await priceService.getTokenPrice(tokenAddress);
					const amountFormatted = parseFloat(ethers.formatUnits(amount, tokenInfo.decimals));
					const value = amountFormatted * tokenPrice;

					totalPortfolioValue += value;
					currentAllocations[tokenAddress] = {
						amount,
						value,
						positionId
					};
				}
			}

			const rebalanceActions: Array<{
				action: 'reduce' | 'increase';
				token: string;
				positionId: number;
				amount: bigint;
				targetValue: number;
			}> = [];

			for (const targetToken of params.toTokens) {
				const targetValue = totalPortfolioValue * (targetToken.targetAllocation / 100);
				const currentValue = currentAllocations[targetToken.address]?.value || 0;
				const difference = targetValue - currentValue;

				if (Math.abs(difference) > 1) { 
					const tokenInfo = getTokenByAddress(targetToken.address);
					if (!tokenInfo) continue;

					const tokenPrice = await priceService.getTokenPrice(targetToken.address);
					const amountDifference = Math.abs(difference) / tokenPrice;
					const amountDifferenceBigInt = parseUnits(amountDifference.toString(), tokenInfo.decimals);

					const action = difference > 0 ? 'increase' : 'reduce';
					const positionId = currentAllocations[targetToken.address]?.positionId || activePositions[0];

					rebalanceActions.push({
						action,
						token: targetToken.address,
						positionId,
						amount: amountDifferenceBigInt,
						targetValue
					});
				}
			}

			if (rebalanceActions.length === 0) {
				return {
					success: true,
					hash: 'NO_REBALANCE_NEEDED',
				};
			}

			const rebalanceData = ethers.AbiCoder.defaultAbiCoder().encode(
				['tuple(string,address,uint256,uint256)[]', 'uint256'],
				[
					rebalanceActions.map(action => [
						action.action,
						action.token,
						action.amount,
						action.targetValue
					]),
					Math.floor(Date.now() / 1000) + 60 * 20 
				]
			);

			console.log('Executing rebalance through StrategyRouter...');

			const tx = await strategyRouter.executeStrategy(strategyId, rebalanceData);
			
			console.log('Rebalancing transaction submitted:', tx.hash);

			const receipt = await tx.wait();

			return {
				success: receipt?.status === 1,
				hash: tx.hash,
			};

		} catch (error) {
			console.error('Production rebalancing failed:', error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Rebalancing execution failed',
			};
		}
	}

	

	public async swapTokens(
		fromToken: string,
		toToken: string,
		amountIn: string,
		minAmountOut: string,
		slippageTolerance: number = 0.5
	): Promise<TransactionResult> {
		try {
			await this.ensureInitialized();

			if (!this.signer) {
				throw new Error('Wallet not connected');
			}

			const fromTokenInfo = getTokenByAddress(fromToken);
			const toTokenInfo = getTokenByAddress(toToken);

			if (!fromTokenInfo || !toTokenInfo) {
				throw new Error('Unsupported token pair');
			}

			const userAddress = await this.signer.getAddress();
			const deadline = Math.floor(Date.now() / 1000) + 60 * 20; 
			const amountInParsed = parseUnits(amountIn, fromTokenInfo.decimals);
			const minAmountOutParsed = parseUnits(minAmountOut, toTokenInfo.decimals);

			const routerAddress = getRouterAddress();
			const routerContract = new ethers.Contract(routerAddress, TRADER_JOE_ROUTER_ABI, this.signer);

			let tx;

			if (fromToken === AVALANCHE_FUJI_TOKENS.AVAX.address) {
				const path = [AVALANCHE_FUJI_TOKENS.AVAX.address, toToken];
				tx = await routerContract.swapExactAVAXForTokens(minAmountOutParsed, path, userAddress, deadline, {
					value: amountInParsed,
				});
			} else if (toToken === AVALANCHE_FUJI_TOKENS.AVAX.address) {
				const fromTokenContract = new ethers.Contract(fromToken, ERC20_ABI, this.signer);

				const allowance = await fromTokenContract.allowance(userAddress, routerAddress);
				if (allowance < amountInParsed) {
					const approveTx = await fromTokenContract.approve(routerAddress, amountInParsed);
					await approveTx.wait();
				}

				const path = [fromToken, AVALANCHE_FUJI_TOKENS.AVAX.address];
				tx = await routerContract.swapExactTokensForAVAX(amountInParsed, minAmountOutParsed, path, userAddress, deadline);
			} else {
				const fromTokenContract = new ethers.Contract(fromToken, ERC20_ABI, this.signer);

				const allowance = await fromTokenContract.allowance(userAddress, routerAddress);
				if (allowance < amountInParsed) {
					const approveTx = await fromTokenContract.approve(routerAddress, amountInParsed);
					await approveTx.wait();
				}

				const path = [fromToken, AVALANCHE_FUJI_TOKENS.AVAX.address, toToken]; 
				tx = await routerContract.swapExactTokensForTokens(amountInParsed, minAmountOutParsed, path, userAddress, deadline);
			}

			const receipt = await tx.wait();

			return {
				success: receipt?.status === 1,
				hash: tx.hash,
			};
		} catch (error) {
			console.error('Token swap failed:', error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error',
			};
		}
	}

	

	public async getSwapQuote(
		fromToken: string,
		toToken: string,
		amountIn: string
	): Promise<{ amountOut: string; priceImpact: number } | null> {
		try {
			await this.ensureInitialized();

			if (!this.provider) {
				throw new Error('Provider not available');
			}

			const fromTokenInfo = getTokenByAddress(fromToken);
			const toTokenInfo = getTokenByAddress(toToken);

			if (!fromTokenInfo || !toTokenInfo) {
				return null;
			}

			const fromPrice = await priceService.getTokenPrice(fromToken);
			const toPrice = await priceService.getTokenPrice(toToken);
			const exchangeRate = fromPrice / toPrice;

			const amountInNum = parseFloat(amountIn);
			const amountOutNum = amountInNum * exchangeRate * 0.997; 

			const priceImpact = await priceService.calculatePriceImpact(fromToken, toToken, amountIn);

			return {
				amountOut: amountOutNum.toFixed(6),
				priceImpact,
			};
		} catch (error) {
			console.error('Failed to get swap quote:', error);
			return null;
		}
	}

	

	public async transferNative(to: string, amount: string): Promise<TransactionResult> {
		try {
			await this.ensureInitialized();

			if (!this.signer) {
				throw new Error('Wallet not connected');
			}

			const tx = await this.signer.sendTransaction({
				to,
				value: parseEther(amount),
			});

			const receipt = await tx.wait();

			return {
				success: receipt?.status === 1,
				hash: tx.hash,
			};
		} catch (error) {
			console.error('Native transfer failed:', error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error',
			};
		}
	}

	

	public async transferToken(tokenAddress: string, to: string, amount: string): Promise<TransactionResult> {
		try {
			await this.ensureInitialized();

			if (!this.signer) {
				throw new Error('Wallet not connected');
			}

			const tokenInfo = getTokenByAddress(tokenAddress);
			if (!tokenInfo) {
				throw new Error('Unsupported token');
			}

			const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, this.signer);
			const amountBN = parseUnits(amount, tokenInfo.decimals);

			const tx = await tokenContract.transfer(to, amountBN);
			const receipt = await tx.wait();

			return {
				success: receipt?.status === 1,
				hash: tx.hash,
			};
		} catch (error) {
			console.error('Token transfer failed:', error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error',
			};
		}
	}

	

	public async getTransactionStatus(hash: string): Promise<'pending' | 'success' | 'failed'> {
		try {
			await this.ensureInitialized();

			if (!this.provider) {
				throw new Error('Provider not available');
			}

			const receipt = await this.provider.getTransactionReceipt(hash);

			if (!receipt) {
				return 'pending';
			}

			return receipt.status === 1 ? 'success' : 'failed';
		} catch (error) {
			console.error('Failed to get transaction status:', error);
			return 'failed';
		}
	}
}

export const walletTransactionService = new WalletTransactionService();
export default walletTransactionService;
