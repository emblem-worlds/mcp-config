const fs = require('fs');
const path = require('path');
require('./env-loader');

// Paths to configuration files
const configPaths = {
  vscode: path.join(__dirname, '../../../AppData/Roaming/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json'),
  desktop: path.join(__dirname, '../../../AppData/Roaming/Claude/claude_desktop_config.json'),
  cli: path.join(__dirname, 'claude-cli/mcp-config.json')
};

// Read and parse JSON file
function readConfig(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err);
    return null;
  }
}

// Write JSON file
function writeConfig(filePath, config) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(config, null, 2));
    console.log(`Successfully updated ${filePath}`);
  } catch (err) {
    console.error(`Error writing ${filePath}:`, err);
  }
}

// Replace hardcoded paths with environment variables
function templatePaths(config) {
  const templatedConfig = JSON.parse(JSON.stringify(config));
  
  // Helper function to replace paths in args array
  const replacePaths = (args) => {
    return args.map(arg => {
      if (typeof arg === 'string' && arg.includes('C:\\Users\\Romar\\Documents\\Cline\\MCP')) {
        const relativePath = arg.replace('C:\\Users\\Romar\\Documents\\Cline\\MCP', '${MCP_ROOT}');
        return relativePath.replace(/\\/g, '/');
      }
      if (typeof arg === 'string' && arg.includes('C:/Users/Romar')) {
        return arg.replace('C:/Users/Romar', '${HOME}');
      }
      return arg;
    });
  };

  // Process each server configuration
  Object.keys(templatedConfig.mcpServers).forEach(serverName => {
    const server = templatedConfig.mcpServers[serverName];
    if (server.args) {
      server.args = replacePaths(server.args);
    }
  });

  return templatedConfig;
}

// Replace environment variables with actual values
function resolvePaths(config) {
  const resolvedConfig = JSON.parse(JSON.stringify(config));
  
  // Helper function to resolve paths in args array
  const resolvePath = (path) => {
    return path.replace(/\$\{([^}]+)\}/g, (match, key) => {
      return process.env[key] || match;
    });
  };

  // Process each server configuration
  Object.keys(resolvedConfig.mcpServers).forEach(serverName => {
    const server = resolvedConfig.mcpServers[serverName];
    if (server.args) {
      server.args = server.args.map(arg => {
        if (typeof arg === 'string') {
          return resolvePath(arg);
        }
        return arg;
      });
    }
  });

  return resolvedConfig;
}

// Main sync function
function syncConfigs() {
  // Read all configs
  const vscodeConfig = readConfig(configPaths.vscode);
  const desktopConfig = readConfig(configPaths.desktop);
  const cliConfig = readConfig(configPaths.cli);

  if (!vscodeConfig || !desktopConfig || !cliConfig) {
    console.error('Failed to read one or more config files');
    return;
  }

  // Template the paths in the source config
  const templatedConfig = templatePaths(vscodeConfig);
  
  // Update other configs with templated version
  desktopConfig.mcpServers = templatedConfig.mcpServers;
  cliConfig.mcpServers = templatedConfig.mcpServers;

  // Write templated configs
  writeConfig(configPaths.vscode, templatedConfig);
  writeConfig(configPaths.desktop, desktopConfig);
  writeConfig(configPaths.cli, cliConfig);

  // Create a template file for reference
  writeConfig('cline-mcp-settings.template.json', templatedConfig);
}

// Run sync
syncConfigs();
