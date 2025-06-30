# Rebalancr: Autonomous DeFi Strategy Management System

Rebalancr is a decentralized platform that combines off-chain intelligence with on-chain execution to provide autonomous DeFi strategy management. The system leverages ElizaOS agents for strategy intelligence, Chainlink services for reliable data and automation, and a robust smart contract architecture for secure execution.


**Chainlink Integration**: Rebalancr uses Chainlink Price Feeds and Chainlink Automation to create state changes on-chain. See [CHAINLINK_INTEGRATION.md](./CHAINLINK_INTEGRATION.md) for detailed implementation.

**Live Demo**: Deployed on Avalanche Fuji testnet with working Chainlink integrations
- PriceFeedOracle: `0x9f1E9B1E5ca887733ab56681a34D801517E82Aac`
- StrategyPoke: `0xd11E68570541daFbEe6975993819f32ea5A8AA02`


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
   - Agent plugins for different strategy types (Yield, Risk)

2. **Oracle Layer (Chainlink)**
   - Price feeds for reliable market data
   - Functions for external data processing
   - Automation for strategy execution triggers

3. **Contract Layer (On-chain)**
   - Core contracts for strategy execution
   - Position management and tracking
   - Access control and security


### System Overview

* The smart contracts form a modular execution layer: `AgentRegistry`, `StrategyRouter`, `StrategyAgent`, `PositionManager`, and `AccessController`.
* The off-chain AI agent (ElizaOS-based) is optional and interacts with contracts through whitelisted agent addresses stored in the `AgentRegistry`.
* Chainlink Automation will be used only once in the system: to periodically call a the `poke(strategyId)` function, which emits a `CheckRequested(strategyId)` event.
* The agent listens for this event and runs analysis using off-chain data and Chainlink Functions. If action is required, the agent sends a transaction to the on-chain system.

### Architectural Flow

```plaintext
                                +------------------------------+
                                |     Chainlink Automation     |
                                |   (scheduled on-chain poke)  |
                                +-------------+----------------+
                                              |
                      emits `poke(strategyId)` to wake agent
                                              |
                                              v
               +-------------------------- StrategyPoke.sol ------------------------+
               | emits `AgentCheckRequested(strategyId)` event                      |
               +--------------------------------+-----------------------------------+
                                                |
                             agent listens via log polling / websocket              
                                                v
                                 +----------------------------+
                                 |      Off-Chain AI Agent     |
                                 | - ElizaOS-based logic       |
                                 | - Uses Chainlink Functions  |
                                 | - Decides action            |
                                 +--------------+-------------+
                                                |
                         sends tx to StrategyRouter (e.g. executeStrategy)
                                                v
                      +----------------- StrategyRouter -----------------+
                      | routes execution to the appropriate strategy      |
                      +------------------------+--------------------------+
                                               |
                                               v
                                  +------ StrategyAgent ------+
                                  | - validates + executes    |
                                  +------------+-------------+
                                               |
                                               v
                                +--------- PositionManager ----------+
                                | - tracks position lifecycle        |
                                +------------------------------------+
                                               |
                                               v
                                  +------- Protocol Adapter -------+
                                  | - interacts with Aave, Beefy, etc |
                                  +-----------------------------------+
```

### Sequence Diagram

```plaintext
  Chainlink Automation        StrategyPoke           Off-Chain Agent         StrategyRouter        StrategyAgent     PositionManager
          |                        |                        |                        |                    |                   |
          |--- checkUpkeep() ----->|                        |                        |                    |                   |
          |<-- upkeepNeeded -------|                        |                        |                    |                   |
          |--- performUpkeep() --->|                        |                        |                    |                   |
          |                        |-- emit Events -------->|                        |                    |                   |
          |                        |                        |-- analyze + fetch --> [Functions / APIs]     |                   |
          |                        |                        |-- if needed: tx ----->|                    |                   |
          |                        |                        |                        |-- delegate to --->|                   |
          |                        |                        |                        |                    |-- position call->|
```

### Chainlink Service Roles

| Chainlink Service    | Used By          | Purpose                                                    |
| -------------------- | ---------------- | ---------------------------------------------------------- |
| Chainlink Data Feeds | Smart Contracts  | On-chain token pricing and slippage protection             |
| Chainlink Functions  | AI Agent         | External APY, protocol stats, risk scores, sentiment, etc. |
| Chainlink Automation | StrategyPoke.sol | Emits event to wake agent on schedule                      |

### Smart Contract Roles

| Contract         | Role                                                |
| ---------------- | --------------------------------------------------- |
| AgentRegistry    | Authorizes which agent wallet addresses can act     |
| StrategyRouter   | Dispatches execution to correct strategy module     |
| StrategyAgent    | Strategy-specific logic (yield, risk, arbitrage)    |
| PositionManager  | Tracks open/closed/modified positions               |
| AccessController | Role-based security over sensitive system functions |
| StrategyPoke.sol | Minimal contract called by Chainlink Automation     |

### Data Flow Summary

* Off-chain agents are event-driven or timer-driven
* All critical financial logic (APY, risk, position state) is enforced on-chain using Chainlink Data Feeds where required
* Agents operate entirely off-chain and interact through signed txs
* Contracts can be used manually (without AI) by sending txs directly to StrategyRouter

## Repository Structure

- `/agent` - ElizaOS agent implementation
- `/contracts` - Smart contract implementation
- `/frontend` - User interface


## Getting Started

### Prerequisites

- Node.js (v16+)
- Yarn
- Hardhat
- ElizaOS CLI
- Bun

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/megalith7CC/rebalancr.git
   cd rebalancr
   ```

2. Install dependencies:
   ```bash
   # Install contract dependencies
   cd contracts
   yarn install
   
   # Install agent dependencies
   cd ../agent
   bun install
   
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

### Local Development

1. Start a local blockchain:
   ```bash
   # In the contracts directory
   yarn hardhat node
   ```

2. Deploy contracts:
   ```bash
   # In the contracts directory
   npx hardhat run scripts/deployment/main.ts --network localhost
   ```

3. Start the agent:
   ```bash
   # In the agent directory
   elizaos start
   ```

4. Start the frontend:
   ```bash
   # In the frontend directory
   yarn dev
   ```

## Deployment

Deploying to Avalanche Fuji:

```bash
cd contracts
npx hardhat run scripts/deployment/main.ts --network fuji
```
