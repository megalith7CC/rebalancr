// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "../interfaces/IPriceOracle.sol";
import "../interfaces/IAgentRegistry.sol";
import "../libraries/InputValidation.sol";

contract MarketDataAggregator is Ownable, ReentrancyGuard {
    using EnumerableSet for EnumerableSet.AddressSet;
    using EnumerableSet for EnumerableSet.Bytes32Set;
    using InputValidation for address;
    using InputValidation for uint256;
    using InputValidation for bytes32;

    enum DataSourceType {
        PRICE_ORACLE,
        PROTOCOL_API,
        MARKET_DATA_API,
        CUSTOM_FEED
    }
    struct MarketData {
        uint256 price;
        uint256 volume24h;
        uint256 liquidity;
        uint256 apy;
        uint256 volatility;
        uint256 lastUpdated;
        bool isValid;
    }
    struct DataSource {
        DataSourceType sourceType;
        address sourceAddress;
        uint256 weight;
        uint256 maxAge;
        bool isActive;
        string description;
    }
    struct HistoricalDataPoint {
        uint256 timestamp;
        uint256 price;
        uint256 volume;
        uint256 apy;
    }


    IAgentRegistry private _agentRegistry;
    mapping(address => MarketData) private _marketData;
    mapping(address => EnumerableSet.AddressSet) private _tokenDataSources;
    mapping(address => DataSource) private _dataSources;
    mapping(address => mapping(uint256 => HistoricalDataPoint)) private _historicalData;
    mapping(address => uint256[]) private _historicalTimestamps;
    EnumerableSet.AddressSet private _supportedTokens;
    EnumerableSet.AddressSet private _registeredSources;
    uint256 private constant DEFAULT_MAX_AGE = 1 hours;
    uint256 private constant MIN_WEIGHT = 100;
    uint256 private constant MAX_WEIGHT = 10000;
    uint256 private constant BASIS_POINTS = 10000;
    bytes32 private constant VIEW_PERMISSION = keccak256(abi.encodePacked("VIEW"));

    error TokenNotSupported(address token);
    error DataSourceNotFound(address source);
    error DataSourceAlreadyExists(address source);
    error InvalidWeight(uint256 weight);
    error InvalidMaxAge(uint256 maxAge);
    error StaleData(address token, uint256 lastUpdated, uint256 maxAge);
    error InsufficientDataSources(address token);
    error UnauthorizedAccess(address caller);
    error InvalidPriceData(address token, uint256 price);
    error DataAggregationFailed(address token);

    event TokenAdded(address indexed token);
    event TokenRemoved(address indexed token);
    event DataSourceRegistered(
        address indexed source,
        DataSourceType indexed sourceType,
        uint256 weight,
        string description
    );
    event DataSourceUpdated(
        address indexed source,
        uint256 newWeight,
        uint256 newMaxAge,
        bool isActive
    );
    event DataSourceRemoved(address indexed source);
    event MarketDataUpdated(
        address indexed token,
        uint256 price,
        uint256 apy,
        uint256 timestamp
    );
    event HistoricalDataAdded(
        address indexed token,
        uint256 indexed timestamp,
        uint256 price,
        uint256 volume
    );
    event DataAggregationCompleted(
        address indexed token,
        uint256 sourcesUsed,
        uint256 timestamp
    );

    modifier onlyAuthorizedAgent() {
        if (!_agentRegistry.isAuthorized(msg.sender, VIEW_PERMISSION)) {
            revert UnauthorizedAccess(msg.sender);
        }
        _;
    }

    modifier tokenSupported(address token) {
        if (!_supportedTokens.contains(token)) {
            revert TokenNotSupported(token);
        }
        _;
    }

    constructor(address agentRegistry) Ownable(msg.sender) {
        agentRegistry.validateNotZeroAddress("agentRegistry");
        _agentRegistry = IAgentRegistry(agentRegistry);
    }

    function addToken(address token) external onlyOwner {
        token.validateNotZeroAddress("token");

        if (_supportedTokens.contains(token)) {
            return;
        }

        _supportedTokens.add(token);
        _marketData[token] = MarketData({
            price: 0,
            volume24h: 0,
            liquidity: 0,
            apy: 0,
            volatility: 0,
            lastUpdated: 0,
            isValid: false
        });

        emit TokenAdded(token);
    }

    function removeToken(
        address token
    ) external onlyOwner tokenSupported(token) {
        _supportedTokens.remove(token);
        EnumerableSet.AddressSet storage sources = _tokenDataSources[token];
        uint256 sourceCount = sources.length();
        for (uint256 i = 0; i < sourceCount; i++) {
            address source = sources.at(0);
            sources.remove(source);
        }
        delete _marketData[token];
        delete _historicalTimestamps[token];

        emit TokenRemoved(token);
    }

    function registerDataSource(
        address source,
        DataSourceType sourceType,
        uint256 weight,
        uint256 maxAge,
        string calldata description
    ) external onlyOwner {
        source.validateNotZeroAddress("source");

        if (weight < MIN_WEIGHT || weight > MAX_WEIGHT) {
            revert InvalidWeight(weight);
        }

        if (maxAge == 0) {
            revert InvalidMaxAge(maxAge);
        }

        if (_registeredSources.contains(source)) {
            revert DataSourceAlreadyExists(source);
        }

        _dataSources[source] = DataSource({
            sourceType: sourceType,
            sourceAddress: source,
            weight: weight,
            maxAge: maxAge,
            isActive: true,
            description: description
        });

        _registeredSources.add(source);

        emit DataSourceRegistered(source, sourceType, weight, description);
    }

    function updateDataSource(
        address source,
        uint256 newWeight,
        uint256 newMaxAge,
        bool isActive
    ) external onlyOwner {
        if (!_registeredSources.contains(source)) {
            revert DataSourceNotFound(source);
        }

        if (newWeight < MIN_WEIGHT || newWeight > MAX_WEIGHT) {
            revert InvalidWeight(newWeight);
        }

        if (newMaxAge == 0) {
            revert InvalidMaxAge(newMaxAge);
        }

        DataSource storage dataSource = _dataSources[source];
        dataSource.weight = newWeight;
        dataSource.maxAge = newMaxAge;
        dataSource.isActive = isActive;

        emit DataSourceUpdated(source, newWeight, newMaxAge, isActive);
    }

    function removeDataSource(address source) external onlyOwner {
        if (!_registeredSources.contains(source)) {
            revert DataSourceNotFound(source);
        }
        uint256 tokenCount = _supportedTokens.length();
        for (uint256 i = 0; i < tokenCount; i++) {
            address token = _supportedTokens.at(i);
            _tokenDataSources[token].remove(source);
        }

        _registeredSources.remove(source);
        delete _dataSources[source];

        emit DataSourceRemoved(source);
    }

    function addTokenDataSource(
        address token,
        address source
    ) external onlyOwner tokenSupported(token) {
        if (!_registeredSources.contains(source)) {
            revert DataSourceNotFound(source);
        }

        _tokenDataSources[token].add(source);
    }

    function removeTokenDataSource(
        address token,
        address source
    ) external onlyOwner tokenSupported(token) {
        _tokenDataSources[token].remove(source);
    }

    function updateMarketData(
        address token
    ) external nonReentrant tokenSupported(token) {
        EnumerableSet.AddressSet storage sources = _tokenDataSources[token];
        uint256 sourceCount = sources.length();

        if (sourceCount == 0) {
            revert InsufficientDataSources(token);
        }

        uint256 weightedPrice = 0;
        uint256 weightedApy = 0;
        uint256 totalWeight = 0;
        uint256 maxVolume = 0;
        uint256 maxLiquidity = 0;
        uint256 validSources = 0;
        for (uint256 i = 0; i < sourceCount; i++) {
            address source = sources.at(i);
            DataSource storage dataSource = _dataSources[source];

            if (!dataSource.isActive) continue;

            try this._getDataFromSource(token, source) returns (
                uint256 price,
                uint256 volume,
                uint256 liquidity,
                uint256 apy,
                uint256 lastUpdated
            ) {
                if (block.timestamp - lastUpdated > dataSource.maxAge) {
                    continue;
                }
                if (price == 0) continue;
                uint256 weight = dataSource.weight;
                weightedPrice += price * weight;
                weightedApy += apy * weight;
                totalWeight += weight;
                validSources++;
                if (volume > maxVolume) maxVolume = volume;
                if (liquidity > maxLiquidity) maxLiquidity = liquidity;
            } catch {
                continue;
            }
        }

        if (validSources == 0 || totalWeight == 0) {
            revert DataAggregationFailed(token);
        }
        uint256 finalPrice = weightedPrice / totalWeight;
        uint256 finalApy = weightedApy / totalWeight;
        MarketData storage data = _marketData[token];
        data.price = finalPrice;
        data.volume24h = maxVolume;
        data.liquidity = maxLiquidity;
        data.apy = finalApy;
        data.lastUpdated = block.timestamp;
        data.isValid = true;
        _addHistoricalData(token, finalPrice, maxVolume, finalApy);

        emit MarketDataUpdated(token, finalPrice, finalApy, block.timestamp);
        emit DataAggregationCompleted(token, validSources, block.timestamp);
    }

    function getMarketData(
        address token
    )
        external
        view
        onlyAuthorizedAgent
        tokenSupported(token)
        returns (MarketData memory data)
    {
        data = _marketData[token];

        if (!data.isValid) {
            revert InvalidPriceData(token, data.price);
        }

        if (block.timestamp - data.lastUpdated > DEFAULT_MAX_AGE) {
            revert StaleData(token, data.lastUpdated, DEFAULT_MAX_AGE);
        }

        return data;
    }

    function getHistoricalData(
        address token,
        uint256 fromTimestamp,
        uint256 toTimestamp
    )
        external
        view
        onlyAuthorizedAgent
        tokenSupported(token)
        returns (HistoricalDataPoint[] memory dataPoints)
    {
        if (fromTimestamp >= toTimestamp) {
            revert InvalidMaxAge(fromTimestamp);
        }

        uint256[] storage timestamps = _historicalTimestamps[token];
        uint256 count = 0;
        for (uint256 i = 0; i < timestamps.length; i++) {
            uint256 timestamp = timestamps[i];
            if (timestamp >= fromTimestamp && timestamp <= toTimestamp) {
                count++;
            }
        }
        dataPoints = new HistoricalDataPoint[](count);
        uint256 index = 0;

        for (uint256 i = 0; i < timestamps.length; i++) {
            uint256 timestamp = timestamps[i];
            if (timestamp >= fromTimestamp && timestamp <= toTimestamp) {
                dataPoints[index] = _historicalData[token][timestamp];
                index++;
            }
        }

        return dataPoints;
    }

    function getMultipleTokenPrices(
        address[] calldata tokens
    )
        external
        view
        onlyAuthorizedAgent
        returns (uint256[] memory prices, uint256[] memory timestamps)
    {
        uint256 tokenCount = tokens.length;
        prices = new uint256[](tokenCount);
        timestamps = new uint256[](tokenCount);

        for (uint256 i = 0; i < tokenCount; i++) {
            address token = tokens[i];
            if (_supportedTokens.contains(token)) {
                MarketData storage data = _marketData[token];
                prices[i] = data.price;
                timestamps[i] = data.lastUpdated;
            } else {
                prices[i] = 0;
                timestamps[i] = 0;
            }
        }

        return (prices, timestamps);
    }

    function getSupportedTokens()
        external
        view
        returns (address[] memory tokens)
    {
        uint256 tokenCount = _supportedTokens.length();
        tokens = new address[](tokenCount);

        for (uint256 i = 0; i < tokenCount; i++) {
            tokens[i] = _supportedTokens.at(i);
        }

        return tokens;
    }

    function getTokenDataSources(
        address token
    ) external view tokenSupported(token) returns (address[] memory sources) {
        EnumerableSet.AddressSet storage tokenSources = _tokenDataSources[
            token
        ];
        uint256 sourceCount = tokenSources.length();
        sources = new address[](sourceCount);

        for (uint256 i = 0; i < sourceCount; i++) {
            sources[i] = tokenSources.at(i);
        }

        return sources;
    }

    function getDataSourceConfig(
        address source
    ) external view returns (DataSource memory config) {
        if (!_registeredSources.contains(source)) {
            revert DataSourceNotFound(source);
        }

        return _dataSources[source];
    }

    function updateAgentRegistry(address newAgentRegistry) external onlyOwner {
        newAgentRegistry.validateNotZeroAddress("newAgentRegistry");
        _agentRegistry = IAgentRegistry(newAgentRegistry);
    }

    function _getDataFromSource(
        address token,
        address source
    )
        external
        view
        returns (
            uint256 price,
            uint256 volume,
            uint256 liquidity,
            uint256 apy,
            uint256 lastUpdated
        )
    {
        require(msg.sender == address(this), "Internal function");

        DataSource storage dataSource = _dataSources[source];

        if (dataSource.sourceType == DataSourceType.PRICE_ORACLE) {
            IPriceOracle oracle = IPriceOracle(source);
            price = oracle.getLatestPrice(token);
            volume = 0;
            liquidity = 0;
            apy = 0;
            lastUpdated = block.timestamp;
        } else {
            price = 0;
            volume = 0;
            liquidity = 0;
            apy = 0;
            lastUpdated = 0;
        }

        return (price, volume, liquidity, apy, lastUpdated);
    }

    function _addHistoricalData(
        address token,
        uint256 price,
        uint256 volume,
        uint256 apy
    ) internal {
        uint256 timestamp = block.timestamp;
        uint256 roundedTimestamp = (timestamp / 1 hours) * 1 hours;
        if (_historicalData[token][roundedTimestamp].timestamp == 0) {
            _historicalData[token][roundedTimestamp] = HistoricalDataPoint({
                timestamp: roundedTimestamp,
                price: price,
                volume: volume,
                apy: apy
            });

            _historicalTimestamps[token].push(roundedTimestamp);

            emit HistoricalDataAdded(token, roundedTimestamp, price, volume);
        }
    }
}
