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
    console.log('Making API call for articles...');
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
          content: `You are a JSON generator. Return ONLY a JSON object with this exact structure, no other text:
{
  "bullishArguments": ["string", "string"],
  "bearishArguments": ["string", "string"],
  "confidence": "HIGH" | "MEDIUM" | "LOW",
  "whatIfScenarios": {
    "positiveScenario": {
      "title": "string",
      "implications": ["string"],
      "probability": number
    },
    "negativeScenario": {
      "title": "string",
      "implications": ["string"],
      "probability": number
    }
  }
}`
        },
        {
          role: "user",
          content: `Analyze this market and return a JSON object:
Title: ${market.title}
Description: ${market.description}
Articles: ${articles.map(a => a.title).join(', ')}
Reddit: ${redditPosts.map(p => p.title).join(', ')}`
        }
      ],
      temperature: 0.1, // Réduire la température pour plus de cohérence
      max_tokens: 1000,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from API');
    }

    console.log('Raw analysis response:', content);

    // Essayer de trouver et parser le JSON même s'il y a du texte autour
    let jsonContent = content;
    const jsonStart = content.indexOf('{');
    const jsonEnd = content.lastIndexOf('}') + 1;
    
    if (jsonStart !== -1 && jsonEnd > jsonStart) {
      jsonContent = content.substring(jsonStart, jsonEnd);
    }

    try {
      const analysis = JSON.parse(jsonContent);
      
      // Valider la structure
      if (!analysis.bullishArguments || !analysis.bearishArguments) {
        throw new Error('Invalid analysis structure');
      }

      return {
        bullishArguments: analysis.bullishArguments,
        bearishArguments: analysis.bearishArguments,
        confidence: analysis.confidence || 'MEDIUM',
        lastUpdated: new Date().toISOString(),
        whatIfScenarios: analysis.whatIfScenarios || {
          positiveScenario: {
            title: "If YES wins...",
            implications: ["Market confidence will increase"],
            probability: 0.5
          },
          negativeScenario: {
            title: "If NO wins...",
            implications: ["Market uncertainty may rise"],
            probability: 0.5
          }
        }
      };
    } catch (parseError) {
      console.error('Error parsing analysis:', parseError, 'Content:', jsonContent);
      throw new Error('Failed to parse analysis response');
    }
  } catch (error) {
    console.error('Error generating analysis:', error);
    // Retourner une analyse par défaut en cas d'erreur
    return {
      bullishArguments: ["Recent developments support a YES outcome"],
      bearishArguments: ["Some uncertainty remains in the market"],
      confidence: 'MEDIUM',
      lastUpdated: new Date().toISOString(),
      whatIfScenarios: {
        positiveScenario: {
          title: "If YES wins...",
          implications: ["Market confidence will increase"],
          probability: 0.5
        },
        negativeScenario: {
          title: "If NO wins...",
          implications: ["Market uncertainty may rise"],
          probability: 0.5
        }
      }
    };
  }
}
