#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ErrorCode,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

// Types for our knowledge graph
interface Node {
  id: string;
  labels: string[];
  properties: Record<string, any>;
}

interface Relationship {
  id: string;
  type: string;
  startNodeId: string;
  endNodeId: string;
  properties: Record<string, any>;
}

interface GraphQuery {
  match?: {
    nodeLabels?: string[];
    properties?: Record<string, any>;
    relationships?: {
      type?: string;
      direction?: 'incoming' | 'outgoing' | 'both';
    }[];
  };
  return?: string[];
}

class KnowledgeGraphServer {
  private server: Server;
  private nodes: Map<string, Node>;
  private relationships: Map<string, Relationship>;

  constructor() {
    this.server = new Server(
      {
        name: 'knowledge-graph-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.nodes = new Map();
    this.relationships = new Map();
    this.setupHandlers();
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 15) +
           Math.random().toString(36).substring(2, 15);
  }

  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'create_node',
          description: 'Create a new node in the knowledge graph',
          inputSchema: {
            type: 'object',
            properties: {
              labels: {
                type: 'array',
                items: { type: 'string' },
                description: 'Labels/types for the node',
              },
              properties: {
                type: 'object',
                description: 'Properties of the node',
              },
            },
            required: ['labels', 'properties'],
          },
        },
        {
          name: 'create_relationship',
          description: 'Create a relationship between two nodes',
          inputSchema: {
            type: 'object',
            properties: {
              startNodeId: {
                type: 'string',
                description: 'ID of the start node',
              },
              endNodeId: {
                type: 'string',
                description: 'ID of the end node',
              },
              type: {
                type: 'string',
                description: 'Type of relationship',
              },
              properties: {
                type: 'object',
                description: 'Properties of the relationship',
              },
            },
            required: ['startNodeId', 'endNodeId', 'type'],
          },
        },
        {
          name: 'query_graph',
          description: 'Query the knowledge graph',
          inputSchema: {
            type: 'object',
            properties: {
              match: {
                type: 'object',
                properties: {
                  nodeLabels: {
                    type: 'array',
                    items: { type: 'string' },
                  },
                  properties: {
                    type: 'object',
                  },
                  relationships: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        type: { type: 'string' },
                        direction: { 
                          type: 'string',
                          enum: ['incoming', 'outgoing', 'both']
                        },
                      },
                    },
                  },
                },
              },
              return: {
                type: 'array',
                items: { type: 'string' },
              },
            },
            required: ['match'],
          },
        },
        {
          name: 'get_node',
          description: 'Get a node by ID',
          inputSchema: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: 'ID of the node to retrieve',
              },
            },
            required: ['id'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      switch (request.params.name) {
        case 'create_node': {
          const { labels, properties = {} } = request.params.arguments as {
            labels: string[];
            properties: Record<string, any>;
          };

          const node: Node = {
            id: this.generateId(),
            labels,
            properties,
          };

          this.nodes.set(node.id, node);

          return {
            content: [
              {
                type: 'text',
                text: `Created node with ID: ${node.id}`,
              },
            ],
          };
        }

        case 'create_relationship': {
          const { startNodeId, endNodeId, type, properties = {} } = request.params.arguments as {
            startNodeId: string;
            endNodeId: string;
            type: string;
            properties: Record<string, any>;
          };

          if (!this.nodes.has(startNodeId)) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              `Start node not found: ${startNodeId}`
            );
          }

          if (!this.nodes.has(endNodeId)) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              `End node not found: ${endNodeId}`
            );
          }

          const relationship: Relationship = {
            id: this.generateId(),
            type,
            startNodeId,
            endNodeId,
            properties,
          };

          this.relationships.set(relationship.id, relationship);

          return {
            content: [
              {
                type: 'text',
                text: `Created relationship with ID: ${relationship.id}`,
              },
            ],
          };
        }

        case 'query_graph': {
          const query = request.params.arguments as GraphQuery;
          const results: Array<Node | Relationship> = [];

          // Filter nodes based on labels and properties
          for (const node of this.nodes.values()) {
            if (query.match?.nodeLabels) {
              const hasAllLabels = query.match.nodeLabels.every(label => 
                node.labels.includes(label)
              );
              if (!hasAllLabels) continue;
            }

            if (query.match?.properties) {
              const matchesProperties = Object.entries(query.match.properties).every(
                ([key, value]) => node.properties[key] === value
              );
              if (!matchesProperties) continue;
            }

            results.push(node);

            // If relationships are requested, add connected nodes and relationships
            if (query.match?.relationships) {
              for (const relationship of this.relationships.values()) {
                if (relationship.startNodeId === node.id || 
                    relationship.endNodeId === node.id) {
                  const relTypeMatch = !query.match.relationships.some(r => 
                    r.type && r.type !== relationship.type
                  );

                  if (relTypeMatch) {
                    results.push(relationship);
                    if (relationship.startNodeId === node.id) {
                      results.push(this.nodes.get(relationship.endNodeId)!);
                    } else {
                      results.push(this.nodes.get(relationship.startNodeId)!);
                    }
                  }
                }
              }
            }
          }

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(results, null, 2),
              },
            ],
          };
        }

        case 'get_node': {
          const { id } = request.params.arguments as { id: string };
          const node = this.nodes.get(id);
          
          if (!node) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              `Node not found: ${id}`
            );
          }

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(node, null, 2),
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
    console.error('Knowledge Graph MCP server running on stdio');
  }
}

const server = new KnowledgeGraphServer();
server.run().catch(console.error);