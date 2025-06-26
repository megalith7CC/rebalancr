'use client';

import { useState, useEffect } from 'react';
import { M3Card, M3Button, M3TextField } from '@/components/ui/M3Components';
import { DashboardNavigation } from '@/components/DashboardNavigation';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save } from 'lucide-react';

export default function SettingsPage() {
	const router = useRouter();
	const [settings, setSettings] = useState({
		autoRebalance: true,
		rebalanceThreshold: '5', 
		maxSlippage: '1', 
		riskTolerance: 'moderate',

		emailNotifications: true,
		rebalanceAlerts: true,
		priceAlerts: false,

		gasOptimization: true,
		emergencyStopLoss: false,
		stopLossThreshold: '10', 
	});
	const [saving, setSaving] = useState(false);
	const [saveMessage, setSaveMessage] = useState<string | null>(null);

	useEffect(() => {
		const savedSettings = localStorage.getItem('rebalancr-settings');
		if (savedSettings) {
			try {
				setSettings(JSON.parse(savedSettings));
			} catch (error) {
				console.warn('Failed to load saved settings:', error);
			}
		}
	}, []);

	const handleSave = async () => {
		setSaving(true);
		setSaveMessage(null);

		try {
			localStorage.setItem('rebalancr-settings', JSON.stringify(settings));
			setSaveMessage('Settings saved successfully!');
		} catch (error) {
			console.error('Error saving settings:', error);
			setSaveMessage('Failed to save settings. Please try again.');
		} finally {
			setSaving(false);
			setTimeout(() => setSaveMessage(null), 3000);
		}
	};

	const updateSetting = (key: string, value: any) => {
		setSettings((prev) => ({ ...prev, [key]: value }));
	};

	return (
		<div className="container mx-auto px-4 py-8">
			<DashboardNavigation />

			<div className="flex items-center mb-6">
				<button onClick={() => router.back()} className="mr-4 p-2 rounded-full hover:bg-black/5" aria-label="Go back">
					<ArrowLeft className="w-5 h-5" />
				</button>
				<h1 className="text-3xl font-bold text-slate-900 dark:text-white">Settings</h1>
			</div>

			<div className="max-w-4xl space-y-6">
				{}
				<M3Card variant="elevated" className="p-6">
					<h2 className="text-xl font-semibold mb-4 text-slate-900 dark:text-white">Portfolio Settings</h2>

					<div className="space-y-4">
						<div className="flex items-center justify-between">
							<div>
								<label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Auto-Rebalance</label>
								<p className="text-sm text-slate-500 dark:text-slate-400">
									Automatically rebalance portfolio when allocations drift
								</p>
							</div>
							<input
								type="checkbox"
								checked={settings.autoRebalance}
								onChange={(e) => updateSetting('autoRebalance', e.target.checked)}
								className="toggle toggle-primary"
							/>
						</div>

						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div>
								<label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Rebalance Threshold (%)</label>
								<M3TextField
									type="number"
									value={settings.rebalanceThreshold}
									onChange={(e) => updateSetting('rebalanceThreshold', e.target.value)}
									placeholder="5"
									min="1"
									max="50"
								/>
							</div>

							<div>
								<label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Max Slippage (%)</label>
								<M3TextField
									type="number"
									value={settings.maxSlippage}
									onChange={(e) => updateSetting('maxSlippage', e.target.value)}
									placeholder="1"
									min="0.1"
									max="10"
									step="0.1"
								/>
							</div>
						</div>

						<div>
							<label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Risk Tolerance</label>
							<div className="flex space-x-4">
								{['conservative', 'moderate', 'aggressive'].map((risk) => (
									<label key={risk} className="flex items-center space-x-2 cursor-pointer">
										<input
											type="radio"
											name="riskTolerance"
											value={risk}
											checked={settings.riskTolerance === risk}
											onChange={() => updateSetting('riskTolerance', risk)}
											className="accent-primary"
										/>
										<span className="text-sm text-slate-700 dark:text-slate-300 capitalize">{risk}</span>
									</label>
								))}
							</div>
						</div>
					</div>
				</M3Card>

				{}
				<M3Card variant="elevated" className="p-6">
					<h2 className="text-xl font-semibold mb-4 text-slate-900 dark:text-white">Notification Settings</h2>

					<div className="space-y-4">
						<div className="flex items-center justify-between">
							<div>
								<label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Email Notifications</label>
								<p className="text-sm text-slate-500 dark:text-slate-400">Receive important updates via email</p>
							</div>
							<input
								type="checkbox"
								checked={settings.emailNotifications}
								onChange={(e) => updateSetting('emailNotifications', e.target.checked)}
								className="toggle toggle-primary"
							/>
						</div>

						<div className="flex items-center justify-between">
							<div>
								<label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Rebalance Alerts</label>
								<p className="text-sm text-slate-500 dark:text-slate-400">Get notified when portfolio is rebalanced</p>
							</div>
							<input
								type="checkbox"
								checked={settings.rebalanceAlerts}
								onChange={(e) => updateSetting('rebalanceAlerts', e.target.checked)}
								className="toggle toggle-primary"
							/>
						</div>

						<div className="flex items-center justify-between">
							<div>
								<label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Price Alerts</label>
								<p className="text-sm text-slate-500 dark:text-slate-400">Alert when asset prices change significantly</p>
							</div>
							<input
								type="checkbox"
								checked={settings.priceAlerts}
								onChange={(e) => updateSetting('priceAlerts', e.target.checked)}
								className="toggle toggle-primary"
							/>
						</div>
					</div>
				</M3Card>

				{}
				<M3Card variant="elevated" className="p-6">
					<h2 className="text-xl font-semibold mb-4 text-slate-900 dark:text-white">Advanced Settings</h2>

					<div className="space-y-4">
						<div className="flex items-center justify-between">
							<div>
								<label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Gas Optimization</label>
								<p className="text-sm text-slate-500 dark:text-slate-400">Wait for lower gas prices when possible</p>
							</div>
							<input
								type="checkbox"
								checked={settings.gasOptimization}
								onChange={(e) => updateSetting('gasOptimization', e.target.checked)}
								className="toggle toggle-primary"
							/>
						</div>

						<div className="flex items-center justify-between">
							<div>
								<label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Emergency Stop-Loss</label>
								<p className="text-sm text-slate-500 dark:text-slate-400">
									Automatically exit positions during extreme market conditions
								</p>
								{}
							</div>
							<input
								type="checkbox"
								checked={settings.emergencyStopLoss}
								onChange={(e) => updateSetting('emergencyStopLoss', e.target.checked)}
								className="toggle toggle-primary"
							/>
						</div>

						{settings.emergencyStopLoss && (
							<div>
								<label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Stop-Loss Threshold (%)</label>
								<M3TextField
									type="number"
									value={settings.stopLossThreshold}
									onChange={(e) => updateSetting('stopLossThreshold', e.target.value)}
									placeholder="10"
									min="5"
									max="50"
								/>
							</div>
						)}
					</div>
				</M3Card>

				{}
				{
}

				{}
				<div className="space-y-4">
					{saveMessage && (
						<div
							className={`p-3 rounded-lg text-center ${
								saveMessage.includes('Failed')
									? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
									: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'
							}`}
						>
							{saveMessage}
						</div>
					)}
					<div className="flex justify-end">
						<M3Button variant="filled" size="large" onClick={handleSave} disabled={saving} icon={<Save className="w-4 h-4" />}>
							{saving ? 'Saving...' : 'Save Settings'}
						</M3Button>
					</div>
				</div>
			</div>
		</div>
	);
}
