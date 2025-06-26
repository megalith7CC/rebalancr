# Rebalancr: Autonomous DeFi Strategy Management System

Rebalancr is a decentralized platform that combines off-chain intelligence with on-chain execution to provide autonomous DeFi strategy management. The system leverages ElizaOS agents for strategy intelligence, Chainlink services for reliable data and automation, and a robust smart contract architecture for secure execution.

## 🏆 Hackathon Submission

**Chainlink Integration**: Rebalancr uses Chainlink Price Feeds and Chainlink Automation to create state changes on-chain. See [CHAINLINK_INTEGRATION.md](./CHAINLINK_INTEGRATION.md) for detailed implementation.

**Live Demo**: Deployed on Avalanche Fuji testnet with working Chainlink integrations
- PriceFeedOracle: `0x9f1E9B1E5ca887733ab56681a34D801517E82Aac`
- StrategyPoke: `0xd11E68570541daFbEe6975993819f32ea5A8AA02`

**Video Demo**: [3-5 minute demonstration video] - *[Upload and add link]*

## System Architecture

Rebalancr follows a three-layer architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                 REBALANCR SYSTEM ARCHITECTURE               │
└─────────────────────────────────────────────────────────────┘
┌─────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  Agent Layer │  │  Oracle Layer   │  │ Contract Layer  │
│  (Off-chain) │◄─►│  (Chainlink)   │◄─►│   (On-chain)   │
└─────────────┘  └─────────────────┘  └─────────────────┘
      │                 │                     │
      ▼                 ▼                     ▼
┌─────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ ElizaOS     │  │ Data Feeds      │  │ Strategy        │
│ Runtime     │  │ Functions       │  │ Contracts       │
│ Environment │  │ Automation      │  │                 │
└─────────────┘  └─────────────────┘  └─────────────────┘
```

### Key Components

1. **Agent Layer (Off-chain)**
   - ElizaOS runtime for agent execution
   - Strategy intelligence and decision-making
   - Agent plugins for different strategy types (Yield, Risk, Arbitrage)

2. **Oracle Layer (Chainlink)**
   - Price feeds for reliable market data
   - Functions for external data processing
   - Automation for strategy execution triggers

3. **Contract Layer (On-chain)**
   - Core contracts for strategy execution
   - Position management and tracking
   - Access control and security

## Repository Structure

- `/agent` - ElizaOS agent implementation
- `/contracts` - Smart contract implementation
- `/docs` - Documentation and ADRs
- `/frontend` - User interface

## Smart Contracts

### Core Contracts

- **AccessController**: Permission management across the system
- **AgentRegistry**: Authorization of agent operations
- **PositionManager**: Management of investment positions
- **StrategyRouter**: Routing of strategy execution requests
- **BaseStrategyAgent**: Base implementation for strategy contracts

### Chainlink Integration

- **ChainlinkPriceOracle**: Access to reliable price data
- **MarketDataAggregator**: Comprehensive market data processing
- **ChainlinkFunctionsConsumer**: External data retrieval and processing
- **AgentRequestHandler**: Handling of agent requests via Chainlink Functions

### Automation

- **AutomationRegistry**: Registration and management of automation tasks
- **StrategyAutomationManager**: Strategy-specific automation management
- **StrategyExecutionBridge**: Bridge between automation triggers and strategy execution

## Agent System

The agent system is built on ElizaOS and consists of:

- **AgentRuntime**: Core execution environment
- **Providers**: Data providers for agent context
- **Actions**: Executable operations for strategies
- **Services**: Specialized functionality for agents

## Getting Started

### Prerequisites

- Node.js (v16+)
- Yarn
- Hardhat
- ElizaOS CLI

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-org/rebalancr.git
   cd rebalancr
   ```

2. Install dependencies:
   ```bash
   # Install contract dependencies
   cd contracts
   yarn install
   
   # Install agent dependencies
   cd ../agent
   yarn install
   
   # Install frontend dependencies
   cd ../frontend
   yarn install
   ```

3. Set up environment variables:
   ```bash
   # In the contracts directory
   cp .env.example .env
   # Edit .env with your configuration
   ```

### Running Tests

```bash
# In the contracts directory
yarn test

# Run specific test
yarn test test/StrategyRouter.test.ts
```

### Local Development

1. Start a local blockchain:
   ```bash
   # In the contracts directory
   yarn hardhat node
   ```

2. Deploy contracts:
   ```bash
   # In the contracts directory
   yarn deploy:local
   ```

3. Start the agent:
   ```bash
   # In the agent directory
   yarn start:dev
   ```

4. Start the frontend:
   ```bash
   # In the frontend directory
   yarn dev
   ```

## Architecture Documentation

Detailed architecture documentation is available in the `/docs/adr` directory:

- **ADR-0001**: Decentralized Architecture
- **ADR-0002**: Agent System Design
- **ADR-0003**: Smart Contract Architecture
- **ADR-0004**: Chainlink Integration
- **ADR-0005**: User Experience
- **ADR-0006**: MVP Critical Components

## Deployment

The system can be deployed to various networks:

```bash
# Deploy to Ethereum mainnet
yarn deploy:mainnet

# Deploy to Polygon
yarn deploy:polygon

# Deploy to Arbitrum
yarn deploy:arbitrum
```

## Security

The system includes several security features:

- Access control for all sensitive operations
- Rate limiting for strategy execution
- Circuit breakers for abnormal conditions
- Comprehensive input validation
- Event logging for transparency

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -am 'Add my feature'`
4. Push to the branch: `git push origin feature/my-feature`
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
