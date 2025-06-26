'use client';

import { createContext, useContext, useReducer, ReactNode, useEffect, useState } from 'react';
import { ethers } from 'ethers';
import contractService, { StrategyInfo, Position } from '@/services/ContractService';
import { priceService } from '../services/PriceService';

interface AppState {
	userAddress: string | null;
	isConnected: boolean;
	networkId: number | null;
	strategies: StrategyInfo[];
	positions: Position[];
	isLoading: {
		strategies: boolean;
		positions: boolean;
		marketData: boolean;
	};
	errors: {
		strategies: string | null;
		positions: string | null;
		marketData: string | null;
	};
	marketData: {
		gasPrice: string;
		ethPrice: string;
		lastUpdated: number;
	};
}

type AppAction =
	| { type: 'SET_USER'; payload: { address: string | null; networkId: number | null } }
	| { type: 'SET_STRATEGIES'; payload: StrategyInfo[] }
	| { type: 'SET_POSITIONS'; payload: Position[] }
	| { type: 'SET_LOADING'; payload: { key: keyof AppState['isLoading']; value: boolean } }
	| { type: 'SET_ERROR'; payload: { key: keyof AppState['errors']; value: string | null } }
	| { type: 'SET_MARKET_DATA'; payload: { gasPrice: string; ethPrice: string } };

const initialState: AppState = {
	userAddress: null,
	isConnected: false,
	networkId: null,
	strategies: [],
	positions: [],
	isLoading: {
		strategies: false,
		positions: false,
		marketData: false,
	},
	errors: {
		strategies: null,
		positions: null,
		marketData: null,
	},
	marketData: {
		gasPrice: '0',
		ethPrice: '0',
		lastUpdated: 0,
	},
};

function appReducer(state: AppState, action: AppAction): AppState {
	switch (action.type) {
		case 'SET_USER':
			return {
				...state,
				userAddress: action.payload.address,
				networkId: action.payload.networkId,
				isConnected: action.payload.address !== null,
			};
		case 'SET_STRATEGIES':
			return {
				...state,
				strategies: action.payload,
			};
		case 'SET_POSITIONS':
			return {
				...state,
				positions: action.payload,
			};
		case 'SET_LOADING':
			return {
				...state,
				isLoading: {
					...state.isLoading,
					[action.payload.key]: action.payload.value,
				},
			};
		case 'SET_ERROR':
			return {
				...state,
				errors: {
					...state.errors,
					[action.payload.key]: action.payload.value,
				},
			};
		case 'SET_MARKET_DATA':
			return {
				...state,
				marketData: {
					...action.payload,
					lastUpdated: Date.now(),
				},
			};
		default:
			return state;
	}
}

const AppContext = createContext<{
	state: AppState;
	dispatch: React.Dispatch<AppAction>;
	connectWallet: () => Promise<void>;
	disconnectWallet: () => void;
	refreshStrategies: () => Promise<void>;
	refreshPositions: () => Promise<void>;
}>({
	state: initialState,
	dispatch: () => null,
	connectWallet: async () => {},
	disconnectWallet: () => {},
	refreshStrategies: async () => {},
	refreshPositions: async () => {},
});

export function AppProvider({ children }: { children: ReactNode }) {
	const [state, dispatch] = useReducer(appReducer, initialState);
	const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);

	useEffect(() => {
		if (typeof window !== 'undefined' && window.ethereum) {
			const web3Provider = new ethers.BrowserProvider(window.ethereum);
			setProvider(web3Provider);

			const initializeContractService = async () => {
				try {
					console.log('[AppProvider] -- Initializing contract service...');
					await contractService.initialize(web3Provider);
					console.log('[AppProvider] -- Contract service initialized successfully');
				} catch (error) {
					console.error('[AppProvider] -- Failed to initialize contract service:', error);
				}
			};

			const checkConnection = async () => {
				try {
					const accounts = await web3Provider.listAccounts();
					if (accounts.length > 0) {
						const network = await web3Provider.getNetwork();
						dispatch({
							type: 'SET_USER',
							payload: { address: accounts[0].address, networkId: Number(network.chainId) },
						});
						await initializeContractService();
					}
				} catch (error) {
					console.error('[AppProvider] -- Error checking wallet connection:', error);
				}
			};

			checkConnection();

			const handleAccountsChanged = async (accounts: string[]) => {
				try {
					if (accounts.length > 0) {
						const network = await web3Provider.getNetwork();
						dispatch({
							type: 'SET_USER',
							payload: { address: String(accounts[0]), networkId: Number(network.chainId) },
						});
						await initializeContractService();
					} else {
						dispatch({
							type: 'SET_USER',
							payload: { address: null, networkId: null },
						});
					}
				} catch (error) {
					console.error('[AppProvider] -- Error handling account change:', error);
				}
			};

			const handleChainChanged = () => {
				window.location.reload();
			};

			window.ethereum.on('accountsChanged', handleAccountsChanged);
			window.ethereum.on('chainChanged', handleChainChanged);

			return () => {
			};
		} else {
			console.error('Web3 provider not available');
		}
	}, []);

	const connectWallet = async () => {
		if (!provider) {
			console.error('[AppProvider] -- Web3 provider not available');
			return;
		}

		try {
			console.log('[AppProvider] -- Requesting wallet connection...');
			const accounts = await provider.send('eth_requestAccounts', []);
			const network = await provider.getNetwork();

			console.log('[AppProvider] -- Wallet connected:', accounts[0]);
			dispatch({
				type: 'SET_USER',
				payload: { address: String(accounts[0]), networkId: Number(network.chainId) },
			});

			console.log('[AppProvider] -- Initializing contract service after wallet connection...');
			await contractService.initialize(provider);
			console.log('[AppProvider] -- Contract service initialized successfully');
		} catch (error) {
			console.error('[AppProvider] -- Failed to connect wallet:', error);
		}
	};

	const disconnectWallet = () => {
		dispatch({
			type: 'SET_USER',
			payload: { address: null, networkId: null },
		});
	};

	const refreshStrategies = async () => {
		if (!state.isConnected) {
			console.log('[AppProvider] -- Cannot refresh strategies: wallet not connected');
			return;
		}

		console.log('[AppProvider] -- Refreshing strategies...');
		dispatch({
			type: 'SET_LOADING',
			payload: { key: 'strategies', value: true },
		});

		try {
			const strategies = await contractService.getActiveStrategies();
			console.log('[AppProvider] -- Strategies loaded:', strategies.length);
			dispatch({
				type: 'SET_STRATEGIES',
				payload: strategies,
			});
			dispatch({
				type: 'SET_ERROR',
				payload: { key: 'strategies', value: null },
			});
		} catch (error) {
			console.error('[AppProvider] -- Failed to fetch strategies:', error);
			dispatch({
				type: 'SET_ERROR',
				payload: { key: 'strategies', value: 'Failed to load strategies. Please ensure your wallet is connected.' },
			});
		} finally {
			dispatch({
				type: 'SET_LOADING',
				payload: { key: 'strategies', value: false },
			});
		}
	};

	const refreshPositions = async () => {
		if (!state.isConnected || !state.userAddress) {
			console.log('[AppProvider] -- Cannot refresh positions: wallet not connected or no address');
			return;
		}

		console.log('[AppProvider] -- Refreshing positions for:', state.userAddress);
		dispatch({
			type: 'SET_LOADING',
			payload: { key: 'positions', value: true },
		});

		try {
			const positions = await contractService.getUserPositions(state.userAddress);
			console.log('[AppProvider] -- Positions loaded:', positions.length);
			dispatch({
				type: 'SET_POSITIONS',
				payload: positions,
			});
			dispatch({
				type: 'SET_ERROR',
				payload: { key: 'positions', value: null },
			});
		} catch (error) {
			console.error('[AppProvider] -- Failed to fetch positions:', error);
			dispatch({
				type: 'SET_ERROR',
				payload: { key: 'positions', value: 'Failed to load positions. Please ensure your wallet is connected.' },
			});
		} finally {
			dispatch({
				type: 'SET_LOADING',
				payload: { key: 'positions', value: false },
			});
		}
	};

	useEffect(() => {
		if (state.isConnected) {
			refreshStrategies();
			refreshPositions();
		}
	}, [state.isConnected, state.userAddress]);

	useEffect(() => {
		const fetchMarketData = async () => {
			if (!provider) return;

			dispatch({
				type: 'SET_LOADING',
				payload: { key: 'marketData', value: true },
			});

			try {
				const gasPrice = await provider.getFeeData();
				const gasPriceGwei = ethers.formatUnits(gasPrice.gasPrice || BigInt(0), 'gwei');

				const avaxPrice = await priceService.getTokenPrice('0x0000000000000000000000000000000000000000');
				const ethPrice = avaxPrice.toFixed(2); 

				dispatch({
					type: 'SET_MARKET_DATA',
					payload: { gasPrice: gasPriceGwei, ethPrice },
				});
				dispatch({
					type: 'SET_ERROR',
					payload: { key: 'marketData', value: null },
				});
			} catch (error) {
				console.error('Failed to fetch market data:', error);
				dispatch({
					type: 'SET_ERROR',
					payload: { key: 'marketData', value: 'Failed to load market data' },
				});
			} finally {
				dispatch({
					type: 'SET_LOADING',
					payload: { key: 'marketData', value: false },
				});
			}
		};

		fetchMarketData();

		const intervalId = setInterval(fetchMarketData, 60000);

		return () => clearInterval(intervalId);
	}, [provider]);

	return (
		<AppContext.Provider
			value={{
				state,
				dispatch,
				connectWallet,
				disconnectWallet,
				refreshStrategies,
				refreshPositions,
			}}
		>
			{children}
		</AppContext.Provider>
	);
}

export function useAppContext() {
	const context = useContext(AppContext);

	if (!context) {
		throw new Error('useAppContext must be used within an AppProvider');
	}

	return context;
}
