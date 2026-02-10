/**
 * API Keys Management Endpoint
 * POST: Create new API key
 */

import { NextResponse } from 'next/server';
import { serverAuth, apiKeyAuth } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    // Require authentication
    const user = await serverAuth.requireAuth();

    const body = await request.json();
    const { name, workspace_id } = body;

    if (!name || !workspace_id) {
      return NextResponse.json(
        { error: 'Missing required fields: name, workspace_id' },
        { status: 400 }
      );
    }

    // Generate API key
    const apiKey = await apiKeyAuth.generateApiKey(user.id, workspace_id, name);

    return NextResponse.json({
      success: true,
      api_key: apiKey,
      message: 'API key created successfully. Save this key securely - you won\'t see it again.',
    });
  } catch (error) {
    console.error('API key creation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create API key' },
      { status: 500 }
    );
  }
}
