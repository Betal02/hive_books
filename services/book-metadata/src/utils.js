/**
 * Normalizes Google Books API response
 */
function normalizeGoogleBook(item) {
    const info = item.volumeInfo || {};
    const isbnObj = info.industryIdentifiers?.find(id => id.type === 'ISBN_13') ||
        info.industryIdentifiers?.find(id => id.type === 'ISBN_10');

    return {
        isbn: isbnObj ? isbnObj.identifier : null,
        title: info.title || 'Unknown Title',
        author: info.authors ? info.authors.join(', ') : 'Unknown Author',
        thumbnail: info.imageLinks ? info.imageLinks.thumbnail.replace('http:', 'https:') : null,
        genre: info.categories ? info.categories[0] : null,
        year: info.publishedDate ? info.publishedDate.split('-')[0] : null,
        description: info.description || ''
    };
}

module.exports = { normalizeGoogleBook };
