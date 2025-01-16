#!/usr/bin/env node
import { Command } from 'commander';
import { config } from 'dotenv';
import { Anthropic, APIError } from '@anthropic-ai/sdk';
import * as readline from 'readline';
import * as path from 'path';
import * as fs from 'fs/promises';
import { spawn } from 'child_process';
import pThrottle from 'p-throttle';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

config({ path: path.join(new URL('.', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'), '../.env') });

// Load MCP config with environment variables
import { loadConfig } from './env-loader.js';
const mcpConfigPath = 'C:/Users/Romar/AppData/Roaming/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json';
const mcpConfig = await loadConfig(mcpConfigPath);

const program = new Command();

// Initialize MCP clients
async function initMcpClients() {
  const clients = new Map();
  
  interface ServerConfig {
    command: string;
    args: string[];
    env?: Record<string, string>;
  }

  // Use Cline settings config
  const mcpConfigPath = 'C:/Users/Romar/AppData/Roaming/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json';
  const mcpConfig = JSON.parse(await fs.readFile(mcpConfigPath, 'utf-8'));
  const serverConfigs: Record<string, ServerConfig> = mcpConfig.mcpServers;

  for (const [name, config] of Object.entries(serverConfigs)) {
    const client = new Client({
      name: `claude-cli-${name}`,
      version: '1.0.0'
    }, {
      capabilities: {}
    });
    
    const transport = new StdioClientTransport(config);
    try {
      await client.connect(transport);
      clients.set(name, client);
      console.log(`Connected to ${name} server`);
    } catch (error: any) {
      console.error(`Failed to connect to ${name} server:`, error.message);
    }
  }
  
  return clients;
}

const mcpClients = await initMcpClients();

function getClient(name: string) {
  const client = mcpClients.get(name === 'spotify' ? 'spotify-server' : name);
  if (!client) {
    throw new Error(`MCP client '${name}' not connected`);
  }
  return client;
}

// Check for API key
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('Error: ANTHROPIC_API_KEY environment variable is required');
  process.exit(1);
}

// Rate limiting with persistent state
interface RateLimitState {
  minuteTokens: number;
  dailyTokens: number;
  lastMinuteReset: number;
  lastDayReset: number;
}

async function checkRateLimit(tokens: number): Promise<boolean> {
  try {
    const response = await getClient('rate-limit-server').callTool({
      name: 'check_rate_limit',
      arguments: { tokens }
    });
    
    if (response.content[0].text.includes('error')) {
      const error = JSON.parse(response.content[0].text).error;
      throw new Error(error);
    }
    
    return true;
  } catch (error: any) {
    console.error('Rate limit check failed:', error.message);
    throw error;
  }
}

// Initialize Anthropic client with retries
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  maxRetries: 3
});

// Helper to estimate token count (rough approximation)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4); // Rough estimate: ~4 chars per token
}

// Message types
interface Message {
  role: 'user' | 'assistant';
  content: string;
  type?: 'text';
}

interface MessageResponse {
  content: Array<{
    text: string;
    type: 'text';
  }>;
  id: string;
  model: string;
  role: 'assistant';
  type: 'message';
  stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'rate_limit' | null;
  stop_sequence: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
  error?: {
    type: string;
    message: string;
  };
}

const createThrottledMessage = async (messages: Message[], isSimpleQuery = false): Promise<MessageResponse> => {
  const model = isSimpleQuery ? 'claude-3-sonnet-20240229' : 'claude-3-opus-20240229';
  const maxTokens = isSimpleQuery ? 256 : 512;
  
  // Calculate approximate token usage for messages
  const messageTokens = messages.reduce((total, msg) => {
    return total + estimateTokens(msg.content);
  }, 0);
  
  // Keep message history within limits
  let historyMessages = messages;
  if (messageTokens > 2000) {
    historyMessages = [];
    let tokenCount = 0;
    for (let i = messages.length - 1; i >= 0; i--) {
      const msgTokens = estimateTokens(messages[i].content);
      if (tokenCount + msgTokens > 2000) break;
      historyMessages.unshift(messages[i]);
      tokenCount += msgTokens;
    }
  }
  
  // Estimate total tokens needed
  const totalTokens = messageTokens + maxTokens;
  
  try {
    // Check rate limits before making request
    await checkRateLimit(totalTokens);
    
    const response = await anthropic.messages.create({
      system: "Be concise.",
      model,
      max_tokens: maxTokens,
      messages: historyMessages
    });
    
    return response;
  } catch (error: any) {
    if (error instanceof APIError && error.status === 429) {
      // Get retry-after from error headers if available
      const retryAfter = error.headers?.['retry-after'];
      const waitTime = retryAfter ? `${retryAfter} seconds` : 'a few minutes';
      
      return {
        id: '',
        content: [{ 
          text: `Rate limit exceeded. Please wait ${waitTime} before trying again. Consider reducing your prompt length or requested tokens.`,
          type: 'text' 
        }],
        model,
        role: 'assistant',
        type: 'message',
        stop_reason: 'rate_limit',
        stop_sequence: null,
        usage: { input_tokens: 0, output_tokens: 0 },
        error: {
          type: 'rate_limit_error',
          message: error.message
        }
      };
    }
    throw error;
  }
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

program
  .name('claude')
  .description('CLI for interacting with Claude AI')
  .version('1.0.0');

program
  .command('chat')
  .description('Start an interactive chat session with Claude')
  .action(async () => {
    console.log('Starting chat with Claude (type "exit" to end the conversation)');
    console.log('-----------------------------------------------------');

    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    let chatInProgress = true;

    while (chatInProgress) {
      const userInput = await new Promise<string>((resolve) => {
        rl.question('You: ', resolve);
      });

      if (userInput.toLowerCase() === 'exit') {
        chatInProgress = false;
        continue;
      }

      try {
        // Trim long inputs
        const trimmedInput = userInput.length > 2000 ? 
          userInput.slice(0, 2000) + "..." : 
          userInput;
        
        messages.push({ role: 'user', content: trimmedInput });

        try {
          // Store only last 10 messages in memory
          await getClient('memory').callTool({
            name: 'set_memory',
            arguments: {
              key: 'conversation',
              value: messages.slice(-10)
            }
          });
        } catch (mcpError: any) {
          console.error('Failed to store conversation in memory:', mcpError.message);
        }

        const response = await createThrottledMessage(messages);

        const assistantMessage = response.content[0].text;
        console.log('\nClaude:', assistantMessage, '\n');
        messages.push({ role: 'assistant', content: assistantMessage });
      } catch (error: any) {
        console.error('Error:', error.message);
        chatInProgress = false;
      }
    }

    rl.close();
  });

program
  .command('ask <prompt>')
  .description('Ask Claude a single question')
  .action(async (prompt: string) => {
    try {
      // Try to get weather info if the question is about weather
      if (prompt.toLowerCase().includes('weather')) {
        try {
          await getClient('weather').callTool({
            name: 'get_weather',
            arguments: {
              city: prompt.match(/weather.*in\s+([^?.,]+)/i)?.[1] || 'unknown'
            }
          });
        } catch (weatherError: any) {
          console.error('Weather service error:', weatherError.message);
        }
      }

      // Try to get music info if the question is about music
      if (prompt.toLowerCase().includes('music') || prompt.toLowerCase().includes('song')) {
        try {
          await getClient('spotify').callTool({
            name: 'get_playlists',
            arguments: {}
          });
        } catch (spotifyError: any) {
          console.error('Spotify service error:', spotifyError.message);
        }
      }

      // Try to search brave if it's a search query
      if (prompt.toLowerCase().includes('search')) {
        try {
          await getClient('brave-search').callTool({
            name: 'brave_search',
            arguments: {
              query: prompt.replace(/search\s+for\s+/i, '').replace(/search\s+/i, '')
            }
          });
        } catch (searchError: any) {
          console.error('Search service error:', searchError.message);
        }
      }

      const response = await createThrottledMessage([{ role: 'user' as const, content: prompt }], true);

      console.log('\nClaude:', response.content[0].text, '\n');
    } catch (error: any) {
      console.error('Error:', error.message);
    }
    rl.close();
  });

program
  .command('spotify')
  .description('Interact with Spotify')
  .option('-p, --playlists', 'List your playlists')
  .option('-t, --tracks <playlistId>', 'List tracks in a playlist')
  .action(async (options) => {
    try {
      if (options.playlists) {
        const response = await getClient('spotify').callTool({
          name: 'get_playlists',
          arguments: {}
        });
        console.log('\nYour Playlists:', response);
      } else if (options.tracks) {
        const response = await getClient('spotify').callTool({
          name: 'get_playlist_tracks',
          arguments: {
            playlistId: options.tracks
          }
        });
        console.log('\nPlaylist Tracks:', response);
      }
    } catch (error: any) {
      console.error('Spotify error:', error.message);
    }
    rl.close();
  });

program
  .command('browse <url>')
  .description('Open a URL in the browser')
  .action(async (url: string) => {
    try {
      await getClient('puppeteer').callTool({
        name: 'launch_browser',
        arguments: {
          url: url
        }
      });
      console.log('Browser launched successfully');
    } catch (error: any) {
      console.error('Browser error:', error.message);
    }
    rl.close();
  });

program
  .command('youtube')
  .description('Interact with YouTube Music')
  .option('-s, --search <query>', 'Search for music')
  .option('-p, --play <songId>', 'Play a specific song')
  .action(async (options) => {
    try {
      if (options.search) {
        const response = await getClient('youtube').callTool({
          name: 'search_songs',
          arguments: {
            query: options.search
          }
        });
        console.log('\nSearch Results:', response);
      } else if (options.play) {
        const response = await getClient('youtube').callTool({
          name: 'play_song',
          arguments: {
            songId: options.play
          }
        });
        console.log('\nPlaying song:', response);
      }
    } catch (error: any) {
      console.error('YouTube Music error:', error.message);
    }
    rl.close();
  });

program
  .command('ollama')
  .description('Interact with Ollama models')
  .option('-l, --list', 'List available models')
  .option('-r, --run <model>', 'Run a specific model')
  .option('-p, --prompt <text>', 'Prompt for the model')
  .action(async (options) => {
    try {
      if (options.list) {
        const response = await getClient('ollama').callTool({
          name: 'list_models',
          arguments: {}
        });
        console.log('\nAvailable Models:', response);
      } else if (options.run && options.prompt) {
        const response = await getClient('ollama').callTool({
          name: 'run_model',
          arguments: {
            model: options.run,
            prompt: options.prompt
          }
        });
        console.log('\nModel Response:', response);
      }
    } catch (error: any) {
      console.error('Ollama error:', error.message);
    }
    rl.close();
  });

program
  .command('github')
  .description('Interact with GitHub')
  .option('-r, --repo <name>', 'Specify repository')
  .option('-i, --issues', 'List issues')
  .option('-p, --prs', 'List pull requests')
  .action(async (options) => {
    try {
      if (options.issues && options.repo) {
        const response = await getClient('github').callTool({
          name: 'list_issues',
          arguments: {
            repo: options.repo
          }
        });
        console.log('\nRepository Issues:', response);
      } else if (options.prs && options.repo) {
        const response = await getClient('github').callTool({
          name: 'list_pull_requests',
          arguments: {
            repo: options.repo
          }
        });
        console.log('\nPull Requests:', response);
      }
    } catch (error: any) {
      console.error('GitHub error:', error.message);
    }
    rl.close();
  });

program
  .command('sync')
  .description('Synchronize MCP configurations across Claude, Cline, and CLI')
  .action(async () => {
    try {
      const syncScript = path.join(new URL('.', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'), '../sync-mcp-configs.js');
      const sync = spawn('node', [syncScript], {
        stdio: 'inherit'
      });

      sync.on('close', (code: number) => {
        if (code === 0) {
          console.log('MCP configurations synchronized successfully');
        } else {
          console.error('Failed to synchronize MCP configurations');
        }
        rl.close();
      });
    } catch (error: any) {
      console.error('Sync error:', error.message);
      rl.close();
    }
  });

program
  .command('list-connections')
  .description('List active MCP server connections')
  .action(async () => {
    for (const [name, client] of mcpClients.entries()) {
      console.log(`${name}: ${client.connected ? 'Connected' : 'Disconnected'}`);
    }
    rl.close();
  });
