const { findGenreLabel } = require('./genres');

/**
 * Normalizes Google Books API response
 */
function normalizeGoogleBook(item) {
    const info = item.volumeInfo || {};
    const isbnObj = info.industryIdentifiers?.find(id => id.type === 'ISBN_13') ||
        info.industryIdentifiers?.find(id => id.type === 'ISBN_10');

    const matchingLabel = findGenreLabel(info.categories);

    return {
        isbn: isbnObj ? isbnObj.identifier : null,
        title: info.title || 'Unknown Title',
        author: info.authors ? info.authors.join(', ') : 'Unknown Author',
        thumbnail: info.imageLinks ? info.imageLinks.thumbnail.replace('http:', 'https:') : null,
        genre: matchingLabel || (info.categories ? info.categories[0] : null),
        year: info.publishedDate ? info.publishedDate.split('-')[0] : null,
        description: info.description || ''
    };
}

function normalizeNYTBook(item, genre) {
    const isbnObj = item.primary_isbn13 ||
        item.primary_isbn10;

    return {
        isbn: isbnObj,
        title: item.title || 'Unknown Title',
        author: item.author || 'Unknown Author',
        thumbnail: item.book_image || null,
        genre: genre || null,
        year: item.created_date ? item.created_date.split('-')[0] : null,
        description: item.description || ''
    };
}

module.exports = { normalizeGoogleBook, normalizeNYTBook };
