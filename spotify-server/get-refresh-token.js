import express from 'express';
import SpotifyWebApi from 'spotify-web-api-node';

const app = express();
const port = 8888;

const spotifyApi = new SpotifyWebApi({
  clientId: 'd4b3fb2af4fd44ca867de205ba0368e3',
  clientSecret: '1cfea5eec820426098ec3af7c34f9b1e',
  redirectUri: 'http://localhost:8888/callback'
});

app.get('/login', (req, res) => {
  const scopes = ['playlist-read-private', 'playlist-read-collaborative'];
  const state = 'spotify-mcp-' + Math.random().toString(36).substring(7);
  const authUrl = spotifyApi.createAuthorizeURL(scopes, state);
  res.redirect(authUrl);
});

app.get('/callback', async (req, res) => {
  const { code } = req.query;
  
  try {
    const data = await spotifyApi.authorizationCodeGrant(code);
    const { access_token, refresh_token } = data.body;
    
    res.send(`
      <h1>Authentication successful!</h1>
      <p>Add this refresh token to your claude_desktop_config.json:</p>
      <pre>${refresh_token}</pre>
      <p>You can close this window now.</p>
    `);
  } catch (error) {
    res.send('Error getting tokens: ' + error);
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/login`);
  console.log('Open this URL in your browser to start the authentication process');
});
