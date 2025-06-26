'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { M3Button } from '@/components/ui/M3Components';
import { useAppContext } from '@/context/AppContext';

interface NavItem {
  name: string;
  path: string;
  icon?: React.ReactNode;
}

const mainNavItems: NavItem[] = [
  { name: 'Dashboard', path: '/dashboard' },
  { name: 'Strategies', path: '/strategies' },
  { name: 'Positions', path: '/positions' },
  { name: 'Market Data', path: '/market-data' },
  { name: 'Agent', path: '/agent' },
];

export function Navigation() {
  const pathname = usePathname();
  const { state, connectWallet, disconnectWallet } = useAppContext();
  
  return (
    <nav className="px-4 py-3 bg-white dark:bg-slate-800 shadow-sm">
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center">
          <Link href="/" className="text-xl font-bold text-primary-600 dark:text-primary-400 mr-8">
            Rebalancr
          </Link>
          
          <div className="hidden md:flex space-x-1">
            {mainNavItems.map((item) => (
              <Link key={item.path} href={item.path} passHref>
                <M3Button
                  variant="text"
                  className={`${
                    pathname === item.path 
                      ? 'text-primary-600 dark:text-primary-400' 
                      : 'text-gray-600 dark:text-gray-300'
                  }`}
                >
                  {item.name}
                </M3Button>
              </Link>
            ))}
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="text-right mr-2">
            {state.isConnected && (
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Gas: {parseFloat(state.marketData.gasPrice).toFixed(1)} Gwei
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  ETH: ${state.marketData.ethPrice}
                </p>
              </div>
            )}
          </div>
          <ConnectWalletButton 
            isConnected={state.isConnected} 
            userAddress={state.userAddress} 
            onConnect={connectWallet}
            onDisconnect={disconnectWallet}
          />
        </div>
      </div>
    </nav>
  );
}

interface ConnectWalletButtonProps {
  isConnected: boolean;
  userAddress: string | null;
  onConnect: () => Promise<void>;
  onDisconnect: () => void;
}

function ConnectWalletButton({ 
  isConnected, 
  userAddress, 
  onConnect, 
  onDisconnect 
}: ConnectWalletButtonProps) {
  if (isConnected && userAddress) {
    return (
      <div className="flex items-center">
        <div className="hidden md:block mr-2">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {userAddress.substring(0, 6)}...{userAddress.substring(userAddress.length - 4)}
          </p>
        </div>
        <M3Button variant="outlined" onClick={onDisconnect}>
          Disconnect
        </M3Button>
      </div>
    );
  }
  
  return (
    <M3Button variant="filled" onClick={onConnect}>
      Connect Wallet
    </M3Button>
  );
} 