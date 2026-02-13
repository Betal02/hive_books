require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const crypto = require('crypto');
const axios = require('axios');
const { createClient } = require('redis');
const Bottleneck = require('bottleneck');
const { normalizeGoogleBook } = require('./utils');

const app = express();
const PORT = process.env.PORT || 3003;

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// Redis Client Initialization
const redisClient = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.on('error', (err) => console.error('Redis Client Error', err)); //TODO standardize logging?
redisClient.connect().then(() => console.log('Connected to Redis')); //TODO standardize logging?

// Bottleneck for Google Books API (Rate Limiting)
const limiter = new Bottleneck({
    minTime: 200,
    maxConcurrent: 3
});

// Health Check
app.get('/health', (req, res) => {
    res.json({ status: 'UP', service: 'Book Metadata Adapter' });
});

// Helper: Fetch with Retry and Throttling
async function fetchWithRetry(url, retries = 3) { //TODO move in utils.js?
    try {
        return await limiter.schedule(() => axios.get(url, {
            responseType: 'arraybuffer',
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' //TODO si può rimuovere?
            }
        }));
    } catch (err) {
        if (err.response?.status === 429 && retries > 0) {
            console.warn(`Rate limit hit for ${url}, retrying in 1s... (${retries} retries left)`); //TODO standardize logging?
            await new Promise(r => setTimeout(r, 1000));
            return fetchWithRetry(url, retries - 1);
        }
        throw err;
    }
}

// Search books by query
app.get('/search', async (req, res) => {
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: 'Query parameter q is required OOOOOOOOOOOHHHHHHHHHS' });

    try {
        const response = await axios.get(process.env.GOOGLE_BOOKS_API_URL, {
            params: {
                q: q,
                key: process.env.GOOGLE_BOOKS_API_KEY || undefined,
            }
        });

        const items = response.data.items || [];
        const normalized = items.map(normalizeGoogleBook);
        res.json(normalized);
    } catch (error) {
        console.error('Google Books API Error:', error.message); //TODO standardize logging?
        res.status(500).json({ message: 'Failed to fetch data from Google Books API', error: error.message });
    }
});

// Lookup book by ISBN
app.get('/isbn/:isbn', async (req, res) => {
    const { isbn } = req.params;

    try {
        const response = await axios.get(process.env.GOOGLE_BOOKS_API_URL, { //TODO max 1
            params: {
                q: `isbn:${isbn}`,
                key: process.env.GOOGLE_BOOKS_API_KEY || undefined
            }
        });

        const items = response.data.items || [];
        if (items.length === 0) return res.status(404).json({ error: 'Book not found' });

        res.json(normalizeGoogleBook(items[0]));
    } catch (error) {
        console.error('Google Books API Error:', error.message); //TODO standardize logging?
        res.status(500).json({ error: 'Failed to fetch data from external API' });
    }
});

// Image Proxy with Redis Cache
app.get('/proxy-image', async (req, res) => {
    const imageUrl = req.query.url;
    if (!imageUrl) return res.status(400).send('URL is required');

    try {
        const urlHash = crypto.createHash('sha256').update(imageUrl).digest('hex');
        const cacheKey = `img_cache:${urlHash}`;

        // Check Redis Cache
        const cachedData = await redisClient.get(cacheKey);

        if (cachedData) {
            try {
                // Base64 encoding prevents binary corruption across services
                const buffer = Buffer.from(cachedData, 'base64');

                // Validate JPEG magic bytes (FF D8)
                if (buffer.length > 2 && buffer[0] === 0xFF && buffer[1] === 0xD8) {
                    console.log(`[PROXY] Cache Hit: ${urlHash} (${buffer.length} bytes)`); //TODO standardize logging?
                    return res.type('image/jpeg').send(buffer);
                }
                console.warn(`[PROXY] Corrupted image in cache for ${urlHash}, re-fetching...`); //TODO standardize logging?
            } catch (e) {
                console.warn(`[PROXY] Cache decoding error for ${urlHash}:`, e.message); //TODO standardize logging?
            }
        }

        // Fetch from source
        console.log(`[PROXY] Cache Miss: Fetching ${imageUrl}`); //TODO standardize logging?
        const response = await fetchWithRetry(imageUrl);
        const buffer = Buffer.from(response.data);

        // Store as Base64
        await redisClient.set(cacheKey, buffer.toString('base64'), {
            EX: 60 * 60 * 24 * 7 // 7 days expiration TODO make it shorter and maybe reset it if requested?
        });

        res.type('image/jpeg').send(buffer);

    } catch (error) {
        console.error('[PROXY] Error:', error.message); //TODO standardize logging?
        if (!res.headersSent) {
            const status = error.response?.status || 500;
            res.status(status).send('Failed to fetch image');
        }
    }
});

app.listen(PORT, () => {
    console.log(`Book Metadata Adapter running on port ${PORT}`); //TODO standardize logging?
});
