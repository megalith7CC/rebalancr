# Rebalancr Agent Providers

This directory contains data providers for the Rebalancr agent. These providers fetch data from blockchain sources and make it available to the agent's actions.

## Available Providers

### Market Data Provider

The Market Data Provider fetches yield data from various DeFi protocols through the MarketDataAggregator contract.

**Usage:**
```typescript
// The provider will be available in the agent's state
const marketData = state.data.marketData;

// Check if market data is available
if (marketData.available) {
  // Access market data properties
  const protocols = marketData.protocols;
  const summary = marketData.summary;
  
  // Access values
  const highestYield = state.values.highestYield;
  const marketSentiment = state.values.marketSentiment;
}
```

### Position Provider

The Position Provider fetches user position data from the PositionManager contract, including position status, health metrics, and allocation details.

**Usage:**
```typescript
// The provider will be available in the agent's state
const position = state.data.position;

// Check if position data is available
if (position.available) {
  // Access position data properties
  const positions = position.positions;
  const totalValue = position.totalValue;
  
  // Access values
  const positionCount = state.values.positionCount;
  const positionOverview = state.values.positionOverview;
}
```

### Strategy Provider

The Strategy Provider fetches current strategy parameters and performance metrics from the StrategyRouter contract.

**Usage:**
```typescript
// The provider will be available in the agent's state
const strategy = state.data.strategy;

// Check if strategy data is available
if (strategy.available) {
  // Access strategy data properties
  const strategies = strategy.strategies;
  const bestPerforming = strategy.bestPerforming;
  const safest = strategy.safest;
  
  // Access values
  const bestStrategy = state.values.bestStrategy;
  const bestStrategyApy = state.values.bestStrategyApy;
  const safestStrategy = state.values.safestStrategy;
}
```

## Provider Features

### Caching

All providers implement caching to reduce blockchain RPC calls:

- **Market Data Provider**: 5-minute cache
- **Position Provider**: 3-minute cache per user address
- **Strategy Provider**: 10-minute cache

To force a refresh of the data, include the appropriate flag in the message content:

```typescript
// Force refresh market data
const message = {
  content: {
    refreshMarketData: true
  }
};

// Force refresh position data
const message = {
  content: {
    refreshPositions: true
  }
};

// Force refresh strategy data
const message = {
  content: {
    refreshStrategies: true
  }
};
```

### Error Handling

All providers implement robust error handling with:

- Detailed error messages
- Error codes
- User-friendly error messages
- Timeout protection for RPC calls
- Connection retry logic

### Configuration

Providers require the following configuration in the agent runtime settings:

```typescript
// Required settings
const rpcUrl = runtime.getSetting('rpcUrl');
const marketDataAggregatorAddress = runtime.getSetting('marketDataAggregatorAddress');
const positionManagerAddress = runtime.getSetting('positionManagerAddress');
const strategyRouterAddress = runtime.getSetting('strategyRouterAddress');
``` 