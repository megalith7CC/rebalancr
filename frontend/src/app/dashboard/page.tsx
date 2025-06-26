'use client';

import { useState } from 'react';
import { M3Button } from '@/components/ui/M3Components';
import RealtimePortfolio from '@/components/RealtimePortfolio';
import { DashboardNavigation } from '@/components/DashboardNavigation';
import { useWallet } from '@/hooks/useWallet';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { LogOut, Settings } from 'lucide-react';
import { ServiceStatusIndicator } from '@/components/ServiceStatusIndicator';
import { WebSocketBridge } from '@/components/WebSocketBridge';

export default function DashboardPage() {
	const { isConnected, disconnectWallet } = useWallet();
	const router = useRouter();
	const [notificationsOpen, setNotificationsOpen] = useState(false);

	useEffect(() => {
		if (!isConnected) {
			router.replace('/');
		}
	}, [isConnected, router]);

	const handleSettingsClick = () => {
		router.push('/settings');
	};

	return (
			<div className="min-h-screen" style={{ backgroundColor: 'var(--md-sys-color-surface)' }}>

				{}
				<header
					className="sticky top-0 z-10 px-6 py-3 flex items-center justify-between"
					style={{
						backgroundColor: 'var(--md-sys-color-surface-container)',
						boxShadow: 'var(--md-sys-elevation-level1)',
					}}
				>
					<div className="flex items-center space-x-4">
						<h1
							style={{
								fontFamily: 'var(--md-sys-typescale-title-large-font)',
								fontSize: 'var(--md-sys-typescale-title-large-size)',
								color: 'var(--md-sys-color-on-surface)',
							}}
						>
							<span className='font-bold'>Rebalancr</span> Dashboard
						</h1>
					</div>

					<div className="flex items-center space-x-3">
						<button
							onClick={handleSettingsClick}
							className="p-2 rounded-full hover:bg-black/5 focus:outline-none"
							aria-label="Settings"
						>
							<Settings className="w-5 h-5" style={{ color: 'var(--md-sys-color-on-surface)' }} />
						</button>

						<M3Button variant="outlined" size="medium" icon={<LogOut className="w-4 h-4" />} onClick={disconnectWallet}>
							Disconnect
						</M3Button>
					</div>
				</header>

				{}
				<main className="container mx-auto px-4 py-6">
					<DashboardNavigation />
					<RealtimePortfolio />
				</main>

				{}
				{}
				{}
			</div>
	);
}
