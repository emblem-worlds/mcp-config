# Model Context Protocol (MCP) System

This repository contains a comprehensive implementation of the Model Context Protocol (MCP) system, which enables seamless communication between AI systems and locally running servers. The MCP architecture provides a robust framework for extending AI capabilities through specialized servers that offer various tools and resources.

## System Architecture

The MCP system consists of multiple specialized servers, each designed to provide specific functionality:

### Core Servers

#### Rate Limit Server
- Manages token usage and rate limiting
- Provides tools for checking and enforcing rate limits
- Helps prevent API quota exhaustion

#### Knowledge Graph Server
- Maintains a graph database for storing and querying relationships
- Supports creating nodes, relationships, and complex graph queries
- Enables AI systems to build and traverse knowledge structures

#### Memory Server
- Provides persistent storage capabilities
- Allows storing and retrieving arbitrary data
- Useful for maintaining state across conversations

### Integration Servers

#### GitHub Server
- Interfaces with GitHub's API
- Manages repository operations
- Handles authentication and access control

#### Spotify Server
- Integrates with Spotify's API
- Manages music playback and playlist operations
- Handles OAuth authentication flow
- Includes utilities for token refresh

#### YouTube Music Server
- Provides YouTube Music API integration
- Manages music streaming and playlist operations
- Type definitions for YouTube Music interactions

### Utility Servers

#### Puppeteer Server
- Enables browser automation
- Provides screenshot capabilities
- Supports web interaction and testing

### Development Tools

#### Environment Loader
- Manages environment variables
- Provides TypeScript type definitions
- Ensures consistent configuration across services

## Repository Structure

```
mcp-config/
├── claude-cli/                 # Claude CLI implementation
│   ├── docs/                   # Documentation for rate limits
│   ├── src/                    # Source code
│   └── mcp-config.json         # CLI configuration
├── env-loader/                 # Environment variable management
│   ├── env-loader.d.ts         # TypeScript definitions
│   └── index.js               # Implementation
├── knowledge-graph-server/     # Graph database server
│   └── src/                    # Source code
├── memory-server/              # Persistent storage server
│   └── src/                    # Source code
├── ollama-server/              # Ollama integration server
│   └── src/                    # Source code
├── puppeteer-server/           # Browser automation server
│   └── src/                    # Source code
├── rate-limit-server/          # Rate limiting server
│   └── src/                    # Source code
├── spotify-server/             # Spotify integration
│   ├── src/                    # Source code
│   └── get-refresh-token.js    # OAuth utility
├── youtube-music-server/       # YouTube Music integration
│   └── src/                    # Source code
├── cline-mcp-settings.json     # VSCode Cline extension settings
├── claude-desktop-config.json  # Desktop app configuration
└── sync-mcp-configs.js         # Configuration sync utility
```

## Configuration Files

#### claude-cli/mcp-config.json
The main configuration file containing settings for:
- API endpoints
- Authentication tokens (redacted)
- Server configurations
- Rate limiting settings

#### cline-mcp-settings.json
VSCode Cline extension settings including:
- MCP server configurations
- Development environment settings
- Tool configurations

#### claude-desktop-config.json
Claude Desktop application settings including:
- User preferences
- Interface configurations
- Integration settings

## Server Setup and Configuration

### Environment Variables
Each server requires specific environment variables for configuration. Use `.env` files locally:

```bash
# Rate Limit Server
RATE_LIMIT_WINDOW=3600
RATE_LIMIT_MAX_TOKENS=1000000

# Spotify Server
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
SPOTIFY_REFRESH_TOKEN=your_refresh_token

# GitHub Server
GITHUB_PERSONAL_ACCESS_TOKEN=your_pat

# Knowledge Graph Server
GRAPH_DB_PATH=./data/graph.db
```

### Server-Specific Setup

#### Spotify Server
1. Create a Spotify Developer application
2. Configure OAuth credentials
3. Run get-refresh-token.js to obtain refresh token:
```bash
node spotify-server/get-refresh-token.js
```

#### Knowledge Graph Server
1. Initialize the graph database
2. Configure node types and relationships
3. Set up indexing for optimal query performance

#### Puppeteer Server
1. Ensure Chrome/Chromium is installed
2. Configure viewport and browser settings
3. Set up screenshot directory if needed

### Development Guidelines

#### TypeScript Configuration
- All servers use TypeScript for type safety
- Consistent tsconfig.json settings
- Shared type definitions in env-loader

#### Testing
- Write unit tests for server functionality
- Test OAuth flows with mock credentials
- Validate rate limiting behavior

#### Error Handling
- Implement proper error types
- Handle API rate limits gracefully
- Provide meaningful error messages

## Usage

### Installation

1. Clone the repository:
```bash
git clone https://github.com/emblem-worlds/mcp-config.git
```

2. Install dependencies for all servers:
```bash
cd mcp-config
npm install
```

3. Configure environment:
```bash
cp .env.example .env
# Edit .env with your credentials
```

4. Build TypeScript servers:
```bash
npm run build
```

### Running Servers

Start individual servers:
```bash
# Rate Limit Server
npm run start:rate-limit

# Spotify Server
npm run start:spotify

# Knowledge Graph Server
npm run start:knowledge-graph
```

Or use the service manager:
```bash
node install-service.js  # Install as system service
node uninstall-service.js  # Remove system service
```

### Configuration Sync

Keep configurations in sync across different environments:
```bash
node sync-mcp-configs.js
```

## Security

All sensitive credentials have been redacted from this repository. Never commit:
- API keys
- Authentication tokens
- Personal access tokens
- Client secrets

Use environment variables or external secret management for sensitive data.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a pull request

## MCP Server Development

### Creating New Servers

1. Use the MCP SDK to create a new server:
```bash
npx @modelcontextprotocol/create-server my-server
```

2. Implement the server interface:
```typescript
class MyServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'my-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          resources: {},
          tools: {},
        },
      }
    );
  }

  // Implement request handlers
  private setupHandlers() {
    this.server.setRequestHandler(/* ... */);
  }
}
```

3. Define tools and resources:
```typescript
// Tool definition
{
  name: 'my_tool',
  description: 'Tool description',
  inputSchema: {
    type: 'object',
    properties: {
      param1: {
        type: 'string',
        description: 'Parameter description'
      }
    },
    required: ['param1']
  }
}

// Resource definition
{
  uri: 'protocol://resource/path',
  name: 'Resource name',
  mimeType: 'application/json',
  description: 'Resource description'
}
```

### Integration Guidelines

1. Server Configuration
- Use consistent naming conventions
- Follow TypeScript best practices
- Implement proper error handling
- Add comprehensive logging

2. Tool Design
- Make tools atomic and focused
- Provide clear input schemas
- Include helpful descriptions
- Handle edge cases gracefully

3. Resource Management
- Use appropriate MIME types
- Structure URIs logically
- Cache responses when possible
- Handle large data efficiently

4. Testing
- Write unit tests for tools
- Test resource endpoints
- Validate input schemas
- Mock external services

5. Documentation
- Document all tools and resources
- Include usage examples
- Explain error scenarios
- Keep docs up-to-date

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
