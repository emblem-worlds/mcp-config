# MCP Configuration Repository

This repository contains configuration files for the Model Context Protocol (MCP) system. MCP enables communication between AI systems and locally running servers that provide additional tools and resources.

## Repository Structure

```
mcp-config/
├── claude-cli/            # Configuration for Claude CLI interface
│   └── mcp-config.json    # Main configuration file
├── .gitignore             # Specifies intentionally untracked files
└── README.md              # This documentation file
```

## Configuration Files

### claude-cli/mcp-config.json
The main configuration file containing settings for:
- API endpoints
- Authentication tokens (redacted)
- Server configurations
- Rate limiting settings

## Usage

1. Clone the repository:
```bash
git clone https://github.com/emblem-worlds/mcp-config.git
```

2. Configure your local environment:
```bash
cd mcp-config
cp claude-cli/mcp-config.example.json claude-cli/mcp-config.json
```

3. Add your credentials to the configuration file (never commit these changes)

4. Use the configuration in your MCP projects

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

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
