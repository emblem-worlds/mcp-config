const fs = require('fs');
const path = require('path');

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

  // Get the most complete configuration (VSCode as source of truth)
  const sourceConfig = vscodeConfig.mcpServers;

  // Update other configs
  desktopConfig.mcpServers = sourceConfig;
  cliConfig.mcpServers = sourceConfig;

  // Write updated configs
  writeConfig(configPaths.desktop, desktopConfig);
  writeConfig(configPaths.cli, cliConfig);
}

// Run sync
syncConfigs();
