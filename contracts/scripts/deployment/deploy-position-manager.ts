import { ethers, network, run } from 'hardhat';
import { VERIFICATION_BLOCK_CONFIRMATIONS, developmentChains } from '../../helper-hardhat-config';
import { DeploymentManager } from './DeploymentManager';

async function DeployPositionManager(chainId: any) {
	const positionManagerFactory = await ethers.getContractFactory('PositionManager');
	const positionManager = await positionManagerFactory.deploy();

	const waitBlockConfirmations = developmentChains.includes(network.name) ? 1 : VERIFICATION_BLOCK_CONFIRMATIONS;
	await positionManager.deploymentTransaction()?.wait(waitBlockConfirmations);

	const address = await positionManager.getAddress();
	console.log(`PositionManager deployed to ${address} on ${network.name}`);

	DeploymentManager.saveAddress('PositionManager', address);

	if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
		await run('verify:verify', {
			address: address,
			constructorArguments: [],
		});
	}

	return address;
}

export { DeployPositionManager };
