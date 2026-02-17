require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { createClient } = require('redis');

const app = express();
const PORT = process.env.PORT || 3005;

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

const axios = require('axios');

// Redis Client Initialization
const redisClient = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.on('error', (err) => console.error('[RECOMMENDATION][REDIS] Failed to connect to Redis', err));
redisClient.connect().then(() => console.log('[RECOMMENDATION][REDIS] Connected to Redis'));

// TTL Constants
const TTL_RECOMMENDATION = (parseInt(process.env.CACHE_TTL_RECOMMENDATION) || 24 * 60) * 60;

// Health Check
app.get('/health', (req, res) => {
    res.json({ status: 'UP', service: 'Recommendation Service' });
});

// Get Recommendations for a user
app.get('/recommendations/:user_id', async (req, res) => {
    const { user_id } = req.params;
    const cacheKey = `recommendation:user:${user_id}`;

    try {
        // 1. Check Cache
        const cached = await redisClient.get(cacheKey);
        if (cached) {
            console.log(`[RECOMMENDATION] Cache Hit for user ${user_id}`);
            return res.json(JSON.parse(cached));
        }

        console.log(`[RECOMMENDATION] Cache Miss for user ${user_id}`);

        // Get user's books from Item Data service
        const libraryRes = await axios.get(`${process.env.ITEM_DATA_URL}/books/${user_id}`);
        const books = libraryRes.data;
        const genres = books.map(b => b.genre).filter(g => g);

        // Rank genres by frequency and sort them
        const genreCounts = {};
        for (const g of genres) {
            genreCounts[g] = (genreCounts[g] || 0) + 1;
        }

        const sortedGenres = Object.entries(genreCounts)
            .sort((a, b) => b[1] - a[1])
            .map(entry => entry[0]);

        // Return generic popular books if library is too small or no genres found
        if (sortedGenres.length < 3) {
            const categories = ['fiction', 'nonfiction', 'business', 'manga', 'ya'];
            const popularPromises = categories.map(cat =>
                axios.get(`${process.env.BOOK_METADATA_URL}/nyt/${cat}`).catch(() => ({ data: [] }))
            );

            const responses = await Promise.all(popularPromises);
            const allPopular = responses.flatMap(r => r.data.slice(0, 5));
            return res.json(allPopular);
        }

        // Generate recommendations based on top 5 genres
        let recommendations = [];
        const top5 = sortedGenres.slice(0, 5);
        const limits = [15, 8, 6, 6, 4];

        for (let i = 0; i < top5.length; i++) {
            const label = top5[i];
            const maxResults = limits[i];

            try {
                // Get genre map
                const genreMapRes = await axios.get(`${process.env.BOOK_METADATA_URL}/genres/${encodeURIComponent(label)}`).catch(() => null);
                const genreMap = genreMapRes ? genreMapRes.data : null;

                let queryRes;
                if (genreMap && genreMap.nyt) {
                    // Fetch from NYT if available
                    queryRes = await axios.get(`${process.env.BOOK_METADATA_URL}/nyt/${genreMap.key}`);
                } else if (genreMap && genreMap.googleSubjects) {
                    // Fetch from Google with subjects query
                    const q = genreMap.googleSubjects.join(' ');
                    queryRes = await axios.get(`${process.env.BOOK_METADATA_URL}/search`, {
                        params: { q, maxResults }
                    });
                } else {
                    // Fetch from Google with using not mapped genre
                    queryRes = await axios.get(`${process.env.BOOK_METADATA_URL}/search`, {
                        params: { q: `subject:${label}`, maxResults }
                    });
                }

                if (queryRes && queryRes.data) {
                    recommendations = recommendations.concat(queryRes.data.slice(0, maxResults));
                }
            } catch (err) {
                console.error(`[RECOMMENDATION] Failed to fetch for genre ${label}:`, err.message);
            }
        }
        console.log('[RECOMMENDATION] Recommendations:', recommendations.length);

        // Cache Result
        await redisClient.set(cacheKey, JSON.stringify(recommendations), {
            EX: TTL_RECOMMENDATION
        });

        res.json(recommendations.slice(0, 35));
    } catch (error) {
        console.error('[RECOMMENDATION] Failed to generate recommendations:', error.message);
        res.status(500).json({ error: 'Failed to generate recommendations' });
    }
});

app.listen(PORT, () => {
    console.log(`[RECOMMENDATION] Recommendation Service running on port ${PORT}`);
});
