import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Forward the request to the Python FastAPI Agents service
    const agentsUrl = process.env.AGENTS_SERVICE_URL || 'http://localhost:8000';
    
    const response = await fetch(`${agentsUrl}/api/v1/agents/chart-prep/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Agent Service Error:', errorText);
      return NextResponse.json(
        { error: `Agent service failed with status ${response.status}`, details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
    
  } catch (error: any) {
    console.error('Failed to proxy request to Chart Prep agent:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}
