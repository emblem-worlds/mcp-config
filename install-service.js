import { Service } from 'node-windows';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create a new service object
const svc = new Service({
    name: 'MCP Config Sync',
    description: 'Syncs MCP server configurations between Claude desktop and VSCode',
    script: join(__dirname, 'sync-mcp-configs.js'),
    nodeOptions: []
});

// Listen for service install/uninstall events
svc.on('install', () => {
    svc.start();
    console.log('MCP Config Sync service installed and started');
});

svc.on('uninstall', () => {
    console.log('MCP Config Sync service uninstalled');
});

svc.on('error', (err) => {
    console.error('Service error:', err);
});

// Install the service
svc.install();
