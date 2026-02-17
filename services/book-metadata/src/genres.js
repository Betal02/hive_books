const GENRE_MAPPING = {
    fiction: {
        label: "Fiction",
        nyt: "hardcover-fiction",
        googleSubjects: [
            "subject:fiction",
            "subject:novel"
        ]
    },

    nonfiction: {
        label: "Non Fiction",
        nyt: "hardcover-nonfiction",
        googleSubjects: [
            "subject:nonfiction",
            "subject:biography",
            "subject:history",
        ]
    },

    business: {
        label: "Business",
        nyt: "business-books",
        googleSubjects: [
            "subject:business",
            "subject:economy",
            "subject:leadership",
            "subject:management"
        ]
    },

    manga: {
        label: "Manga",
        nyt: "graphic-books-and-manga",
        googleSubjects: [
            "subject:manga",
            "subject:graphic",
            "subject:comics",
            "subject:anime"
        ]
    },

    ya: {
        label: "Young Adult",
        nyt: "young-adult-hardcover",
        googleSubjects: [
            "subject:young",
            "subject:teen",
        ]
    },

    advice: {
        label: "Advice & Self Help",
        nyt: "advice-how-to-and-miscellaneous",
        googleSubjects: [
            "subject:help",
            "subject:personal",
            "subject:motivation",
            "subject:psychology",
            "subject:relationships"
        ]
    },

    combined: {
        label: "Trending",
        nyt: "combined-print-and-e-book-fiction",
        googleSubjects: [
            "subject:fiction"
        ]
    },

    // Only Google Books API

    fantasy: {
        label: "Fantasy",
        nyt: null,
        googleSubjects: [
            "subject:fantasy",
            "subject:epic",
            "subject:magic"
        ]
    },

    scifi: {
        label: "Sci-Fi",
        nyt: null,
        googleSubjects: [
            "subject:scifi",
            "subject:dystopian",
            "subject:space",
            "subject:cyberpunk"
        ]
    },

    romance: {
        label: "Romance",
        nyt: null,
        googleSubjects: [
            "subject:romance",
            "subject:romantic",
            "subject:love"
        ]
    },

    thriller: {
        label: "Thriller",
        nyt: null,
        googleSubjects: [
            "subject:thriller",
            "subject:mystery",
            "subject:crime",
            "subject:suspense"
        ]
    },

    horror: {
        label: "Horror",
        nyt: null,
        googleSubjects: [
            "subject:horror",
            "subject:gothic"
        ]
    }
};

/**
 * Get the full mapping for a specific genre key.
 * @param {string} key - The genre key (e.g., 'fiction', 'fantasy').
 * @returns {object|null}
 */
const getGenre = (key) => GENRE_MAPPING[key] || null;

/**
 * Get all available genre keys.
 * @returns {string[]}
 */
const getAllGenreKeys = () => Object.keys(GENRE_MAPPING);

/**
 * Get genre key from label.
 * @param {string} label - The genre label (e.g., 'Fiction', 'Fantasy').
 * @returns {string|null}
 */
const getGenreFromLabel = (label) => Object.keys(GENRE_MAPPING).find(key => GENRE_MAPPING[key].label === label) || null;

/**
 * Get genre keys that have an associated NYT list.
 * @returns {string[]}
 */
const getNytGenreKeys = () => Object.keys(GENRE_MAPPING).filter(key => GENRE_MAPPING[key].nyt !== null);

/**
 * Find the matching genre label from a list of categories (e.g. from Google Books)
 * @param {string[]} categories - Array of categories/subjects
 * @returns {string|null}
 */
const findGenreLabel = (categories) => {
    if (!categories || !Array.isArray(categories)) return null;

    const clean = (s) => s.toLowerCase().replace('subject:', '').trim();
    for (const cat of categories) {
        const cleanCat = clean(cat);
        for (const key in GENRE_MAPPING) {
            const genre = GENRE_MAPPING[key];
            if (genre.googleSubjects.some(sub => clean(sub) === cleanCat)) {
                return genre.label;
            }
        }
    }
    return null;
};

module.exports = {
    GENRE_MAPPING,
    getGenre,
    getGenreFromLabel,
    getAllGenreKeys,
    getNytGenreKeys,
    findGenreLabel
};
