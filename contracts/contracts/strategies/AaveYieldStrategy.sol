// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@aave/core-v3/contracts/interfaces/IPool.sol";
import "@aave/core-v3/contracts/interfaces/IAaveOracle.sol";
import "@aave/core-v3/contracts/protocol/libraries/types/DataTypes.sol";
import "../core/BaseStrategyAgent.sol";
import "../interfaces/IPositionManager.sol";
import "../interfaces/IPriceOracle.sol";
import "../libraries/MathLib.sol";
import "../libraries/InputValidation.sol";
import "../libraries/ProtocolConstants.sol";

contract AaveYieldStrategy is BaseStrategyAgent {
    using SafeERC20 for IERC20;
    using InputValidation for address;
    using InputValidation for uint256;
    using MathLib for uint256;
    IPool public aavePool;
    IAaveOracle public aaveOracle;
    IPriceOracle public priceOracle;
    mapping(address => address) public aTokens;
    mapping(address => uint256) public totalDeposits;
    mapping(address => uint8) public tokenDecimals;
    event Deposited(
        address indexed token,
        uint256 amount,
        address indexed user
    );
    event Withdrawn(
        address indexed token,
        uint256 amount,
        address indexed user
    );
    event ATokenAdded(address indexed token, address indexed aToken);
    event AavePoolUpdated(address indexed newAavePool);
    event AaveOracleUpdated(address indexed newAaveOracle);
    event PriceOracleUpdated(address indexed newPriceOracle);
    event ErrorHandled(string operation, string reason);

    error AaveOperationFailed(string operation);
    error ZeroAmount();
    error TokenNotMapped(address token);
    error InsufficientATokenBalance(
        address aToken,
        uint256 required,
        uint256 available
    );

    constructor() Ownable(msg.sender) {}

    bool private _aaveInitialized;

    function initializeAaveStrategy(bytes calldata data) external onlyOwner {
        if (_aaveInitialized) {
            revert AlreadyInitialized();
        }
        (
            address aavePoolAddress,
            address aaveOracleAddress,
            address priceOracleAddress,
            address[] memory tokens,
            address[] memory aTokenAddresses
        ) = abi.decode(data, (address, address, address, address[], address[]));
        aavePoolAddress.validateNotZeroAddress("aavePoolAddress");
        aaveOracleAddress.validateNotZeroAddress("aaveOracleAddress");
        priceOracleAddress.validateNotZeroAddress("priceOracleAddress");

        require(
            tokens.length == aTokenAddresses.length,
            "Token and aToken arrays must have the same length"
        );
        require(tokens.length > 0, "At least one token must be provided");
        aavePool = IPool(aavePoolAddress);
        aaveOracle = IAaveOracle(aaveOracleAddress);
        priceOracle = IPriceOracle(priceOracleAddress);
        for (uint256 i = 0; i < tokens.length; i++) {
            tokens[i].validateNotZeroAddress("token");
            aTokenAddresses[i].validateNotZeroAddress("aToken");
            require(
                aTokens[tokens[i]] == address(0),
                "Token already mapped to an aToken"
            );

            aTokens[tokens[i]] = aTokenAddresses[i];
            tokenDecimals[tokens[i]] = 18;
            uint256 tokenCodeSize;
            address tokenAddress = tokens[i];
            assembly {
                tokenCodeSize := extcodesize(tokenAddress)
            }

            if (tokenCodeSize > 0) {
                try IERC20Metadata(tokens[i]).decimals() returns (
                    uint8 decimals
                ) {
                    require(
                        decimals <= 77,
                        "Token decimals exceeds maximum allowed"
                    );
                    tokenDecimals[tokens[i]] = decimals;
                } catch Error(string memory reason) {
                    emit ErrorHandled("decimals() call failed", reason);
                } catch Panic(uint errorCode) {
                    emit ErrorHandled(
                        "decimals() call panicked",
                        string(abi.encodePacked("Code: ", errorCode))
                    );
                } catch (bytes memory) {
                    emit ErrorHandled(
                        "decimals() call failed",
                        "Unknown error"
                    );
                }
            }

            emit ATokenAdded(tokens[i], aTokenAddresses[i]);
        }

        emit AavePoolUpdated(aavePoolAddress);
        emit AaveOracleUpdated(aaveOracleAddress);
        emit PriceOracleUpdated(priceOracleAddress);
        _aaveInitialized = true;
    }

    function updateAavePool(address newAavePool) external onlyOwner {
        newAavePool.validateNotZeroAddress("newAavePool");
        aavePool = IPool(newAavePool);
        emit AavePoolUpdated(newAavePool);
    }

    function updateAaveOracle(address newAaveOracle) external onlyOwner {
        newAaveOracle.validateNotZeroAddress("newAaveOracle");
        aaveOracle = IAaveOracle(newAaveOracle);
        emit AaveOracleUpdated(newAaveOracle);
    }

    function updatePriceOracle(address newPriceOracle) external onlyOwner {
        newPriceOracle.validateNotZeroAddress("newPriceOracle");
        priceOracle = IPriceOracle(newPriceOracle);
        emit PriceOracleUpdated(newPriceOracle);
    }

    function addAToken(address token, address aToken) external onlyOwner {
        token.validateNotZeroAddress("token");
        aToken.validateNotZeroAddress("aToken");
        require(
            aTokens[token] == address(0),
            "Token already mapped to an aToken"
        );

        aTokens[token] = aToken;
        tokenDecimals[token] = 18;
        uint256 tokenCodeSize;
        assembly {
            tokenCodeSize := extcodesize(token)
        }

        if (tokenCodeSize > 0) {
            try IERC20Metadata(token).decimals() returns (uint8 decimals) {
                require(
                    decimals <= 77,
                    "Token decimals exceeds maximum allowed"
                );
                tokenDecimals[token] = decimals;
            } catch Error(string memory reason) {
                emit ErrorHandled("decimals() call failed", reason);
            } catch Panic(uint errorCode) {
                emit ErrorHandled(
                    "decimals() call panicked",
                    string(abi.encodePacked("Code: ", errorCode))
                );
            } catch (bytes memory) {
                emit ErrorHandled("decimals() call failed", "Unknown error");
            }
        }

        emit ATokenAdded(token, aToken);
    }

    function getAToken(address token) external view returns (address) {
        return aTokens[token];
    }

    function getTokenAPY(address token) public view returns (uint256) {
        try aavePool.getReserveData(token) returns (
            DataTypes.ReserveData memory data
        ) {
            uint256 liquidityRateInBps = data.currentLiquidityRate / 1e25;
            return MathLib.aprToApy(liquidityRateInBps, 31536000);
        } catch {
            return 0;
        }
    }

    function getAverageAPY() public view returns (uint256) {
        uint256 totalAPY = 0;
        uint256 tokenCount = 0;
        address[] memory supportedTokens = strategyInfo.supportedTokens;

        for (uint256 i = 0; i < supportedTokens.length; i++) {
            if (aTokens[supportedTokens[i]] != address(0)) {
                totalAPY += getTokenAPY(supportedTokens[i]);
                tokenCount++;
            }
        }

        if (tokenCount == 0) return 0;

        return totalAPY / tokenCount;
    }

    function _executeStrategy(
        bytes calldata data
    ) internal virtual override returns (bool) {
        (address token, uint256 amount, bool isDeposit) = abi.decode(
            data,
            (address, uint256, bool)
        );

        if (isDeposit) {
            return _deposit(token, amount);
        } else {
            return _withdraw(token, amount);
        }
    }

    function _validateParams(
        bytes calldata data
    ) internal view virtual override returns (bool) {
        if (data.length < 64) {
            return false;
        }
        address token;
        uint256 amount;
        bool isDeposit;
        assembly {
            token := calldataload(add(data.offset, 0))
            amount := calldataload(add(data.offset, 32))
            isDeposit := calldataload(add(data.offset, 64))
        }
        if (!isTokenSupported(token)) {
            return false;
        }
        if (aTokens[token] == address(0)) {
            return false;
        }
        if (amount == 0) {
            return false;
        }

        return true;
    }

    function _prepareEntryPositionData(
        address token,
        uint256 amount
    ) internal pure override returns (bytes memory) {
        return abi.encode(token, amount, true);
    }

    function _prepareExitPositionData(
        uint256 /* positionId */,
        IPositionManager.Position memory position
    ) internal pure override returns (bytes memory) {
        return abi.encode(position.tokens[0], position.amounts[0], false);
    }

    /**
     * @inheritdoc BaseStrategyAgent
     */
    function _onPositionOpened(
        uint256 /* positionId */,
        address token,
        uint256 amount
    ) internal override returns (bool) {
        return _deposit(token, amount);
    }

    /**
     * @inheritdoc BaseStrategyAgent
     */
    function _onPositionClosed(
        uint256 /* positionId */,
        IPositionManager.Position memory position
    ) internal override returns (bool) {
        address token = position.tokens[0];
        uint256 amount = position.amounts[0];

        return _withdraw(token, amount);
    }

    /**
     * @inheritdoc BaseStrategyAgent
     */
    function _onPositionRebalanced(
        uint256 /* positionId */,
        IPositionManager.Position memory position,
        bytes calldata data
    ) internal override returns (bool) {
        (address newToken, uint256 newAmount) = abi.decode(
            data,
            (address, uint256)
        );
        bool success = _withdraw(position.tokens[0], position.amounts[0]);
        if (!success) return false;
        return _deposit(newToken, newAmount);
    }

    /**
     * @inheritdoc BaseStrategyAgent
     */
    function _updateTVL() internal virtual override {
        uint256 totalValue = 0;
        address[] memory supportedTokens = strategyInfo.supportedTokens;

        for (uint256 i = 0; i < supportedTokens.length; i++) {
            address token = supportedTokens[i];
            address aTokenAddr = aTokens[token];

            if (aTokenAddr == address(0)) continue;

            uint256 aTokenBalance = IERC20(aTokenAddr).balanceOf(address(this));
            uint256 tokenPriceUSD = priceOracle.getLatestPrice(token);
            uint8 decimals = tokenDecimals[token];
            uint256 tokenValue = (aTokenBalance * tokenPriceUSD) /
                (10 ** decimals);
            totalValue += tokenValue;
        }

        tvl = totalValue;
        currentApy = getAverageAPY();
        lastUpdateTimestamp = block.timestamp;

        emit PerformanceUpdated(
            tvl,
            currentApy,
            riskScore,
            lastUpdateTimestamp
        );
    }

    function _deposit(
        address token,
        uint256 amount
    ) internal virtual returns (bool) {
        if (amount == 0) revert ZeroAmount();

        address aTokenAddr = aTokens[token];
        if (aTokenAddr == address(0)) revert TokenNotMapped(token);
        IERC20 tokenContract = IERC20(token);
        tokenContract.approve(address(aavePool), amount);
        try aavePool.supply(token, amount, address(this), 0) {
            totalDeposits[token] += amount;
            _updateTVL();

            emit Deposited(token, amount, msg.sender);
            return true;
        } catch (bytes memory reason) {
            revert AaveOperationFailed(string(reason));
        }
    }

    function _withdraw(
        address token,
        uint256 amount
    ) internal virtual returns (bool) {
        if (amount == 0) revert ZeroAmount();

        address aTokenAddr = aTokens[token];
        if (aTokenAddr == address(0)) revert TokenNotMapped(token);

        uint256 aTokenBalance = _getATokenBalance(token);
        if (aTokenBalance < amount) {
            revert InsufficientATokenBalance(aTokenAddr, amount, aTokenBalance);
        }
        try aavePool.withdraw(token, amount, address(this)) {
            if (amount <= totalDeposits[token]) {
                totalDeposits[token] -= amount;
            } else {
                totalDeposits[token] = 0;
            }
            _updateTVL();

            emit Withdrawn(token, amount, msg.sender);

            return true;
        } catch (bytes memory reason) {
            revert AaveOperationFailed(string(reason));
        }
    }

    function _getATokenBalance(
        address token
    ) internal view virtual returns (uint256) {
        address aTokenAddr = aTokens[token];
        if (aTokenAddr == address(0)) return 0;
        return IERC20(aTokenAddr).balanceOf(address(this));
    }
}
