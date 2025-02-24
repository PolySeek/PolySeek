export const API_CONFIG = {
  POLYMARKET: {
    BASE_URL: 'https://gamma-api.polymarket.com',
    ENDPOINTS: {
      EVENTS: '/events',
    },
  },
  AI_SERVICE: {
    BASE_URL: 'https://api.zukijourney.com/v1',
    API_KEY: process.env.NEXT_PUBLIC_ZUKI_API_KEY || '',
  },
  MARKET_ANALYSIS: {
    BASE_URL: process.env.NEXT_PUBLIC_ANALYSIS_SERVICE_URL || '',
    API_KEY: process.env.NEXT_PUBLIC_ANALYSIS_SERVICE_KEY || '',
    ENDPOINTS: {
      SEARCH: '/search',
      SOCIAL: '/social'
    }
  }
} as const;

export const CACHE_CONFIG = {
  MARKET_DATA: 60 * 5, // 5 minutes
  ANALYSIS: 60 * 30, // 30 minutes
  SOCIAL_METRICS: 60 * 15, // 15 minutes
} as const;

export const ERROR_MESSAGES = {
  INVALID_URL: 'Please enter a valid Polymarket URL',
  MARKET_NOT_FOUND: 'Market not found',
  API_ERROR: 'An error occurred while fetching data',
  RATE_LIMIT: 'Rate limit exceeded. Please try again later',
  MULTIPLE_OUTCOMES: 'Markets with multiple outcomes are not supported'
} as const; 