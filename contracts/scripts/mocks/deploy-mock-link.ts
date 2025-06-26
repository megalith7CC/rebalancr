import { ethers } from "hardhat";

async function main() {
  console.log("Deploying Mock LINK Token...");
  
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const mockLink = await MockERC20.deploy("Chainlink Token", "LINK", 18);
  
  await mockLink.waitForDeployment();
  const mockLinkAddress = await mockLink.getAddress();
  
  console.log(`Mock LINK Token deployed to: ${mockLinkAddress}`);
  
  const [deployer] = await ethers.getSigners();
  const mintAmount = ethers.parseEther("1000000"); 
  
  await mockLink.mint(deployer.address, mintAmount);
  console.log(`Minted ${ethers.formatEther(mintAmount)} LINK to ${deployer.address}`);
  
  process.stdout.write(mockLinkAddress);
  
  return mockLinkAddress;
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export default main; 