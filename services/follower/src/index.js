require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { isNewRelease } = require('./utils');

const app = express();
const PORT = process.env.PORT || 3005;

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

const axios = require('axios');

// In-memory cache
const cache = new Map();
const CACHE_TTL = (process.env.CACHE_TTL_MINUTES || 60) * 60 * 1000;

// Health Check
app.get('/health', (req, res) => {
    res.json({ status: 'UP', service: 'Follower Service' });
});

// Get New Releases for authors in user's library
app.get('/new-releases/:user_id', async (req, res) => {
    const { user_id } = req.params;

    // Check cache
    const cacheKey = `new-releases-${user_id}`;
    const cachedData = cache.get(cacheKey);
    if (cachedData && cachedData.newReleases && (Date.now() - cachedData.timestamp < CACHE_TTL)) {
        console.log(`[FOLLOWER] Cache Hit: Serving new releases for user ${user_id}`);

        // Filter out books already in library and not new releases
        const libraryRes = await axios.get(`${process.env.ITEM_DATA_URL}/books/${user_id}`);
        const books = libraryRes.data;
        const existingIsbns = new Set(books.map(b => b.isbn).filter(i => i));
        const filteredNewReleases = cachedData.newReleases.filter(b => !existingIsbns.has(b.isbn));

        return res.json(filteredNewReleases);
    }

    console.log(`[FOLLOWER] Cache Miss: Fetching new releases for user ${user_id}`);

    try {
        // Get user's books from Item Data service
        const libraryRes = await axios.get(`${process.env.ITEM_DATA_URL}/books/${user_id}`);
        const books = libraryRes.data;

        if (books.length === 0) return res.json([]);

        // Extract unique authors
        const authors = books.map(b => b.author).filter(a => a);
        const uniqueAuthors = [...new Set(authors)];

        // Fetch recent books for each author
        const releasePromises = uniqueAuthors.slice(0, 5).map(author =>
            axios.get(`${process.env.BOOK_METADATA_URL}/search`, {
                params: { q: `inauthor:"${author}"`, maxResults: 5, orderBy: 'newest' }
            })
        );

        const responses = await Promise.all(releasePromises);

        let newReleases = responses.flatMap(r => r.data).filter(b => isNewRelease(b.year));

        // Update cache
        cache.set(cacheKey, {
            timestamp: Date.now(),
            newReleases: newReleases
        });

        // Filter out books already in library and not new releases
        const existingIsbns = new Set(books.map(b => b.isbn).filter(i => i));
        const filteredNewReleases = newReleases.filter(b => !existingIsbns.has(b.isbn));

        res.json(filteredNewReleases);
    } catch (error) {
        console.error('[FOLLOWER] Failed to fetch new releases:', error.message);
        res.status(500).json({ error: 'Failed to fetch new releases' });
    }
});

// Get Last Releases for authors in user's library
app.get('/last-releases/:user_id', async (req, res) => {
    const { user_id } = req.params;
    const cacheKey = `last-releases-${user_id}`;

    // Check cache
    const cachedData = cache.get(cacheKey);
    if (cachedData && cachedData.lastReleases && (Date.now() - cachedData.timestamp < CACHE_TTL)) {
        console.log(`[FOLLOWER] Cache Hit: Serving last releases for user ${user_id}`);
        return res.json(cachedData.lastReleases);
    }

    console.log(`[FOLLOWER] Cache Miss: Fetching last releases for user ${user_id}`);

    try {
        // Get user's books from Item Data service
        const libraryRes = await axios.get(`${process.env.ITEM_DATA_URL}/books/${user_id}`);
        const books = libraryRes.data;

        if (books.length === 0) return res.json([]);

        const authors = books.map(b => b.author).filter(a => a);
        const existingIsbns = new Set(books.map(b => b.isbn).filter(i => i));

        // Rank authors by frequency
        const authorCounts = {};
        for (const a of authors) {
            authorCounts[a] = (authorCounts[a] || 0) + 1;
        }

        const sortedAuthors = Object.entries(authorCounts)
            .sort((a, b) => b[1] - a[1])
            .map(entry => entry[0]);

        // Fetch recent books for each author
        const releaseResults = await Promise.all(sortedAuthors.slice(0, 5).map(async author => {
            try {
                const response = await axios.get(`${process.env.BOOK_METADATA_URL}/search`, {
                    params: { q: `inauthor:"${author}"`, maxResults: 5, orderBy: 'newest' }
                });
                // Filter out books already in library
                const filteredBooks = response.data.filter(b => !existingIsbns.has(b.isbn));
                return { author, books: filteredBooks };
            } catch (err) {
                console.error(`[FOLLOWER] Failed to fetch for ${author}:`, err.message);
                return { author, books: [] };
            }
        }));

        const lastReleases = {};
        releaseResults.forEach(res => {
            if (res.books.length > 0) {
                lastReleases[res.author] = res.books;
            }
        });

        // Update cache
        cache.set(cacheKey, {
            timestamp: Date.now(),
            lastReleases: lastReleases
        });

        res.json(lastReleases);
    } catch (error) {
        console.error('[FOLLOWER] Failed to fetch new releases:', error.message);
        res.status(500).json({ error: 'Failed to fetch new releases' });
    }
});

app.listen(PORT, () => {
    console.log(`[FOLLOWER] Follower Service running on port ${PORT}`);
});
