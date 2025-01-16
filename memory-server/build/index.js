#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, McpError, ErrorCode, } from '@modelcontextprotocol/sdk/types.js';
class MemoryServer {
    constructor() {
        this.server = new Server({
            name: 'memory-server',
            version: '1.0.0',
        }, {
            capabilities: {
                tools: {},
            },
        });
        this.memory = new Map();
        this.setupHandlers();
    }
    setupHandlers() {
        this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
            tools: [
                {
                    name: 'set_memory',
                    description: 'Store a value in memory',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            key: {
                                type: 'string',
                                description: 'Key to store the value under',
                            },
                            value: {
                                type: 'any',
                                description: 'Value to store',
                            },
                        },
                        required: ['key', 'value'],
                    },
                },
                {
                    name: 'get_memory',
                    description: 'Retrieve a value from memory',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            key: {
                                type: 'string',
                                description: 'Key to retrieve the value for',
                            },
                        },
                        required: ['key'],
                    },
                },
            ],
        }));
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            switch (request.params.name) {
                case 'set_memory': {
                    const { key, value } = request.params.arguments;
                    this.memory.set(key, value);
                    return {
                        content: [
                            {
                                type: 'text',
                                text: `Successfully stored value for key: ${key}`,
                            },
                        ],
                    };
                }
                case 'get_memory': {
                    const { key } = request.params.arguments;
                    const value = this.memory.get(key);
                    if (value === undefined) {
                        throw new McpError(ErrorCode.InvalidRequest, `No value found for key: ${key}`);
                    }
                    return {
                        content: [
                            {
                                type: 'text',
                                text: JSON.stringify(value),
                            },
                        ],
                    };
                }
                default:
                    throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
            }
        });
        // Error handling
        this.server.onerror = (error) => console.error('[MCP Error]', error);
        process.on('SIGINT', async () => {
            await this.server.close();
            process.exit(0);
        });
    }
    async run() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.error('Memory MCP server running on stdio');
    }
}
const server = new MemoryServer();
server.run().catch(console.error);
