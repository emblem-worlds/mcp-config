const fs = require('fs');
const path = require('path');

function loadConfig() {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
  }
  return process.env;
}

module.exports = { loadConfig };
