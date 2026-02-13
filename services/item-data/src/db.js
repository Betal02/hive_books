const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();

const dbPath = path.resolve(__dirname, '..', process.env.DB_PATH || './library.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database', err.message); //TODO: standardize logs and allow in dev mode?
  } else {
    console.log(`Item Database connected at ${dbPath}`); //TODO: standardize logs and allow in dev mode?

    // Initialize schema
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS books (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          isbn TEXT,
          title TEXT NOT NULL,
          author TEXT,
          thumbnail TEXT,
          genre TEXT,
          year TEXT,
          description TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      db.run(`CREATE INDEX IF NOT EXISTS idx_books_user ON books(user_id)`);
    });
  }
});

module.exports = db;
