import { execSync } from 'child_process';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

const envPath = path.resolve(__dirname, '../.env.avalanche');
if (fs.existsSync(envPath)) {
  console.log(`Loading environment from ${envPath}`);
  dotenv.config({ path: envPath });
} else {
  console.log('No .env.avalanche file found, using default environment');
  dotenv.config();
}

process.env.HARDHAT_NETWORK = 'avalanche';

process.env.LINK_TOKEN_ADDRESS = process.env.LINK_TOKEN_ADDRESS || '0x5947BB275c521040051D82396192181b413227A3'; 
process.env.FUNCTIONS_ROUTER_ADDRESS = process.env.FUNCTIONS_ROUTER_ADDRESS || '0xA9d587a00A31A52Ed70D6026794a8FC5E2F5dCb0'; 
process.env.AUTOMATION_REGISTRY_ADDRESS = process.env.AUTOMATION_REGISTRY_ADDRESS || '0x7b3EC232b08BD7b4b3305BE0C044D907B2DF960B'; 
process.env.USD_PRICE_FEED_ADDRESS = process.env.USD_PRICE_FEED_ADDRESS || '0x976B3D034E162d8bD72D6b9C989d545b839003b0'; 
process.env.AAVE_LENDING_POOL_ADDRESS = process.env.AAVE_LENDING_POOL_ADDRESS || '0x4F01AeD16D97E3aB5ab2B501154DC9bb0F1A5A2C'; 
process.env.STABLECOIN_ADDRESS = process.env.STABLECOIN_ADDRESS || '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E'; 
process.env.FUNCTIONS_SUBSCRIPTION_ID = process.env.FUNCTIONS_SUBSCRIPTION_ID || '1';
process.env.FUNCTIONS_DON_ID = process.env.FUNCTIONS_DON_ID || '0x66756e2d6176616c616e6368652d6d61696e6e6574000000000000000000000';

process.env.EXPORT_ADDRESSES = '../agent,../frontend';

console.log('Starting Avalanche deployment...');
console.log('Network: Avalanche');
console.log('Chain ID: 43114');

try {
  execSync('npx hardhat run scripts/deploy.ts --network avalanche', { 
    stdio: 'inherit',
    env: process.env
  });
  console.log('Avalanche deployment completed successfully');
} catch (error) {
  console.error('Avalanche deployment failed:', error);
  process.exit(1);
} 