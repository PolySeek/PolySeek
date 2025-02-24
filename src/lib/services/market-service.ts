import axios from 'axios';
import { API_CONFIG } from '../api-config';
import type { Market, MarketAnalysis, RelatedArticle } from '@/types/market';
import { OpenAI } from 'openai';
import { RedditService } from './reddit-service';
import { ERROR_MESSAGES } from '@/lib/api-config';

export class MarketService {
  private static instance: MarketService;
  private openai: OpenAI;

  private constructor() {
    this.openai = new OpenAI({
      baseURL: API_CONFIG.AI_SERVICE.BASE_URL,
      apiKey: API_CONFIG.AI_SERVICE.API_KEY,
      timeout: 60000,
      dangerouslyAllowBrowser: true,
      defaultHeaders: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
  }

  static getInstance(): MarketService {
    if (!MarketService.instance) {
      MarketService.instance = new MarketService();
    }
    return MarketService.instance;
  }

  async getMarketBySlug(slug: string): Promise<Market> {
    try {
      console.log('Fetching market data for slug:', slug);
      const response = await axios.get(
        `${API_CONFIG.POLYMARKET.BASE_URL}${API_CONFIG.POLYMARKET.ENDPOINTS.EVENTS}`,
        {
          params: { slug },
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
        }
      );

      // Si la réponse est un tableau, prenons le premier élément
      const marketData = Array.isArray(response.data) ? response.data[0] : response.data;

      if (!marketData) {
        throw new Error(ERROR_MESSAGES.MARKET_NOT_FOUND);
      }

      if (!this.isValidMarketData(marketData)) {
        if (marketData.markets && marketData.markets.length > 1) {
          throw new Error(ERROR_MESSAGES.MULTIPLE_OUTCOMES);
        }
        throw new Error('Invalid market data received');
      }

      return this.transformMarketData(marketData);
    } catch (error) {
      console.error('Error fetching market data:', error);
      throw error;
    }
  }

  private isValidMarketData(data: any): boolean {
    // Vérifier si le marché a des outcomes multiples
    if (data.markets && data.markets.length > 1) {
      console.log('Market rejected: multiple outcomes detected');
      return false;
    }

    return (
      data &&
      typeof data === 'object' &&
      typeof data.title === 'string' &&
      typeof data.description === 'string' &&
      typeof data.id === 'string'
    );
  }

  private async getSonarAnalysis(market: Market): Promise<{
    articles: any[],
    socialMetrics: any
  }> {
    try {
      console.log('Starting analysis for market:', market.title);
      
      // Appel à notre API pour les articles uniquement
      console.log('Making API call for articles...');
      const articlesResponse = await axios.post('/api/analyze', {
        market,
        type: 'articles'
      });

      console.log('Articles API call successful');
      const articlesContent = articlesResponse.data.content || '';

      console.log('Parsing responses...');
      const parsedArticles = this.parseArticlesResponse(articlesContent);

      console.log('Analysis complete. Found:', {
        articlesCount: parsedArticles.length
      });

      // Retourner des métriques sociales par défaut pour l'instant
      return {
        articles: parsedArticles,
        socialMetrics: {
          tweetVolume: 0,
          overallSentiment: 0.5,
          keyInfluencers: [],
          sentimentOverTime: [],
          redditPosts: [],
          keyDiscussionPoints: []
        }
      };
    } catch (error: any) {
      console.error('Detailed error in getSonarAnalysis:', {
        name: error.name,
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      
      return {
        articles: [],
        socialMetrics: {
          tweetVolume: 0,
          overallSentiment: 0.5,
          keyInfluencers: [],
          sentimentOverTime: [],
          redditPosts: [],
          keyDiscussionPoints: []
        }
      };
    }
  }

  private parseArticlesResponse(content: string): any[] {
    try {
      const articles = [];
      const articleBlocks = content.split(/\d+\.\s+/).filter(block => block.trim());

      for (const block of articleBlocks) {
        const titleMatch = block.match(/Title:\s*(.+)/);
        const urlMatch = block.match(/URL:\s*(.+)/);
        const sourceMatch = block.match(/Source:\s*(.+)/);
        const dateMatch = block.match(/Date:\s*(.+)/);
        const relevanceMatch = block.match(/Relevance:\s*(.+)/);

        if (titleMatch && urlMatch && sourceMatch && dateMatch && relevanceMatch) {
          articles.push({
            title: titleMatch[1].trim(),
            url: urlMatch[1].trim(),
            source: sourceMatch[1].trim(),
            publishDate: dateMatch[1].trim(),
            relevanceScore: parseFloat(relevanceMatch[1])
          });
        }
      }

      return articles;
    } catch (error) {
      console.error('Error parsing articles response:', error);
      return [];
    }
  }

  private parseRedditResponse(content: string): any {
    try {
      // Extraire les posts Reddit
      const redditPosts = [];
      const postsSection = content.split('Reddit Posts:')[1]?.split('Overall Analysis:')[0] || '';
      const postBlocks = postsSection.split(/\d+\./).filter(block => block.trim());
      
      for (const block of postBlocks) {
        const lines = block.split('\n').map(line => line.trim());
        const post = {
          subreddit: lines.find(l => l.startsWith('Subreddit:'))?.split('Subreddit:')[1]?.trim() || '',
          title: lines.find(l => l.startsWith('Title:'))?.split('Title:')[1]?.trim() || '',
          url: lines.find(l => l.startsWith('URL:'))?.split('URL:')[1]?.trim() || '',
          date: lines.find(l => l.startsWith('Date:'))?.split('Date:')[1]?.trim() || '',
          upvotes: parseInt(lines.find(l => l.startsWith('Upvotes:'))?.split('Upvotes:')[1]?.trim() || '0'),
          keyComments: lines.find(l => l.startsWith('Key Comments:'))?.split('Key Comments:')[1]?.trim() || '',
          sentiment: lines.find(l => l.startsWith('Sentiment:'))?.split('Sentiment:')[1]?.trim() || 'NEUTRAL'
        };
        redditPosts.push(post);
      }

      // Extraire l'analyse globale
      const overallSection = content.split('Overall Analysis:')[1]?.split('Sentiment Timeline:')[0] || '';
      const totalPosts = parseInt(overallSection.match(/Total Relevant Posts:\s*(\d+)/)?.[1] || '0');
      const avgSentiment = parseFloat(overallSection.match(/Average Sentiment:\s*([\d.]+)/)?.[1] || '0.5');
      const activeSubreddits = overallSection
        .match(/Most Active Subreddits:\s*([^\n]+)/)?.[1]
        ?.split(',')
        .map(s => s.trim()) || [];

      // Extraire les points de discussion clés
      const keyPoints = overallSection
        .split('Key Discussion Points:')[1]
        ?.split('\n')
        .filter(line => line.trim().startsWith('*'))
        .map(point => point.replace(/^\s*\*\s*/, '').trim()) || [];
      
      // Extraire la timeline du sentiment
      const timelineSection = content.split('Sentiment Timeline:')[1] || '';
      const timelinePoints = timelineSection
        .split('\n')
        .filter(line => line.trim().startsWith('-'))
        .map(line => {
          const [date, sentiment, activity] = line.match(/\[(.*?)\]/g)?.map(m => m.slice(1, -1)) || [];
          return {
            timestamp: date,
            sentiment: parseFloat(sentiment),
            volume: activity === 'HIGH' ? 1000 : activity === 'MEDIUM' ? 500 : 100
          };
        });

      return {
        tweetVolume: totalPosts * 100, // Estimation du volume basée sur le nombre de posts
        overallSentiment: avgSentiment,
        keyInfluencers: activeSubreddits,
        sentimentOverTime: timelinePoints,
        redditPosts,
        keyDiscussionPoints: keyPoints
      };
    } catch (error) {
      console.error('Error parsing Reddit response:', error);
      return null;
    }
  }

  async analyzeMarket(market: Market): Promise<MarketAnalysis> {
    try {
      console.log('\n🔍 Starting market analysis...');
      console.log('📊 Market data:', {
        title: market.title,
        probability: `${(market.probability * 100).toFixed(1)}%`,
        volume: `$${market.volume.toLocaleString()}`,
        liquidity: `$${market.liquidity.toLocaleString()}`,
        endDate: new Date(market.endDate).toLocaleDateString(),
        outcomes: market.outcomes.map(o => `${o.title}: ${(o.probability * 100).toFixed(1)}%`)
      });

      // 1. Générer des mots-clés pertinents avec l'IA
      console.log('\n🔍 Generating search keywords...');
      const keywordsResponse = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `You are a search expert. Generate relevant search keywords for finding Reddit discussions about this prediction market.
Return ONLY a JSON array of keywords, no other text. Example: ["keyword1", "keyword2"]`
          },
          {
            role: 'user',
            content: `Generate search keywords for this market:
Title: ${market.title}
Description: ${market.description}
Outcomes: ${market.outcomes.map(o => o.title).join(', ')}`
          }
        ],
        temperature: 0.3,
        max_tokens: 100,
        response_format: { type: "json_object" }
      });

      const keywords = JSON.parse(keywordsResponse.choices[0]?.message?.content || '[]');
      console.log('Generated keywords:', keywords);

      // 2. Chercher les posts Reddit avec ces mots-clés
      console.log('\n🔍 Searching Reddit posts...');
      const redditService = RedditService.getInstance();
      const searchQuery = keywords.join(' ');
      const redditPosts = await redditService.searchPosts(searchQuery, 5);
      console.log('Found Reddit posts:', redditPosts.length);

      // 3. Analyser le sentiment des posts avec l'IA
      console.log('\n🤖 Analyzing Reddit posts sentiment...');
      const analyzedPosts = await Promise.all(redditPosts.map(async (post) => {
        try {
          const response = await this.openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
              {
                role: "system",
                content: `Analyze this Reddit post's sentiment regarding the prediction market question: "${market.title}".
Return ONLY a JSON object with this structure:
{
  "sentiment": "BULLISH" | "BEARISH" | "NEUTRAL",
  "keyPoints": "Brief summary of main points"
}`
              },
              {
                role: "user",
                content: `Post Title: ${post.title}
Subreddit: ${post.subreddit}
Content: ${post.keyComments}`
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
            keyComments: analysis.keyPoints || post.keyComments
          };
        } catch (error) {
          console.error('Error analyzing Reddit post:', error);
          return post;
        }
      }));

      // 4. Obtenir l'analyse générale du marché
      console.log('\n🤖 Getting market analysis...');
      const analysisResponse = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `You are a market analyst specialized in prediction markets. Analyze the given market data and provide insights in the following format:

Market Context: [Brief overview of the market situation]

Bullish Arguments:
- [Point 1]
- [Point 2]
- [Point 3]

Bearish Arguments:
- [Point 1]
- [Point 2]
- [Point 3]

What If Scenarios:

Positive Scenario (60%):
- [Implication 1]
- [Implication 2]
- [Implication 3]

Negative Scenario (40%):
- [Implication 1]
- [Implication 2]
- [Implication 3]`
          },
          {
            role: 'user',
            content: `Please analyze this prediction market:
Title: ${market.title}
Description: ${market.description}
Current probability: ${(market.probability * 100).toFixed(1)}%
Volume: $${market.volume.toLocaleString()}
Liquidity: $${market.liquidity.toLocaleString()}
End Date: ${new Date(market.endDate).toLocaleDateString()}
Outcomes: ${market.outcomes.map(o => `${o.title}: ${(o.probability * 100).toFixed(1)}%`).join(', ')}

Reddit Sentiment:
${analyzedPosts.map(post => `- ${post.title} (${post.sentiment})`).join('\n')}`
          }
        ],
        temperature: 0.7,
        max_tokens: 1500
      });

      console.log('\n✅ Received response from Zuki API');
      if (!analysisResponse.choices[0]?.message?.content) {
        throw new Error('Empty response from API');
      }

      console.log('\n📝 AI Response:');
      console.log('---START OF RESPONSE---');
      console.log(analysisResponse.choices[0].message.content);
      console.log('---END OF RESPONSE---');

      // 5. Parser la réponse et inclure les vrais posts Reddit
      console.log('\n🔄 Parsing AI response...');
      const analysis = this.parseAIResponse(analysisResponse.choices[0].message.content, market);
      analysis.redditPosts = analyzedPosts;
      
      console.log('\n📊 Analysis Results:', {
        bullishArgs: analysis.bullishArguments.length,
        bearishArgs: analysis.bearishArguments.length,
        articles: analysis.relatedArticles.length,
        redditPosts: analysis.redditPosts.length,
        whatIf: {
          positive: analysis.whatIfScenarios.positiveScenario.implications.length,
          negative: analysis.whatIfScenarios.negativeScenario.implications.length
        }
      });

      return analysis;
    } catch (error) {
      console.error('\n❌ Error analyzing market:', error);
      console.log('⚠️ Using default analysis as fallback...');
      return this.getDefaultAnalysis(market);
    }
  }

  private parseAIResponse(aiResponse: string, market: Market): MarketAnalysis {
    try {
      console.log('\n🔍 Starting to parse AI response');
      
      const analysis: MarketAnalysis = {
        bullishArguments: [],
        bearishArguments: [],
        relatedArticles: [],
        redditPosts: [],
        whatIfScenarios: {
          positiveScenario: {
            title: "Positive Scenario",
            implications: [],
            probability: 0.6
          },
          negativeScenario: {
            title: "Negative Scenario",
            implications: [],
            probability: 0.4
          }
        },
        bullishBearishAnalysis: {
          bullishArguments: [],
          bearishArguments: [],
          confidence: "MEDIUM",
          lastUpdated: new Date().toISOString()
        },
        socialMetrics: {
          tweetVolume: 0,
          overallSentiment: market.outcomes[0].probability > 0.5 ? 0.65 : 0.45,
          keyInfluencers: [],
          sentimentOverTime: []
        }
      };

      console.log('📑 Splitting response into sections...');
      console.log('Raw AI Response:', aiResponse);
      
      // Extraire les arguments bullish
      const bullishMatch = aiResponse.match(/Bullish Arguments:([\s\S]*?)(?=Bearish Arguments:|$)/);
      if (bullishMatch) {
        const bullishArgs = bullishMatch[1]
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.startsWith('-') || line.startsWith('1.') || line.startsWith('2.') || line.startsWith('3.'))
          .map(line => line.replace(/^-\s*|^\d+\.\s*/, '').trim())
          .filter(line => line.length > 0);
        
        analysis.bullishArguments = bullishArgs;
        analysis.bullishBearishAnalysis.bullishArguments = bullishArgs;
        console.log('✅ Parsed bullish arguments:', bullishArgs.length);
      }

      // Extraire les arguments bearish
      const bearishMatch = aiResponse.match(/Bearish Arguments:([\s\S]*?)(?=What If Scenarios:|$)/);
      if (bearishMatch) {
        const bearishArgs = bearishMatch[1]
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.startsWith('-') || line.startsWith('1.') || line.startsWith('2.') || line.startsWith('3.'))
          .map(line => line.replace(/^-\s*|^\d+\.\s*/, '').trim())
          .filter(line => line.length > 0);
        
        analysis.bearishArguments = bearishArgs;
        analysis.bullishBearishAnalysis.bearishArguments = bearishArgs;
        console.log('✅ Parsed bearish arguments:', bearishArgs.length);
      }

      // Extraire les scénarios What If
      const whatIfMatch = aiResponse.match(/What If Scenarios:([\s\S]*?)(?=Reddit Discussion:|$)/);
      if (whatIfMatch) {
        // Extraire le scénario positif
        const positiveMatch = whatIfMatch[1].match(/Positive Scenario[^:]*:([\s\S]*?)(?=Negative Scenario|$)/);
        if (positiveMatch) {
          const implications = positiveMatch[1]
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.startsWith('-'))
            .map(line => line.substring(1).trim())
            .filter(line => line.length > 0);
          
          analysis.whatIfScenarios.positiveScenario.implications = implications;
          console.log('✅ Parsed positive scenario:', implications.length, 'implications');
        }

        // Extraire le scénario négatif
        const negativeMatch = whatIfMatch[1].match(/Negative Scenario[^:]*:([\s\S]*?)(?=$)/);
        if (negativeMatch) {
          const implications = negativeMatch[1]
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.startsWith('-'))
            .map(line => line.substring(1).trim())
            .filter(line => line.length > 0);
          
          analysis.whatIfScenarios.negativeScenario.implications = implications;
          console.log('✅ Parsed negative scenario:', implications.length, 'implications');
        }
      }

      // Extraire les discussions Reddit
      console.log('\n🔍 Looking for Reddit Discussion section...');
      const redditMatch = aiResponse.match(/Reddit Discussion:([\s\S]*?)(?=$)/);
      if (redditMatch) {
        console.log('Found Reddit Discussion section:', redditMatch[1]);
        const redditPosts = redditMatch[1]
          .split(/\n\s*-\s*Title:/)
          .map(block => block.trim())
          .filter(block => block.length > 0)
          .map(block => {
            console.log('Processing Reddit block:', block);
            const lines = block.split('\n').map(line => line.trim());
            const post: any = {};
            
            let currentField = '';
            for (const line of lines) {
              if (line.startsWith('Title:')) {
                currentField = 'title';
                post.title = line.replace('Title:', '').trim();
              } else if (line.startsWith('Subreddit:')) {
                currentField = 'subreddit';
                post.subreddit = line.replace('Subreddit:', '').trim();
              } else if (line.startsWith('Sentiment:')) {
                currentField = 'sentiment';
                post.sentiment = line.replace('Sentiment:', '').trim() as 'BULLISH' | 'BEARISH' | 'NEUTRAL';
              } else if (line.startsWith('Key Points:')) {
                currentField = 'keyPoints';
                post.keyComments = line.replace('Key Points:', '').trim();
              } else if (line.startsWith('Upvotes:')) {
                currentField = 'upvotes';
                post.upvotes = parseInt(line.replace('Upvotes:', '').trim()) || 0;
              } else if (line.trim() && currentField === 'keyPoints') {
                // Append to existing key points
                post.keyComments = (post.keyComments || '') + ' ' + line.trim();
              }
            }

            if (post.title && post.subreddit) {
              post.url = `https://reddit.com/r/${post.subreddit}`;
              post.date = new Date().toISOString();
              console.log('Created Reddit post:', post);
              return post;
            }
            console.log('Skipping invalid Reddit post:', post);
            return null;
          })
          .filter(post => post !== null);

        analysis.redditPosts = redditPosts;
        console.log('✅ Parsed Reddit posts:', redditPosts.length);
      } else {
        console.log('❌ No Reddit Discussion section found');
      }

      // Définir la confiance en fonction de la probabilité
      analysis.bullishBearishAnalysis.confidence = 
        market.probability > 0.7 ? "HIGH" : 
        market.probability > 0.5 ? "MEDIUM" : "LOW";

      console.log('\n✅ Successfully parsed AI response');
      console.log('Final Reddit posts:', analysis.redditPosts);
      return analysis;
    } catch (error) {
      console.error('\n❌ Error parsing AI response:', error);
      console.log('⚠️ Using default analysis as fallback...');
      return this.getDefaultAnalysis(market);
    }
  }

  private parseSentiment(sentiment: string): number {
    if (typeof sentiment === 'number') return sentiment;
    switch (sentiment.toLowerCase()) {
      case 'positive': return 0.7;
      case 'negative': return 0.3;
      case 'neutral': return 0.5;
      default: return parseFloat(sentiment) || 0.5;
    }
  }

  private getDefaultAnalysis(market: Market): MarketAnalysis {
    console.log('\n📝 Generating default analysis...');
    
    const bullishArgs = [
      "Market sentiment appears positive based on recent trading activity",
      "Current probability suggests strong market confidence",
      "Trading volume shows sustained interest in the market"
    ];

    const bearishArgs = [
      "Market uncertainty remains due to external factors",
      "Historical volatility suggests potential price swings",
      "Limited liquidity could impact market efficiency"
    ];

    const analysis: MarketAnalysis = {
      bullishArguments: bullishArgs,
      bearishArguments: bearishArgs,
      relatedArticles: [
        {
          title: "Official Resolution Source",
          url: market.resolutionSource || 'https://polymarket.com',
          source: "Resolution Source",
          publishDate: new Date().toISOString(),
          relevanceScore: 1,
          summary: "Official source that will be used to resolve this market",
          marketImpact: "NEUTRAL" as const
        }
      ],
      redditPosts: [
        {
          title: "Market Analysis Discussion",
          url: "https://reddit.com/r/Polymarket",
          subreddit: "Polymarket",
          upvotes: 42,
          sentiment: "NEUTRAL",
          keyComments: "Community discussion about recent market movements and analysis",
          date: new Date().toISOString()
        },
        {
          title: "Price Movement Analysis",
          url: "https://reddit.com/r/PolymarketTrading",
          subreddit: "PolymarketTrading",
          upvotes: 28,
          sentiment: market.probability > 0.5 ? "BULLISH" : "BEARISH",
          keyComments: `Discussion about ${market.title} price movements and trading strategies`,
          date: new Date(Date.now() - 86400000).toISOString()
        }
      ],
      whatIfScenarios: {
        positiveScenario: {
          title: "Positive Outcome",
          implications: [
            "Market resolves as expected",
            "Trading volume increases significantly",
            "Price stability maintained until resolution"
          ],
          probability: 0.6
        },
        negativeScenario: {
          title: "Negative Outcome",
          implications: [
            "Market resolves against expectations",
            "Trading volume decreases",
            "Increased price volatility before resolution"
          ],
          probability: 0.4
        }
      },
      bullishBearishAnalysis: {
        bullishArguments: bullishArgs,
        bearishArguments: bearishArgs,
        confidence: market.probability > 0.7 ? "HIGH" : market.probability > 0.5 ? "MEDIUM" : "LOW",
        lastUpdated: new Date().toISOString()
      },
      socialMetrics: {
        tweetVolume: Math.floor(market.volume / 100),
        overallSentiment: market.probability,
        keyInfluencers: [
          "Market Analysts",
          "Trading Community",
          "Industry Experts"
        ],
        sentimentOverTime: [
          {
            timestamp: new Date(Date.now() - 259200000).toISOString(),
            sentiment: market.probability - 0.1,
            volume: Math.floor(market.volume * 0.8)
          },
          {
            timestamp: new Date(Date.now() - 172800000).toISOString(),
            sentiment: market.probability - 0.05,
            volume: Math.floor(market.volume * 0.9)
          },
          {
            timestamp: new Date(Date.now() - 86400000).toISOString(),
            sentiment: market.probability,
            volume: market.volume
          }
        ]
      }
    };

    console.log('\n📊 Default analysis generated:', {
      bullishArgs: analysis.bullishArguments.length,
      bearishArgs: analysis.bearishArguments.length,
      articles: analysis.relatedArticles.length,
      redditPosts: analysis.redditPosts.length,
      confidence: analysis.bullishBearishAnalysis.confidence
    });

    return analysis;
  }

  private extractKeyTerms(description: string): string[] {
    // Extraire les termes clés de la description
    const terms = description.match(/\b[A-Z][a-zA-Z]{2,}\b/g) || [];
    const numbers = description.match(/\$?\d+(\.\d+)?\s*billion/gi) || [];
    return Array.from(new Set([...terms, ...numbers])).slice(0, 7);
  }

  private generateRelatedArticles(market: Market): RelatedArticle[] {
    const baseDate = new Date();
    const articles: RelatedArticle[] = [];
    
    if (market.resolutionSource) {
      articles.push({
        title: `Official Resolution Source Announcement`,
        url: market.resolutionSource,
        source: "Official Source",
        publishDate: baseDate.toISOString().split('T')[0],
        relevanceScore: 1.0,
        summary: `Official source for market resolution as specified in market description.`,
        marketImpact: "BULLISH"
      });
    }

    articles.push({
      title: `Market Analysis: ${market.title}`,
      url: "https://www.predictit.org/markets/detail/",
      source: "PredictIt",
      publishDate: new Date(baseDate.setDate(baseDate.getDate() - 7)).toISOString().split('T')[0],
      relevanceScore: 0.9,
      summary: `Comprehensive analysis of market conditions and factors affecting ${market.title}`,
      marketImpact: "NEUTRAL"
    });

    return articles;
  }

  private generateSentimentTimeline(market: Market): { timestamp: string; sentiment: number; volume: number; }[] {
    const timeline = [];
    const baseDate = new Date();
    const startDate = new Date(baseDate.setMonth(baseDate.getMonth() - 1));
    
    for (let i = 0; i < 4; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + (i * 7));
      
      timeline.push({
        timestamp: date.toISOString().split('T')[0],
        sentiment: market.outcomes[0].probability + (Math.random() * 0.2 - 0.1),
        volume: Math.floor(market.volume * (0.5 + Math.random() * 0.5))
      });
    }
    
    return timeline;
  }

  extractSlugFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      const pathSegments = urlObj.pathname.split('/');
      // Trouver le segment "event" et prendre le segment suivant
      const eventIndex = pathSegments.indexOf('event');
      if (eventIndex === -1 || eventIndex === pathSegments.length - 1) {
        throw new Error('Invalid Polymarket URL format');
      }
      // Extraire le slug sans les paramètres d'URL
      const rawSlug = pathSegments[eventIndex + 1];
      return rawSlug.split('?')[0]; // Enlever les paramètres d'URL
    } catch (error) {
      console.error('Error extracting slug:', error);
      throw new Error('Invalid Polymarket URL');
    }
  }

  private transformMarketData(data: any): Market {
    try {
      let outcomes = [];
      
      if (data.probabilities) {
        outcomes = Object.entries(data.probabilities).map(([outcome, prob]: [string, any]) => ({
          id: outcome,
          title: outcome,
          price: Number(prob),
          probability: Number(prob),
          volume: data.volume ? Number(data.volume) / Object.keys(data.probabilities).length : 0
        }));
      } else if (data.prices) {
        outcomes = Object.entries(data.prices).map(([outcome, price]: [string, any]) => ({
          id: outcome,
          title: outcome,
          price: Number(price),
          probability: Number(price),
          volume: data.volume ? Number(data.volume) / Object.keys(data.prices).length : 0
        }));
      } else {
        outcomes = [
          {
            id: '1',
            title: 'Yes',
            price: 0.5,
            probability: 0.5,
            volume: data.volume ? Number(data.volume) / 2 : 0
          },
          {
            id: '2',
            title: 'No',
            price: 0.5,
            probability: 0.5,
            volume: data.volume ? Number(data.volume) / 2 : 0
          }
        ];
      }

      // Calculer la probabilité globale du marché basée sur l'outcome le plus probable
      const probability = Math.max(...outcomes.map(o => o.probability));

      return {
        id: data.id || '',
        slug: data.slug || data.ticker || '',
        title: data.title || '',
        description: data.description || '',
        question: data.question || data.title || '',
        outcomes,
        volume: Number(data.volume) || 0,
        liquidity: Number(data.liquidity) || 0,
        probability,
        endDate: data.endDate || '',
        resolutionSource: data.resolutionSource || '',
        imageUrl: data.imageUrl || data.image || ''
      };
    } catch (error) {
      console.error('Error transforming market data:', error);
      throw new Error('Failed to transform market data');
    }
  }
} 