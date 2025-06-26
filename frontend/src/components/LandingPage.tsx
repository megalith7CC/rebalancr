import React, { useState, useEffect } from 'react';
import {
	TrendingUp,
	Shield,
	ArrowRight,
	Target,
	Wallet,
	BarChart3,
	Github,
} from 'lucide-react';

interface LandingPageProps {
	onConnectWallet: () => void;
	isConnecting?: boolean;
	walletError?: string | null;
}

const M3Button: React.FC<{
	variant?: 'filled' | 'outlined' | 'text';
	size?: 'small' | 'medium' | 'large';
	icon?: React.ReactNode;
	iconPosition?: 'start' | 'end';
	onClick?: () => void;
	disabled?: boolean;
	children: React.ReactNode;
	className?: string;
}> = ({ variant = 'filled', size = 'medium', icon, iconPosition = 'start', onClick, disabled, children, className = '' }) => {
	const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);

	const createRipple = (event: React.MouseEvent<HTMLButtonElement>) => {
		const button = event.currentTarget;
		const rect = button.getBoundingClientRect();
		const size = Math.max(rect.width, rect.height);
		const x = event.clientX - rect.left - size / 2;
		const y = event.clientY - rect.top - size / 2;
		const newRipple = { id: Date.now(), x, y };

		setRipples((prev) => [...prev, newRipple]);
		setTimeout(() => setRipples((prev) => prev.filter((ripple) => ripple.id !== newRipple.id)), 400);
	};

	const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
		createRipple(event);
		onClick?.();
	};

	const sizeClasses = {
		small: 'px-4 py-2 text-sm',
		medium: 'px-6 py-3',
		large: 'px-8 py-4 text-lg',
	};

	return (
		<button
			className={`md3-button md3-button--${variant} ${sizeClasses[size]} ${className} ${
				disabled ? 'opacity-50 cursor-not-allowed' : ''
			}`}
			onClick={handleClick}
			disabled={disabled}
		>
			{ripples.map((ripple) => (
				<span
					key={ripple.id}
					className="ripple"
					style={{
						left: ripple.x,
						top: ripple.y,
						width: '20px',
						height: '20px',
					}}
				/>
			))}
			{icon && iconPosition === 'start' && <span>{icon}</span>}
			<span>{children}</span>
			{icon && iconPosition === 'end' && <span>{icon}</span>}
		</button>
	);
};

const M3Card: React.FC<{
	variant?: 'elevated' | 'filled' | 'outlined';
	children: React.ReactNode;
	className?: string;
	onClick?: () => void;
}> = ({ variant = 'elevated', children, className = '', onClick }) => {
	return (
		<div
			className={`md3-card md3-card--${variant} ${className} ${onClick ? 'cursor-pointer hover:shadow-lg' : ''}`}
			onClick={onClick}
		>
			{children}
		</div>
	);
};

export default function LandingPage({ onConnectWallet, isConnecting = false, walletError }: LandingPageProps) {
	const [activeFeature, setActiveFeature] = useState(0);

	const features = [
		{
			icon: <Target className="w-6 h-6" />,
			title: 'Smart Rebalancing',
			description: 'Automatically maintain your target allocation ratios across different DeFi protocols',
		},
		{
			icon: <TrendingUp className="w-6 h-6" />,
			title: 'Yield Optimization',
			description: 'Monitor and migrate funds to the highest-yielding opportunities in DeFi',
		},
		{
			icon: <Shield className="w-6 h-6" />,
			title: 'Risk Management',
			description: 'Built-in safety features including stop-loss mechanisms and position limits',
		},
	];

	useEffect(() => {
		const interval = setInterval(() => {
			setActiveFeature((prev) => (prev + 1) % features.length);
		}, 4000);
		return () => clearInterval(interval);
	}, [features.length]);

	return (
		<div className="min-h-screen" style={{ backgroundColor: 'var(--md-sys-color-surface)' }}>
			{}
			<nav className="relative z-50 flex items-center justify-between p-6 lg:px-8">
				<div className="flex items-center space-x-3">
					<div
						className=" text-2xl"
						style={{
							fontFamily: 'var(--md-sys-typescale-headline-medium-font)',
							fontSize: 'var(--md-sys-typescale-headline-medium-size)',
							color: 'var(--md-sys-color-on-surface)',
						}}
					>
						Rebalancr
					</div>
				</div>

				<div className="flex items-center space-x-4">
					<a
						href="https://github.com/megalith7CC/rebalancr"
						target="_blank"
						rel="noopener noreferrer"
						className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
						style={{ color: 'var(--md-sys-color-on-surface-variant)' }}
					>
						<Github className="w-5 h-5" />
					</a>

					<M3Button
						variant="filled"
						size="medium"
						icon={
							isConnecting ? (
								<div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
							) : (
								<Wallet className="w-4 h-4" />
							)
						}
						onClick={onConnectWallet}
						disabled={isConnecting}
					>
						{isConnecting ? 'Connecting...' : 'Connect Wallet'}
					</M3Button>
				</div>
			</nav>

			{}
			{walletError && (
				<div className="px-6 lg:px-8 mb-8">
					<M3Card variant="outlined" className="max-w-4xl mx-auto">
						<div className="p-4 flex items-center space-x-3" style={{ color: 'var(--md-sys-color-error)' }}>
							<Shield className="w-5 h-5" />
							<span
								style={{
									fontFamily: 'var(--md-sys-typescale-body-medium-font)',
									fontSize: 'var(--md-sys-typescale-body-medium-size)',
								}}
							>
								{walletError}
							</span>
						</div>
					</M3Card>
				</div>
			)}

			{}
			<section className="relative px-6 lg:px-8 pt-12 pb-20">
				<div className="mx-auto max-w-6xl">
					<div className="text-center mb-16">
						<h1
							className="mb-6 bg-gradient-to-r from-purple-600 via-blue-600 to-cyan-600 bg-clip-text text-transparent"
							style={{
								fontFamily: 'var(--md-sys-typescale-display-large-font)',
								fontSize: 'clamp(2.5rem, 5vw, 3.5rem)',
								fontWeight: '400',
								lineHeight: '1.1',
							}}
						>
							Automated DeFi Portfolio Management
						</h1>
						<p
							className="mb-12 max-w-3xl mx-auto opacity-80 ml-24"
							style={{
								fontFamily: 'var(--md-sys-typescale-headline-small-font)',
								fontSize: 'var(--md-sys-typescale-title-large-size)',
								lineHeight: 'var(--md-sys-typescale-title-large-line-height)',
								color: 'var(--md-sys-color-on-surface-variant)',
							}}
						>
							Rebalancr automatically manages your DeFi portfolio allocation, optimizes yields, and manages risk across multiple protocols. 
							Set your strategy and let the platform handle the rest.
						</p>

						<div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16 mt-10">
							<M3Button
								variant="filled"
								size="large"
								icon={<ArrowRight className="w-5 h-5" />}
								iconPosition="end"
								onClick={onConnectWallet}
								disabled={isConnecting}
								className="min-w-[200px]"
							>
								Get Started
							</M3Button>
							<a
								href="https://github.com/megalith7CC/rebalancr"
								target="_blank"
								rel="noopener noreferrer"
							>
								<M3Button variant="outlined" size="large" className="min-w-[200px]">
									View on GitHub
								</M3Button>
							</a>
						</div>

						{}
					</div>
				</div>
			</section>

			{}
			<section className="px-6 lg:px-8 py-20" style={{ backgroundColor: 'var(--md-sys-color-surface-container)' }}>
				<div className="mx-auto max-w-6xl">
					<div className="text-center mb-16">
						<h2
							className="mb-4"
							style={{
								fontFamily: 'var(--md-sys-typescale-headline-large-font)',
								fontSize: 'var(--md-sys-typescale-headline-large-size)',
								color: 'var(--md-sys-color-on-surface)',
							}}
						>
							Portfolio Management Features
						</h2>
						<p
							className="max-w-2xl mx-auto"
							style={{
								fontFamily: 'var(--md-sys-typescale-body-large-font)',
								fontSize: 'var(--md-sys-typescale-body-large-size)',
								color: 'var(--md-sys-color-on-surface-variant)',
							}}
						>
							Automated tools to optimize your DeFi investment strategy
						</p>
					</div>

					<div className="grid lg:grid-cols-2 gap-12 items-center">
						{}
						<div className="space-y-4">
							{features.map((feature, index) => (
								<M3Card
									key={index}
									variant={activeFeature === index ? 'filled' : 'elevated'}
									className={`p-6 transition-all duration-500 cursor-pointer ${
										activeFeature === index ? 'scale-105' : 'hover:scale-102'
									}`}
									onClick={() => setActiveFeature(index)}
								>
									<div className="flex items-start space-x-4">
										<div
											className="w-12 h-12 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center text-white flex-shrink-0"
										>
											{feature.icon}
										</div>
										<div className="flex-1">
											<h3
												className="mb-2"
												style={{
													fontFamily: 'var(--md-sys-typescale-title-large-font)',
													fontSize: 'var(--md-sys-typescale-title-large-size)',
													color: 'var(--md-sys-color-on-surface)',
												}}
											>
												{feature.title}
											</h3>
											<p
												style={{
													fontFamily: 'var(--md-sys-typescale-body-medium-font)',
													fontSize: 'var(--md-sys-typescale-body-medium-size)',
													color: 'var(--md-sys-color-on-surface-variant)',
												}}
											>
												{feature.description}
											</p>
										</div>
									</div>
								</M3Card>
							))}
						</div>

						{}
						<div className="relative">
							<M3Card variant="elevated" className="p-8">
								<div className="mb-6">
									<h3
										className="mb-4"
										style={{
											fontFamily: 'var(--md-sys-typescale-title-large-font)',
											fontSize: 'var(--md-sys-typescale-title-large-size)',
											color: 'var(--md-sys-color-on-surface)',
										}}
									>
										Platform Overview
									</h3>
									<div className="h-48 bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg flex items-center justify-center">
										<div className="text-center">
											<BarChart3 className="w-16 h-16 mx-auto mb-4 opacity-60" />
											<p className="text-sm opacity-60">Dashboard Preview</p>
										</div>
									</div>
								</div>

								<div className="grid grid-cols-2 gap-4">
									<div
										className="text-center p-4 rounded-lg"
										style={{ backgroundColor: 'var(--md-sys-color-surface-container-high)' }}
									>
										<div className="text-lg font-semibold" style={{ color: 'var(--md-sys-color-primary)' }}>Multi-Protocol</div>
										<div className="text-sm opacity-70">Support</div>
									</div>
									<div
										className="text-center p-4 rounded-lg"
										style={{ backgroundColor: 'var(--md-sys-color-surface-container-high)' }}
									>
										<div className="text-lg font-semibold" style={{ color: 'var(--md-sys-color-primary)' }}>Automated</div>
										<div className="text-sm opacity-70">Rebalancing</div>
									</div>
								</div>
							</M3Card>
						</div>
					</div>
				</div>
			</section>

			{}
			<section className="px-6 lg:px-8 py-20" style={{ backgroundColor: 'var(--md-sys-color-primary-container)' }}>
				<div className="mx-auto max-w-4xl text-center">
					<h2
						className="mb-6"
						style={{
							fontFamily: 'var(--md-sys-typescale-headline-large-font)',
							fontSize: 'var(--md-sys-typescale-headline-large-size)',
							color: 'var(--md-sys-color-on-primary-container)',
						}}
					>
						Ready to Optimize Your DeFi Strategy?
					</h2>
					<p
						className="mb-8 text-lg"
						style={{
							color: 'var(--md-sys-color-on-primary-container)',
							opacity: 0.8,
						}}
					>
						Connect your wallet to start building your automated DeFi portfolio
					</p>
					<div className="flex flex-col sm:flex-row gap-4 justify-center">
						<M3Button
							variant="filled"
							size="large"
							icon={<Wallet className="w-5 h-5" />}
							onClick={onConnectWallet}
							disabled={isConnecting}
							className="min-w-[250px] bg-white text-purple-600 hover:bg-gray-50"
						>
							Connect Wallet
						</M3Button>
						<a
							href="https://github.com/megalith7CC/rebalancr"
							target="_blank"
							rel="noopener noreferrer"
						>
							<M3Button variant="outlined" size="large" className="min-w-[250px] border-white text-white hover:bg-white/10">
								View Documentation
							</M3Button>
						</a>
					</div>
				</div>
			</section>

			{}
			<footer className="px-6 lg:px-8 py-12" style={{ backgroundColor: 'var(--md-sys-color-surface-container)' }}>
				<div className="mx-auto max-w-6xl">
					<div className="flex flex-col md:flex-row justify-between items-center">
						<div className="flex items-center space-x-3 mb-4 md:mb-0">
							<span className="font-semibold" style={{ color: 'var(--md-sys-color-on-surface)' }}>
								Rebalancr
							</span>
						</div>
						<div className="flex space-x-6 text-sm">
							<a
								href="https://github.com/megalith7CC/rebalancr"
								target="_blank"
								rel="noopener noreferrer"
								className="hover:opacity-80 transition-opacity"
								style={{ color: 'var(--md-sys-color-on-surface-variant)' }}
							>
								GitHub
							</a>
							<a
								href="https://github.com/megalith7CC/rebalancr/blob/main/README.md"
								target="_blank"
								rel="noopener noreferrer"
								className="hover:opacity-80 transition-opacity"
								style={{ color: 'var(--md-sys-color-on-surface-variant)' }}
							>
								Documentation
							</a>
						</div>
					</div>
					<div
						className="mt-8 pt-8 border-t text-center text-sm"
						style={{
							borderColor: 'var(--md-sys-color-outline-variant)',
							color: 'var(--md-sys-color-on-surface-variant)',
						}}
					>
						© 2025 Rebalancr. Open source DeFi portfolio management.
					</div>
				</div>
			</footer>
		</div>
	);
}
