'use client';

import { useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { BackgroundPaths } from '@/components/ui/background-paths';
import type { Market, MarketAnalysis, Outcome } from '@/types/market';

const extractSlugFromUrl = (url: string): string | null => {
  try {
    const urlObj = new URL(url);
    const pathSegments = urlObj.pathname.split('/');
    const eventIndex = pathSegments.indexOf('event');
    if (eventIndex === -1 || eventIndex === pathSegments.length - 1) {
      return null;
    }
    return pathSegments[eventIndex + 1].split('?')[0];
  } catch (error) {
    console.error('Error extracting slug:', error);
    return null;
  }
};

const useLoadingSteps = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const steps = ['market', 'articles', 'social', 'insights'];

  const showStep = (stepIndex: number) => {
    if (stepIndex > 0) {
      // Marquer l'étape précédente comme terminée
      const prevSpinner = document.getElementById(`step${stepIndex}-spinner`);
      const prevCheck = document.getElementById(`step${stepIndex}-check`);
      if (prevSpinner) prevSpinner.style.opacity = '0';
      if (prevCheck) prevCheck.style.opacity = '1';
    }
    
    // Afficher l'étape actuelle
    const currentStepEl = document.getElementById(`step${stepIndex + 1}`);
    if (currentStepEl) {
      currentStepEl.style.opacity = '1';
      // Afficher le spinner de l'étape actuelle
      const currentSpinner = document.getElementById(`step${stepIndex + 1}-spinner`);
      if (currentSpinner) currentSpinner.style.opacity = '1';
    }
    
    setCurrentStep(stepIndex);
  };

  const completeAllSteps = () => {
    // Marquer la dernière étape comme terminée
    const lastSpinner = document.getElementById(`step4-spinner`);
    const lastCheck = document.getElementById(`step4-check`);
    if (lastSpinner) lastSpinner.style.opacity = '0';
    if (lastCheck) lastCheck.style.opacity = '1';
  };

  return { showStep, completeAllSteps };
};

export default function Home() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<MarketAnalysis | null>(null);
  const [market, setMarket] = useState<Market | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { showStep, completeAllSteps } = useLoadingSteps();

  const handleAnalyze = async () => {
    try {
      setError(null);
      const slug = extractSlugFromUrl(url);
      
      if (!slug) {
        setError('Please enter a valid Polymarket URL');
        return;
      }

      setLoading(true);
      showStep(0); // Fetching market data

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });

      // Attendre la réponse avant de passer à l'étape suivante
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze market');
      }

      if (data.error) {
        throw new Error(data.error);
      }

      if (!data.market || !data.analysis) {
        throw new Error('Invalid response format from server');
      }

      // Une fois les données reçues, simuler le temps de traitement pour chaque étape
      await new Promise(resolve => setTimeout(resolve, 2000)); // Fetching market data
      showStep(1); // Searching articles
      
      await new Promise(resolve => setTimeout(resolve, 3000)); // Searching articles
      showStep(2); // Analyzing sentiment
      
      await new Promise(resolve => setTimeout(resolve, 3000)); // Analyzing sentiment
      showStep(3); // Generating insights
      
      await new Promise(resolve => setTimeout(resolve, 2500)); // Generating insights
      completeAllSteps();

      await new Promise(resolve => setTimeout(resolve, 1000)); // Pause finale

      setAnalysis(data.analysis);
      setMarket(data.market);
    } catch (error) {
      console.error('Error during analysis:', error);
      setError(error instanceof Error ? error.message : 'An error occurred');
      setAnalysis(null);
      setMarket(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen bg-black text-white">
      <BackgroundPaths />
      <Navbar />
      
      {!loading && !analysis && (
        <div className="min-h-screen relative z-20 flex items-center justify-center">
          <div className="container mx-auto px-4 sm:px-6">
            <div className="flex items-center justify-center">
              <div className="relative w-full max-w-4xl mx-auto">
                <div className="relative px-4 sm:px-8 py-12 text-center space-y-8 sm:space-y-12">
                  <div className="space-y-4">
                    <h1 className="text-5xl sm:text-5xl md:text-6xl font-normal tracking-tight">
                      <span className="bg-gradient-to-r from-gray-100 to-gray-400 text-transparent bg-clip-text">Predict. React.</span>
                      <br />
                      <span className="bg-gradient-to-r from-gray-300 to-gray-500 text-transparent bg-clip-text">Dominate.</span>
                    </h1>
                    <p className="text-gray-400 text-lg sm:text-lg md:text-xl font-light tracking-wide max-w-2xl mx-auto">
                      AI-powered analysis reveals market trends before they happen. Gain the edge with real-time insights from social sentiment and news signals.
                    </p>
                  </div>
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row gap-4">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          value={url}
                          onChange={(e) => setUrl(e.target.value)}
                          placeholder="Enter Polymarket URL..."
                          className="w-full bg-white/10 backdrop-blur-sm border-2 border-white/30 rounded-2xl px-6 py-4 focus:outline-none focus:border-white/50 transition-colors text-xl tracking-wide text-white"
                        />
                        <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
                          <svg className="w-6 h-6 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                        </div>
                      </div>
                      <button
                        onClick={handleAnalyze}
                        disabled={!url}
                        className="relative group overflow-hidden rounded-2xl px-8 py-4 disabled:opacity-50 w-full sm:w-auto"
                      >
                        <span className="absolute inset-0 bg-gradient-to-r from-gray-200 to-gray-400 transition-transform duration-300 group-hover:scale-105"></span>
                        <span className="relative text-gray-900 text-xl font-bold tracking-wider">
                          Analyze
                        </span>
                      </button>
                    </div>
                    {error && (
                      <div className="text-red-500 text-lg">{error}</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="h-[calc(100vh-64px)] relative z-20 flex flex-col items-center justify-center -mt-32">
          <div className="max-w-2xl w-full space-y-6 p-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 flex items-center justify-center">
                  <div className="w-8 h-8 rounded-full border-t-4 border-b-4 border-white [animation:spin_2s_linear_infinite] transition-opacity duration-300" id="step1-spinner"></div>
                  <svg className="w-8 h-8 text-white absolute opacity-0 transition-opacity duration-300" id="step1-check" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-xl text-white/70">Fetching market data...</span>
              </div>
            </div>

            <div className="flex items-center justify-between opacity-0 transition-opacity duration-300" id="step2">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 flex items-center justify-center">
                  <div className="w-8 h-8 rounded-full border-t-4 border-b-4 border-white [animation:spin_2s_linear_infinite] transition-opacity duration-300" id="step2-spinner"></div>
                  <svg className="w-8 h-8 text-white absolute opacity-0 transition-opacity duration-300" id="step2-check" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-xl text-white/70">Searching relevant articles...</span>
              </div>
            </div>

            <div className="flex items-center justify-between opacity-0 transition-opacity duration-300" id="step3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 flex items-center justify-center">
                  <div className="w-8 h-8 rounded-full border-t-4 border-b-4 border-white [animation:spin_2s_linear_infinite] transition-opacity duration-300" id="step3-spinner"></div>
                  <svg className="w-8 h-8 text-white absolute opacity-0 transition-opacity duration-300" id="step3-check" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-xl text-white/70">Analyzing social sentiment...</span>
              </div>
            </div>

            <div className="flex items-center justify-between opacity-0 transition-opacity duration-300" id="step4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 flex items-center justify-center">
                  <div className="w-8 h-8 rounded-full border-t-4 border-b-4 border-white [animation:spin_2s_linear_infinite] transition-opacity duration-300" id="step4-spinner"></div>
                  <svg className="w-8 h-8 text-white absolute opacity-0 transition-opacity duration-300" id="step4-check" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-xl text-white/70">Generating market insights...</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {analysis && (
        <div className="relative z-20 pt-24 pb-12">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto space-y-8">
              {/* Market Header */}
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 shadow-lg">
                <div className="flex items-start gap-6">
                  {market?.imageUrl && (
                    <img 
                      src={market.imageUrl} 
                      alt={market.title} 
                      className="w-24 h-24 rounded-xl object-cover bg-white/5"
                    />
                  )}
                  <div className="flex-1">
                    <h1 className="text-3xl font-bold mb-3 text-white">{market?.title}</h1>
                    <p className="text-white/70 text-lg mb-6 whitespace-pre-wrap">{market?.description}</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-white/5 rounded-lg p-3">
                        <div className="text-white/50 text-sm">Volume</div>
                        <div className="text-white font-bold">${market?.volume?.toLocaleString()}</div>
                      </div>
                      <div className="bg-white/5 rounded-lg p-3">
                        <div className="text-white/50 text-sm">Liquidity</div>
                        <div className="text-white font-bold">${market?.liquidity?.toLocaleString()}</div>
                      </div>
                      <div className="bg-white/5 rounded-lg p-3">
                        <div className="text-white/50 text-sm">End Date</div>
                        <div className="text-white font-bold">{new Date(market?.endDate || '').toLocaleDateString()}</div>
                      </div>
                    </div>
                    {market?.resolutionSource && (
                      <div className="mt-6">
                        <div className="text-white/50 text-sm">Resolution Source</div>
                        <a 
                          href={market.resolutionSource} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          {market.resolutionSource}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Related Articles */}
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 shadow-lg">
                <h2 className="text-4xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70 tracking-wider">Related Articles</h2>
                <div className="space-y-4">
                  {analysis.relatedArticles.map((article, i) => (
                    <a
                      key={i}
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-6 transition-colors"
                    >
                      <h3 className="text-xl font-bold text-white mb-2">{article.title}</h3>
                      <p className="text-white/60 text-base mb-3">{article.summary}</p>
                      <div className="flex flex-wrap items-center gap-4 text-sm">
                        <span className="text-white/40">{article.source}</span>
                        <span className="text-white/40">{new Date(article.publishDate).toLocaleDateString()}</span>
                        <span className="text-white/90">Relevance: {article.relevanceScore.toFixed(2)}</span>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          article.marketImpact === 'BULLISH' ? 'bg-green-500/20 text-green-300' :
                          article.marketImpact === 'BEARISH' ? 'bg-red-500/20 text-red-300' :
                          'bg-blue-500/20 text-blue-300'
                        }`}>
                          {article.marketImpact}
                        </span>
                      </div>
                    </a>
                  ))}
                </div>
              </div>

              {/* Reddit Posts */}
              {analysis.redditPosts && analysis.redditPosts.length > 0 && (
                <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 shadow-lg">
                  <h2 className="text-4xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70 tracking-wider">Reddit Discussions</h2>
                  <div className="space-y-4">
                    {analysis.redditPosts.map((post, i) => (
                      <a
                        key={i}
                        href={post.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-6 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <h3 className="text-xl font-bold text-white flex-1">{post.title}</h3>
                          {post.sentiment && (
                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                              post.sentiment === 'BULLISH' ? 'bg-green-500/20 text-green-300' :
                              post.sentiment === 'BEARISH' ? 'bg-red-500/20 text-red-300' :
                              'bg-gray-500/20 text-gray-300'
                            }`}>
                              {post.sentiment}
                            </span>
                          )}
                        </div>
                        {post.keyComments && (
                          <p className="text-white/60 text-base mt-2 mb-3">{post.keyComments}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-4 mt-3 text-sm">
                          <span className="text-orange-400">r/{post.subreddit}</span>
                          <span className="text-white/40">{new Date(post.date).toLocaleDateString()}</span>
                          <span className="text-white/90">
                            <svg className="w-4 h-4 inline-block mr-1" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
                            </svg>
                            {post.upvotes.toLocaleString()}
                          </span>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Bullish/Bearish Analysis */}
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 shadow-lg">
                <h2 className="text-4xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70 tracking-wider">Analysis</h2>
                <div className="grid md:grid-cols-2 gap-8">
                  {/* Bullish Arguments */}
                  <div>
                    <h3 className="text-2xl font-bold mb-4 text-green-400">Bullish Arguments</h3>
                    <ul className="space-y-3">
                      {analysis.bullishBearishAnalysis.bullishArguments.map((arg, i) => (
                        <li key={i} className="flex items-start gap-3 text-white/70">
                          <span className="text-green-400 mt-1">•</span>
                          <span>{arg}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {/* Bearish Arguments */}
                  <div>
                    <h3 className="text-2xl font-bold mb-4 text-red-400">Bearish Arguments</h3>
                    <ul className="space-y-3">
                      {analysis.bullishBearishAnalysis.bearishArguments.map((arg, i) => (
                        <li key={i} className="flex items-start gap-3 text-white/70">
                          <span className="text-red-400 mt-1">•</span>
                          <span>{arg}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className="mt-6 flex items-center gap-3">
                  <span className="text-white/50">Confidence:</span>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    analysis.bullishBearishAnalysis.confidence === 'HIGH' ? 'bg-green-500/20 text-green-300' :
                    analysis.bullishBearishAnalysis.confidence === 'LOW' ? 'bg-red-500/20 text-red-300' :
                    'bg-yellow-500/20 text-yellow-300'
                  }`}>
                    {analysis.bullishBearishAnalysis.confidence}
                  </span>
                </div>
              </div>

              {/* What If Scenarios */}
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 shadow-lg">
                <h2 className="text-4xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70 tracking-wider">What If Scenarios</h2>
                <div className="grid md:grid-cols-2 gap-8">
                  {/* Positive Scenario */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-2xl font-bold text-green-400">{analysis.whatIfScenarios.positiveScenario.title}</h3>
                      <span className="px-3 py-1 rounded-full text-sm font-medium bg-green-500/20 text-green-300">
                        {(analysis.whatIfScenarios.positiveScenario.probability * 100).toFixed(0)}%
                      </span>
                    </div>
                    <ul className="space-y-3">
                      {analysis.whatIfScenarios.positiveScenario.implications.map((implication, i) => (
                        <li key={i} className="flex items-start gap-3 text-white/70">
                          <span className="text-green-400 mt-1">→</span>
                          <span>{implication}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {/* Negative Scenario */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-2xl font-bold text-red-400">{analysis.whatIfScenarios.negativeScenario.title}</h3>
                      <span className="px-3 py-1 rounded-full text-sm font-medium bg-red-500/20 text-red-300">
                        {(analysis.whatIfScenarios.negativeScenario.probability * 100).toFixed(0)}%
                      </span>
                    </div>
                    <ul className="space-y-3">
                      {analysis.whatIfScenarios.negativeScenario.implications.map((implication, i) => (
                        <li key={i} className="flex items-start gap-3 text-white/70">
                          <span className="text-red-400 mt-1">→</span>
                          <span>{implication}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
} 