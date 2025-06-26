import { ethers } from "hardhat";
import { writeFileSync } from "fs";
import path from "path";
import fs from "fs";
import { DeployAdapters } from './deployment/deploy-adapters';
import { DeployStrategies } from './deployment/deploy-strategies';

type DeploymentInfo = {
  network?: string;
  chainId?: string;
  timestamp?: string;
  deployer?: string;
  contracts?: Record<string, string>;
  external?: Record<string, string>;
} | null;


async function exportDeploymentInfo(deploymentInfo: DeploymentInfo) {

  if (!deploymentInfo) {
    return;
  }

  console.log("\nDeployment Summary:");
  console.log("======================");
  console.log("Network:", deploymentInfo.network);
  console.log("Chain ID:", deploymentInfo.chainId);
  console.log("Deployer:", deploymentInfo.deployer);
  console.log("\nContract Addresses:");
  Object.entries(deploymentInfo?.contracts || {}).forEach(([name, address]) => {
    console.log(`${name}: ${address}`);
  });
  console.log("\nExternal Contracts:");
  Object.entries(deploymentInfo?.external || {}).forEach(([name, address]) => {
    console.log(`${name}: ${address}`);
  });

  const content = `// Auto-generated deployment configuration

export const addresses = ${JSON.stringify(deploymentInfo.contracts, null, 2)};

export const externalAddresses = ${JSON.stringify(deploymentInfo.external, null, 2)};

export const deploymentConfig = ${JSON.stringify(deploymentInfo, null, 2)};
`;
  
  const locations = process.env.EXPORT_ADDRESSES ? process.env.EXPORT_ADDRESSES.split(',') : [];

  console.log("\nSaving deployment info to directories:");
  if (locations.length === 0) {
    console.log("No directories specified in EXPORT_ADDRESSES. Saving to default locations.");
    locations.push(
      "../agent",
      "../frontend"
    );
  }

  locations.forEach((location: string) => {
    try {
      const fullPath = path.resolve(location);
      const srcPath = path.join(fullPath, 'generated');
      
      if (!fs.existsSync(srcPath)) {
        fs.mkdirSync(srcPath, { recursive: true });
      }
      
      const addressesPath = path.join(srcPath, 'addresses.ts');
      writeFileSync(addressesPath, content);
      console.log(`Saved to: ${addressesPath}`);
    } catch (error: any) {
      console.error(`❌ Failed to save to ${location}:`, error.message);
    }
  });

}

async function main() {
	const [deployer] = await ethers.getSigners();
	console.log('Deploying contracts with account:', deployer.address);

	const network = await ethers.provider.getNetwork();
	console.log('Network:', network.name);
	console.log('Chain ID:', network.chainId);

	const contracts: Record<string, string> = {};
	const external: Record<string, string> = {};

	const linkTokenAddress = process.env.LINK_TOKEN_ADDRESS || '0x779877A7B0D9E8603169DdbD7836e478b4624789'; 
	const functionsRouterAddress = process.env.FUNCTIONS_ROUTER_ADDRESS || '0xb83E47C2bC239B3bf370bc41e1459A34b41238D0'; 
	const chainlinkAutomationRegistryAddress =
		process.env.AUTOMATION_REGISTRY_ADDRESS || '0x819B58A646CDd8289275A87653a2aA4902b14fe6'; 
	const usdPriceFeedAddress = process.env.USD_PRICE_FEED_ADDRESS || '0x694AA1769357215DE4FAC081bf1f309aDC325306'; 

	external['LINK_TOKEN'] = linkTokenAddress;
	external['FUNCTIONS_ROUTER'] = functionsRouterAddress;
	external['AUTOMATION_REGISTRY'] = chainlinkAutomationRegistryAddress;
	external['USD_PRICE_FEED'] = usdPriceFeedAddress;

	console.log('\nDeploying core contracts...');

	console.log('Deploying AccessController...');
	const AccessController = await ethers.getContractFactory('AccessController');
	const accessController = await AccessController.deploy(deployer.address);
	await accessController.waitForDeployment();
	const accessControllerAddress = await accessController.getAddress();
	console.log('AccessController deployed to:', accessControllerAddress);
	contracts['AccessController'] = accessControllerAddress;

	console.log('Deploying AgentRegistry...');
	const AgentRegistry = await ethers.getContractFactory('AgentRegistry');
	const agentRegistry = await AgentRegistry.deploy();
	await agentRegistry.waitForDeployment();
	const agentRegistryAddress = await agentRegistry.getAddress();
	console.log('AgentRegistry deployed to:', agentRegistryAddress);
	contracts['AgentRegistry'] = agentRegistryAddress;

	console.log('Deploying PositionManager...');
	const PositionManager = await ethers.getContractFactory('PositionManager');
	const positionManager = await PositionManager.deploy();
	await positionManager.waitForDeployment();
	const positionManagerAddress = await positionManager.getAddress();
	console.log('PositionManager deployed to:', positionManagerAddress);
	contracts['PositionManager'] = positionManagerAddress;

	console.log('Deploying StrategyRouter...');
	const StrategyRouter = await ethers.getContractFactory('StrategyRouter');
	const strategyRouter = await StrategyRouter.deploy(agentRegistryAddress);
	await strategyRouter.waitForDeployment();
	const strategyRouterAddress = await strategyRouter.getAddress();
	console.log('StrategyRouter deployed to:', strategyRouterAddress);
	contracts['StrategyRouter'] = strategyRouterAddress;

	console.log('Deploying ChainlinkPriceOracle...');
	const ChainlinkPriceOracle = await ethers.getContractFactory('ChainlinkPriceOracle');
	const chainlinkPriceOracle = await ChainlinkPriceOracle.deploy(usdPriceFeedAddress);
	await chainlinkPriceOracle.waitForDeployment();
	const chainlinkPriceOracleAddress = await chainlinkPriceOracle.getAddress();
	console.log('ChainlinkPriceOracle deployed to:', chainlinkPriceOracleAddress);
	contracts['ChainlinkPriceOracle'] = chainlinkPriceOracleAddress;

	console.log('Deploying MarketDataAggregator...');
	const MarketDataAggregator = await ethers.getContractFactory('MarketDataAggregator');
	const marketDataAggregator = await MarketDataAggregator.deploy(agentRegistryAddress);
	await marketDataAggregator.waitForDeployment();
	const marketDataAggregatorAddress = await marketDataAggregator.getAddress();
	console.log('MarketDataAggregator deployed to:', marketDataAggregatorAddress);
	contracts['MarketDataAggregator'] = marketDataAggregatorAddress;

	console.log('Deploying ChainlinkFunctionsConsumer...');
	const ChainlinkFunctionsConsumer = await ethers.getContractFactory('ChainlinkFunctionsConsumer');

	const subscriptionId = process.env.FUNCTIONS_SUBSCRIPTION_ID || '1'; 
	const donId = process.env.FUNCTIONS_DON_ID || '0x66756e2d657468657265756d2d7365706f6c69612d3100000000000000000000'; 

	const chainlinkFunctionsConsumer = await ChainlinkFunctionsConsumer.deploy(
		functionsRouterAddress,
		strategyRouterAddress,
		agentRegistryAddress,
		subscriptionId,
		donId
	);
	await chainlinkFunctionsConsumer.waitForDeployment();
	const chainlinkFunctionsConsumerAddress = await chainlinkFunctionsConsumer.getAddress();
	console.log('ChainlinkFunctionsConsumer deployed to:', chainlinkFunctionsConsumerAddress);
	contracts['ChainlinkFunctionsConsumer'] = chainlinkFunctionsConsumerAddress;

	console.log('Deploying StrategyExecutionBridge...');
	const StrategyExecutionBridge = await ethers.getContractFactory('StrategyExecutionBridge');
	const strategyExecutionBridge = await StrategyExecutionBridge.deploy(strategyRouterAddress, agentRegistryAddress);
	await strategyExecutionBridge.waitForDeployment();
	const strategyExecutionBridgeAddress = await strategyExecutionBridge.getAddress();
	console.log('StrategyExecutionBridge deployed to:', strategyExecutionBridgeAddress);
	contracts['StrategyExecutionBridge'] = strategyExecutionBridgeAddress;

	console.log('Deploying AutomationRegistry...');
	const AutomationRegistry = await ethers.getContractFactory('AutomationRegistry');
	const automationRegistry = await AutomationRegistry.deploy(
		chainlinkAutomationRegistryAddress, 
		linkTokenAddress,
		agentRegistryAddress,
		ethers.parseEther('0.1') 
	);
	await automationRegistry.waitForDeployment();
	const automationRegistryAddress = await automationRegistry.getAddress();
	console.log('AutomationRegistry deployed to:', automationRegistryAddress);
	contracts['AutomationRegistry'] = automationRegistryAddress;

	console.log('Deploying StrategyAutomationManager...');
	const StrategyAutomationManager = await ethers.getContractFactory('StrategyAutomationManager');
	const strategyAutomationManager = await StrategyAutomationManager.deploy(
		automationRegistryAddress,
		strategyExecutionBridgeAddress,
		agentRegistryAddress,
		marketDataAggregatorAddress,
		positionManagerAddress,
		linkTokenAddress
	);
	await strategyAutomationManager.waitForDeployment();
	const strategyAutomationManagerAddress = await strategyAutomationManager.getAddress();
	console.log('StrategyAutomationManager deployed to:', strategyAutomationManagerAddress);
	contracts['StrategyAutomationManager'] = strategyAutomationManagerAddress;

	console.log('Deploying AgentRequestHandler...');
	const AgentRequestHandler = await ethers.getContractFactory('AgentRequestHandler');
	const agentRequestHandler = await AgentRequestHandler.deploy(agentRegistryAddress);
	await agentRequestHandler.waitForDeployment();
	const agentRequestHandlerAddress = await agentRequestHandler.getAddress();
	console.log('AgentRequestHandler deployed to:', agentRequestHandlerAddress);
	contracts['AgentRequestHandler'] = agentRequestHandlerAddress;

	try {
		console.log('Deploying AaveYieldStrategy...');
		const AaveYieldStrategy = await ethers.getContractFactory('AaveYieldStrategy');

		const aaveLendingPoolAddress = process.env.AAVE_LENDING_POOL_ADDRESS || '0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951'; 
		external['AAVE_LENDING_POOL'] = aaveLendingPoolAddress;

		const aaveYieldStrategy = await AaveYieldStrategy.deploy();
		await aaveYieldStrategy.waitForDeployment();
		const aaveYieldStrategyAddress = await aaveYieldStrategy.getAddress();
		console.log('AaveYieldStrategy deployed to:', aaveYieldStrategyAddress);
		contracts['AaveYieldStrategy'] = aaveYieldStrategyAddress;

		console.log('Initializing AaveYieldStrategy...');
		const stablecoinAddress = process.env.STABLECOIN_ADDRESS || '0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8'; 
		external['USDC'] = stablecoinAddress;

		const initData = ethers.AbiCoder.defaultAbiCoder().encode(
			['string', 'string', 'address[]', 'uint256', 'bytes32', 'uint256', 'address'],
			[
				'Aave Yield Strategy',
				'Provides yield through Aave lending protocol',
				[stablecoinAddress],
				ethers.parseUnits('100', 6), 
				ethers.encodeBytes32String('MEDIUM'), 
				1000, 
				positionManagerAddress,
			]
		);

		await aaveYieldStrategy.initialize(initData);
		console.log('AaveYieldStrategy initialized');

		console.log('Registering AaveYieldStrategy with StrategyRouter...');
		const strategyId = await aaveYieldStrategy.strategyInfo();
		await strategyRouter.registerStrategy(strategyId.id, aaveYieldStrategyAddress);
		console.log('AaveYieldStrategy registered with StrategyRouter');

		console.log('Registering AaveYieldStrategy with PositionManager...');
		await positionManager.registerStrategy(aaveYieldStrategyAddress);
		console.log('AaveYieldStrategy registered with PositionManager');
	} catch (error: any) {
		console.log('Skipping AaveYieldStrategy deployment:', error.message);
	}

	console.log('Configuring permissions in AgentRegistry...');

	const YIELD_AGENT_TYPE = ethers.encodeBytes32String('YIELD_AGENT');

	const VIEW_PERMISSION = ethers.encodeBytes32String('VIEW');
	const EXECUTE_PERMISSION = ethers.encodeBytes32String('EXECUTE');
	const QUERY_PERMISSION = ethers.encodeBytes32String('QUERY');
	const SUBMIT_REQUEST_PERMISSION = ethers.encodeBytes32String('SUBMIT_REQUEST');
	const PROCESS_REQUEST_PERMISSION = ethers.encodeBytes32String('PROCESS_REQUEST');
	const AUTOMATION_ADMIN_PERMISSION = ethers.encodeBytes32String('AUTOMATION_ADMIN');
	const AUTOMATION_EXECUTE_PERMISSION = ethers.encodeBytes32String('AUTOMATION_EXECUTE');
	const MANAGE_PERMISSION = ethers.encodeBytes32String('MANAGE');

	await agentRegistry.addGlobalPermission(VIEW_PERMISSION);
	await agentRegistry.addGlobalPermission(QUERY_PERMISSION);
	console.log('Global permissions added to AgentRegistry');

	const yieldAgentAddress = process.env.YIELD_AGENT_ADDRESS || deployer.address; 
	await agentRegistry.registerAgent(yieldAgentAddress, YIELD_AGENT_TYPE);
	console.log('YieldAgent registered with AgentRegistry:', yieldAgentAddress);

	await agentRegistry.updateAgentPermissions(yieldAgentAddress, [
		VIEW_PERMISSION,
		QUERY_PERMISSION,
		EXECUTE_PERMISSION,
		SUBMIT_REQUEST_PERMISSION,
		PROCESS_REQUEST_PERMISSION,
		AUTOMATION_ADMIN_PERMISSION,
		AUTOMATION_EXECUTE_PERMISSION,
		MANAGE_PERMISSION,
	]);
	console.log('YieldAgent permissions updated');

	console.log('Registering ChainlinkPriceOracle with MarketDataAggregator...');
	await marketDataAggregator.registerDataSource(
		chainlinkPriceOracleAddress,
		0, 
		1000, 
		3600, 
		'Chainlink Price Oracle'
	);
	console.log('ChainlinkPriceOracle registered with MarketDataAggregator');

	console.log('Configuring JavaScript source for Chainlink Functions...');
	const javaScriptSource = `
    return Functions.encodeString(JSON.stringify({
      status: "success",
      data: args[1]
    }));
  `;
	await chainlinkFunctionsConsumer.updateJavaScriptSource(javaScriptSource);
	console.log('JavaScript source configured for Chainlink Functions');

	console.log('\n🔧 Deploying Protocol Adapters...');
	await DeployAdapters(network.chainId);

	console.log('\n🎯 Deploying Strategies...');
	await DeployStrategies(network.chainId);

	console.log('\n🎉 All deployments completed successfully!');

	const deploymentInfo: DeploymentInfo = {
		network: network.name,
		chainId: network.chainId.toString(),
		timestamp: new Date().toISOString(),
		deployer: deployer.address,
		contracts,
		external,
	};

	exportDeploymentInfo(deploymentInfo);
}

main()
  .then(() => process.exit(0))
  .catch((error: any) => {
    console.error(error);
    process.exit(1);
  });
