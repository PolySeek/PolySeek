import axios from 'axios';
import type { RedditPost } from '@/types/market';

export class RedditService {
  private static instance: RedditService;
  private accessToken: string | null = null;
  private tokenExpiration: number = 0;

  private readonly clientId = process.env.NEXT_PUBLIC_REDDIT_CLIENT_ID || '';
  private readonly clientSecret = process.env.NEXT_PUBLIC_REDDIT_CLIENT_SECRET || '';
  private readonly userAgent = 'PolySeek/1.0';

  private constructor() {}

  static getInstance(): RedditService {
    if (!RedditService.instance) {
      RedditService.instance = new RedditService();
    }
    return RedditService.instance;
  }

  private async authenticate(): Promise<void> {
    try {
      if (this.accessToken && Date.now() < this.tokenExpiration) {
        return;
      }

      const authString = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
      
      const response = await axios.post(
        'https://www.reddit.com/api/v1/access_token',
        'grant_type=client_credentials',
        {
          headers: {
            'Authorization': `Basic ${authString}`,
            'User-Agent': this.userAgent,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiration = Date.now() + (response.data.expires_in * 1000);
      
      console.log('Reddit authentication successful');
    } catch (error) {
      console.error('Reddit authentication error:', error);
      throw new Error('Failed to authenticate with Reddit');
    }
  }

  async searchPosts(query: string, limit: number = 10): Promise<RedditPost[]> {
    try {
      await this.authenticate();

      // Clean and enhance the search query
      const enhancedQuery = this.buildSearchQuery(query);
      const searchQuery = encodeURIComponent(enhancedQuery);

      // Search in relevant subreddits for more focused results
      const relevantSubreddits = ['politics', 'news', 'economy', 'worldnews', 'usanews'];
      let allPosts: RedditPost[] = [];

      for (const subreddit of relevantSubreddits) {
        const response = await axios.get(
          `https://oauth.reddit.com/r/${subreddit}/search?q=${searchQuery}&sort=relevance&limit=${limit}&t=month&restrict_sr=on`,
          {
            headers: {
              'Authorization': `Bearer ${this.accessToken}`,
              'User-Agent': this.userAgent
            }
          }
        );

        const posts = response.data.data.children
          .map((child: any) => ({
            subreddit: child.data.subreddit,
            title: child.data.title,
            url: `https://reddit.com${child.data.permalink}`,
            date: new Date(child.data.created_utc * 1000).toISOString(),
            upvotes: child.data.ups,
            keyComments: child.data.selftext?.substring(0, 200) || '',
            sentiment: 'NEUTRAL'
          }))
          .filter((post: RedditPost) => {
            // Filter out irrelevant posts using keyword matching
            const keywords = query.toLowerCase().split(' ');
            const titleWords = post.title.toLowerCase();
            return keywords.some(keyword => titleWords.includes(keyword));
          });

        allPosts = [...allPosts, ...posts];
      }

      // Remove duplicates and sort by relevance and upvotes
      const uniquePosts = Array.from(
        new Map(allPosts.map(post => [post.url, post])).values()
      );

      return uniquePosts
        .sort((a, b) => b.upvotes - a.upvotes)
        .slice(0, limit);

    } catch (error) {
      console.error('Error searching Reddit posts:', error);
      return [];
    }
  }

  private buildSearchQuery(query: string): string {
    // Remove common words, dates, and time-related terms
    const stopWords = [
      'will', 'the', 'be', 'to', 'in', 'on', 'at', 'by', 'for', 'of', 'with',
      'before', 'after', 'during', 'until', 'since',
      'january', 'february', 'march', 'april', 'may', 'june', 'july',
      'august', 'september', 'october', 'november', 'december',
      'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
      'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
      'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun',
      'year', 'month', 'week', 'day', 'today', 'tomorrow', 'yesterday',
      '2024', '2025', '2026'
    ];

    // Extract essential keywords
    const keywords = query
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .split(' ')
      .filter(word => !stopWords.includes(word) && word.length > 2);

    // Add relevant context terms based on the query content
    let contextTerms: string[] = [];
    if (keywords.includes('ukraine')) {
      contextTerms = ['aid', 'congress', 'funding'];
    } else if (keywords.includes('trump')) {
      contextTerms = ['campaign', 'republican'];
    }

    // Combine keywords and context terms, remove duplicates
    const relevantKeywords = Array.from(new Set([...keywords, ...contextTerms]));

    // Take only the most important keywords (limit to 3-4 terms)
    return relevantKeywords.slice(0, 4).join(' ');
  }

  async getPostComments(postId: string): Promise<string[]> {
    try {
      await this.authenticate();

      const response = await axios.get(
        `https://oauth.reddit.com/comments/${postId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'User-Agent': this.userAgent
          }
        }
      );

      return response.data[1].data.children
        .slice(0, 5)
        .map((comment: any) => comment.data.body)
        .filter((comment: string) => comment);
    } catch (error) {
      console.error('Error fetching post comments:', error);
      return [];
    }
  }
} 