import { ethers } from "hardhat";
import { writeFileSync } from "fs";
import path from "path";
import fs from "fs";



type DeploymentInfo = {
  network?: string;
  chainId?: string;
  timestamp?: string;
  deployer?: string;
  contracts?: Record<string, string>[];
  external?: Record<string, string>[];
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

  // Enhanced export format for better integration
  const content = `// Auto-generated deployment configuration
// Generated on: ${deploymentInfo.timestamp}
// Network: ${deploymentInfo.network}
// Chain ID: ${deploymentInfo.chainId}

export const addresses = ${JSON.stringify(deploymentInfo.contracts, null, 2)};

export const externalAddresses = ${JSON.stringify(deploymentInfo.external, null, 2)};

export const deploymentConfig = ${JSON.stringify(deploymentInfo, null, 2)};
`;
  
  const locations = process.env.EXPORT_ADDRESSES ? process.env.EXPORT_ADDRESSES.split(',') : [];

  console.log("\nSaving deployment info to directories:");
  if (locations.length === 0) {
    console.log("No directories specified in EXPORT_ADDRESSES. Saving to default locations.");
    // Add default locations
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
  
  // deploy contracts


  // export deployment info to target directories

  const deploymentInfo: DeploymentInfo = null;
  exportDeploymentInfo(deploymentInfo);
}

main()
  .then(() => process.exit(0))
  .catch((_) => {
    process.exit(1);
  });
