import { ethers, network, run } from 'hardhat';
import { developmentChains, VERIFICATION_BLOCK_CONFIRMATIONS } from '../../helper-hardhat-config';
import { DeploymentManager } from './DeploymentManager';

async function DeployStrategyRouter(chainId: any) {

	const agentRegistryAddress = DeploymentManager.getAddress('AgentRegistry');

	if (!agentRegistryAddress) {
		throw new Error('AgentRegistry address not found. Please deploy AgentRegistry first.');
	}

	console.log(`Using AgentRegistry at: ${agentRegistryAddress}`);

	const strategyRouterFactory = await ethers.getContractFactory('StrategyRouter');
	const strategyRouter = await strategyRouterFactory.deploy(agentRegistryAddress);

	const waitBlockConfirmations = developmentChains.includes(network.name) ? 1 : VERIFICATION_BLOCK_CONFIRMATIONS;
	await strategyRouter.deploymentTransaction()?.wait(waitBlockConfirmations);

	const address = await strategyRouter.getAddress();
	console.log(`StrategyRouter deployed to ${address} on ${network.name}`);

	DeploymentManager.saveAddress('StrategyRouter', address);

	if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
		await run('verify:verify', {
			address: address,
			constructorArguments: [agentRegistryAddress],
		});
	}

	return address;
}

export { DeployStrategyRouter };
