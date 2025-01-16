#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import express from 'express';
import cors from 'cors';
import SpotifyWebApi from 'spotify-web-api-node';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

// Spotify API setup
const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  redirectUri: process.env.SPOTIFY_REDIRECT_URI
});

// Express server for OAuth callback
const app = express();
app.use(cors());

// MCP Server setup
class SpotifyMigrationServer {
  private server: Server;
  
  constructor() {
    this.server = new Server(
      {
        name: 'spotify-migration-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          resources: {},
          tools: {},
        },
      }
    );

    this.setupAuthEndpoints();
    this.setupPlaylistTools();
    
    // Error handling
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupAuthEndpoints() {
    // OAuth authorization endpoint
    app.get('/auth/spotify', (req, res) => {
      const scopes = [
        'playlist-read-private',
        'playlist-read-collaborative',
        'user-library-read'
      ];
      const state = crypto.randomBytes(16).toString('hex');
      
      const authUrl = spotifyApi.createAuthorizeURL(scopes, state);
      res.redirect(authUrl);
    });

    // OAuth callback endpoint
    app.get('/auth/spotify/callback', async (req, res) => {
      const { code, state } = req.query;
      
      try {
        const data = await spotifyApi.authorizationCodeGrant(code as string);
        const { access_token, refresh_token } = data.body;
        
        spotifyApi.setAccessToken(access_token);
        spotifyApi.setRefreshToken(refresh_token);
        
        res.send('Authentication successful! You can close this window.');
      } catch (error) {
        console.error('Error during authentication:', error);
        res.status(500).send('Authentication failed');
      }
    });

    // Token refresh endpoint
    app.post('/auth/spotify/refresh', async (req, res) => {
      try {
        const data = await spotifyApi.refreshAccessToken();
        spotifyApi.setAccessToken(data.body.access_token);
        res.json({ access_token: data.body.access_token });
      } catch (error) {
        console.error('Error refreshing token:', error);
        res.status(500).send('Token refresh failed');
      }
    });
  }

  private setupPlaylistTools() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'get_playlists',
          description: 'Get user playlists from Spotify',
          inputSchema: {
            type: 'object',
            properties: {},
            required: []
          }
        },
        {
          name: 'get_playlist_tracks',
          description: 'Get tracks from a specific Spotify playlist',
          inputSchema: {
            type: 'object',
            properties: {
              playlistId: {
                type: 'string',
                description: 'Spotify playlist ID'
              }
            },
            required: ['playlistId']
          }
        }
      ]
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        switch (request.params.name) {
          case 'get_playlists': {
            const data = await spotifyApi.getUserPlaylists();
            return {
              content: [{
                type: 'text',
                text: JSON.stringify(data.body.items.map(playlist => ({
                  id: playlist.id,
                  name: playlist.name,
                  tracks: playlist.tracks.total
                })), null, 2)
              }]
            };
          }

          case 'get_playlist_tracks': {
            const { arguments: args } = request.params;
            if (!args || typeof args.playlistId !== 'string') {
              throw new McpError(ErrorCode.InvalidParams, 'Invalid playlist ID');
            }

            const data = await spotifyApi.getPlaylistTracks(args.playlistId);
            return {
              content: [{
                type: 'text',
                text: JSON.stringify(data.body.items.map(item => {
                  if (!item.track) {
                    return null;
                  }
                  return {
                    name: item.track.name,
                    artists: item.track.artists.map(artist => artist.name),
                    album: item.track.album.name,
                    duration_ms: item.track.duration_ms
                  };
                }).filter(Boolean), null, 2)
              }]
            };
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

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Spotify Migration MCP server running on stdio');
  }
}

// Start servers
const port = process.env.PORT || 8888;
app.listen(port, () => {
  console.log(`OAuth callback server running on port ${port}`);
});

const server = new SpotifyMigrationServer();
server.run().catch(console.error);
