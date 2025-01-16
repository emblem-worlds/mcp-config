#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import YTMusic from 'ytmusic';

// YouTube Music API setup
const ytmusic = new YTMusic();

interface SearchSongArgs {
  query: string;
}

interface CreatePlaylistArgs {
  title: string;
  description?: string;
}

interface AddToPlaylistArgs {
  playlistId: string;
  videoId: string;
}

class YouTubeMusicServer {
  private server: Server;
  
  constructor() {
    this.server = new Server(
      {
        name: 'youtube-music-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupPlaylistTools();
    
    // Error handling
    this.server.onerror = (error: Error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private async handleSearchSong(args: SearchSongArgs) {
    const results = await ytmusic.searchSongs(args.query);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(results.map(song => ({
          id: song.videoId,
          title: song.title,
          artist: song.artist,
          duration: song.duration
        })), null, 2)
      }]
    };
  }

  private async handleCreatePlaylist(args: CreatePlaylistArgs) {
    const playlist = await ytmusic.createPlaylist(args.title, args.description || '');
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          id: playlist.id,
          title: playlist.title
        }, null, 2)
      }]
    };
  }

  private async handleAddToPlaylist(args: AddToPlaylistArgs) {
    await ytmusic.addToPlaylist(args.playlistId, args.videoId);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          message: 'Song added to playlist'
        }, null, 2)
      }]
    };
  }

  private setupPlaylistTools() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'search_song',
          description: 'Search for a song on YouTube Music',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query (artist - song title)'
              }
            },
            required: ['query']
          }
        },
        {
          name: 'create_playlist',
          description: 'Create a new playlist on YouTube Music',
          inputSchema: {
            type: 'object',
            properties: {
              title: {
                type: 'string',
                description: 'Playlist title'
              },
              description: {
                type: 'string',
                description: 'Playlist description'
              }
            },
            required: ['title']
          }
        },
        {
          name: 'add_to_playlist',
          description: 'Add a song to a YouTube Music playlist',
          inputSchema: {
            type: 'object',
            properties: {
              playlistId: {
                type: 'string',
                description: 'YouTube Music playlist ID'
              },
              videoId: {
                type: 'string',
                description: 'YouTube video ID'
              }
            },
            required: ['playlistId', 'videoId']
          }
        }
      ]
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const { arguments: args } = request.params;
        if (!args) {
          throw new McpError(ErrorCode.InvalidParams, 'Missing arguments');
        }

        switch (request.params.name) {
          case 'search_song': {
            if (!this.isSearchSongArgs(args)) {
              throw new McpError(ErrorCode.InvalidParams, 'Invalid search song arguments');
            }
            return this.handleSearchSong(args);
          }

          case 'create_playlist': {
            if (!this.isCreatePlaylistArgs(args)) {
              throw new McpError(ErrorCode.InvalidParams, 'Invalid create playlist arguments');
            }
            return this.handleCreatePlaylist(args);
          }

          case 'add_to_playlist': {
            if (!this.isAddToPlaylistArgs(args)) {
              throw new McpError(ErrorCode.InvalidParams, 'Invalid add to playlist arguments');
            }
            return this.handleAddToPlaylist(args);
          }

          default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
        }
      } catch (error) {
        if (error instanceof McpError) throw error;
        console.error('Error executing tool:', error);
        throw new McpError(ErrorCode.InternalError, 'Failed to execute tool');
      }
    });
  }

  private isSearchSongArgs(args: unknown): args is SearchSongArgs {
    return typeof args === 'object' && args !== null && typeof (args as SearchSongArgs).query === 'string';
  }

  private isCreatePlaylistArgs(args: unknown): args is CreatePlaylistArgs {
    const playlist = args as CreatePlaylistArgs;
    return typeof args === 'object' && args !== null && 
           typeof playlist.title === 'string' &&
           (playlist.description === undefined || typeof playlist.description === 'string');
  }

  private isAddToPlaylistArgs(args: unknown): args is AddToPlaylistArgs {
    const playlist = args as AddToPlaylistArgs;
    return typeof args === 'object' && args !== null &&
           typeof playlist.playlistId === 'string' &&
           typeof playlist.videoId === 'string';
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('YouTube Music MCP server running on stdio');
  }
}

// Start server
const server = new YouTubeMusicServer();
server.run().catch(console.error);
