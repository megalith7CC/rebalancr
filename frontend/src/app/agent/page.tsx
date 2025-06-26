'use client';

import { useState, useRef, useEffect } from 'react';
import { M3Card, M3Button, M3TextField } from '@/components/ui/M3Components';

interface YieldStrategy {
	id: string;
	name: string;
	description: string;
	apy: number;
	protocol: string;
	risk: 'LOW' | 'MEDIUM' | 'HIGH';
}

interface AgentMessage {
	id: string;
	text: string;
	sender: 'user' | 'agent';
	role?: 'agent' | 'user';
	timestamp: number;
	content?: {
		text: string;
		analyzed?: {
			recommendations?: any[];
		};
	};
}

export default function AgentPage() {
	const [message, setMessage] = useState('');
	const [userAddress, setUserAddress] = useState<string>('');

	const messagesEndRef = useRef<HTMLDivElement>(null);
	const messages: any[] = [];
	const loading = false;
	const sendMessage = () => {};
	const analyzeYield = () => {};
	const [strategies, setStrategies] = useState<YieldStrategy[]>([]);

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
	}, [messages]);

	const handleSendMessage = async () => {
		if (!message.trim()) return;

		setMessage('');
	};

	const handleAnalyzeYield = async () => {
		try {
		} catch (error) {
			console.error('Error analyzing yield:', error);
		}
	};

	return (
		<div className="container mx-auto px-4 py-8">
			<h1 className="text-3xl font-bold mb-6 text-slate-900 dark:text-white">Yield Agent</h1>

			<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
				{}
				<div className="lg:col-span-2">
					<M3Card variant="outlined" className="flex flex-col h-[600px]">
						<div className="p-4 border-b border-slate-200 dark:border-slate-700">
							<h2 className="text-xl font-semibold text-slate-900 dark:text-white">Chat with Yield Agent</h2>
							<p className="text-sm text-slate-500">Ask about strategies, market data, or recommendations</p>
						</div>

						<div className="flex-1 overflow-y-auto p-4 space-y-4">
							{messages.length === 0 ? (
								<div className="h-full flex items-center justify-center">
									<p className="text-slate-500 dark:text-slate-400">No messages yet. Start a conversation with the yield agent!</p>
								</div>
							) : (
								messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
							)}
							<div ref={messagesEndRef} />
						</div>

						<div className="p-4 border-t border-slate-200 dark:border-slate-700">
							<div className="flex gap-2">
								<M3TextField
									value={message}
									onChange={(e) => setMessage(e.target.value)}
									onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
									placeholder="Ask something about DeFi strategies..."
									className="flex-1"
								/>
								<M3Button variant="filled" onClick={handleSendMessage} disabled={loading || !message.trim()}>
									Send
								</M3Button>
							</div>
						</div>
					</M3Card>
				</div>

				{}
				<div>
					<M3Card variant="outlined" className="mb-6 p-4">
						<h2 className="text-xl font-semibold mb-4 text-slate-900 dark:text-white">Quick Actions</h2>
						<div className="space-y-3">
							<M3Button variant="filled" onClick={handleAnalyzeYield} fullWidth>
								Analyze Yield Opportunities
							</M3Button>
							<M3Button variant="outlined" fullWidth>
								Check Position Health
							</M3Button>
							<M3Button variant="outlined" fullWidth>
								Recommend Rebalance
							</M3Button>
						</div>
					</M3Card>

					{strategies.length > 0 && (
						<M3Card variant="outlined" className="p-4">
							<h2 className="text-xl font-semibold mb-4 text-slate-900 dark:text-white">Recommended Strategies</h2>
							<div className="space-y-4">
								{strategies.map((strategy) => (
									<StrategyCard key={strategy.id} strategy={strategy} />
								))}
							</div>
						</M3Card>
					)}
				</div>
			</div>
		</div>
	);
}

function MessageBubble({ message }: { message: AgentMessage }) {
  const isAgent = message.role === 'agent';
  
  return (
		<div className={`flex ${isAgent ? 'justify-start' : 'justify-end'}`}>
			<div
				className={`max-w-[80%] rounded-lg p-3 ${
					isAgent
						? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white'
						: 'bg-primary-100 dark:bg-primary-900 text-primary-900 dark:text-primary-100'
				}`}
			>
				<div className="whitespace-pre-wrap">{message.content?.text || message.text}</div>

				{}
				{isAgent && message.content?.analyzed && (
					<div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-600">
						{message.content.analyzed.recommendations && (
							<div className="text-sm font-medium text-primary-600 dark:text-primary-400">
								{message.content.analyzed.recommendations.length} recommendation(s) available
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
}

function StrategyCard({ strategy }: { strategy: YieldStrategy }) {
  const riskColors = {
    LOW: 'text-green-500',
    MEDIUM: 'text-yellow-500',
    HIGH: 'text-red-500',
  };
  
  return (
    <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg">
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-semibold text-slate-900 dark:text-white">{strategy.name}</h3>
        <span className="text-primary-600 dark:text-primary-400 font-bold">
          {strategy.apy}% APY
        </span>
      </div>
      
      <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">
        {strategy.description}
      </p>
      
      <div className="flex justify-between text-sm">
        <span className="text-slate-500 dark:text-slate-400">
          {strategy.protocol}
        </span>
        <span className={`font-medium ${riskColors[strategy.risk]}`}>
          {strategy.risk} Risk
        </span>
      </div>
      
      <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
        <M3Button variant="filled" size="small" fullWidth>
          Invest
        </M3Button>
      </div>
    </div>
  );
} 