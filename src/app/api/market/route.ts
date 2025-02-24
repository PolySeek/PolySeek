import { NextResponse } from 'next/server';
import axios from 'axios';
import { API_CONFIG } from '@/lib/api-config';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('slug');

  if (!slug) {
    return NextResponse.json(
      { error: 'Slug parameter is required' },
      { status: 400 }
    );
  }

  try {
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
      return NextResponse.json(
        { error: 'Market not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(marketData);
  } catch (error) {
    console.error('Error fetching from Polymarket:', error);
    return NextResponse.json(
      { error: 'Failed to fetch market data' },
      { status: 500 }
    );
  }
} 