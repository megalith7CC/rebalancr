import { network, ethers, run } from 'hardhat';
import { developmentChains, networkConfig, VERIFICATION_BLOCK_CONFIRMATIONS } from '../../helper-hardhat-config';
import { DeploymentManager } from './DeploymentManager';

async function DeployPriceFeedOracle(chainId: any) {

	let priceFeedAddress: string;

	if (developmentChains.includes(network.name)) {
		const DECIMALS = '18';
		const INITIAL_PRICE = '200000000000000000000';

		const mockV3AggregatorFactory = await ethers.getContractFactory('MockChainlinkAggregator');
		const mockV3Aggregator = await mockV3AggregatorFactory.deploy(DECIMALS, INITIAL_PRICE);

		priceFeedAddress = await mockV3Aggregator.getAddress();
	} else {
		priceFeedAddress = networkConfig[chainId]['ethUsdPriceFeed'] || '';
	}

	const priceFeedOracleFactory = await ethers.getContractFactory('PriceFeedOracle');
	const priceFeedOracle = await priceFeedOracleFactory.deploy(priceFeedAddress);

	const waitBlockConfirmations = developmentChains.includes(network.name) ? 1 : VERIFICATION_BLOCK_CONFIRMATIONS;
	await priceFeedOracle.deploymentTransaction()?.wait(waitBlockConfirmations);

	const address = await priceFeedOracle.getAddress();
	console.log(`PriceFeedOracle deployed to ${address} on ${network.name}`);

	DeploymentManager.saveAddress('PriceFeedOracle', address);

	if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
		await run('verify:verify', {
			address: address,
			constructorArguments: [priceFeedAddress],
		});
	}

	return address;
}

export { DeployPriceFeedOracle };
