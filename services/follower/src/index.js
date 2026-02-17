require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { createClient } = require('redis');
const { isNewRelease } = require('./utils');

const app = express();
const PORT = process.env.PORT || 3004;

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

const axios = require('axios');

// Redis Client Initialization
const redisClient = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.on('error', (err) => console.error('[FOLLOWER][REDIS] Failed to connect to Redis', err));
redisClient.connect().then(() => console.log('[FOLLOWER][REDIS] Connected to Redis'));

// TTL Constants
const TTL_USER_AUTHORS = (parseInt(process.env.CACHE_TTL_USER_AUTHORS_MIN) || 60) * 60;
const TTL_AUTHOR = (parseInt(process.env.CACHE_TTL_AUTHOR_MIN) || 7 * 24 * 60) * 60;

// Health Check
app.get('/health', (req, res) => {
    res.json({ status: 'UP', service: 'Follower Service' });
});

// Get New Releases for a single author
async function getAuthorReleases(author) {
    const cacheKey = `follower:author:${author}`;

    try {
        const cached = await redisClient.get(cacheKey);
        if (cached) {
            console.log(`[FOLLOWER] Cache Hit: Releases for author ${author}`);
            return JSON.parse(cached);
        }
    } catch (e) {
        console.warn(`[FOLLOWER] Redis error for ${author}:`, e.message);
    }

    console.log(`[FOLLOWER] Cache Miss: Fetching releases for author ${author}`);
    try {
        const response = await axios.get(`${process.env.BOOK_METADATA_URL}/search`, {
            params: { q: `inauthor:"${author}"`, maxResults: 5, orderBy: 'newest' }
        });

        const books = response.data || [];

        // Cache
        await redisClient.set(cacheKey, JSON.stringify(books), {
            EX: TTL_AUTHOR
        });

        return books;
    } catch (err) {
        console.error(`[FOLLOWER] Failed to fetch for ${author}:`, err.message);
        return [];
    }
}

// Get user's authors
async function getUserAuthors(user_id) {
    const cacheKey = `follower:user_authors:${user_id}`;

    try {
        const cached = await redisClient.get(cacheKey);
        if (cached) {
            console.log(`[FOLLOWER] Cache Hit: Authors for user ${user_id}`);
            return JSON.parse(cached);
        }
    } catch (e) {
        console.warn(`[FOLLOWER] Redis error for user ${user_id}:`, e.message);
    }

    console.log(`[FOLLOWER] Cache Miss: Fetching library for user ${user_id}`);
    try {
        const libraryRes = await axios.get(`${process.env.ITEM_DATA_URL}/books/${user_id}`);
        const books = libraryRes.data || [];

        const authors = books.map(b => b.author).filter(a => a);

        const authorCounts = {};
        for (const a of authors) {
            authorCounts[a] = (authorCounts[a] || 0) + 1;
        }

        const sortedAuthors = Object.entries(authorCounts)
            .sort((a, b) => b[1] - a[1])
            .map(entry => entry[0]);

        // Cache
        await redisClient.set(cacheKey, JSON.stringify(sortedAuthors), {
            EX: TTL_USER_AUTHORS
        });

        return sortedAuthors;
    } catch (err) {
        console.error(`[FOLLOWER] Failed to fetch library for user ${user_id}:`, err.message);
        throw err;
    }
}

// Get New Releases for authors in user's library
app.get('/new-releases/:user_id', async (req, res) => {
    const { user_id } = req.params;

    try {
        const authors = await getUserAuthors(user_id);
        if (authors.length === 0) return res.json([]);

        // Fetch recent books for each author
        const releasePromises = authors.slice(0, 8).map(author => getAuthorReleases(author));
        const results = await Promise.all(releasePromises);

        let newReleases = results.flatMap(books => books).filter(b => isNewRelease(b.year));

        res.json(newReleases);
    } catch (error) {
        console.error('[FOLLOWER] Failed to fetch new releases:', error.message);
        res.status(500).json({ error: 'Failed to fetch new releases' });
    }
});

// Get Last Releases for authors in user's library
app.get('/last-releases/:user_id', async (req, res) => {
    const { user_id } = req.params;

    try {
        const authors = await getUserAuthors(user_id);
        if (authors.length === 0) return res.json([]);

        const releaseResults = await Promise.all(authors.slice(0, 5).map(async author => {
            const books = await getAuthorReleases(author);
            return { author, books };
        }));

        const lastReleases = {};
        releaseResults.forEach(res => {
            if (res.books.length > 0) {
                lastReleases[res.author] = res.books;
            }
        });

        res.json(lastReleases);
    } catch (error) {
        console.error('[FOLLOWER] Failed to fetch last releases:', error.message);
        res.status(500).json({ error: 'Failed to fetch last releases' });
    }
});

app.listen(PORT, () => {
    console.log(`[FOLLOWER] Follower Service running on port ${PORT}`);
});
