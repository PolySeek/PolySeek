import { Card, Title, Text, Metric, Flex, Grid } from '@tremor/react';
import { formatDistance } from 'date-fns';
import type { Market } from '@/types/market';
import { useState } from 'react';

interface MarketCardProps {
  market: Market;
}

export function MarketCard({ market }: MarketCardProps) {
  const [imageError, setImageError] = useState(false);

  const timeToEnd = market.endDate
    ? formatDistance(new Date(market.endDate), new Date(), { addSuffix: true })
    : 'No end date';

  return (
    <Card>
      <Grid numItems={1} className="gap-4">
        <div className="flex items-start gap-4">
          {market.imageUrl && !imageError && (
            <div className="w-24 h-24 rounded-lg overflow-hidden flex-shrink-0">
              <img
                src={market.imageUrl}
                alt={market.title}
                className="w-full h-full object-cover"
                onError={() => setImageError(true)}
              />
            </div>
          )}
          <div className="flex-grow">
            <Title>{market.title}</Title>
            <Text>{market.description}</Text>
          </div>
        </div>

        <Grid numItems={2} className="gap-4">
          <Card>
            <Text>Volume</Text>
            <Metric>$ {market.volume.toLocaleString()}</Metric>
          </Card>
          <Card>
            <Text>Liquidity</Text>
            <Metric>$ {market.liquidity.toLocaleString()}</Metric>
          </Card>
        </Grid>

        <div>
          <Text>Resolution</Text>
          <Flex className="mt-2">
            <Text>Ends {timeToEnd}</Text>
            {market.resolutionSource && (
              <Text>Source: {market.resolutionSource}</Text>
            )}
          </Flex>
        </div>
      </Grid>
    </Card>
  );
} 