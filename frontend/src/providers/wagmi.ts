import { http, createConfig } from 'wagmi';
import { avalancheFuji } from 'wagmi/chains';
import { injected, metaMask, walletConnect } from 'wagmi/connectors';

const projectId = process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || 'demo-project-id';

export const config = createConfig({
	chains: [avalancheFuji],
	connectors: [injected(), metaMask(), walletConnect({ projectId })],
	transports: {
		[avalancheFuji.id]: http(),
	},
});
