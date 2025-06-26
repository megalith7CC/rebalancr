import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { injected } from 'wagmi/connectors';

export interface WalletState {
  isConnected: boolean;
  address: string | null;
  connecting: boolean;
  error: string | null;
}

export function useWallet() {
  const { address, isConnected } = useAccount();
  const { connect, isPending: connecting, error: connectError } = useConnect();
  const { disconnect } = useDisconnect();

  const connectWallet = async () => {
    try {
      connect({ connector: injected() });
    } catch (error) {
      console.error('Failed to connect wallet:', error);
    }
  };

  const disconnectWallet = () => {
    disconnect();
  };

  return {
    isConnected,
    address: address || null,
    connecting,
    error: connectError?.message || null,
    connectWallet,
    disconnectWallet
  };
}