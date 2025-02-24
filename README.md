# PolySeek - Polymarket Analysis Tool

PolySeek is a powerful companion tool for Polymarket that provides comprehensive market analysis, AI-powered insights, and social sentiment tracking.

## Features

- Market data analysis from Polymarket
- AI-powered market insights
- Social media sentiment analysis
- Real-time price and volume tracking
- Related content discovery
- Advanced sentiment analysis with Sonar Pro integration

## Getting Started

### Prerequisites

- Node.js 18.0 or higher
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/polyseek.git
cd polyseek
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
   - Copy `.env.example` to `.env.local`
   - Fill in your API keys and service URLs
   - Never commit `.env.local` to version control

```env
# Required Configuration
NEXT_PUBLIC_AI_SERVICE_URL=your-ai-service-url
NEXT_PUBLIC_AI_SERVICE_KEY=your-ai-service-key
NEXT_PUBLIC_ANALYSIS_SERVICE_URL=your-analysis-service-url
NEXT_PUBLIC_ANALYSIS_SERVICE_KEY=your-analysis-service-key

# Optional Reddit Integration
REDDIT_CLIENT_ID=your-reddit-client-id
REDDIT_CLIENT_SECRET=your-reddit-client-secret
```

4. Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:3000`.

## Usage

1. Enter a Polymarket URL in the input field
2. Click "Analyze Market" to get comprehensive insights
3. View market details, AI analysis, and social sentiment metrics

## Technology Stack

- Next.js 14 with App Router
- TypeScript
- Tailwind CSS
- Tremor for data visualization
- AI-powered market analysis
- Polymarket Gamma API for market data

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details. 