import OpenAI from 'openai';
import { Market } from '@/types/market';
import { API_CONFIG } from '@/config/api-config';

export class MarketService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      baseURL: API_CONFIG.BASE_URL,
      apiKey: API_CONFIG.API_KEY,
      dangerouslyAllowBrowser: true
    });
  }

  async analyzeMarket(market: Market): Promise<string> {
    try {
      console.log('Analyzing market:', market.question);
      
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that analyzes prediction markets.'
          },
          {
            role: 'user',
            content: `Please analyze this prediction market:\n${market.question}\nCurrent probability: ${market.probability}%`
          }
        ],
        temperature: 0.7
      });

      console.log('Received analysis from API');
      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error('Empty response from API');
      }
      return content;
      
    } catch (error) {
      console.error('Error analyzing market:', error);
      throw new Error('Failed to analyze market');
    }
  }
} 