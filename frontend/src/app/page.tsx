'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import LandingPage from '@/components/LandingPage';
import { useWallet } from '@/hooks/useWallet';

export default function Home() {
	const router = useRouter();
	const { isConnected, connectWallet, connecting, error, address } = useWallet();

	useEffect(() => {
		if (isConnected) {
			console.log('Connected wallet address:', address);
			router.replace('/dashboard');
		}
	}, [isConnected, router]);

	return <LandingPage onConnectWallet={connectWallet} isConnecting={connecting} walletError={error} />;
}
