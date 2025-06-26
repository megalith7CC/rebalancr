import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AppProvider } from '@/context/AppContext';
import { Web3Provider } from '../providers/Web3Provider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
	title: 'Rebalancr - DeFi Strategy Agent',
	description: 'AI-powered DeFi yield strategy management platform',
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {

	console.log("Using projectId:", process.env.PROJECT_ID);

	return (
		<html lang="en">
			<body className={inter.className}>
				<Web3Provider>
					<AppProvider>
						<div className="flex flex-col min-h-screen">
							<main className="flex-1 bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
								{children}
							</main>
						</div>
					</AppProvider>
				</Web3Provider>
			</body>
		</html>
	);
}
