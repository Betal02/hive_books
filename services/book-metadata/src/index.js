require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const crypto = require('crypto');
const axios = require('axios');
const { createClient } = require('redis');
const Bottleneck = require('bottleneck');
const { normalizeGoogleBook, normalizeNYTBook } = require('./utils');
const { getGenre, getGenreFromLabel } = require('./genres');

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

redisClient.on('error', (err) => console.error('[METADATA][REDIS] Failed to connect to Redis', err));
redisClient.connect().then(() => console.log('[METADATA][REDIS] Connected to Redis'));

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
            console.warn(`[METADATA] Rate limit hit for ${url}, retrying in 1s... (${retries} retries left)`);
            await new Promise(r => setTimeout(r, 1000));
            return fetchWithRetry(url, retries - 1);
        }
        throw err;
    }
}

/**
 * Google Books API
 */

const fieldsStr = 'items(id,volumeInfo/title,volumeInfo/authors,volumeInfo/publishedDate,volumeInfo/description,volumeInfo/industryIdentifiers,volumeInfo/imageLinks,volumeInfo/categories)';

// Search books by query
app.get('/search', async (req, res) => {
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: 'Query parameter q is required' });

    try {
        const response = await axios.get(process.env.GOOGLE_BOOKS_API_URL, {
            params: {
                q: q,
                fields: fieldsStr,
                orderBy: 'relevance',
                langRestrict: 'en',
                key: process.env.GOOGLE_BOOKS_API_KEY || undefined,
            }
        });

        const items = response.data.items || [];
        const normalized = items.map(normalizeGoogleBook);
        res.json(normalized);
    } catch (error) {
        console.error('[METADATA] Failed to fetch data from Google Books API:', error.message);
        res.status(500).json({ message: 'Failed to fetch data from Google Books API', error: error.message });
    }
});

// Search books by query with advanced options
app.get('/search/advanced', async (req, res) => {
    const { q, maxResults, orderBy, langRestrict } = req.query;
    if (!q) return res.status(400).json({ error: 'Query parameter q is required' });

    try {
        const response = await axios.get(process.env.GOOGLE_BOOKS_API_URL, {
            params: {
                q,
                fields: fieldsStr,
                maxResults: maxResults || 15,
                orderBy: orderBy || 'relevance',
                langRestrict: langRestrict || 'en',
                key: process.env.GOOGLE_BOOKS_API_KEY || undefined,
            }
        });

        const items = response.data.items || [];
        const normalized = items.map(normalizeGoogleBook);
        res.json(normalized);
    } catch (error) {
        console.error('[METADATA] Failed to fetch data from Google Books API:', error.message);
        res.status(500).json({ message: 'Failed to fetch data from Google Books API', error: error.message });
    }
});

// Search book by ISBN
app.get('/isbn/:isbn', async (req, res) => {
    const { isbn } = req.params;

    try {
        const response = await axios.get(process.env.GOOGLE_BOOKS_API_URL, {
            params: {
                q: `isbn:${isbn}`,
                fields: fieldsStr,
                maxResults: 1,
                orderBy: 'relevance',
                key: process.env.GOOGLE_BOOKS_API_KEY || undefined,
            }
        });

        const items = response.data.items || [];
        if (items.length === 0) return res.status(404).json({ error: 'Book not found' });

        res.json(normalizeGoogleBook(items[0]));
    } catch (error) {
        console.error('[METADATA] Failed to fetch data from Google Books API:', error.message);
        res.status(500).json({ error: 'Failed to fetch data from Google Books API' });
    }
});

/**
 * NYT API
 */

app.get('/nyt/:category', async (req, res) => {
    const genre = getGenre(req.params.category);

    if (!genre || !genre.nyt) {
        return res.status(400).json({ message: 'Invalid or unsupported NYT category' });
    }

    try {
        const response = await axios.get(
            `${process.env.NYT_API_URL}${genre.nyt}.json`,
            {
                params: {
                    'api-key': process.env.NYT_API_KEY
                }
            }
        );

        const items = response.data.results.books || [];
        const normalized = items.map(item => normalizeNYTBook(item, genre.label));
        res.json(normalized);
    } catch (error) {
        console.error('[METADATA] Failed to fetch data from NYT API:', error.message);
        res.status(500).json({ message: 'Failed to fetch data from NYT API', error: error.message });
    }
});

/**
 * Genre Metadata API
 */

app.get('/genres/:label', (req, res) => {
    const genreKey = getGenreFromLabel(req.params.label);
    if (!genreKey) return res.status(404).json({ error: 'Genre not found' });
    res.json({ key: genreKey, ...getGenre(genreKey) });
});

/**
 * Image Proxy (with Redis)
 */
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
                    console.log(`[METADATA][REDIS] Cache Hit: ${urlHash} (${buffer.length} bytes)`);
                    return res.type('image/jpeg').send(buffer);
                }
                console.warn(`[METADATA][REDIS] Corrupted image in cache for ${urlHash}, re-fetching...`);
            } catch (e) {
                console.warn(`[METADATA][REDIS] Cache decoding error for ${urlHash}:`, e.message);
            }
        }

        // Fetch from source
        console.log(`[METADATA][REDIS] Cache Miss: Fetching ${imageUrl}`);
        const response = await fetchWithRetry(imageUrl);
        const buffer = Buffer.from(response.data);

        // Store as Base64
        await redisClient.set(cacheKey, buffer.toString('base64'), {
            EX: 60 * 60 * 24 * 7 // 7 days expiration TODO make it shorter and maybe reset it if requested?
        });

        res.type('image/jpeg').send(buffer);

    } catch (error) {
        console.error('[METADATA][REDIS] Error:', error.message);
        if (!res.headersSent) {
            const status = error.response?.status || 500;
            res.status(status).send('Failed to fetch image');
        }
    }
});

app.listen(PORT, () => {
    console.log(`[METADATA] Book Metadata Adapter running on port ${PORT}`);
});
