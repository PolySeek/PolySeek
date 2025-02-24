import { NextResponse } from 'next/server';
import { RedditService } from '@/lib/services/reddit-service';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query');
    const limit = searchParams.get('limit') || '10';

    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter is required' },
        { status: 400 }
      );
    }

    const redditService = RedditService.getInstance();
    const posts = await redditService.searchPosts(query, parseInt(limit));

    return NextResponse.json({ posts });
  } catch (error) {
    console.error('Error in Reddit API route:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Reddit posts' },
      { status: 500 }
    );
  }
} 