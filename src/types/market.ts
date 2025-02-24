export interface Market {
  id: string;
  slug: string;
  title: string;
  description: string;
  question: string;
  outcomes: {
    id: string;
    title: string;
    price: number;
    probability: number;
    volume: number;
  }[];
  volume: number;
  liquidity: number;
  probability: number;
  endDate: string;
  resolutionSource: string;
  imageUrl: string;
}

export interface Outcome {
  id: string;
  title: string;
  price: number;
  probability: number;
  volume: number;
}

export interface RedditPost {
  title: string;
  url: string;
  subreddit: string;
  upvotes: number;
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  keyComments: string;
  date: string;
}

export interface BullishBearishAnalysis {
  bullishArguments: string[];
  bearishArguments: string[];
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  lastUpdated: string;
}

export interface WhatIfScenarios {
  positiveScenario: {
    title: string;
    implications: string[];
    probability: number;
  };
  negativeScenario: {
    title: string;
    implications: string[];
    probability: number;
  };
}

export interface RelatedArticle {
  title: string;
  url: string;
  source: string;
  publishDate: string;
  relevanceScore: number;
  summary: string;
  marketImpact: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
}

export interface SocialMetrics {
  tweetVolume: number;
  overallSentiment: number;
  keyInfluencers: string[];
  sentimentOverTime: {
    timestamp: string;
    sentiment: number;
    volume: number;
  }[];
}

export interface MarketAnalysis {
  bullishArguments: string[];
  bearishArguments: string[];
  relatedArticles: RelatedArticle[];
  redditPosts: RedditPost[];
  whatIfScenarios: WhatIfScenarios;
  bullishBearishAnalysis: BullishBearishAnalysis;
  socialMetrics: SocialMetrics;
} 