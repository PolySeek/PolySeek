import { Card, Title, Text, Grid, List, ListItem, Badge } from '@tremor/react';
import type { MarketAnalysis } from '@/types/market';

interface AnalysisCardProps {
  analysis: MarketAnalysis;
}

export function AnalysisCard({ analysis }: AnalysisCardProps) {
  return (
    <div className="space-y-6">
      {/* Résumé de l'analyse du marché */}
      <Card>
        <Title className="mb-4 text-lg font-bold text-blue-600">Analyse du marché</Title>
        <div className="space-y-4">
          {/* Termes clés */}
          <div>
            <Text className="font-semibold">Termes clés :</Text>
            <div className="flex flex-wrap gap-2 mt-1">
              {analysis.bullishBearishAnalysis.bullishArguments.map((term, index) => (
                <Badge key={index} color="blue">
                  {term}
                </Badge>
              ))}
            </div>
          </div>

          {/* Insights */}
          <div>
            <Text className="font-semibold">Insights :</Text>
            <List className="mt-1">
              {analysis.bullishBearishAnalysis.bearishArguments.map((insight, index) => (
                <ListItem key={index}>{insight}</ListItem>
              ))}
            </List>
          </div>
        </div>
      </Card>

      {/* Articles trouvés par Sonar Pro */}
      <Card>
        <Title className="mb-4 text-lg font-bold text-green-600">
          Articles pertinents ({analysis.relatedArticles.length})
        </Title>
        <div className="space-y-4">
          {analysis.relatedArticles.map((article, index) => (
            <div key={index} className="p-4 border rounded-lg hover:bg-gray-50">
              <div className="flex flex-col gap-2">
                <Text className="font-medium text-lg">{article.title}</Text>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge size="sm" color="blue">{article.source}</Badge>
                  <Text className="text-sm text-gray-500">
                    {new Date(article.publishDate).toLocaleDateString()}
                  </Text>
                  <Badge size="sm" color="yellow">Score: {article.relevanceScore.toFixed(2)}</Badge>
                  {article.marketImpact && (
                    <Badge 
                      size="sm" 
                      color={article.marketImpact.includes('YES') ? 'green' : 'red'}
                    >
                      {article.marketImpact}
                    </Badge>
                  )}
                </div>
                {article.summary && (
                  <Text className="text-gray-600 italic">
                    "{article.summary}"
                  </Text>
                )}
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline flex items-center gap-1"
                >
                  <span>Lire l'article</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Analyse Reddit par Sonar Pro */}
      <Card>
        <Title className="mb-4 text-lg font-bold text-purple-600">Analyse Reddit</Title>
        <div className="space-y-6">
          {/* Métriques globales */}
          <Grid numItems={2} className="gap-4">
            <Card>
              <Text className="font-semibold">Volume de posts</Text>
              <Text className="text-2xl font-bold">
                {analysis.socialMetrics.tweetVolume.toLocaleString()}
              </Text>
            </Card>
            <Card>
              <Text className="font-semibold">Sentiment global</Text>
              <Text className="text-2xl font-bold">
                {(analysis.socialMetrics.overallSentiment * 100).toFixed(1)}%
              </Text>
            </Card>
          </Grid>

          {/* Subreddits actifs */}
          <div>
            <Text className="font-semibold">Subreddits les plus actifs :</Text>
            <div className="flex flex-wrap gap-2 mt-2">
              {analysis.socialMetrics.keyInfluencers.map((subreddit, index) => (
                <Badge key={index} color="purple">
                  {subreddit}
                </Badge>
              ))}
            </div>
          </div>

          {/* Posts Reddit */}
          {analysis.redditPosts && analysis.redditPosts.length > 0 && (
            <div>
              <Text className="font-semibold mb-2">Posts Reddit pertinents :</Text>
              <div className="space-y-4">
                {analysis.redditPosts.map((post, index) => (
                  <div key={index} className="p-4 border rounded-lg hover:bg-gray-50">
                    <div className="flex flex-col gap-2">
                      <Text className="font-medium text-lg">{post.title}</Text>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge size="sm" color="purple">r/{post.subreddit}</Badge>
                        <Text className="text-sm text-gray-500">
                          {new Date(post.date).toLocaleDateString()}
                        </Text>
                        <Badge size="sm" color="orange">⬆️ {post.upvotes}</Badge>
                        <Badge 
                          size="sm" 
                          color={post.sentiment === 'BULLISH' ? 'green' : post.sentiment === 'BEARISH' ? 'red' : 'gray'}
                        >
                          {post.sentiment}
                        </Badge>
                      </div>
                      {post.keyComments && (
                        <Text className="text-gray-600 italic">
                          "{post.keyComments}"
                        </Text>
                      )}
                      <a
                        href={post.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:underline flex items-center gap-1"
                      >
                        <span>Voir le post</span>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Timeline du sentiment */}
          <div>
            <Text className="font-semibold">Évolution du sentiment :</Text>
            <List className="mt-2">
              {analysis.socialMetrics.sentimentOverTime.map((point, index) => (
                <ListItem key={index}>
                  <Text>
                    {new Date(point.timestamp).toLocaleDateString()} - 
                    Sentiment: {(point.sentiment * 100).toFixed(1)}% - 
                    Volume: {point.volume}
                  </Text>
                </ListItem>
              ))}
            </List>
          </div>
        </div>
      </Card>
    </div>
  );
} 