import { ethers } from "hardhat";

async function main() {
  console.log("Deploying Mock Chainlink Price Feed for ETH/USD...");
  
  const MockChainlinkAggregator = await ethers.getContractFactory("MockChainlinkAggregator");
  const mockPriceFeed = await MockChainlinkAggregator.deploy(8, "ETH / USD");
  
  await mockPriceFeed.waitForDeployment();
  const mockPriceFeedAddress = await mockPriceFeed.getAddress();
  
  console.log(`Mock ETH/USD Price Feed deployed to: ${mockPriceFeedAddress}`);
  
  const initialPrice = 200000000000; 
  await mockPriceFeed.updateAnswer(initialPrice);
  console.log(`Set initial ETH price to $2000 USD`);
  
  process.stdout.write(mockPriceFeedAddress);
  
  return mockPriceFeedAddress;
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