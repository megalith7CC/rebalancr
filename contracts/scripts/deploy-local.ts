import { execSync } from 'child_process';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  console.log(`Loading environment from ${envPath}`);
  dotenv.config({ path: envPath });
} else {
  console.log('No .env.local file found, using default environment');
  dotenv.config();
}

process.env.HARDHAT_NETWORK = 'localhost';

process.env.DEPLOY_MOCKS = 'true';

process.env.EXPORT_ADDRESSES = '../agent,../frontend';

console.log('Starting local development deployment...');
console.log('Network: localhost');
console.log('Chain ID: 31337');

function deployMocks() {
  console.log('Deploying mock contracts for external dependencies...');
  
  try {
    console.log('Deploying MockERC20 for LINK token...');
    const linkTokenDeployCmd = `
      npx hardhat run --network localhost scripts/mocks/deploy-mock-link.ts
    `;
    const linkTokenAddress = execSync(linkTokenDeployCmd).toString().trim();
    process.env.LINK_TOKEN_ADDRESS = linkTokenAddress;
    console.log(`Mock LINK token deployed at: ${linkTokenAddress}`);
    
    console.log('Deploying MockChainlinkAggregator for ETH/USD price feed...');
    const priceFeedDeployCmd = `
      npx hardhat run --network localhost scripts/mocks/deploy-mock-price-feed.ts
    `;
    const priceFeedAddress = execSync(priceFeedDeployCmd).toString().trim();
    process.env.USD_PRICE_FEED_ADDRESS = priceFeedAddress;
    console.log(`Mock ETH/USD price feed deployed at: ${priceFeedAddress}`);
    
    console.log('Deploying MockFunctionsRouter...');
    const functionsRouterDeployCmd = `
      npx hardhat run --network localhost scripts/mocks/deploy-mock-functions-router.ts
    `;
    const functionsRouterAddress = execSync(functionsRouterDeployCmd).toString().trim();
    process.env.FUNCTIONS_ROUTER_ADDRESS = functionsRouterAddress;
    console.log(`Mock Functions Router deployed at: ${functionsRouterAddress}`);
    
    console.log('Deploying MockAutomationRegistry...');
    const automationRegistryDeployCmd = `
      npx hardhat run --network localhost scripts/mocks/deploy-mock-automation-registry.ts
    `;
    const automationRegistryAddress = execSync(automationRegistryDeployCmd).toString().trim();
    process.env.AUTOMATION_REGISTRY_ADDRESS = automationRegistryAddress;
    console.log(`Mock Automation Registry deployed at: ${automationRegistryAddress}`);
    
    console.log('Deploying MockERC20 for USDC...');
    const usdcDeployCmd = `
      npx hardhat run --network localhost scripts/mocks/deploy-mock-usdc.ts
    `;
    const usdcAddress = execSync(usdcDeployCmd).toString().trim();
    process.env.STABLECOIN_ADDRESS = usdcAddress;
    console.log(`Mock USDC deployed at: ${usdcAddress}`);
    
    console.log('Deploying MockContract for Aave Lending Pool...');
    const aaveLendingPoolDeployCmd = `
      npx hardhat run --network localhost scripts/mocks/deploy-mock-aave-lending-pool.ts
    `;
    const aaveLendingPoolAddress = execSync(aaveLendingPoolDeployCmd).toString().trim();
    process.env.AAVE_LENDING_POOL_ADDRESS = aaveLendingPoolAddress;
    console.log(`Mock Aave Lending Pool deployed at: ${aaveLendingPoolAddress}`);
    
    process.env.FUNCTIONS_SUBSCRIPTION_ID = '1';
    process.env.FUNCTIONS_DON_ID = '0x6d6f636b2d646f6e2d69642d6c6f63616c686f737400000000000000000000';
    
    console.log('All mock contracts deployed successfully');
    return true;
  } catch (error) {
    console.error('Error deploying mock contracts:', error);
    return false;
  }
}

if (process.env.DEPLOY_MOCKS === 'true') {
  const mocksDeployed = deployMocks();
  if (!mocksDeployed) {
    console.error('Failed to deploy mock contracts. Aborting deployment.');
    process.exit(1);
  }
}

try {
  execSync('npx hardhat run scripts/deploy.ts --network localhost', { 
    stdio: 'inherit',
    env: process.env
  });
  console.log('Local development deployment completed successfully');
} catch (error) {
  console.error('Local development deployment failed:', error);
  process.exit(1);
} 