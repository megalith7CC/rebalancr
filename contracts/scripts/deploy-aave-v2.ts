import { ethers } from 'hardhat';
import { writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

async function deployAaveAdapter() {
	console.log('Deploying Aave V2 Adapter for Avalanche Fuji...');

	const AAVE_V2_POOL_FUJI = '0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951';

	const AaveAdapter = await ethers.getContractFactory('AaveAdapter');
	const aaveAdapter = await AaveAdapter.deploy(AAVE_V2_POOL_FUJI);
	await aaveAdapter.waitForDeployment();

	const aaveAdapterAddress = await aaveAdapter.getAddress();
	console.log('AaveAdapter deployed to:', aaveAdapterAddress);

	const tokenMappings = [
		{
			underlying: '0x5425890298aed601595a70AB815c96711a31Bc65',
			aToken: '0x625E7708f30cA75bfd92586e17077590C60eb4cD', 
		},
		{
			underlying: '0x1D308089a2D1Ced3f1Ce36B1FcaF815b07217be3',
			aToken: '0x6d80113e533a2C0fe82EaBD35f1875DcEA89Ea97', 
		},
		{
			underlying: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7',
			aToken: '0x6ab707Aca953eDAeFBc4fD23bA73294241490620', 
		},
	];

	for (const mapping of tokenMappings) {
		console.log(`Setting token mapping: ${mapping.underlying} -> ${mapping.aToken}`);
		const tx = await aaveAdapter.setAaveTokenMapping(mapping.underlying, mapping.aToken);
		await tx.wait();
		console.log('✓ Token mapping set');
	}

	const AaveYieldStrategyV2 = await ethers.getContractFactory('AaveYieldStrategyV2');

	const deploymentsPath = join(__dirname, '../deployments.json');
	const deployments = JSON.parse(readFileSync(deploymentsPath, 'utf8'));
	const priceOracleAddress = deployments['43113']?.PriceFeedOracle;

	if (!priceOracleAddress) {
		throw new Error('PriceFeedOracle not found in deployments for Fuji testnet');
	}

	const aaveStrategy = await AaveYieldStrategyV2.deploy(aaveAdapterAddress, priceOracleAddress);
	await aaveStrategy.waitForDeployment();

	const aaveStrategyAddress = await aaveStrategy.getAddress();
	console.log('AaveYieldStrategyV2 deployed to:', aaveStrategyAddress);

	const supportedTokens = tokenMappings.map((m) => m.underlying);
	console.log('Adding supported tokens to strategy...');

	for (const token of supportedTokens) {
		const tx = await aaveStrategy.addSupportedToken(token);
		await tx.wait();
		console.log(`✓ Added supported token: ${token}`);
	}

	deployments['43113'] = {
		...deployments['43113'],
		AaveAdapter: aaveAdapterAddress,
		AaveYieldStrategyV2: aaveStrategyAddress,
	};

	writeFileSync(deploymentsPath, JSON.stringify(deployments, null, 2));
	console.log('✓ Updated deployments.json');

	const strategyRouterAddress = deployments['43113']?.StrategyRouter;
	if (strategyRouterAddress) {
		console.log('Registering strategy with StrategyRouter...');
		const StrategyRouter = await ethers.getContractAt('StrategyRouter', strategyRouterAddress);

		const strategyId = ethers.id('aave-v2-yield-strategy');
		const tx = await StrategyRouter.registerStrategy(strategyId, aaveStrategyAddress);
		await tx.wait();
		console.log('✓ Strategy registered with ID:', strategyId);
	}

	console.log('\n🎉 Aave V2 deployment completed!');
	console.log('Addresses:');
	console.log('- AaveAdapter:', aaveAdapterAddress);
	console.log('- AaveYieldStrategyV2:', aaveStrategyAddress);
	console.log('- Supported tokens:', supportedTokens.length);

	return {
		aaveAdapter: aaveAdapterAddress,
		aaveStrategy: aaveStrategyAddress,
	};
}

if (require.main === module) {
	deployAaveAdapter()
		.then(() => process.exit(0))
		.catch((error) => {
			console.error(error);
			process.exit(1);
		});
}

export { deployAaveAdapter };
