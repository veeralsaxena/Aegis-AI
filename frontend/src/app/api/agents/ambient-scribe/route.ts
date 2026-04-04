import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Forward the request to the Python FastAPI Agents service
    const agentsUrl = process.env.AGENTS_SERVICE_URL || 'http://localhost:8000';
    
    const response = await fetch(`${agentsUrl}/api/v1/agents/ambient-scribe/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        encounter_id: body.encounter_id,
        transcript_segments: body.transcript_segments
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Ambient Scribe Service Error:', errorText);
      return NextResponse.json(
        { error: `Ambient Scribe service failed with status ${response.status}`, details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
    
  } catch (error: any) {
    console.error('Failed to proxy request to Ambient Scribe agent:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}
