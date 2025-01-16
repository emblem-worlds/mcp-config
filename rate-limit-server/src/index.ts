#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ErrorCode,
} from '@modelcontextprotocol/sdk/types.js';

interface CallToolRequest {
  params: {
    name: string;
    arguments?: Record<string, any>;
  };
}

interface RateLimitState {
  minuteTokens: number;
  dailyTokens: number;
  lastMinuteReset: number;
  lastDayReset: number;
}

let state: RateLimitState = {
  minuteTokens: 40000,  // Anthropic's per-minute token limit
  dailyTokens: 1000000,  // Daily token limit
  lastMinuteReset: Date.now(),
  lastDayReset: Date.now()
};

const server = new Server(
  {
    name: 'rate-limit-server',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'check_rate_limit',
      description: 'Check if token usage is within rate limits',
      inputSchema: {
        type: 'object',
        properties: {
          tokens: {
            type: 'number',
            description: 'Number of tokens to check'
          }
        },
        required: ['tokens']
      }
    },
    {
      name: 'get_rate_limit_state',
      description: 'Get current rate limit state',
      inputSchema: {
        type: 'object',
        properties: {},
        required: []
      }
    }
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
  const now = Date.now();

  // Reset minute tokens if needed
  if (now - state.lastMinuteReset >= 60000) {
    state.minuteTokens = 40000;  // Match initial value
    state.lastMinuteReset = now;
  }

  // Reset daily tokens if needed
  if (now - state.lastDayReset >= 86400000) {
    state.dailyTokens = 1000000;  // Match initial value
    state.lastDayReset = now;
  }

  switch (request.params.name) {
    case 'check_rate_limit': {
      const { tokens } = request.params.arguments as { tokens: number };

      if (state.minuteTokens < tokens) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: 'Rate limit exceeded: Please wait a minute before trying again'
              })
            }
          ],
          isError: true
        };
      }

      if (state.dailyTokens < tokens) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: 'Daily token limit exceeded: Please try again tomorrow'
              })
            }
          ],
          isError: true
        };
      }

      state.minuteTokens -= tokens;
      state.dailyTokens -= tokens;

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              remainingMinuteTokens: state.minuteTokens,
              remainingDailyTokens: state.dailyTokens
            })
          }
        ]
      };
    }

    case 'get_rate_limit_state': {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(state)
          }
        ]
      };
    }

    default:
      throw new McpError(
        ErrorCode.MethodNotFound,
        `Unknown tool: ${request.params.name}`
      );
  }
});

// Error handling
server.onerror = (error) => console.error('[MCP Error]', error);
process.on('SIGINT', async () => {
  await server.close();
  process.exit(0);
});

async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Rate Limit MCP server running on stdio');
}

run().catch(console.error);
