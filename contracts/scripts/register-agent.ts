import { ethers, Interface } from 'ethers';
import { network, run } from 'hardhat';
import { PositionManager__factory } from '../typechain-types';
import { createWalletClient, http } from 'viem';
import { avalancheFuji } from 'viem/chains';

const walletClient = createWalletClient({
	chain: avalancheFuji,
	transport: http(process.env.AVALANCHE_FUJI_RPC_URL),
	account: `0x${process.env.PRIVATE_KEY}` || '',
});

const PositionManagerABI = ['function registerStrategy(address strategyAgent)'];

const errorAbi = ['error StrategyAlreadyRegistered(bytes32 strategyId)'];

const iface = new Interface(errorAbi);

const positionManagerAddress = process.env.POSITION_MANAGER_ADDRESS || '';

async function RegisterStrategyAgent(chainId: any) {
	const url = process.env.AVALANCHE_FUJI_RPC_URL || '';
	const provider = new ethers.JsonRpcProvider(url);
	const signer = new ethers.Wallet(process.env.PRIVATE_KEY || '', provider);

	const positionManager = PositionManager__factory.connect(positionManagerAddress, signer);

	const strategyAgent = process.env.STRATEGY_AGENT_ADDRESS || '';
	if (!strategyAgent) {
		throw new Error('STRATEGY_AGENT_ADDRESS environment variable is not set');
	}

	const { request } = await publicClient.simulateContract({
		positionManager,
		abi,
		functionName: 'registerStrategy',
		args: [strategyAgent],
		account,
	});

	const hash = await walletClient.writeContract(request);
	console.log('Tx hash:', hash);
}

async function Main() {
	await run('compile');
	const chainId = network.config.chainId;
	await RegisterStrategyAgent(chainId);
}

Main().catch((error) => {
	console.error('Deployment failed:', error);
	process.exitCode = 1;
});
