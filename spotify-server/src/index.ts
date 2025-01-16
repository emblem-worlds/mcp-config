#!/usr/bin/env node
import { config } from 'dotenv';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

config(); // Load environment variables from .env file
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import SpotifyWebApi from 'spotify-web-api-node';

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const SPOTIFY_REFRESH_TOKEN = process.env.SPOTIFY_REFRESH_TOKEN;

if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET || !SPOTIFY_REFRESH_TOKEN) {
  throw new Error('Missing required environment variables');
}

class SpotifyServer {
  private server: Server;
  private spotifyApi: SpotifyWebApi;

  constructor() {
    this.server = new Server(
      {
        name: 'spotify-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {
            get_auth_url: {
              description: 'Get the Spotify authorization URL',
              inputSchema: {
                type: 'object',
                properties: {},
                required: [],
              },
            },
            set_auth_code: {
              description: 'Set the authorization code from callback',
              inputSchema: {
                type: 'object',
                properties: {
                  code: {
                    type: 'string',
                    description: 'Authorization code from callback URL',
                  },
                },
                required: ['code'],
              },
            },
            get_playlists: {
              description: 'Get user playlists',
              inputSchema: {
                type: 'object',
                properties: {},
                required: [],
              },
            },
            get_playlist_tracks: {
              description: 'Get tracks from a specific playlist',
              inputSchema: {
                type: 'object',
                properties: {
                  playlistId: {
                    type: 'string',
                    description: 'Spotify playlist ID',
                  },
                },
                required: ['playlistId'],
              },
            },
          },
        },
      }
    );

    this.spotifyApi = new SpotifyWebApi({
      clientId: SPOTIFY_CLIENT_ID,
      clientSecret: SPOTIFY_CLIENT_SECRET,
      refreshToken: SPOTIFY_REFRESH_TOKEN
    });

    this.setupToolHandlers();
    
    // Error handling
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'get_auth_url',
          description: 'Get the Spotify authorization URL',
          inputSchema: {
            type: 'object',
            properties: {},
            required: [],
          },
        },
        {
          name: 'set_auth_code',
          description: 'Set the authorization code from callback',
          inputSchema: {
            type: 'object',
            properties: {
              code: {
                type: 'string',
                description: 'Authorization code from callback URL',
              },
            },
            required: ['code'],
          },
        },
        {
          name: 'get_playlists',
          description: 'Get user playlists',
          inputSchema: {
            type: 'object',
            properties: {},
            required: [],
          },
        },
        {
          name: 'get_playlist_tracks',
          description: 'Get tracks from a specific playlist',
          inputSchema: {
            type: 'object',
            properties: {
              playlistId: {
                type: 'string',
                description: 'Spotify playlist ID',
              },
            },
            required: ['playlistId'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      switch (request.params.name) {
        case 'get_auth_url':
          return this.handleGetAuthUrl();
        case 'set_auth_code':
          return this.handleSetAuthCode(request.params.arguments);
        case 'get_playlists':
          return this.handleGetPlaylists();
        case 'get_playlist_tracks':
          return this.handleGetPlaylistTracks(request.params.arguments);
        default:
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${request.params.name}`
          );
      }
    });
  }

  private async handleGetAuthUrl() {
    const scopes = ['playlist-read-private', 'playlist-read-collaborative'];
    const state = 'spotify-mcp-' + Math.random().toString(36).substring(7);
    const authUrl = this.spotifyApi.createAuthorizeURL(scopes, state);
    
    return {
      content: [
        {
          type: 'text',
          text: authUrl,
        },
      ],
    };
  }

  private async handleSetAuthCode(args: any) {
    if (typeof args.code !== 'string') {
      throw new McpError(ErrorCode.InvalidParams, 'Invalid authorization code');
    }

    try {
      const data = await this.spotifyApi.authorizationCodeGrant(args.code);
      this.spotifyApi.setAccessToken(data.body.access_token);
      this.spotifyApi.setRefreshToken(data.body.refresh_token);

      return {
        content: [
          {
            type: 'text',
            text: 'Successfully authenticated with Spotify',
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private async refreshAccessToken() {
    try {
      // Get a new access token using the refresh token from SpotifyWebApi instance
      const data = await this.spotifyApi.refreshAccessToken();
      this.spotifyApi.setAccessToken(data.body.access_token);
      return true;
    } catch (error) {
      console.error('Failed to refresh token:', error);
      return false;
    }
  }

  private async handleGetPlaylists() {
    try {
      const response = await this.spotifyApi.getUserPlaylists();
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(response.body, null, 2),
          },
        ],
      };
    } catch (error: any) {
      if (error.statusCode === 401 && await this.refreshAccessToken()) {
        // Retry after token refresh
        const response = await this.spotifyApi.getUserPlaylists();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.body, null, 2),
            },
          ],
        };
      }
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to get playlists: ${error.message || 'Unknown error'}`
      );
    }
  }

  private async handleGetPlaylistTracks(args: any) {
    if (typeof args.playlistId !== 'string') {
      throw new McpError(ErrorCode.InvalidParams, 'Invalid playlist ID');
    }

    try {
      const response = await this.spotifyApi.getPlaylistTracks(args.playlistId);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(response.body, null, 2),
          },
        ],
      };
    } catch (error: any) {
      if (error.statusCode === 401 && await this.refreshAccessToken()) {
        // Retry after token refresh
        const response = await this.spotifyApi.getPlaylistTracks(args.playlistId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.body, null, 2),
            },
          ],
        };
      }
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to get playlist tracks: ${error.message || 'Unknown error'}`
      );
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Spotify MCP server running on stdio');
  }
}

const server = new SpotifyServer();
server.run().catch(console.error);
