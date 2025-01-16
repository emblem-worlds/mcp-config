#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import puppeteer, { Browser, Page } from 'puppeteer';

interface BrowserState {
  browser: Browser | null;
  page: Page | null;
}

const state: BrowserState = {
  browser: null,
  page: null,
};

class PuppeteerServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'puppeteer-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.cleanup();
      await this.server.close();
      process.exit(0);
    });
  }

  private async cleanup() {
    if (state.browser) {
      await state.browser.close();
      state.browser = null;
      state.page = null;
    }
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'launch',
          description: 'Launch a new browser instance at the specified URL',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'URL to navigate to',
              },
            },
            required: ['url'],
          },
        },
        {
          name: 'click',
          description: 'Click at specific coordinates',
          inputSchema: {
            type: 'object',
            properties: {
              x: {
                type: 'number',
                description: 'X coordinate',
              },
              y: {
                type: 'number',
                description: 'Y coordinate',
              },
            },
            required: ['x', 'y'],
          },
        },
        {
          name: 'type',
          description: 'Type text',
          inputSchema: {
            type: 'object',
            properties: {
              text: {
                type: 'string',
                description: 'Text to type',
              },
            },
            required: ['text'],
          },
        },
        {
          name: 'scroll_down',
          description: 'Scroll down by one page height',
          inputSchema: {
            type: 'object',
            properties: {},
            required: [],
          },
        },
        {
          name: 'scroll_up',
          description: 'Scroll up by one page height',
          inputSchema: {
            type: 'object',
            properties: {},
            required: [],
          },
        },
        {
          name: 'close',
          description: 'Close the browser instance',
          inputSchema: {
            type: 'object',
            properties: {},
            required: [],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (!['launch', 'close'].includes(request.params.name) && !state.browser) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          'Browser not launched. Call launch first.'
        );
      }

      try {
        switch (request.params.name) {
          case 'launch': {
            const { url } = request.params.arguments as { url: string };
            if (state.browser) {
              await this.cleanup();
            }
            state.browser = await puppeteer.launch({
              headless: false,
              defaultViewport: { width: 900, height: 600 },
            });
            state.page = await state.browser.newPage();
            await state.page.setViewport({ width: 900, height: 600 });
            await state.page.goto(url);
            const pageTitle = await state.page.title();
            return {
              content: [
                {
                  type: 'text',
                  text: `Browser launched at ${url}. Page title: ${pageTitle}`
                }
              ],
            };
          }

          case 'click': {
            const { x, y } = request.params.arguments as { x: number; y: number };
            await state.page!.mouse.click(x, y);
            return {
              content: [
                {
                  type: 'text',
                  text: `Clicked at coordinates (${x}, ${y})`,
                },
              ],
            };
          }

          case 'type': {
            const { text } = request.params.arguments as { text: string };
            await state.page!.keyboard.type(text);
            return {
              content: [
                {
                  type: 'text',
                  text: `Typed text: ${text}`,
                },
              ],
            };
          }

          case 'scroll_down': {
            await state.page!.evaluate(() => {
              window.scrollBy(0, window.innerHeight);
            });
            return {
              content: [
                {
                  type: 'text',
                  text: 'Scrolled down by one page height',
                },
              ],
            };
          }

          case 'scroll_up': {
            await state.page!.evaluate(() => {
              window.scrollBy(0, -window.innerHeight);
            });
            return {
              content: [
                {
                  type: 'text',
                  text: 'Scrolled up by one page height',
                },
              ],
            };
          }

          case 'close': {
            await this.cleanup();
            return {
              content: [
                {
                  type: 'text',
                  text: 'Browser closed',
                },
              ],
            };
          }

          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${request.params.name}`
            );
        }
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }
        throw new McpError(
          ErrorCode.InternalError,
          `Puppeteer error: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Puppeteer MCP server running on stdio');
  }
}

const server = new PuppeteerServer();
server.run().catch(console.error);
