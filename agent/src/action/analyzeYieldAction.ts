import { type Action, type IAgentRuntime, type Memory, type State, type HandlerCallback } from '@elizaos/core';


const analyzeYieldAction: Action = {
	name: 'ANALYZE_YIELD',
	description: 'Analyze yield opportunities across DeFi protocols and recommend optimal strategies',

	similes: [
		'evaluate yield opportunities',
		'compare protocol returns',
		'find best yield strategies',
		'assess DeFi yields',
		'optimize yield allocation',
	],

	examples: [
		[
			{
				name: 'user',
				content: {
					text: 'Can you analyze the current yield opportunities?',
				},
			},
		],
		[
			{
				name: 'user',
				content: {
					text: "What's the best yield strategy for a conservative investor right now?",
				},
			},
		],
		[
			{
				name: 'user',
				content: {
					text: 'Compare yields between Aave and Compound for stablecoins',
				},
			},
		],
	],

	async validate(runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean> {
		const text = message.content.text?.toLowerCase() || '';

		const yieldKeywords = [
			'yield',
			'apy',
			'interest',
			'returns',
			'earning',
			'staking',
			'lending',
			'supplying',
			'liquidity',
			'farming',
			'rewards',
		];

		const analysisKeywords = [
			'analyze',
			'compare',
			'evaluate',
			'assess',
			'recommend',
			'suggest',
			'best',
			'optimal',
			'highest',
			'strategy',
			'opportunity',
			'options',
		];

		const hasYieldKeyword = yieldKeywords.some((keyword) => text.includes(keyword));
		const hasAnalysisKeyword = analysisKeywords.some((keyword) => text.includes(keyword));

		return hasYieldKeyword && hasAnalysisKeyword;
	},

	async handler(
		runtime: IAgentRuntime,
		message: Memory,
		state?: State,
		options?: Record<string, unknown>,
		callback?: HandlerCallback,
	): Promise<void> {
		if (!state) {
			console.error('State is required for ANALYZE_YIELD action');
			return;
		}

		try {
			const marketData = state.data.marketData;
			const strategyData = state.data.strategy;

			if (!marketData?.available || !strategyData?.available) {
				const errorMessage = {
					text: "I'm unable to analyze yield opportunities at the moment due to missing market or strategy data. Please try again later.",
					thought: 'Missing required market data or strategy information to perform yield analysis.',
				};

				if (callback) {
					await callback({ ...errorMessage });
				}
				return;
			}

			let riskTolerance = 'moderate';
			const text = message.content.text?.toLowerCase() || '';

			if (text.includes('conservative') || text.includes('safe') || text.includes('low risk')) {
				riskTolerance = 'conservative';
			} else if (text.includes('aggressive') || text.includes('high risk') || text.includes('risky')) {
				riskTolerance = 'aggressive';
			}

			const protocols = marketData.protocols || [];

			const strategies = strategyData.strategies || [];

			// Filter and sort protocols based on risk tolerance
			let filteredProtocols = [...protocols];
			let filteredStrategies = [...strategies];

			if (riskTolerance === 'conservative') {
				filteredProtocols = protocols.filter((p) => p.risk < 0.4);
				filteredStrategies = strategies.filter((s) => s.riskScore < 0.4);
			} else if (riskTolerance === 'aggressive') {
				filteredProtocols = protocols.filter((p) => p.risk >= 0.6);
				filteredStrategies = strategies.filter((s) => s.riskScore >= 0.6);
			} else {
				  
				filteredProtocols = protocols.filter((p) => p.risk >= 0.3 && p.risk <= 0.7);
				filteredStrategies = strategies.filter((s) => s.riskScore >= 0.3 && s.riskScore <= 0.7);
			}

			// Sort by APY
			filteredProtocols.sort((a, b) => parseFloat(b.apy) - parseFloat(a.apy));
			filteredStrategies.sort((a, b) => parseFloat(b.currentApy) - parseFloat(a.currentApy));

			// Generate protocol comparison table
			const protocolComparison =
				filteredProtocols.length > 0
					? filteredProtocols
							.map((p) => `| ${p.name} | ${p.apy} | ${p.risk.toFixed(2)} | $${parseFloat(p.tvl).toLocaleString()} |`)
							.join('\n')
					: 'No protocols match the selected risk profile.';

			// Generate strategy comparison table
			const strategyComparison =
				filteredStrategies.length > 0
					? filteredStrategies
							.map((s) => `| ${s.name} | ${s.currentApy} | ${s.riskScore.toFixed(2)} | $${parseFloat(s.tvl).toLocaleString()} |`)
							.join('\n')
					: 'No strategies match the selected risk profile.';

			// Generate recommendations based on risk tolerance
			const topProtocol = filteredProtocols.length > 0 ? filteredProtocols[0] : null;
			const topStrategy = filteredStrategies.length > 0 ? filteredStrategies[0] : null;

			let recommendations = '';

			if (topProtocol && topStrategy) {
				if (parseFloat(topProtocol.apy) > parseFloat(topStrategy.currentApy)) {
					recommendations = `Based on your ${riskTolerance} risk profile, I recommend the ${topProtocol.name} protocol with ${topProtocol.apy} APY and a risk score of ${topProtocol.risk.toFixed(2)}.`;
				} else {
					recommendations = `Based on your ${riskTolerance} risk profile, I recommend the ${topStrategy.name} strategy with ${topStrategy.currentApy} APY and a risk score of ${topStrategy.riskScore.toFixed(2)}.`;
				}
			} else if (topProtocol) {
				recommendations = `Based on your ${riskTolerance} risk profile, I recommend the ${topProtocol.name} protocol with ${topProtocol.apy} APY and a risk score of ${topProtocol.risk.toFixed(2)}.`;
			} else if (topStrategy) {
				recommendations = `Based on your ${riskTolerance} risk profile, I recommend the ${topStrategy.name} strategy with ${topStrategy.currentApy} APY and a risk score of ${topStrategy.riskScore.toFixed(2)}.`;
			} else {
				recommendations = `No suitable protocols or strategies found for your ${riskTolerance} risk profile. Consider adjusting your risk tolerance.`;
			}

			// Consider market conditions in recommendations
			const marketSentiment = marketData.summary?.sentiment || 'neutral';
			const volatilityIndex = marketData.summary?.volatilityIndex || 0.5;

			let marketAdvice = '';
			if (marketSentiment === 'bearish' && volatilityIndex > 0.7) {
				marketAdvice =
					'Given the current bearish market sentiment and high volatility, consider allocating more to stablecoin strategies for capital preservation.';
			} else if (marketSentiment === 'bullish' && volatilityIndex < 0.3) {
				marketAdvice =
					'With bullish market sentiment and low volatility, this may be a good time to increase allocation to higher-yield strategies.';
			} else if (volatilityIndex > 0.6) {
				marketAdvice = 'Due to elevated market volatility, consider diversifying across multiple yield sources to reduce risk.';
			}

			// Prepare the response using the yieldAnalysis template
			const analysisResponse = {
				text: `# Yield Analysis Report

## Current Market Overview
Market sentiment is currently ${marketSentiment} with a volatility index of ${volatilityIndex.toFixed(2)}.
${marketData.summary ? `Last updated: ${marketData.summary.timestamp}` : ''}

## Protocol Comparison
| Protocol | APY | Risk Score | TVL |
|----------|-----|------------|-----|
${protocolComparison}

## Strategy Comparison
| Strategy | Current APY | Risk Score | TVL |
|----------|------------|------------|-----|
${strategyComparison}

## Risk Assessment
Risk profile: ${riskTolerance.toUpperCase()}
${marketAdvice}

## Recommended Actions
${recommendations}

## Additional Considerations
- Past performance does not guarantee future results
- Market conditions can change rapidly
- Consider your investment timeframe and liquidity needs
`,
				thought: `Analyzing yield opportunities for ${riskTolerance} risk profile. Market sentiment is ${marketSentiment} with ${volatilityIndex.toFixed(2)} volatility index. Found ${filteredProtocols.length} matching protocols and ${filteredStrategies.length} matching strategies.`,
			};

			if (callback) {
				await callback(analysisResponse);
			}
		} catch (error) {
			console.error('Error in ANALYZE_YIELD action:', error);

			const errorMessage = {
				text: 'I encountered an error while analyzing yield opportunities. Please try again later.',
				thought: `Error in yield analysis: ${error.message}`,
			};

			if (callback) {
				await callback(errorMessage);
			}
		}
	},
};

export default analyzeYieldAction;
