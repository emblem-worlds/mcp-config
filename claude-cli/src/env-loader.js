const fs = require('fs');
const path = require('path');
require('dotenv').config();

function loadConfig(configPath) {
  try {
    // Read the config file
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    // Function to recursively replace placeholders
    const replacePlaceholders = (obj) => {
      for (const key in obj) {
        if (typeof obj[key] === 'string') {
          // Replace ${VAR_NAME} with actual environment variable
          obj[key] = obj[key].replace(/\${(.*?)}/g, (_, varName) => {
            return process.env[varName] || '';
          });
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          replacePlaceholders(obj[key]);
        }
      }
    };
    
    // Process the config
    replacePlaceholders(config);
    return config;
  } catch (error) {
    console.error('Error loading config:', error);
    process.exit(1);
  }
}

module.exports = { loadConfig };
