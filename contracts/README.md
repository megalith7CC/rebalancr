# Rebalancr Smart Contracts

This directory contains the smart contract implementation for the Rebalancr DeFi Strategy Agent system. The contracts provide a robust framework for on-chain strategy execution, position management, and automation.

## Architecture

The contract architecture follows a modular design with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│               REBALANCR CONTRACT ARCHITECTURE               │
└─────────────────────────────────────────────────────────────┘
┌─────────────┐     ┌─────────────┐     ┌─────────────────┐
│ Agent       │     │ Strategy    │     │ Position        │
│ Registry    │────►│ Router      │────►│ Manager         │
└─────────────┘     └─────────────┘     └─────────────────┘
      │                    │                     │
      │                    ▼                     │
      │           ┌─────────────────┐            │
      └──────────►│ Access          │◄───────────┘
                  │ Controller      │
                  └─────────────────┘
```

### Automation Architecture

The automation components extend the core architecture to provide automated strategy execution:

```
┌─────────────────────────────────────────────────────────────┐
│           REBALANCR AUTOMATION ARCHITECTURE                 │
└─────────────────────────────────────────────────────────────┘
┌─────────────┐     ┌─────────────────┐     ┌─────────────┐
│ Automation  │     │ Strategy        │     │ Agent       │
│ Registry    │────►│ Automation      │────►│ Request     │
└─────────────┘     │ Manager         │     │ Handler     │
      │             └─────────────────┘     └─────────────┘
      │                     │                      │
      │                     ▼                      │
      │             ┌─────────────────┐            │
      └────────────►│ Strategy        │◄───────────┘
                    │ Execution Bridge│
                    └─────────────────┘
                           │
                           ▼
                    ┌─────────────────┐
                    │ Strategy        │
                    │ Router          │
                    └─────────────────┘
```

## Core Components

### Base Contracts

- **AccessController.sol**: Permission management across the system
- **AgentRegistry.sol**: Authorization of agent operations
- **PositionManager.sol**: Management of investment positions
- **StrategyRouter.sol**: Routing of strategy execution requests
- **BaseStrategyAgent.sol**: Base implementation for strategy contracts

### Chainlink Integration

- **ChainlinkPriceOracle.sol**: Access to reliable price data
- **MarketDataAggregator.sol**: Comprehensive market data processing
- **ChainlinkFunctionsConsumer.sol**: External data retrieval and processing
- **AgentRequestHandler.sol**: Handling of agent requests via Chainlink Functions

### Automation Components

- **AutomationRegistry.sol**: Registration and management of automation tasks
- **StrategyAutomationManager.sol**: Strategy-specific automation management
- **StrategyExecutionBridge.sol**: Bridge between automation triggers and strategy execution

## Automation System

The automation system enables strategies to be executed based on various triggers without requiring manual intervention.

### Trigger Types

The `AutomationRegistry` supports multiple trigger types:

1. **TIME_BASED**: Execute strategies at regular intervals
2. **PRICE_DEVIATION**: Execute when price movements exceed thresholds
3. **POSITION_HEALTH**: Execute when position health metrics decline
4. **APY_OPPORTUNITY**: Execute when yield opportunities arise
5. **GAS_OPTIMIZATION**: Execute during favorable gas conditions

### Automation Flow

1. **Registration**: Strategies and positions are registered with the automation system
2. **Monitoring**: Chainlink Automation regularly checks trigger conditions
3. **Execution**: When conditions are met, the strategy is executed via the execution bridge

## Getting Started

### Prerequisites

- Node.js (v16+)
- Yarn or npm
- Hardhat

### Installation

```bash
# Install dependencies
yarn install
```

### Compilation

```bash
# Compile contracts
yarn compile
```

### Testing

```bash
# Run all tests
yarn test

# Run specific test
yarn test test/AutomationRegistry.test.ts
```

### Deployment

The project supports deployment to multiple networks:

```bash
# Deploy to local network
yarn deploy:localhost

# Deploy to Sepolia testnet
yarn deploy:sepolia

# Deploy to Avalanche mainnet
yarn deploy:avalanche

# Deploy to Avalanche Fuji testnet
yarn deploy:avalanche-fuji

# Generate deployment summary
yarn deployment-summary
```

#### Environment Configuration

Create the following environment files for each network:

- `.env.sepolia` - Sepolia testnet configuration
- `.env.avalanche` - Avalanche mainnet configuration
- `.env.avalanche-fuji` - Avalanche Fuji testnet configuration
- `.env.local` - Local development configuration

Each file should include the appropriate RPC URLs, private keys, and contract addresses.

Example for Avalanche:
```
# Avalanche Mainnet RPC URL
AVALANCHE_RPC_URL=https://api.avax.network/ext/bc/C/rpc

# Your private key for deployments
PRIVATE_KEY=your_private_key_here

# Snowtrace API key for contract verification
SNOWTRACE_API_KEY=your_snowtrace_api_key_here

# Chainlink contract addresses
LINK_TOKEN_ADDRESS=0x5947BB275c521040051D82396192181b413227A3
FUNCTIONS_ROUTER_ADDRESS=0xA9d587a00A31A52Ed70D6026794a8FC5E2F5dCb0
AUTOMATION_REGISTRY_ADDRESS=0x7b3EC232b08BD7b4b3305BE0C044D907B2DF960B
```

## Usage Examples

### Creating Time-Based Automation

```javascript
// Deploy contracts
const automationRegistry = await AutomationRegistry.deploy(
  chainlinkRegistry,
  linkToken,
  agentRegistry,
  minimumAutomationFunding
);

const strategyAutomationManager = await StrategyAutomationManager.deploy(
  automationRegistry.address,
  strategyExecutionBridge.address,
  agentRegistry.address,
  marketDataAggregator.address,
  positionManager.address,
  linkToken
);

// Register strategy
const strategyId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("MY_STRATEGY"));
await strategyRouter.registerStrategy(strategyId, strategyImplementation.address);

// Create time-based automation
const executeData = strategyImplementation.interface.encodeFunctionData("execute", ["rebalance"]);
const automationId = await strategyAutomationManager.createStrategyTimeAutomation(
  strategyId,
  86400, // 24 hours
  executeData,
  ethers.utils.parseEther("1") // 1 LINK
);

// Automation is now active and will execute every 24 hours
```

### Creating Price-Based Automation

```javascript
// Create price-based automation
const tokenAddress = "0x..."; // Token address
const priceThreshold = 500; // 5% in basis points
const checkInterval = 3600; // Check every hour
const executeData = strategyImplementation.interface.encodeFunctionData("execute", ["adjustPosition"]);

const automationId = await strategyAutomationManager.createStrategyPriceAutomation(
  strategyId,
  tokenAddress,
  priceThreshold,
  checkInterval,
  executeData,
  ethers.utils.parseEther("1") // 1 LINK
);

// Automation will execute when price moves by 5% or more
```

## Security Features

- **Access Control**: All sensitive operations are protected by role-based access control
- **Input Validation**: Comprehensive validation of all inputs
- **Circuit Breakers**: Automatic pausing of operations under abnormal conditions
- **Rate Limiting**: Prevention of excessive operations
- **Event Logging**: Detailed event logging for transparency and auditing

## License

This project is licensed under the MIT License - see the LICENSE file for details.
