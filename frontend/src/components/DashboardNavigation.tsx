'use client';

import { useRouter, usePathname } from 'next/navigation';
import { M3Button } from './ui/M3Components';
import { BarChart3, Target, Settings, TrendingUp } from 'lucide-react';

export function DashboardNavigation() {
	const router = useRouter();
	const pathname = usePathname();

	const navItems = [
		{
			path: '/dashboard',
			label: 'Portfolio',
			icon: <BarChart3 className="w-4 h-4" />,
			description: 'View and manage your portfolio',
		},
		{
			path: '/strategies',
			label: 'Strategies',
			icon: <Target className="w-4 h-4" />,
			description: 'Browse and select yield strategies',
		},
		{
			path: '/positions',
			label: 'Positions',
			icon: <TrendingUp className="w-4 h-4" />,
			description: 'Manage active positions',
		},
		{
			path: '/settings',
			label: 'Settings',
			icon: <Settings className="w-4 h-4" />,
			description: 'Configure preferences',
		},
	];

	return (
		<nav className="mb-6">
			<div className="flex flex-wrap gap-2">
				{navItems.map((item) => (
					<M3Button
						key={item.path}
						variant={pathname === item.path ? 'filled' : 'outlined'}
						size="medium"
						onClick={() => {console.log(`Navigating to ${item.path}`); router.push(item.path)}}
						icon={item.icon}
						title={item.description}
					>
						{item.label}
					</M3Button>
				))}
			</div>

			{}
			{}
		</nav>
	);
}
