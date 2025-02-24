import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import type { Market, MarketAnalysis, RelatedArticle, RedditPost } from '@/types/market';
import { API_CONFIG } from '@/lib/api-config';
import { RedditService } from '@/lib/services/reddit-service';
import { MarketService } from '@/lib/services/market-service';

// Augmenter la limite de temps à 60 secondes
export const maxDuration = 60;

// Configurer pour utiliser Edge Runtime avec des timeouts plus courts
export const runtime = 'edge';

const openai = new OpenAI({
  baseURL: API_CONFIG.AI_SERVICE.BASE_URL,
  apiKey: API_CONFIG.AI_SERVICE.API_KEY,
  defaultHeaders: {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  },
  dangerouslyAllowBrowser: true,
  timeout: 20000 // Réduire encore le timeout
});

// Log de la configuration (sans les clés API)
console.log('API Configuration:', {
  baseURL: API_CONFIG.AI_SERVICE.BASE_URL,
  hasApiKey: !!API_CONFIG.AI_SERVICE.API_KEY,
  timeout: 20000
});

interface Analysis {
  title: string;
  url: string;
  source: string;
  date: string;
  sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' | 'UNDECIDED';
  keyPoints: string[];
}

function extractSlugFromUrl(url: string): string | null {
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
}

// Ajouter un timeout pour les promesses
const withTimeout = (promise: Promise<any>, ms: number) => {
  const timeout = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Request timeout')), ms);
  });
  return Promise.race([promise, timeout]);
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log('Received request body:', body);

    if (!body.url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    const slug = extractSlugFromUrl(body.url);
    if (!slug) {
      return NextResponse.json(
        { error: 'Invalid Polymarket URL' },
        { status: 400 }
      );
    }

    console.log('Extracted slug:', slug);

    const marketService = MarketService.getInstance();
    console.log('Fetching market data...');
    const market = await withTimeout(marketService.getMarketBySlug(slug), 10000);
    console.log('Market data received:', market);

    // Récupérer les articles en parallèle avec les posts Reddit avec timeout
    console.log('Starting parallel fetches for articles and Reddit posts...');
    try {
      const [articles, redditPosts] = await Promise.all([
        withTimeout(fetchRelatedArticles(market).catch(error => {
          console.error('Error fetching articles:', error);
          return [];
        }), 20000),
        withTimeout(fetchRedditPosts(market).catch(error => {
          console.error('Error fetching Reddit posts:', error);
          return [];
        }), 20000)
      ]);

      console.log('Articles fetched:', articles.length);
      console.log('Reddit posts fetched:', redditPosts.length);
      console.log('Reddit posts:', JSON.stringify(redditPosts, null, 2));

      // Générer l'analyse
      console.log('Generating bullish/bearish analysis...');
      const bullishBearishAnalysis = await generateBullishBearishAnalysis(market, articles, redditPosts);
      console.log('Analysis generated');

      // Construire l'analyse complète
      const analysis: MarketAnalysis = {
        bullishArguments: bullishBearishAnalysis.bullishArguments,
        bearishArguments: bullishBearishAnalysis.bearishArguments,
        relatedArticles: articles,
        redditPosts: redditPosts,
        whatIfScenarios: bullishBearishAnalysis.whatIfScenarios,
        bullishBearishAnalysis: {
          bullishArguments: bullishBearishAnalysis.bullishArguments,
          bearishArguments: bullishBearishAnalysis.bearishArguments,
          confidence: bullishBearishAnalysis.confidence,
          lastUpdated: bullishBearishAnalysis.lastUpdated
        },
        socialMetrics: {
          tweetVolume: 0,
          overallSentiment: 0,
          keyInfluencers: [],
          sentimentOverTime: []
        }
      };

      console.log('Final analysis structure:', {
        hasRedditPosts: analysis.redditPosts && analysis.redditPosts.length > 0,
        redditPostsCount: analysis.redditPosts?.length || 0
      });

      console.log('Sending response with market and analysis');
      return NextResponse.json({
        market,
        analysis
      });
    } catch (error) {
      console.error('Error during parallel fetches:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error in analyze endpoint:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to analyze market' },
      { status: 500 }
    );
  }
}

async function fetchRelatedArticles(market: Market) {
  try {
    console.log('Making API call for articles with config:', {
      baseURL: API_CONFIG.AI_SERVICE.BASE_URL,
      hasApiKey: !!API_CONFIG.AI_SERVICE.API_KEY
    });
    const response = await openai.chat.completions.create({
      model: "sonar-pro",
      messages: [
        {
          role: "system",
          content: `Return a JSON array of 3 most relevant recent news articles. Format:
[{
  "title": "string",
  "url": "string",
  "source": "string",
  "publishDate": "YYYY-MM-DD",
  "relevanceScore": 0.0-1.0,
  "summary": "string",
  "marketImpact": "BULLISH/BEARISH/NEUTRAL"
}]`
        },
        {
          role: "user",
          content: `Find top 3 relevant articles for: "${market.title}"
Description: ${market.description}
Focus on last 30 days impact on market outcome.`
        }
      ],
      temperature: 0.1,
      max_tokens: 2000,
      response_format: { type: "json_object" }
    });

    console.log('API response received');
    const content = response.choices[0]?.message?.content;
    if (!content) {
      console.error('Empty response from API');
      return [];
    }

    try {
      // Nettoyer et parser la réponse
      const jsonContent = content.trim()
        .replace(/^[^[]*\[/, '[')  // Retirer tout ce qui précède le premier '['
        .replace(/][^]]*$/, ']');  // Retirer tout ce qui suit le dernier ']'

      const articles = JSON.parse(jsonContent);
      
      if (!Array.isArray(articles)) {
        console.error('Response is not an array:', articles);
        return [];
      }

      console.log('Successfully parsed articles:', articles.length);
      return articles;
    } catch (parseError) {
      console.error('Error parsing API response:', parseError);
      return [];
    }
  } catch (error) {
    console.error('Error fetching articles:', error);
    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        name: error.name,
        stack: error.stack
      });
    }
    return [];
  }
}

async function fetchRedditPosts(market: Market) {
  try {
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : 'http://localhost:3000';
    
    console.log('Fetching Reddit posts with base URL:', baseUrl);
    
    const response = await fetch(`${baseUrl}/api/reddit?query=${encodeURIComponent(market.title)}&limit=10`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch Reddit posts: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Reddit posts fetched:', data.posts);
    
    return data.posts || [];
  } catch (error) {
    console.error('Error fetching Reddit posts:', error);
    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        name: error.name,
        stack: error.stack
      });
    }
    return [];
  }
}

async function generateBullishBearishAnalysis(market: Market, articles: RelatedArticle[], redditPosts: RedditPost[]) {
  try {
    console.log('Generating AI analysis...');
    const response = await openai.chat.completions.create({
      model: "sonar-pro",
      messages: [
        {
          role: "system",
          content: `You are a prediction market analyst. Analyze the market data, articles, and Reddit posts to generate a detailed analysis.
Return ONLY a JSON object with this exact structure:
{
  "bullishArguments": ["Detailed argument based on specific evidence", "Another specific argument"],
  "bearishArguments": ["Detailed counter-argument based on specific evidence", "Another specific argument"],
  "confidence": "HIGH" | "MEDIUM" | "LOW",
  "whatIfScenarios": {
    "positiveScenario": {
      "title": "If YES wins...",
      "implications": ["Specific market implication", "Another specific implication"],
      "probability": 0.5
    },
    "negativeScenario": {
      "title": "If NO wins...",
      "implications": ["Specific market implication", "Another specific implication"],
      "probability": 0.5
    }
  }
}`
        },
        {
          role: "user",
          content: `Analyze this prediction market:
Title: ${market.title}
Description: ${market.description}
Current Probabilities: ${market.outcomes.map(o => `${o.title}: ${(o.probability * 100).toFixed(1)}%`).join(', ')}

Recent Articles:
${articles.map(a => `- ${a.title} (Impact: ${a.marketImpact}, Score: ${a.relevanceScore})
  Summary: ${a.summary}`).join('\n')}

Reddit Discussion:
${redditPosts.map(p => `- ${p.title} (${p.sentiment}, ${p.upvotes} upvotes)
  Key Points: ${p.keyComments}`).join('\n')}

Generate a detailed analysis focusing on specific evidence from the articles and Reddit posts.`
        }
      ],
      temperature: 0.1,
      max_tokens: 1000,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from AI');
    }

    console.log('Raw AI analysis:', content);
    const analysis = JSON.parse(content);

    // Valider la structure de la réponse
    if (!analysis.bullishArguments || !analysis.bearishArguments || !analysis.confidence || !analysis.whatIfScenarios) {
      throw new Error('Invalid AI response structure');
    }

    // Valider et corriger le niveau de confiance
    const validConfidence = analysis.confidence === 'HIGH' || analysis.confidence === 'MEDIUM' || analysis.confidence === 'LOW' 
      ? analysis.confidence 
      : 'MEDIUM';

    // Ajuster les probabilités des scénarios avec les données réelles du marché
    const yesOutcome = market.outcomes.find(o => o.title.toLowerCase() === 'yes') || market.outcomes[0];
    const noOutcome = market.outcomes.find(o => o.title.toLowerCase() === 'no') || market.outcomes[1];

    return {
      bullishArguments: analysis.bullishArguments,
      bearishArguments: analysis.bearishArguments,
      confidence: validConfidence as 'HIGH' | 'MEDIUM' | 'LOW',
      lastUpdated: new Date().toISOString(),
      whatIfScenarios: {
        positiveScenario: {
          title: `If ${yesOutcome.title} wins...`,
          implications: analysis.whatIfScenarios.positiveScenario.implications,
          probability: yesOutcome.probability
        },
        negativeScenario: {
          title: `If ${noOutcome.title} wins...`,
          implications: analysis.whatIfScenarios.negativeScenario.implications,
          probability: noOutcome.probability
        }
      }
    };
  } catch (error) {
    console.error('Error in AI analysis generation:', error);
    // Fallback à l'analyse basée sur les données disponibles
    const bullishArticles = articles.filter(a => a.marketImpact === 'BULLISH');
    const bearishArticles = articles.filter(a => a.marketImpact === 'BEARISH');
    const bullishPosts = redditPosts.filter(p => p.sentiment === 'BULLISH');
    const bearishPosts = redditPosts.filter(p => p.sentiment === 'BEARISH');

    const bullishArguments = [
      ...bullishArticles.map(a => `${a.title}: ${a.summary}`),
      ...bullishPosts.map(p => `Reddit discussion shows support: ${p.title}`)
    ];

    const bearishArguments = [
      ...bearishArticles.map(a => `${a.title}: ${a.summary}`),
      ...bearishPosts.map(p => `Reddit discussion raises concerns: ${p.title}`)
    ];

    if (bullishArguments.length === 0) {
      bullishArguments.push(
        `Market shows significant trading volume of $${market.volume.toLocaleString()}`,
        `Current probability suggests balanced sentiment`
      );
    }

    if (bearishArguments.length === 0) {
      bearishArguments.push(
        `Market uncertainty reflected in trading patterns`,
        `Current market conditions indicate mixed views`
      );
    }

    const confidence: 'HIGH' | 'MEDIUM' | 'LOW' = articles.length > 2 ? 'HIGH' : articles.length > 0 ? 'MEDIUM' : 'LOW';
    const yesOutcome = market.outcomes.find(o => o.title.toLowerCase() === 'yes') || market.outcomes[0];
    const noOutcome = market.outcomes.find(o => o.title.toLowerCase() === 'no') || market.outcomes[1];

    return {
      bullishArguments: bullishArguments.slice(0, 3),
      bearishArguments: bearishArguments.slice(0, 3),
      confidence,
      lastUpdated: new Date().toISOString(),
      whatIfScenarios: {
        positiveScenario: {
          title: `If ${yesOutcome.title} wins...`,
          implications: [
            `Market confidence in ${yesOutcome.title} outcome will be validated`,
            `Trading volume of $${yesOutcome.volume.toLocaleString()} indicates strong interest`
          ],
          probability: yesOutcome.probability
        },
        negativeScenario: {
          title: `If ${noOutcome.title} wins...`,
          implications: [
            `Market sentiment for ${noOutcome.title} outcome will be confirmed`,
            `Current liquidity of $${market.liquidity.toLocaleString()} shows significant market participation`
          ],
          probability: noOutcome.probability
        }
      }
    };
  }
}
