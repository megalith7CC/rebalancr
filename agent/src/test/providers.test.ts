import { describe, it, expect, vi, beforeEach } from 'vitest';
import { marketDataProvider, positionProvider, strategyProvider } from '../provider';

// Mock the ethers library
vi.mock('ethers', () => {
  const mockContract = {
    getLatestMarketSummary: vi.fn().mockResolvedValue({
      timestamp: Math.floor(Date.now() / 1000),
      sentiment: 'BULLISH',
      volatilityIndex: 2500, // 25%
    }),
    getProtocolYields: vi.fn().mockResolvedValue([
      { name: 'Aave', apy: 500, tvl: '1000000000000000000000000', risk: 2500 },
      { name: 'Compound', apy: 450, tvl: '2000000000000000000000000', risk: 2000 },
      { name: 'Curve', apy: 600, tvl: '500000000000000000000000', risk: 3500 },
    ]),
    getUserPositions: vi.fn().mockResolvedValue([1, 2, 3]),
    getPositionDetails: vi.fn().mockImplementation((positionId) => {
      return Promise.resolve({
        owner: '0x1234567890123456789012345678901234567890',
        strategy: '0x0987654321098765432109876543210987654321',
        amount: '1000000000000000000',
        entryTimestamp: Math.floor(Date.now() / 1000) - 86400,
        lastUpdateTimestamp: Math.floor(Date.now() / 1000),
        entryValue: '1000000000000000000',
        currentValue: '1100000000000000000',
        healthFactor: 9500,
        active: true,
      });
    }),
    getPositionAllocations: vi.fn().mockResolvedValue([
      { asset: '0xabc', amount: '1000000000000000000', weight: 10000 },
    ]),
    getActiveStrategies: vi.fn().mockResolvedValue([
      '0x1111111111111111111111111111111111111111',
      '0x2222222222222222222222222222222222222222',
    ]),
    getStrategyInfo: vi.fn().mockImplementation((strategy) => {
      if (strategy === '0x1111111111111111111111111111111111111111') {
        return Promise.resolve({
          name: 'Aave Yield Strategy',
          description: 'Optimized yield farming on Aave',
          tvl: '1000000000000000000000000',
          currentApy: 500,
          historicalApy: 450,
          riskScore: 2500,
          isActive: true,
        });
      } else {
        return Promise.resolve({
          name: 'Balancer LP Strategy',
          description: 'Liquidity provision on Balancer',
          tvl: '500000000000000000000000',
          currentApy: 600,
          historicalApy: 550,
          riskScore: 3500,
          isActive: true,
        });
      }
    }),
    getStrategyParameters: vi.fn().mockImplementation((strategy) => {
      if (strategy === '0x1111111111111111111111111111111111111111') {
        return Promise.resolve('0x...');
      } else {
        return Promise.resolve('0x...');
      }
    }),
  };

  return {
    Contract: vi.fn().mockImplementation(() => mockContract),
    JsonRpcProvider: vi.fn().mockImplementation(() => ({
      getBlockNumber: vi.fn().mockResolvedValue(1000000),
    })),
    formatUnits: vi.fn().mockImplementation((value) => {
      if (typeof value === 'string' && value.startsWith('1000000000000000000')) {
        return '1.0';
      } else if (typeof value === 'string' && value.startsWith('1100000000000000000')) {
        return '1.1';
      } else if (typeof value === 'string' && value.startsWith('500000000000000000000000')) {
        return '500000.0';
      } else if (typeof value === 'string' && value.startsWith('1000000000000000000000000')) {
        return '1000000.0';
      } else if (typeof value === 'string' && value.startsWith('2000000000000000000000000')) {
        return '2000000.0';
      }
      return '0.0';
    }),
  };
});

// Mock runtime
const mockRuntime = {
  getSetting: vi.fn().mockImplementation((key) => {
    const settings = {
      rpcUrl: 'https://mainnet.infura.io/v3/your-api-key',
      marketDataAggregatorAddress: '0xMarketDataAggregator',
      positionManagerAddress: '0xPositionManager',
      strategyRouterAddress: '0xStrategyRouter',
    };
    return settings[key];
  }),
};

describe('Providers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Market Data Provider', () => {
    it('should fetch market data successfully', async () => {
      const result = await marketDataProvider.get(mockRuntime, {}, {});
      
      expect(result).toBeDefined();
      expect(result.data.marketData.available).toBe(true);
      expect(result.data.marketData.protocols).toHaveLength(3);
      expect(result.values.marketOverview).toContain('Current market sentiment is BULLISH');
      expect(result.values.highestYield).toBe('Curve');
      expect(result.values.lowestRisk).toBe('Compound');
    });
  });

  describe('Position Provider', () => {
    it('should fetch position data successfully', async () => {
      const result = await positionProvider.get(
        mockRuntime, 
        { content: { userAddress: '0x1234567890123456789012345678901234567890' } }, 
        {}
      );
      
      expect(result).toBeDefined();
      expect(result.data.position.available).toBe(true);
      expect(result.data.position.positions).toHaveLength(3);
      expect(result.values.positionCount).toBe(3);
      expect(result.values.positionOverview).toContain('User has 3 active positions');
    });
  });

  describe('Strategy Provider', () => {
    it('should fetch strategy data successfully', async () => {
      const result = await strategyProvider.get(mockRuntime, {}, {});
      
      expect(result).toBeDefined();
      expect(result.data.strategy.available).toBe(true);
      expect(result.data.strategy.strategies).toHaveLength(2);
      expect(result.values.bestStrategy).toBe('Balancer LP Strategy');
      expect(result.values.safestStrategy).toBe('Aave Yield Strategy');
      expect(result.values.activeStrategiesCount).toBe(2);
    });
  });
}); 