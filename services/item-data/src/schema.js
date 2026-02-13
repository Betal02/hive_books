const { buildSchema } = require('graphql');
const db = require('./db');

const schema = buildSchema(`
  type Book {
    id: ID!
    user_id: Int!
    isbn: String
    title: String!
    author: String
    thumbnail: String
    genre: String
    year: String
    description: String
    created_at: String
  }

  type Query {
    books(user_id: Int!): [Book]
    book(id: ID!): Book
  }

  type Mutation {
    addBook(
      user_id: Int!,
      isbn: String,
      title: String!,
      author: String,
      thumbnail: String,
      genre: String,
      year: String,
      description: String
    ): Book
    deleteBook(id: ID!): Boolean
  }
`);

const root = {
    books: ({ user_id }) => {
        return new Promise((resolve, reject) => {
            db.all('SELECT * FROM books WHERE user_id = ?', [user_id], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    },
    book: ({ id }) => {
        return new Promise((resolve, reject) => {
            db.get('SELECT * FROM books WHERE id = ?', [id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    },
    addBook: ({ user_id, isbn, title, author, thumbnail, genre, year, description }) => {
        return new Promise((resolve, reject) => {
            const sql = `
        INSERT INTO books (user_id, isbn, title, author, thumbnail, genre, year, description)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;
            db.run(sql, [user_id, isbn, title, author, thumbnail, genre, year, description], function (err) {
                if (err) return reject(err);
                const lastID = this.lastID;
                db.get('SELECT * FROM books WHERE id = ?', [lastID], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });
        });
    },
    deleteBook: ({ id }) => {
        return new Promise((resolve, reject) => {
            db.run('DELETE FROM books WHERE id = ?', [id], function (err) {
                if (err) reject(err);
                else resolve(this.changes > 0);
            });
        });
    },
    updateBook: ({ id, user_id, isbn, title, author, thumbnail, genre, year, description }) => {
        return new Promise((resolve, reject) => {
            const sql = `
        UPDATE books SET user_id = ?, isbn = ?, title = ?, author = ?, thumbnail = ?, genre = ?, year = ?, description = ? WHERE id = ?
      `;
            db.run(sql, [user_id, isbn, title, author, thumbnail, genre, year, description, id], function (err) {
                if (err) reject(err);
                else resolve(this.changes > 0);
            });
        });
    }
};

module.exports = { schema, root };
