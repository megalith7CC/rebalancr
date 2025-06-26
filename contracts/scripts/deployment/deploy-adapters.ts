import { ethers, network, run } from 'hardhat';
import { developmentChains, networkConfig, VERIFICATION_BLOCK_CONFIRMATIONS } from '../../helper-hardhat-config';
import { DeploymentManager } from './DeploymentManager';

async function DeployAdapters(chainId: any) {
	await DeployAaveV2Adapter(chainId);
}

async function DeployAaveV2Adapter(chainId: any) {
	let aavePoolAddress: string;
	const [deployer] = await ethers.getSigners();

	if (developmentChains.includes(network.name)) {
		const MockAavePool = await ethers.getContractFactory('MockAavePool');
		const mockAavePool = await MockAavePool.deploy();
		await mockAavePool.deploymentTransaction()?.wait(1);

		aavePoolAddress = await mockAavePool.getAddress();
	} else {
		aavePoolAddress = networkConfig[chainId]['aavePoolAddress'] || '';
		if (!aavePoolAddress) {
			throw new Error(`Aave V2 Pool address not configured for chain ${chainId}`);
		}
	}

	const AaveAdapter = await ethers.getContractFactory('AaveAdapter');
	const aaveAdapter = await AaveAdapter.deploy(aavePoolAddress);
	const adapterWithSigner = aaveAdapter.connect(deployer);

	const waitBlockConfirmations = developmentChains.includes(network.name) ? 1 : VERIFICATION_BLOCK_CONFIRMATIONS;
	await adapterWithSigner.deploymentTransaction()?.wait(waitBlockConfirmations);

	const aaveAdapterAddress = await adapterWithSigner.getAddress();
	console.log(`AaveAdapter deployed to ${aaveAdapterAddress} on ${network.name}`);

	DeploymentManager.saveAddress('AaveAdapter', aaveAdapterAddress);

	if (!developmentChains.includes(network.name)) {
		console.log('Configuring Aave V2 Adapter with supported tokens...');
		await ConfigureAaveAdapter(adapterWithSigner, chainId);
	}

	if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
		try {
			await run('verify:verify', {
				address: aaveAdapterAddress,
				constructorArguments: [aavePoolAddress],
			});
		} catch (error) {
			console.log('❌ AaveAdapter verification failed:', error);
		}
	}

	return aaveAdapterAddress;
}

async function ConfigureAaveAdapter(aaveAdapter: any, chainId: any) {
	const aTokens = networkConfig[chainId].aTokenAddress || {};
	const tokens = networkConfig[chainId].tokenAddress || {};

	let successCount = 0;
	let failureCount = 0;

	for (const [tokenSymbol, tokenAddress] of Object.entries(tokens)) {
		const aTokenAddress = aTokens[tokenSymbol];

		if (aTokenAddress) {
			console.log(`   ${tokenSymbol}: ${tokenAddress} -> ${aTokenAddress}`);

			try {
				await aaveAdapter.setAaveTokenMapping(tokenAddress, aTokenAddress);
				console.log(`    ${tokenSymbol} mapping configured successfully`);
				successCount++;
			} catch (error) {
				console.log(`    Failed to configure ${tokenSymbol} mapping:`, error);
				failureCount++;
			}
		} else {
			console.log(`   No aToken address found for ${tokenSymbol}`);
		}
	}
}

export { DeployAdapters };
