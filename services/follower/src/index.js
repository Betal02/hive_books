require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

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
    const cachedData = cache.get(user_id);
    if (cachedData && (Date.now() - cachedData.timestamp < CACHE_TTL)) {
        console.log(`[FOLLOWER] Serving cached releases for user ${user_id}`);
        return res.json(cachedData.data);
    }

    try {
        // Get user's books from Item Data service
        const libraryRes = await axios.get(`${process.env.ITEM_DATA_URL}/books/${user_id}`);
        const books = libraryRes.data;

        if (books.length === 0) return res.json([]);

        // Extract unique authors
        const authors = [...new Set(books.map(b => b.author).filter(a => a))];

        // Fetch recent books for each author
        const releasePromises = authors.slice(0, 5).map(author =>
            axios.get(`${process.env.BOOK_METADATA_URL}/search?q=inauthor:"${author}"&orderBy=newest`)
        );

        const responses = await Promise.all(releasePromises);
        let allReleases = responses.flatMap(r => r.data);

        // Filter and sort
        const existingTitles = new Set(books.map(b => b.title.toLowerCase()));
        const newReleases = allReleases
            .filter(b => !existingTitles.has(b.title.toLowerCase()))
            .slice(0, 15);

        // Update cache
        cache.set(user_id, {
            timestamp: Date.now(),
            data: newReleases
        });

        res.json(newReleases);
    } catch (error) {
        console.error('[FOLLOWER] Failed to fetch new releases:', error.message);
        res.status(500).json({ error: 'Failed to fetch new releases' });
    }
});

app.listen(PORT, () => {
    console.log(`[FOLLOWER] Follower Service running on port ${PORT}`);
});
