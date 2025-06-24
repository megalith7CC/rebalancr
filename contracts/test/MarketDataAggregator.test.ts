import { expect } from 'chai';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';

describe('MarketDataAggregator', function () {
	const INITIAL_PRICE = ethers.parseEther('1000');
	const WEIGHT_50_PERCENT = 5000;
	const WEIGHT_30_PERCENT = 3000;
	const MAX_AGE_1_HOUR = 3600;
	const DEFAULT_MAX_AGE = 3600;
	const VIEW_PERMISSION = ethers.keccak256(ethers.toUtf8Bytes('VIEW'));

	async function deployMarketDataAggregatorFixture() {
		const [owner, agent, user] = await ethers.getSigners();
		const MockChainlinkAggregator = await ethers.getContractFactory('MockChainlinkAggregator');
		const mockAggregator = await MockChainlinkAggregator.deploy(8, 'TEST/USD');
		await mockAggregator.waitForDeployment();

    const AgentRegistry = await ethers.getContractFactory('AgentRegistry');
		const agentRegistry = await AgentRegistry.deploy();
		await agentRegistry.waitForDeployment();

    const ChainlinkPriceOracle = await ethers.getContractFactory('ChainlinkPriceOracle');
		const priceOracle = await ChainlinkPriceOracle.deploy(await mockAggregator.getAddress());
		await priceOracle.waitForDeployment();

    const MarketDataAggregator = await ethers.getContractFactory('MarketDataAggregator');
		const marketDataAggregator = await MarketDataAggregator.deploy(await agentRegistry.getAddress());
		await marketDataAggregator.waitForDeployment();

    const token1 = '0x1111111111111111111111111111111111111111';
		const token2 = '0x2222222222222222222222222222222222222222';

    await agentRegistry.registerAgent(agent.address, ethers.encodeBytes32String('test-agent'));
		await agentRegistry.updateAgentPermissions(agent.address, [VIEW_PERMISSION]);

		return {
			marketDataAggregator,
			agentRegistry,
			priceOracle,
			mockAggregator,
			owner,
			agent,
			user,
			token1,
			token2,
		};
	}

	describe('Deployment', function () {
		it('shouldDeployWithCorrectAgentRegistry', async function () {
			const { marketDataAggregator, owner } = await loadFixture(deployMarketDataAggregatorFixture);
			expect(await marketDataAggregator.owner()).to.equal(owner.address);
		});

		it('shouldRevertIfAgentRegistryIsZeroAddress', async function () {
			const MarketDataAggregator = await ethers.getContractFactory('MarketDataAggregator');
			await expect(MarketDataAggregator.deploy(ethers.ZeroAddress)).to.be.revertedWithCustomError(
				MarketDataAggregator,
				'ZeroAddress'
			);
		});
	});

	describe('TokenManagement', function () {
		it('shouldAddNewToken', async function () {
			const { marketDataAggregator, token1 } = await loadFixture(deployMarketDataAggregatorFixture);

			await expect(marketDataAggregator.addToken(token1)).to.emit(marketDataAggregator, 'TokenAdded').withArgs(token1);

			const supportedTokens = await marketDataAggregator.getSupportedTokens();
			expect(supportedTokens).to.include(token1);
		});

		it('shouldNotAddDuplicateTokens', async function () {
			const { marketDataAggregator, token1 } = await loadFixture(deployMarketDataAggregatorFixture);

			await marketDataAggregator.addToken(token1);
			await marketDataAggregator.addToken(token1);

			const supportedTokens = await marketDataAggregator.getSupportedTokens();
			expect(supportedTokens.length).to.equal(1);
		});

		it('shouldRemoveToken', async function () {
			const { marketDataAggregator, token1 } = await loadFixture(deployMarketDataAggregatorFixture);

			await marketDataAggregator.addToken(token1);

			await expect(marketDataAggregator.removeToken(token1)).to.emit(marketDataAggregator, 'TokenRemoved').withArgs(token1);

			const supportedTokens = await marketDataAggregator.getSupportedTokens();
			expect(supportedTokens).to.not.include(token1);
		});

		it('shouldRevertWhenAddingZeroAddressToken', async function () {
			const { marketDataAggregator } = await loadFixture(deployMarketDataAggregatorFixture);

			await expect(marketDataAggregator.addToken(ethers.ZeroAddress)).to.be.revertedWithCustomError(
				marketDataAggregator,
				'ZeroAddress'
			);
		});

		it('shouldRevertWhenRemovingNonExistentToken', async function () {
			const { marketDataAggregator, token1 } = await loadFixture(deployMarketDataAggregatorFixture);

			await expect(marketDataAggregator.removeToken(token1)).to.be.revertedWithCustomError(
				marketDataAggregator,
				'TokenNotSupported'
			);
		});

		it('shouldOnlyAllowOwnerToManageTokens', async function () {
			const { marketDataAggregator, user, token1 } = await loadFixture(deployMarketDataAggregatorFixture);

			await expect(marketDataAggregator.connect(user).addToken(token1)).to.be.revertedWithCustomError(
				marketDataAggregator,
				'OwnableUnauthorizedAccount'
			);
		});
	});

	describe('DataSourceManagement', function () {
		it('shouldRegisterANewDataSource', async function () {
			const { marketDataAggregator, priceOracle, token1 } = await loadFixture(deployMarketDataAggregatorFixture);

			await marketDataAggregator.addToken(token1);
			const sourceAddress = await priceOracle.getAddress();

			await expect(
				marketDataAggregator.registerDataSource(sourceAddress, 0, WEIGHT_50_PERCENT, MAX_AGE_1_HOUR, 'Test Price Oracle')
			)
				.to.emit(marketDataAggregator, 'DataSourceRegistered')
				.withArgs(sourceAddress, 0, WEIGHT_50_PERCENT, 'Test Price Oracle');
		});

		it('shouldUpdateAnExistingDataSource', async function () {
			const { marketDataAggregator, priceOracle, token1 } = await loadFixture(deployMarketDataAggregatorFixture);

			await marketDataAggregator.addToken(token1);
			const sourceAddress = await priceOracle.getAddress();

			await marketDataAggregator.registerDataSource(sourceAddress, 0, WEIGHT_50_PERCENT, MAX_AGE_1_HOUR, 'Test Oracle');

			await expect(marketDataAggregator.updateDataSource(sourceAddress, WEIGHT_30_PERCENT, MAX_AGE_1_HOUR * 2, false))
				.to.emit(marketDataAggregator, 'DataSourceUpdated')
				.withArgs(sourceAddress, WEIGHT_30_PERCENT, MAX_AGE_1_HOUR * 2, false);
		});

		it('shouldRemoveADataSource', async function () {
			const { marketDataAggregator, priceOracle, token1 } = await loadFixture(deployMarketDataAggregatorFixture);

			await marketDataAggregator.addToken(token1);
			const sourceAddress = await priceOracle.getAddress();

			await marketDataAggregator.registerDataSource(sourceAddress, 0, WEIGHT_50_PERCENT, MAX_AGE_1_HOUR, 'Test Oracle');

			await expect(marketDataAggregator.removeDataSource(sourceAddress))
				.to.emit(marketDataAggregator, 'DataSourceRemoved')
				.withArgs(sourceAddress);
		});

		it('shouldRevertWhenRegisteringDuplicateDataSource', async function () {
			const { marketDataAggregator, priceOracle, token1 } = await loadFixture(deployMarketDataAggregatorFixture);

			await marketDataAggregator.addToken(token1);
			const sourceAddress = await priceOracle.getAddress();

			await marketDataAggregator.registerDataSource(sourceAddress, 0, WEIGHT_50_PERCENT, MAX_AGE_1_HOUR, 'Test Oracle');

			await expect(
				marketDataAggregator.registerDataSource(sourceAddress, 0, WEIGHT_50_PERCENT, MAX_AGE_1_HOUR, 'Test Oracle')
			).to.be.revertedWithCustomError(marketDataAggregator, 'DataSourceAlreadyExists');
		});

		it('shouldRevertWithInvalidWeight', async function () {
			const { marketDataAggregator, priceOracle } = await loadFixture(deployMarketDataAggregatorFixture);

			const sourceAddress = await priceOracle.getAddress();

			await expect(
				marketDataAggregator.registerDataSource(sourceAddress, 0, 50, MAX_AGE_1_HOUR, 'Test Oracle')
			).to.be.revertedWithCustomError(marketDataAggregator, 'InvalidWeight');

			await expect(
				marketDataAggregator.registerDataSource(sourceAddress, 0, 15000, MAX_AGE_1_HOUR, 'Test Oracle')
			).to.be.revertedWithCustomError(marketDataAggregator, 'InvalidWeight');
		});

		it('shouldRevertWithInvalidMaxAge', async function () {
			const { marketDataAggregator, priceOracle } = await loadFixture(deployMarketDataAggregatorFixture);

			const sourceAddress = await priceOracle.getAddress();

			await expect(
				marketDataAggregator.registerDataSource(sourceAddress, 0, WEIGHT_50_PERCENT, 0, 'Test Oracle')
			).to.be.revertedWithCustomError(marketDataAggregator, 'InvalidMaxAge');
		});
	});

	describe('TokenDataSourceAssociation', function () {
		it('shouldAssociateDataSourceWithToken', async function () {
			const { marketDataAggregator, priceOracle, token1 } = await loadFixture(deployMarketDataAggregatorFixture);

			await marketDataAggregator.addToken(token1);
			const sourceAddress = await priceOracle.getAddress();

			await marketDataAggregator.registerDataSource(sourceAddress, 0, WEIGHT_50_PERCENT, MAX_AGE_1_HOUR, 'Test Oracle');

			await marketDataAggregator.addTokenDataSource(token1, sourceAddress);

			const sources = await marketDataAggregator.getTokenDataSources(token1);
			expect(sources).to.include(sourceAddress);
		});

		it('shouldRemoveDataSourceAssociation', async function () {
			const { marketDataAggregator, priceOracle, token1 } = await loadFixture(deployMarketDataAggregatorFixture);

			await marketDataAggregator.addToken(token1);
			const sourceAddress = await priceOracle.getAddress();

			await marketDataAggregator.registerDataSource(sourceAddress, 0, WEIGHT_50_PERCENT, MAX_AGE_1_HOUR, 'Test Oracle');

			await marketDataAggregator.addTokenDataSource(token1, sourceAddress);
			await marketDataAggregator.removeTokenDataSource(token1, sourceAddress);

			const sources = await marketDataAggregator.getTokenDataSources(token1);
			expect(sources).to.not.include(sourceAddress);
		});

		it('shouldRevertWhenAssociatingNonRegisteredSource', async function () {
			const { marketDataAggregator, token1 } = await loadFixture(deployMarketDataAggregatorFixture);

			await marketDataAggregator.addToken(token1);
			const fakeSource = '0x3333333333333333333333333333333333333333';

			await expect(marketDataAggregator.addTokenDataSource(token1, fakeSource)).to.be.revertedWithCustomError(
				marketDataAggregator,
				'DataSourceNotFound'
			);
		});

		it('shouldRevertWhenAssociatingWithUnsupportedToken', async function () {
			const { marketDataAggregator, priceOracle, token2 } = await loadFixture(deployMarketDataAggregatorFixture);

			const sourceAddress = await priceOracle.getAddress();

			await marketDataAggregator.registerDataSource(sourceAddress, 0, WEIGHT_50_PERCENT, MAX_AGE_1_HOUR, 'Test Oracle');

			await expect(marketDataAggregator.addTokenDataSource(token2, sourceAddress)).to.be.revertedWithCustomError(
				marketDataAggregator,
				'TokenNotSupported'
			);
		});
	});

	describe('MarketDataRetrieval', function () {
		it('shouldUpdateMarketDataSuccessfully', async function () {
			const { marketDataAggregator, priceOracle, mockAggregator, token1 } = await loadFixture(deployMarketDataAggregatorFixture);

			await marketDataAggregator.addToken(token1);
			const sourceAddress = await priceOracle.getAddress();

			await marketDataAggregator.registerDataSource(sourceAddress, 0, WEIGHT_50_PERCENT, MAX_AGE_1_HOUR, 'Test Oracle');

			await marketDataAggregator.addTokenDataSource(token1, sourceAddress);
			await priceOracle.setPriceFeed(token1, await mockAggregator.getAddress());
			await mockAggregator.updateAnswer(INITIAL_PRICE);

			await expect(marketDataAggregator.updateMarketData(token1)).to.emit(marketDataAggregator, 'MarketDataUpdated');
		});

		it('shouldRevertWithInsufficientDataSources', async function () {
			const { marketDataAggregator, token1 } = await loadFixture(deployMarketDataAggregatorFixture);

			await marketDataAggregator.addToken(token1);

			await expect(marketDataAggregator.updateMarketData(token1)).to.be.revertedWithCustomError(
				marketDataAggregator,
				'InsufficientDataSources'
			);
		});

		it('shouldOnlyAllowAuthorizedAgentsToGetMarketData', async function () {
			const { marketDataAggregator, user, token1 } = await loadFixture(deployMarketDataAggregatorFixture);

			await marketDataAggregator.addToken(token1);

			await expect(marketDataAggregator.connect(user).getMarketData(token1)).to.be.revertedWithCustomError(
				marketDataAggregator,
				'UnauthorizedAccess'
			);
		});

		it('shouldGetMultipleTokenPrices', async function () {
			const { marketDataAggregator, agent, token1, token2 } = await loadFixture(deployMarketDataAggregatorFixture);

			await marketDataAggregator.addToken(token1);
			await marketDataAggregator.addToken(token2);

			const [prices, timestamps] = await marketDataAggregator.connect(agent).getMultipleTokenPrices([token1, token2]);

			expect(prices).to.have.length(2);
			expect(timestamps).to.have.length(2);
		});
	});

	describe('HistoricalData', function () {
		it('shouldStoreHistoricalDataWhenUpdating', async function () {
			const { marketDataAggregator, priceOracle, mockAggregator, agent, token1 } = await loadFixture(
				deployMarketDataAggregatorFixture
			);
			await marketDataAggregator.addToken(token1);
			const sourceAddress = await priceOracle.getAddress();

			await marketDataAggregator.registerDataSource(sourceAddress, 0, WEIGHT_50_PERCENT, MAX_AGE_1_HOUR, 'Test Oracle');

			await marketDataAggregator.addTokenDataSource(token1, sourceAddress);
			await priceOracle.setPriceFeed(token1, await mockAggregator.getAddress());
			await mockAggregator.updateAnswer(INITIAL_PRICE);

			await marketDataAggregator.updateMarketData(token1);

			const currentBlock = await ethers.provider.getBlock('latest');
			const fromTimestamp = currentBlock!.timestamp - 3600;
			const toTimestamp = currentBlock!.timestamp + 3600;

			const historicalData = await marketDataAggregator.connect(agent).getHistoricalData(token1, fromTimestamp, toTimestamp);

			expect(historicalData.length).to.be.greaterThan(0);
		});

		it('shouldRevertWithInvalidTimestampRange', async function () {
			const { marketDataAggregator, priceOracle, agent, token1 } = await loadFixture(deployMarketDataAggregatorFixture);

			await marketDataAggregator.addToken(token1);
			const sourceAddress = await priceOracle.getAddress();

			await marketDataAggregator.registerDataSource(sourceAddress, 0, WEIGHT_50_PERCENT, MAX_AGE_1_HOUR, 'Test Oracle');

			await marketDataAggregator.addTokenDataSource(token1, sourceAddress);

			const currentTime = Math.floor(Date.now() / 1000);

			await expect(
				marketDataAggregator.connect(agent).getHistoricalData(token1, currentTime, currentTime - 3600)
			).to.be.revertedWithCustomError(marketDataAggregator, 'InvalidMaxAge');
		});
	});

	describe('AccessControl', function () {
		it('shouldUpdateAgentRegistry', async function () {
			const { marketDataAggregator } = await loadFixture(deployMarketDataAggregatorFixture);

			const newAgentRegistry = await (await ethers.getContractFactory('AgentRegistry')).deploy();
			await newAgentRegistry.waitForDeployment();

			await marketDataAggregator.updateAgentRegistry(await newAgentRegistry.getAddress());
		});

		it('shouldRevertWhenUpdatingWithZeroAddress', async function () {
			const { marketDataAggregator } = await loadFixture(deployMarketDataAggregatorFixture);

			await expect(marketDataAggregator.updateAgentRegistry(ethers.ZeroAddress)).to.be.revertedWithCustomError(
				marketDataAggregator,
				'ZeroAddress'
			);
		});

		it('shouldOnlyAllowOwnerToUpdateAgentRegistry', async function () {
			const { marketDataAggregator, user } = await loadFixture(deployMarketDataAggregatorFixture);

			const newAgentRegistry = await (await ethers.getContractFactory('AgentRegistry')).deploy();
			await newAgentRegistry.waitForDeployment();

			await expect(
				marketDataAggregator.connect(user).updateAgentRegistry(await newAgentRegistry.getAddress())
			).to.be.revertedWithCustomError(marketDataAggregator, 'OwnableUnauthorizedAccount');
		});
	});

	describe('DataSourceConfiguration', function () {
		it('shouldGetDataSourceConfiguration', async function () {
			const { marketDataAggregator, priceOracle } = await loadFixture(deployMarketDataAggregatorFixture);

			const sourceAddress = await priceOracle.getAddress();

			await marketDataAggregator.registerDataSource(sourceAddress, 0, WEIGHT_50_PERCENT, MAX_AGE_1_HOUR, 'Test Oracle');

			const config = await marketDataAggregator.getDataSourceConfig(sourceAddress);

			expect(config.sourceType).to.equal(0);
			expect(config.weight).to.equal(WEIGHT_50_PERCENT);
			expect(config.maxAge).to.equal(MAX_AGE_1_HOUR);
			expect(config.isActive).to.be.true;
			expect(config.description).to.equal('Test Oracle');
		});

		it('shouldRevertWhenGettingConfigForNonExistentSource', async function () {
			const { marketDataAggregator } = await loadFixture(deployMarketDataAggregatorFixture);

			const fakeSource = '0x3333333333333333333333333333333333333333';

			await expect(marketDataAggregator.getDataSourceConfig(fakeSource)).to.be.revertedWithCustomError(
				marketDataAggregator,
				'DataSourceNotFound'
			);
		});
	});

	describe('EdgeCases', function () {
		it('shouldHandleEmptyTokenList', async function () {
			const { marketDataAggregator } = await loadFixture(deployMarketDataAggregatorFixture);

			const tokens = await marketDataAggregator.getSupportedTokens();
			expect(tokens).to.have.length(0);
		});

		it('shouldHandleTokenWithNoDataSources', async function () {
			const { marketDataAggregator, token1 } = await loadFixture(deployMarketDataAggregatorFixture);

			await marketDataAggregator.addToken(token1);

			const sources = await marketDataAggregator.getTokenDataSources(token1);
			expect(sources).to.have.length(0);
		});

		it('shouldHandleMultipleTokenOperations', async function () {
			const { marketDataAggregator, token1, token2 } = await loadFixture(deployMarketDataAggregatorFixture);

			const tokenAddresses = [token1, token2];

			for (const token of tokenAddresses) {
				await marketDataAggregator.addToken(token);
			}

			const supportedTokens = await marketDataAggregator.getSupportedTokens();
			expect(supportedTokens).to.have.length(2);
			expect(supportedTokens).to.include.members(tokenAddresses);
		});
	});
});
