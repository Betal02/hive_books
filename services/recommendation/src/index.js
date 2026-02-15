require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const app = express();
const PORT = process.env.PORT || 3004;

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

const axios = require('axios');

// Health Check
app.get('/health', (req, res) => {
    res.json({ status: 'UP', service: 'Recommendation Service' });
});

// Get Recommendations for a user
app.get('/recommendations/:user_id', async (req, res) => {
    const { user_id } = req.params;

    try {
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

        // Filter out books already in library
        const existingIsbns = new Set(books.map(b => b.isbn).filter(i => i));
        recommendations = recommendations.filter(b => !existingIsbns.has(b.isbn));

        console.log('[RECOMMENDATION] Recommendations:', recommendations.length);
        res.json(recommendations.slice(0, 35));
    } catch (error) {
        console.error('[RECOMMENDATION] Failed to generate recommendations:', error.message);
        res.status(500).json({ error: 'Failed to generate recommendations' });
    }
});

app.listen(PORT, () => {
    console.log(`[RECOMMENDATION] Recommendation Service running on port ${PORT}`);
});
