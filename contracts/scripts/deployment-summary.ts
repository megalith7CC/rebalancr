import fs from 'fs';
import path from 'path';

function readDeploymentInfo(filePath: string): any {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      const match = content.match(/export const addresses = (.*?);/s);
      if (match && match[1]) {
        return JSON.parse(match[1]);
      }
    }
    return null;
  } catch (error) {
    console.error(`Error reading deployment info from ${filePath}:`, error);
    return null;
  }
}

function generateDeploymentSummary(): string {
  const networks = [
    { name: 'Sepolia', addressFile: '../agent/generated/addresses-sepolia.ts' },
    { name: 'Avalanche', addressFile: '../agent/generated/addresses-avalanche.ts' },
    { name: 'Avalanche Fuji', addressFile: '../agent/generated/addresses-avalancheFuji.ts' },
    { name: 'Local', addressFile: '../agent/generated/addresses-localhost.ts' }
  ];

  let markdown = '# Rebalancr Deployment Summary\n\n';

  networks.forEach(network => {
    const filePath = path.resolve(__dirname, network.addressFile);
    const deploymentInfo = readDeploymentInfo(filePath);

    markdown += `## ${network.name}\n\n`;
    
    if (deploymentInfo) {
      markdown += '| Contract | Address |\n';
      markdown += '|----------|--------|\n';
      
      Object.entries(deploymentInfo).forEach(([name, address]) => {
        markdown += `| ${name} | \`${address}\` |\n`;
      });
      
      markdown += '\n';
    } else {
      markdown += 'No deployment information available.\n\n';
    }
  });

  markdown += '## Usage\n\n';
  markdown += 'To deploy to a specific network, use one of the following commands:\n\n';
  markdown += '```bash\n';
  markdown += '# Deploy to Sepolia testnet\n';
  markdown += 'npm run deploy:sepolia\n\n';
  markdown += '# Deploy to Avalanche mainnet\n';
  markdown += 'npm run deploy:avalanche\n\n';
  markdown += '# Deploy to Avalanche Fuji testnet\n';
  markdown += 'npm run deploy:avalanche-fuji\n\n';
  markdown += '# Deploy to local development network\n';
  markdown += 'npm run deploy:local\n';
  markdown += '```\n\n';
  
  markdown += '## Environment Configuration\n\n';
  markdown += 'Create the following environment files for each network:\n\n';
  markdown += '- `.env.sepolia` - Sepolia testnet configuration\n';
  markdown += '- `.env.avalanche` - Avalanche mainnet configuration\n';
  markdown += '- `.env.avalanche-fuji` - Avalanche Fuji testnet configuration\n';
  markdown += '- `.env.local` - Local development configuration\n\n';
  
  markdown += 'Each file should include the appropriate RPC URLs, private keys, and contract addresses.\n';

  return markdown;
}

const summary = generateDeploymentSummary();
const outputPath = path.resolve(__dirname, '../DEPLOYMENTS.md');
fs.writeFileSync(outputPath, summary);

console.log(`Deployment summary written to ${outputPath}`); 