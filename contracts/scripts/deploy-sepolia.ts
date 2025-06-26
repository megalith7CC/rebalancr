import { execSync } from 'child_process';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

const envPath = path.resolve(__dirname, '../.env.sepolia');
if (fs.existsSync(envPath)) {
  console.log(`Loading environment from ${envPath}`);
  dotenv.config({ path: envPath });
} else {
  console.log('No .env.sepolia file found, using default environment');
  dotenv.config();
}

process.env.HARDHAT_NETWORK = 'sepolia';

process.env.LINK_TOKEN_ADDRESS = process.env.LINK_TOKEN_ADDRESS || '0x779877A7B0D9E8603169DdbD7836e478b4624789';
process.env.FUNCTIONS_ROUTER_ADDRESS = process.env.FUNCTIONS_ROUTER_ADDRESS || '0xb83E47C2bC239B3bf370bc41e1459A34b41238D0';
process.env.AUTOMATION_REGISTRY_ADDRESS = process.env.AUTOMATION_REGISTRY_ADDRESS || '0x0BDaBb4594EFd10bB8931A74BF3b640149F1D946';
process.env.USD_PRICE_FEED_ADDRESS = process.env.USD_PRICE_FEED_ADDRESS || '0x694AA1769357215DE4FAC081bf1f309aDC325306';
process.env.AAVE_LENDING_POOL_ADDRESS = process.env.AAVE_LENDING_POOL_ADDRESS || '0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951';
process.env.STABLECOIN_ADDRESS = process.env.STABLECOIN_ADDRESS || '0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8';
process.env.FUNCTIONS_SUBSCRIPTION_ID = process.env.FUNCTIONS_SUBSCRIPTION_ID || '1';
process.env.FUNCTIONS_DON_ID = process.env.FUNCTIONS_DON_ID || '0x66756e2d657468657265756d2d7365706f6c69612d3100000000000000000000';

process.env.EXPORT_ADDRESSES = '../agent,../frontend';

console.log('Starting Sepolia deployment...');
console.log('Network: Sepolia');
console.log('Chain ID: 11155111');

try {
  execSync('npx hardhat run scripts/deploy.ts --network sepolia', { 
    stdio: 'inherit',
    env: process.env
  });
  console.log('Sepolia deployment completed successfully');
} catch (error) {
  console.error('Sepolia deployment failed:', error);
  process.exit(1);
} 