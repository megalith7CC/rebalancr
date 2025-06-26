# Rebalancr Agent

The Rebalancr Agent is an ElizaOS-based agent that provides intelligent DeFi strategy management and automation. It connects to the Rebalancr smart contracts to analyze yield opportunities, monitor position health, and execute rebalancing strategies.

## Architecture

The agent is built using the ElizaOS framework and consists of the following components:

- **Providers**: Data providers that fetch information from blockchain sources
- **Actions**: Action handlers that implement the agent's capabilities
- **Character**: Agent personality and response templates
- **Plugins**: Additional functionality and integrations

## Providers

The agent includes the following data providers:

- **Market Data Provider**: Fetches yield data from various DeFi protocols
- **Position Provider**: Fetches user position data and health metrics
- **Strategy Provider**: Fetches strategy parameters and performance metrics

All providers implement caching to reduce blockchain RPC calls and include robust error handling.

## Actions

The agent implements the following actions:

- **Analyze Yield**: Analyzes current yield opportunities across DeFi protocols
- **Optimize Parameters**: Optimizes strategy parameters based on user preferences
- **Rebalance**: Executes rebalancing operations for user positions

## Setup

### Prerequisites

- Node.js 16+
- ElizaOS CLI
- Access to Ethereum RPC endpoint

### Installation

```bash
# Install dependencies
npm install

# Build the agent
npm run build
```

### Configuration

Create a `.env` file with the following configuration:

```
RPC_URL=<your-ethereum-rpc-url>
MARKET_DATA_AGGREGATOR_ADDRESS=<contract-address>
POSITION_MANAGER_ADDRESS=<contract-address>
STRATEGY_ROUTER_ADDRESS=<contract-address>
```

## Development

### Running Tests

```bash
# Run all tests
npm test

# Run specific test
npm test -- -t "Market Data Provider"
```

### Building

```bash
# Build for production
npm run build

# Build for development with watch mode
npm run dev
```

## Integration with Smart Contracts

The agent integrates with the following smart contracts:

- **MarketDataAggregator**: Provides market data and yield information
- **PositionManager**: Manages user positions and allocations
- **StrategyRouter**: Routes strategy execution requests
- **StrategyAutomationManager**: Manages automated strategy execution

## License

MIT 