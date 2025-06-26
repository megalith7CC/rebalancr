import { ethers, network, run } from 'hardhat';
import { developmentChains, networkConfig, VERIFICATION_BLOCK_CONFIRMATIONS } from '../../helper-hardhat-config';
import { DeploymentManager } from './DeploymentManager';

async function DeployStrategies(chainId: any) {
	console.log(`\n📋 Deploying strategies for chain ID: ${chainId}`);

	const aaveAdapterAddress = DeploymentManager.getAddress('AaveAdapter');
	const priceOracleAddress =
		DeploymentManager.getAddress('ChainlinkPriceOracle') || DeploymentManager.getAddress('PriceFeedOracle');
	const positionManagerAddress = DeploymentManager.getAddress('PositionManager');

	if (!aaveAdapterAddress) {
		throw new Error('AaveAdapter not found. Deploy adapters first.');
	}

	if (!priceOracleAddress) {
		throw new Error('Price Oracle not found. Deploy price oracle first.');
	}

	if (!positionManagerAddress) {
		throw new Error('PositionManager not found. Deploy core contracts first.');
	}

	console.log(`Using AaveAdapter: ${aaveAdapterAddress}`);
	console.log(`Using PriceOracle: ${priceOracleAddress}`);
	console.log(`Using PositionManager: ${positionManagerAddress}`);

	await DeployAaveYieldStrategyV2(aaveAdapterAddress, priceOracleAddress, positionManagerAddress, chainId);

}

async function DeployAaveYieldStrategyV2(
	aaveAdapterAddress: string,
	priceOracleAddress: string,
	positionManagerAddress: string,
	chainId: any
) {
	const [deployer] = await ethers.getSigners();
	console.log(`\n🚀 Deploying AaveYieldStrategyV2 with account: ${deployer.address}`);

	const AaveYieldStrategyV2 = await ethers.getContractFactory('AaveYieldStrategyV2');
	const aaveYieldStrategy = await AaveYieldStrategyV2.deploy(aaveAdapterAddress, priceOracleAddress);

	const waitBlockConfirmations = developmentChains.includes(network.name) ? 1 : VERIFICATION_BLOCK_CONFIRMATIONS;
	await aaveYieldStrategy.deploymentTransaction()?.wait(waitBlockConfirmations);

	const strategyAddress = await aaveYieldStrategy.getAddress();
	console.log(`✅ AaveYieldStrategyV2 deployed to: ${strategyAddress} on ${network.name}`);

	DeploymentManager.saveAddress('AaveYieldStrategyV2', strategyAddress);

	console.log(`\n🔧 Configuring AaveYieldStrategyV2...`);
	await ConfigureAaveStrategy(aaveYieldStrategy, chainId);

	console.log(`\n📝 Registering strategy with PositionManager...`);
	await RegisterStrategy(strategyAddress, positionManagerAddress, deployer);

	if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
		console.log(`\n🔍 Verifying contract on Etherscan...`);
		try {
			await run('verify:verify', {
				address: strategyAddress,
				constructorArguments: [aaveAdapterAddress, priceOracleAddress],
			});
			console.log(`✅ Contract verified on Etherscan`);
		} catch (error) {
			console.log('❌ AaveYieldStrategyV2 verification failed:', error);
		}
	}

	return strategyAddress;
}

async function ConfigureAaveStrategy(aaveStrategy: any, chainId: any) {
	const tokens = networkConfig[chainId].tokenAddress || {};
	const supportedTokens = Object.values(tokens);

	if (supportedTokens.length === 0) {
		console.log(`⚠️  No tokens configured for this network`);
		return;
	}

	try {
		console.log(`   Initializing strategy with ${supportedTokens.length} supported tokens...`);
		console.log(`   Supported tokens:`, supportedTokens);

		const positionManagerAddress = DeploymentManager.getAddress('PositionManager');
		if (!positionManagerAddress) {
			throw new Error('PositionManager address not found');
		}

		const initData = ethers.AbiCoder.defaultAbiCoder().encode(
			['string', 'string', 'address[]', 'uint256', 'bytes32', 'uint256', 'address'],
			[
				'Aave Yield Strategy V2', 
				'Automated yield farming strategy using Aave V2 protocol', 
				supportedTokens, 
				ethers.parseEther('100'), 
				ethers.encodeBytes32String('LOW'), 
				200, 
				positionManagerAddress, 
			]
		);

		console.log('   📝 Initializing strategy...');
		const initTx = await aaveStrategy.initialize(initData);
		await initTx.wait();
		console.log('   ✅ Strategy initialized successfully');

		console.log('   🟢 Activating strategy...');
		const activateTx = await aaveStrategy.activateStrategy();
		await activateTx.wait();
		console.log('   ✅ Strategy activated successfully');

		const strategyInfo = await aaveStrategy.getStrategyInfo();
		console.log('   📋 Strategy Information:');
		console.log(`       ID: ${strategyInfo.id}`);
		console.log(`       Name: ${strategyInfo.name}`);
		console.log(`       Active: ${strategyInfo.active}`);
		console.log(`       Supported tokens: ${strategyInfo.supportedTokens.length}`);
	} catch (error) {
		console.error('   ❌ Failed to configure strategy:', error);
		console.log('   ⚠️  Strategy configuration failed but deployment continues');
	}
}

async function RegisterStrategy(strategyAddress: string, positionManagerAddress: string, deployer: any) {
	try {
		console.log(`   Connecting to PositionManager at: ${positionManagerAddress}`);

		const positionManagerABI = [
			'function registerStrategy(address strategyAgent)',
			'function isStrategyRegistered(bytes32 strategyId) view returns (bool)',
		];

		const positionManager = new ethers.Contract(positionManagerAddress, positionManagerABI, deployer);

		console.log(`   Registering strategy ${strategyAddress}...`);

		try {
			const registerTx = await positionManager.registerStrategy(strategyAddress);
			const receipt = await registerTx.wait();

			console.log(`   ✅ Strategy registered successfully`);
			console.log(`   📄 Transaction hash: ${receipt?.hash}`);
			console.log(`   ⛽ Gas used: ${receipt?.gasUsed?.toString()}`);
		} catch (registerError: any) {
			if (registerError.message?.includes('StrategyAlreadyRegistered')) {
				console.log(`   ⚠️  Strategy is already registered`);
			} else {
				console.error('   ❌ Registration transaction failed:', registerError.message || registerError);
			}
		}
	} catch (error: any) {
		console.error('   ❌ Failed to register strategy:', error.message || error);
		console.log('   ⚠️  Strategy registration failed but deployment continues');
	}
}

async function DeployBalancerLPStrategyV2(balancerAdapterAddress: string, priceFeedOracleAddress: string) {
	console.log('Deploying BalancerLPStrategyV2 contract...');
	const BalancerLPStrategyV2 = await ethers.getContractFactory('BalancerLPStrategyV2');
	const balancerLPStrategy = await BalancerLPStrategyV2.deploy(balancerAdapterAddress, priceFeedOracleAddress);

	const waitBlockConfirmations = developmentChains.includes(network.name) ? 1 : VERIFICATION_BLOCK_CONFIRMATIONS;
	await balancerLPStrategy.deploymentTransaction()?.wait(waitBlockConfirmations);

	const strategyAddress = await balancerLPStrategy.getAddress();
	console.log(`BalancerLPStrategyV2 deployed to: ${strategyAddress} on ${network.name}`);

	DeploymentManager.saveAddress('BalancerLPStrategyV2', strategyAddress);

	if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
		try {
			await run('verify:verify', {
				address: strategyAddress,
				constructorArguments: [balancerAdapterAddress, priceFeedOracleAddress],
			});
		} catch (error) {
			console.log('BalancerLPStrategyV2 verification failed:', error);
		}
	}

	return strategyAddress;
}

export { DeployStrategies };
