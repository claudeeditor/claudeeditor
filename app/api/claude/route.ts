import { NextRequest, NextResponse } from 'next/server';

// ========== Types ==========
interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ClaudeResponse {
  content: Array<{
    type: string;
    text: string;
  }>;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
  model?: string;
}

interface APIResponse {
  content: string;
  usage?: {
    total_tokens: number;
    prompt_tokens: number;
    completion_tokens: number;
  };
  mode: 'production' | 'mock' | 'mock-fallback' | 'error-fallback';
  model?: string;
  timestamp: string;
  error?: string;
}

// ========== Configuration ==========
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL = 'claude-3-5-sonnet-20241022';
const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_MAX_TOKENS = 4000;
const DEFAULT_TEMPERATURE = 0.7;

// ========== Helper Functions ==========
function getApiKey(): string | undefined {
  return process.env.CLAUDE_API_KEY || 
         process.env.ANTHROPIC_API_KEY || 
         process.env.NEXT_PUBLIC_CLAUDE_API_KEY;
}

function generateMockResponse(message: string): string {
  const lowerMessage = message.toLowerCase();
  
  const responses: Record<string, string> = {
    error: `I see you're experiencing an error. Here's how to fix it:

1. **Check your imports** - Ensure all packages are installed
2. **Clear cache**: \`rm -rf .next node_modules/.cache\`
3. **Reinstall**: \`npm install\`

\`\`\`typescript
// Here's a working example:
export default function Component() {
  return <div>Error resolved!</div>;
}
\`\`\`

Make sure you're using stable versions (Next.js 14, React 18).`,
    
    component: `Here's a React component following best practices:

\`\`\`typescript
'use client';
import { useState } from 'react';

interface ComponentProps {
  title?: string;
}

export default function MyComponent({ title = "Counter" }: ComponentProps) {
  const [count, setCount] = useState(0);
  
  return (
    <div className="p-6 bg-gray-800 rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-4 text-white">{title}</h2>
      <div className="flex items-center gap-4">
        <button 
          onClick={() => setCount(c => c - 1)}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
        >
          -
        </button>
        <span className="text-xl font-semibold text-white min-w-[3ch] text-center">
          {count}
        </span>
        <button 
          onClick={() => setCount(c => c + 1)}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
        >
          +
        </button>
      </div>
    </div>
  );
}
\`\`\``,
    
    explain: `Let me explain how this works:

**Key Concepts:**
1. **React Hooks** - Functions that let you use state and other React features
2. **State Management** - Tracking data that changes over time
3. **Event Handlers** - Functions that respond to user interactions
4. **Tailwind CSS** - Utility-first CSS framework for styling

The component re-renders automatically when state changes, updating the UI to reflect the new values. This is React's core reactivity system at work.`
  };
  
  // Find matching response type
  for (const [key, response] of Object.entries(responses)) {
    if (lowerMessage.includes(key)) {
      return response;
    }
  }
  
  // Default response
  return `I understand you're asking about: "${message}"

Here's how I can help:
1. I'll analyze your code for potential issues
2. Suggest improvements following best practices
3. Ensure compatibility with stable versions (Next.js 14, React 18, Tailwind v3)

What specific aspect would you like me to focus on?`;
}

async function callClaudeAPI(
  messages: Message[],
  apiKey: string,
  maxTokens: number,
  temperature: number
): Promise<ClaudeResponse> {
  const claudeMessages = messages
    .filter(msg => msg.role !== 'system')
    .map(msg => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content
    }));

  const response = await fetch(CLAUDE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: maxTokens,
      temperature: temperature,
      messages: claudeMessages
    }),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Claude API error:', response.status, errorText);
    
    let errorMessage = `Claude API error: ${response.status}`;
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.error?.message || errorMessage;
    } catch {
      // Use default error message
    }
    
    throw new Error(errorMessage);
  }
  
  return response.json();
}

function extractContent(data: ClaudeResponse): string {
  if (data.content && Array.isArray(data.content)) {
    return data.content
      .filter(item => item.type === 'text')
      .map(item => item.text)
      .join('\n');
  }
  return '';
}

// ========== Main Handler ==========
export async function POST(request: NextRequest): Promise<NextResponse> {
    console.log('Environment check:', {
    hasClaudeKey: !!process.env.CLAUDE_API_KEY,
    keyLength: process.env.CLAUDE_API_KEY?.length,
    keyPrefix: process.env.CLAUDE_API_KEY?.substring(0, 15) + '...',
    nodeEnv: process.env.NODE_ENV
  });
  try {
    // Parse and validate request
    const body = await request.json();
    const { 
      messages, 
      max_tokens = DEFAULT_MAX_TOKENS, 
      temperature = DEFAULT_TEMPERATURE 
    } = body;
    
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'Invalid request: messages array is required' },
        { status: 400 }
      );
    }
    
    // Check API key
    const apiKey = getApiKey();
    const isDevelopment = !apiKey || apiKey === 'mock-key-for-testing';
    
    // Log request info
    console.log('Claude API request:', {
      mode: isDevelopment ? 'development' : 'production',
      messageCount: messages.length,
      maxTokens: max_tokens,
      temperature,
      timestamp: new Date().toISOString()
    });
    
    // Development mode - return mock response
    if (isDevelopment) {
      const lastMessage = messages[messages.length - 1];
      const mockContent = generateMockResponse(lastMessage.content);
      
      const response: APIResponse = {
        content: mockContent,
        usage: {
          total_tokens: Math.floor(Math.random() * 500) + 100,
          prompt_tokens: Math.floor(Math.random() * 200) + 50,
          completion_tokens: Math.floor(Math.random() * 300) + 50,
        },
        mode: 'mock',
        timestamp: new Date().toISOString()
      };
      
      console.log('Returning mock response');
      return NextResponse.json(response);
    }
    
    // Production mode - call actual Claude API
    try {
      const data = await callClaudeAPI(messages, apiKey!, max_tokens, temperature);
      const content = extractContent(data);
      
      if (!content) {
        throw new Error('No content in Claude response');
      }
      
      const response: APIResponse = {
        content,
        usage: data.usage ? {
          total_tokens: (data.usage.input_tokens || 0) + (data.usage.output_tokens || 0),
          prompt_tokens: data.usage.input_tokens || 0,
          completion_tokens: data.usage.output_tokens || 0,
        } : undefined,
        mode: 'production',
        model: data.model || CLAUDE_MODEL,
        timestamp: new Date().toISOString()
      };
      
      console.log('Claude API response sent successfully');
      return NextResponse.json(response);
      
    } catch (apiError) {
      console.error('Claude API call failed:', apiError);
      
      // Fallback to mock response on API error
      const lastMessage = messages[messages.length - 1];
      const mockContent = generateMockResponse(lastMessage.content);
      
      const response: APIResponse = {
        content: mockContent,
        usage: {
          total_tokens: 100,
          prompt_tokens: 50,
          completion_tokens: 50,
        },
        mode: 'mock-fallback',
        error: apiError instanceof Error ? apiError.message : 'API call failed',
        timestamp: new Date().toISOString()
      };
      
      return NextResponse.json(response);
    }
    
  } catch (error) {
    console.error('API route error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    const statusCode = errorMessage.includes('Invalid request') ? 400 : 500;
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined,
        timestamp: new Date().toISOString()
      },
      { status: statusCode }
    );
  }
}

// CORS handler
export async function OPTIONS(_request: NextRequest): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}