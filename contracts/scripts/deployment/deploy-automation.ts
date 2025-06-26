import { ethers, network, run } from 'hardhat';
import { developmentChains, VERIFICATION_BLOCK_CONFIRMATIONS } from '../../helper-hardhat-config';
import { DeploymentManager } from './DeploymentManager';

async function DeployStrategyPoke(chainId: any) {

	const strategyPokeFactory = await ethers.getContractFactory('StrategyPoke');
	const strategyPoke = await strategyPokeFactory.deploy();

	const waitBlockConfirmations = developmentChains.includes(network.name) ? 1 : VERIFICATION_BLOCK_CONFIRMATIONS;
	await strategyPoke.deploymentTransaction()?.wait(waitBlockConfirmations);

	const address = await strategyPoke.getAddress();
	console.log(`StrategyPoke deployed to ${address} on ${network.name}`);

	DeploymentManager.saveAddress('StrategyPoke', address);

	if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
		await run('verify:verify', {
			address: address,
			constructorArguments: [],
		});
	}

	return address;
}

export { DeployStrategyPoke };
