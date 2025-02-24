import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import type { Market, MarketAnalysis, RelatedArticle, RedditPost } from '@/types/market';
import { API_CONFIG } from '@/lib/api-config';
import { RedditService } from '@/lib/services/reddit-service';
import { MarketService } from '@/lib/services/market-service';

const openai = new OpenAI({
  baseURL: API_CONFIG.AI_SERVICE.BASE_URL,
  apiKey: API_CONFIG.AI_SERVICE.API_KEY,
  defaultHeaders: {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  },
  dangerouslyAllowBrowser: true,
  timeout: 60000
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
    const market = await marketService.getMarketBySlug(slug);
    console.log('Market data received:', market);

    // Récupérer les articles en parallèle avec les posts Reddit
    console.log('Starting parallel fetches for articles and Reddit posts...');
    try {
      const [articles, redditPosts] = await Promise.all([
        fetchRelatedArticles(market).catch(error => {
          console.error('Error fetching articles:', error);
          return [];
        }),
        fetchRedditPosts(market).catch(error => {
          console.error('Error fetching Reddit posts:', error);
          return [];
        })
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
    console.log('Making API call for articles...');
    const response = await openai.chat.completions.create({
      model: "sonar-pro",
      messages: [
        {
          role: "system",
          content: `You are a news search and analysis expert. Find and analyze recent news articles related to this prediction market question. Return your findings as a JSON array of articles.

Format each article as:
{
  "title": "Article title",
  "url": "Full URL",
  "source": "Publication name",
  "publishDate": "YYYY-MM-DD",
  "relevanceScore": 0.0-1.0,
  "summary": "2-3 sentence summary",
  "marketImpact": "BULLISH/BEARISH/NEUTRAL"
}`
        },
        {
          role: "user",
          content: `Find relevant articles for this market:
"${market.title}"

Description: ${market.description}
Resolution: ${market.resolutionSource || 'Not specified'}
Outcomes: ${market.outcomes.map(o => o.title).join(', ')}

Focus on articles from the last 30 days that could impact the market outcome.`
        }
      ],
      temperature: 0.1,
      max_tokens: 2000
    });

    console.log('API response received');
    const content = response.choices[0]?.message?.content;
    if (!content) {
      console.error('Empty response from API');
      return [];
    }

    console.log('Response content:', content);

    try {
      // Essayer de trouver le début du JSON dans la réponse
      const jsonStart = content.indexOf('[');
      const jsonEnd = content.lastIndexOf(']') + 1;
      if (jsonStart === -1 || jsonEnd === 0) {
        console.error('No JSON array found in response');
        return [];
      }
      
      const jsonContent = content.substring(jsonStart, jsonEnd);
      const articles = JSON.parse(jsonContent);
      
      if (!Array.isArray(articles)) {
        console.error('Invalid articles format received:', articles);
        return [];
      }

      // Filtrer les articles non pertinents avec des seuils adaptés au type de marché
      const relevanceThreshold = market.title.toLowerCase().includes('oscar') || 
        market.title.toLowerCase().includes('award') ||
        market.title.toLowerCase().includes('emmy') ||
        market.title.toLowerCase().includes('grammy') ? 0.5 : 0.6;
      const filteredArticles = articles.filter(article => 
        article.relevanceScore >= relevanceThreshold && // Score de pertinence minimum
        new Date(article.publishDate) >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 derniers jours
      );

      // Trier les articles par pertinence et date
      const sortedArticles = filteredArticles.sort((a, b) => {
        // Ajuster les poids en fonction du type de marché
        const recencyWeight = market.title.toLowerCase().includes('oscar') || 
          market.title.toLowerCase().includes('award') ||
          market.title.toLowerCase().includes('emmy') ||
          market.title.toLowerCase().includes('grammy') ? 0.4 : 0.3;
        const relevanceWeight = 1 - recencyWeight;

        const aScore = a.relevanceScore * relevanceWeight + 
          (1 - (Date.now() - new Date(a.publishDate).getTime()) / (30 * 24 * 60 * 60 * 1000)) * recencyWeight;
        const bScore = b.relevanceScore * relevanceWeight + 
          (1 - (Date.now() - new Date(b.publishDate).getTime()) / (30 * 24 * 60 * 60 * 1000)) * recencyWeight;
        return bScore - aScore;
      });

      // Limiter à 5 articles les plus pertinents
      return sortedArticles.slice(0, 5);
    } catch (parseError) {
      console.error('Error parsing API response:', {
        error: parseError,
        content: content
      });
      return [];
    }
  } catch (error) {
    console.error('Error fetching articles:', error);
    return [];
  }
}

async function fetchRedditPosts(market: Market) {
  try {
    // Déterminer si c'est un marché binaire (YES/NO) ou à choix multiples
    const isBinaryMarket = market.outcomes.length === 2 && 
      market.outcomes.every(o => ['YES', 'NO', 'yes', 'no'].includes(o.title.toLowerCase()));

    // Détecter si c'est un marché d'awards/récompenses
    const isAwardsMarket = market.title.toLowerCase().includes('oscar') || 
      market.title.toLowerCase().includes('award') ||
      market.title.toLowerCase().includes('emmy') ||
      market.title.toLowerCase().includes('grammy');

    if (isBinaryMarket) {
      // Logique originale pour les marchés binaires
      const redditService = RedditService.getInstance();
      const searchQuery = market.title;
      const posts = await redditService.searchPosts(searchQuery, 10);

      // Analyser le sentiment et la pertinence des posts
      const analyzedPosts = await Promise.all(posts.map(async (post) => {
        try {
          const response = await openai.chat.completions.create({
            model: "sonar-pro",
            messages: [
              {
                role: "system",
                content: `Analyze this Reddit post's sentiment regarding the prediction market question: "${market.title}".
                Return ONLY a JSON object with this structure:
                {
                  "sentiment": "BULLISH" | "BEARISH" | "NEUTRAL",
                  "relevance": "HIGH" | "MEDIUM" | "LOW",
                  "keyPoints": "Brief summary of main points"
                }
                
                When analyzing sentiment:
                - BULLISH: Post suggests positive outcome or increased probability
                - BEARISH: Post suggests negative outcome or decreased probability
                - NEUTRAL: Post has balanced or unclear sentiment`
              },
              {
                role: "user",
                content: `Post Title: ${post.title}\nSubreddit: ${post.subreddit}`
              }
            ],
            temperature: 0.3,
            max_tokens: 150,
            response_format: { type: "json_object" }
          });

          const analysis = JSON.parse(response.choices[0]?.message?.content || '{}');
          
          return {
            ...post,
            sentiment: analysis.sentiment || 'NEUTRAL',
            keyComments: analysis.keyPoints || ''
          };
        } catch (error) {
          console.error('Error analyzing Reddit post:', error);
          return post;
        }
      }));

      // Filtrer et trier les posts par pertinence et upvotes
      return analyzedPosts
        .sort((a, b) => b.upvotes - a.upvotes)
        .slice(0, 5);
    } else {
      // Logique améliorée pour les marchés non binaires
      // Utiliser l'IA pour générer une stratégie de recherche adaptée
      const searchStrategyResponse = await openai.chat.completions.create({
        model: "sonar-pro",
        messages: [
          {
            role: "system",
            content: `You are a search expert specializing in prediction markets. Generate a focused search strategy.
            
            For awards markets (Oscars, etc):
            - Use the exact award category and year in keywords
            - Include all nominees/candidates in search queries
            
            Return ONLY a JSON object with this structure:
            {
              "keywords": ["specific search terms combining year + category + nominees"],
              "subreddits": ["relevant subreddit names without 'r/' prefix - up to 5"],
              "searchQueries": ["2-3 search queries using keywords and outcomes"],
              "outcomes": ${JSON.stringify(market.outcomes.map(o => o.title))},
              "relevantTopics": ["directly related events/topics"]
            }`
          },
          {
            role: "user",
            content: `Generate a focused search strategy for this market:
            Title: ${market.title}
            Description: ${market.description}
            Type: Multiple Choice
            Outcomes: ${market.outcomes.map(o => o.title).join(', ')}
            
            ${isAwardsMarket ? 'This is an awards prediction - focus on the specific category, year, and nominees.' : ''}`
          }
        ],
        temperature: 0.3,
        max_tokens: 1000,
        response_format: { type: "json_object" }
      });

      const searchStrategy = JSON.parse(searchStrategyResponse.choices[0]?.message?.content || '{}');
      console.log('Generated search strategy:', searchStrategy);

      const redditService = RedditService.getInstance();
      let allPosts: RedditPost[] = [];

      // Rechercher dans les subreddits spécifiques
      for (const subreddit of searchStrategy.subreddits || []) {
        for (const query of searchStrategy.searchQueries || []) {
          const subredditPosts = await redditService.searchPosts(
            `subreddit:${subreddit} ${query}`,
            5
          );
          allPosts = [...allPosts, ...subredditPosts];
        }
      }

      // Recherche générale avec les requêtes optimisées
      for (const query of searchStrategy.searchQueries || []) {
        const generalPosts = await redditService.searchPosts(query, 5);
        allPosts = [...allPosts, ...generalPosts];
      }

      // Dédupliquer les posts par URL
      const uniquePosts = Array.from(
        new Map(allPosts.map(post => [post.url, post])).values()
      );

      // Analyser la pertinence et le contenu des posts
      const analyzedPosts = await Promise.all(uniquePosts.map(async (post) => {
        try {
          const response = await openai.chat.completions.create({
            model: "sonar-pro",
            messages: [
              {
                role: "system",
                content: `Analyze this Reddit post's relevance to the prediction market.
                Possible outcomes: ${market.outcomes.map(o => o.title).join(', ')}
                
                Return ONLY a JSON object with this structure:
                {
                  "favoredOutcome": "string (must be one of: ${market.outcomes.map(o => o.title).join(', ')} or UNDECIDED)",
                  "confidence": "HIGH" | "MEDIUM" | "LOW",
                  "keyPoints": "Brief summary of main points"
                }`
              },
              {
                role: "user",
                content: `Market: ${market.title}
                Reddit Post Title: ${post.title}
                Subreddit: ${post.subreddit}`
              }
            ],
            temperature: 0.3,
            max_tokens: 150,
            response_format: { type: "json_object" }
          });

          const analysis = JSON.parse(response.choices[0]?.message?.content || '{}');
          
          return {
            ...post,
            sentiment: analysis.favoredOutcome || 'UNDECIDED',
            keyComments: analysis.keyPoints || ''
          };
        } catch (error) {
          console.error('Error analyzing Reddit post:', error);
          return post;
        }
      }));

      // Trier par nombre d'upvotes et limiter à 5 posts
      return analyzedPosts
        .sort((a, b) => b.upvotes - a.upvotes)
        .slice(0, 5);
    }
  } catch (error) {
    console.error('Error fetching Reddit posts:', error);
    return [];
  }
}

async function generateBullishBearishAnalysis(market: Market, articles: RelatedArticle[], redditPosts: RedditPost[]) {
  try {
    console.log('Generating bullish/bearish analysis and what-if scenarios...');
    const response = await openai.chat.completions.create({
      model: "sonar-pro",
      messages: [
        {
          role: "system",
          content: `You are a prediction market analyst. Analyze the market data, articles, and social discussions to provide:
1. Balanced arguments for both YES and NO outcomes
2. What-if scenarios exploring the implications of each outcome

Focus on concrete facts and evidence. Each argument should be clear, concise, and directly related to the market resolution conditions.

Return ONLY a JSON object with this structure (no other text):
{
  "bullishArguments": ["argument 1", "argument 2", "argument 3"],
  "bearishArguments": ["argument 1", "argument 2", "argument 3"],
  "confidence": "HIGH",
  "whatIfScenarios": {
    "positiveScenario": {
      "title": "If YES wins...",
      "implications": ["implication 1", "implication 2", "implication 3"],
      "probability": 0.7
    },
    "negativeScenario": {
      "title": "If NO wins...",
      "implications": ["implication 1", "implication 2", "implication 3"],
      "probability": 0.3
    }
  }
}`
        },
        {
          role: "user",
          content: `Analyze this market data and provide balanced YES/NO arguments and what-if scenarios:

Market Question: ${market.title}
Description: ${market.description}
End Date: ${new Date(market.endDate).toLocaleDateString()}

Related Articles:
${articles.map(a => `- ${a.title} (${a.source}) - Impact: ${a.marketImpact}`).join('\n')}

Reddit Discussions:
${redditPosts.map(p => `- ${p.title} (r/${p.subreddit}) - Sentiment: ${p.sentiment}`).join('\n')}

Provide:
1. 3-5 strong arguments for each side, focusing on factual evidence
2. Detailed implications for each scenario
Do not consider current market probabilities in your analysis.`
        }
      ],
      temperature: 0.3,
      max_tokens: 1500
    });

    const analysis = JSON.parse(response.choices[0]?.message?.content || '{}');
    
    // Ensure all required fields are present with default values if missing
    const result = {
      bullishArguments: analysis.bullishArguments || [
        "Recent developments support a YES outcome",
        "Historical data suggests favorable conditions",
        "Key indicators point to positive resolution"
      ],
      bearishArguments: analysis.bearishArguments || [
        "Some uncertainty remains in the market",
        "Potential challenges could affect the outcome",
        "Counter-indicators suggest caution"
      ],
      confidence: analysis.confidence || 'MEDIUM',
      lastUpdated: new Date().toISOString(),
      whatIfScenarios: {
        positiveScenario: {
          title: analysis.whatIfScenarios?.positiveScenario?.title || "If YES wins...",
          implications: analysis.whatIfScenarios?.positiveScenario?.implications || [
            "Market confidence will increase",
            "Trading volume likely to surge",
            "Similar markets may see increased activity"
          ],
          probability: 0.5
        },
        negativeScenario: {
          title: analysis.whatIfScenarios?.negativeScenario?.title || "If NO wins...",
          implications: analysis.whatIfScenarios?.negativeScenario?.implications || [
            "Market uncertainty may rise",
            "Trading volume could decrease",
            "Related markets might experience volatility"
          ],
          probability: 0.5
        }
      }
    };

    return result;
  } catch (error) {
    console.error('Error generating analysis:', error);
    return {
      bullishArguments: [
        "Recent developments support a YES outcome",
        "Historical data suggests favorable conditions",
        "Key indicators point to positive resolution"
      ],
      bearishArguments: [
        "Some uncertainty remains in the market",
        "Potential challenges could affect the outcome",
        "Counter-indicators suggest caution"
      ],
      confidence: 'MEDIUM',
      lastUpdated: new Date().toISOString(),
      whatIfScenarios: {
        positiveScenario: {
          title: "If YES wins...",
          implications: [
            "Market confidence will increase",
            "Trading volume likely to surge",
            "Similar markets may see increased activity"
          ],
          probability: 0.5
        },
        negativeScenario: {
          title: "If NO wins...",
          implications: [
            "Market uncertainty may rise",
            "Trading volume could decrease",
            "Related markets might experience volatility"
          ],
          probability: 0.5
        }
      }
    };
  }
} 