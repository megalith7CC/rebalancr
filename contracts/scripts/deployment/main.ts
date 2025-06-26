import { network, run } from 'hardhat';

import { DeployPositionManager } from './deploy-position-manager';
import { DeployAgentRegistry } from './deploy-agentregistry';
import { DeployStrategyRouter } from './deploy-strategyrouter';
import { DeployPriceFeedOracle } from './deploy-pricefeedoracle';
import { DeployStrategyPoke } from './deploy-automation';
import { DeployAccessController } from './deploy-accesscontroller';
import { DeploymentManager } from './DeploymentManager';
import { DeployAdapters } from './deploy-adapters';
import { DeployStrategies } from './deploy-strategies';

async function Main() {

	await run('compile');
	const chainId = network.config.chainId;

	await DeployAccessController(chainId);
	await DeployPositionManager(chainId);
	await DeployPriceFeedOracle(chainId);
	await DeployStrategyPoke(chainId);

	await DeployAgentRegistry(chainId);
	await DeployStrategyRouter(chainId);

	await DeployAdapters(chainId);
	await DeployStrategies(chainId);

	DeploymentManager.ExportAddresses();
}

Main().catch((error) => {
	console.error('Deployment failed:', error);
	process.exitCode = 1;
});
