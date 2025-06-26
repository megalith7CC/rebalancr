import { ethers, network, run } from 'hardhat';
import { developmentChains, VERIFICATION_BLOCK_CONFIRMATIONS } from '../../helper-hardhat-config';
import { DeploymentManager } from './DeploymentManager';

async function DeployAgentRegistry(chainId: any) {

	const AgentRegistry = await ethers.getContractFactory('AgentRegistry');
	const agentRegistry = await AgentRegistry.deploy();

	const waitBlockConfirmations = developmentChains.includes(network.name) ? 1 : VERIFICATION_BLOCK_CONFIRMATIONS;
	await agentRegistry.deploymentTransaction()?.wait(waitBlockConfirmations);

	const address = await agentRegistry.getAddress();
	console.log(`AgentRegistry deployed to ${address} on ${network.name}`);

	DeploymentManager.saveAddress('AgentRegistry', address);

	if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
		await run('verify:verify', {
			address: address,
			constructorArguments: [],
		});
	}

	return address;
}

export { DeployAgentRegistry };
