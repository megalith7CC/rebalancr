import { execSync } from 'child_process';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

const envPath = path.resolve(__dirname, '../.env.avalanche-fuji');
if (fs.existsSync(envPath)) {
  console.log(`Loading environment from ${envPath}`);
  dotenv.config({ path: envPath });
} else {
  console.log('No .env.avalanche-fuji file found, using default environment');
  dotenv.config();
}

process.env.HARDHAT_NETWORK = 'fuji';

process.env.LINK_TOKEN_ADDRESS = process.env.LINK_TOKEN_ADDRESS || '0x0b9d5D9136855f6FEc3c0993feE6E9CE8a297846'; 
process.env.FUNCTIONS_ROUTER_ADDRESS = process.env.FUNCTIONS_ROUTER_ADDRESS || '0xA9d587a00A31A52Ed70D6026794a8FC5E2F5dCb0'; 
process.env.AUTOMATION_REGISTRY_ADDRESS = process.env.AUTOMATION_REGISTRY_ADDRESS || '0x819B58A646CDd8289275A87653a2aA4902b14fe6'; 
process.env.USD_PRICE_FEED_ADDRESS = process.env.USD_PRICE_FEED_ADDRESS || '0x5498BB86BC934c8D34FDA08E81D444153d0D06aD'; 
process.env.AAVE_LENDING_POOL_ADDRESS = process.env.AAVE_LENDING_POOL_ADDRESS || '0x76cc67FF2CC77821A70ED14321111Ce381C2594D'; 
process.env.STABLECOIN_ADDRESS = process.env.STABLECOIN_ADDRESS || '0x5425890298aed601595a70AB815c96711a31Bc65'; 
process.env.FUNCTIONS_SUBSCRIPTION_ID = process.env.FUNCTIONS_SUBSCRIPTION_ID || '1';
process.env.FUNCTIONS_DON_ID = process.env.FUNCTIONS_DON_ID || '0x66756e2d6176616c616e6368652d66756a692d3100000000000000000000000';

process.env.EXPORT_ADDRESSES = '../agent,../frontend';

console.log('Starting Avalanche Fuji deployment...');
console.log('Network: Avalanche Fuji');
console.log('Chain ID: 43113');

try {
  execSync('npx hardhat run scripts/deploy.ts --network fuji', { 
    stdio: 'inherit',
    env: process.env
  });
  console.log('Avalanche Fuji deployment completed successfully');
} catch (error) {
  console.error('Avalanche Fuji deployment failed:', error);
  process.exit(1);
} 