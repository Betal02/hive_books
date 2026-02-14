require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet({
  contentSecurityPolicy: false, // Allow external assets (fonts/icons)
}));
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// Check if client is in container or local
const clientPath = fs.existsSync(path.join(__dirname, '../client'))
  ? path.join(__dirname, '../client')
  : path.join(__dirname, '../../../client');

app.use(express.static(clientPath));

const axios = require('axios');

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'UP', service: 'Orchestrator' });
});

// Authentication Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ message: 'Authentication token required' });

  jwt.verify(token, process.env.ACCESS_JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid or expired token' });
    req.user = user;
    next();
  });
};

// --- AUTH WORKFLOWS ---

app.post('/api/auth/login', async (req, res) => {
  try {
    const response = await axios.post(`${process.env.USER_DATA_URL}/login`, req.body);
    res.json(response.data);
  } catch (e) {
    res.status(e.response?.status || 500).json(e.response?.data || { message: 'Failed to perform the login', error: e.message });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const response = await axios.post(`${process.env.USER_DATA_URL}/register`, req.body);
    res.json(response.data);
  } catch (e) {
    res.status(e.response?.status || 500).json(e.response?.data || { message: 'Failed to perform the registration', error: e.message });
  }
});

// --- LIBRARY WORKFLOWS ---

app.get('/api/library', authenticateToken, async (req, res) => {
  try {
    const response = await axios.get(`${process.env.ITEM_DATA_URL}/books/${req.user.id}`);
    res.json(response.data);
  } catch (e) {
    res.status(e.response?.status || 500).json(e.response?.data || { message: 'Failed to fetch library', error: e.message });
  }
});

app.post('/api/books/add', authenticateToken, async (req, res) => {
  const { isbn, title } = req.body;
  const user_id = req.user.id;

  if (!isbn && !title) return res.status(400).json({ message: 'Failed to add book', error: 'ISBN or Title required' });

  try {
    let bookMetadata;

    // If ISBN provided: fetch metadata
    if (isbn) {
      const metaRes = await axios.get(`${process.env.BOOK_METADATA_URL}/isbn/${isbn}`);
      bookMetadata = metaRes.data;
    } else {
      // If not: use the provided data
      bookMetadata = req.body;
    }

    // Save to Item Data Service
    const saveRes = await axios.post(`${process.env.ITEM_DATA_URL}/books`, {
      user_id,
      ...bookMetadata
    });

    res.status(201).json(saveRes.data);
  } catch (e) {
    res.status(e.response?.status || 500).json(e.response?.data || { message: 'Failed to add book', error: e.message });
  }
});

app.delete('/api/books/:id', authenticateToken, async (req, res) => {
  try {
    await axios.delete(`${process.env.ITEM_DATA_URL}/books/${req.params.id}`);
    res.json({ message: 'Book removed' });
  } catch (e) {
    res.status(e.response?.status || 500).json(e.response?.data || { message: 'Failed to delete book', error: e.message });
  }
});

// --- BOOK METADATA & SEARCH/RECOMMENDATION WORKFLOWS ---

app.get('/api/search', async (req, res) => {
  try {
    const response = await axios.get(`${process.env.BOOK_METADATA_URL}/search`, { params: req.query });
    res.json(response.data);
  } catch (e) {
    res.status(e.response?.status || 500).json(e.response?.data || { message: 'Failed to perform the search', error: e.message });
  }
});

app.get('/api/discovery', authenticateToken, async (req, res) => {
  try {
    const response = await axios.get(`${process.env.RECOMMENDATION_URL}/recommendations/${req.user.id}`);
    res.json(response.data);
  } catch (e) {
    res.status(e.response?.status || 500).json(e.response?.data || { message: 'Failed to fetch recommendations', error: e.message });
  }
});

app.get('/api/new-releases', authenticateToken, async (req, res) => {
  try {
    const response = await axios.get(`${process.env.FOLLOWER_URL}/new-releases/${req.user.id}`);
    res.json(response.data);
  } catch (e) {
    res.status(e.response?.status || 500).json(e.response?.data || { message: 'Failed to fetch new releases', error: e.message });
  }
});

app.get('/api/last-releases', authenticateToken, async (req, res) => {
  try {
    const response = await axios.get(`${process.env.FOLLOWER_URL}/last-releases/${req.user.id}`);
    res.json(response.data);
  } catch (e) {
    res.status(e.response?.status || 500).json(e.response?.data || { message: 'Failed to fetch last releases', error: e.message });
  }
});


app.get('/api/proxy-image', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  // Fetch book thumbnail from Book Metadata service
  try {
    const metadataUrl = `${process.env.BOOK_METADATA_URL}/proxy-image`;
    console.log(`[ORCHESTRATOR] Proxying to: ${metadataUrl} with url=${url}`);

    const response = await axios.get(metadataUrl, {
      params: req.query,
      responseType: 'arraybuffer',
      timeout: 12000
    });

    res.setHeader('Content-Type', 'image/jpeg');
    res.send(Buffer.from(response.data));
  } catch (e) {
    console.error('[ORCHESTRATOR] Failed to fetch image:', e.message);
    const status = e.response?.status || 500;

    // If responseType was 'stream', e.response.data is a stream.
    if (e.response?.data && typeof e.response.data.on === 'function') { //TODO refactor errors messages
      let errorBody = '';
      e.response.data.on('data', chunk => { errorBody += chunk.toString(); });
      e.response.data.on('end', () => {
        console.error('[ORCHESTRATOR] Failed to fetch image:', errorBody);
        try {
          // Try to parse if it's JSON from our metadata service
          const parsed = JSON.parse(errorBody);
          res.status(status).json(parsed);
        } catch (jsonErr) {
          res.status(status).json({ message: 'Metadata service returned error', error: errorBody || e.message });
        }
      });
      e.response.data.on('error', (streamErr) => {
        res.status(status).json({ message: 'Stream error during proxy', error: streamErr.message });
      });
    } else {
      res.status(status).json({ message: 'Failed to fetch image', error: e.message, details: e.response?.data });
    }
  }
});

// Redirect any other route to the dashboard
app.get('*', (req, res) => {
  res.sendFile(path.join(clientPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`[ORCHESTRATOR] Orchestrator Service running on port ${PORT}`);
});
