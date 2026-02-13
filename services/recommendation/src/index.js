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

        //TODO refactoring: Usare NYT Best Sellers per avere ISBN ranks, estrarre prima genere, poi se vuoto prendere Weeks on list, altrimenti ordinare generi per frequenza e fare query su quello

        if (books.length === 0) {
            // Return popular books if library is empty
            const popularRes = await axios.get(`${process.env.BOOK_METADATA_URL}/search?q=subject:fiction`); //TODO implement exception handling and find a dedicated endpoint for popular books
            return res.json(popularRes.data.slice(0, 10));
        }

        // Extract most frequent genres
        const genres = books.map(b => b.genre).filter(g => g);
        const topGenre = genres.length > 0 ? genres[0] : 'Fiction'; //TODO implement more complex logic (e.g. weighted average of genres)

        // Search for books in that genre via Metadata Adapter
        const recommendRes = await axios.get(`${process.env.BOOK_METADATA_URL}/search?q=subject:${topGenre}`);

        // Filter out books already in library
        const existingIsbns = new Set(books.map(b => b.isbn).filter(i => i));
        const recommendations = recommendRes.data.filter(b => !existingIsbns.has(b.isbn));

        res.json(recommendations.slice(0, 10));
    } catch (error) {
        console.error('Recommendation Error:', error.message);
        res.status(500).json({ error: 'Failed to generate recommendations' });
    }
});

app.listen(PORT, () => {
    console.log(`Recommendation Service running on port ${PORT}`);
});
