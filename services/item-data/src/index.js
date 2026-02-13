require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { createHandler } = require('graphql-http/lib/use/express');
const { schema, root } = require('./schema');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(helmet({
  contentSecurityPolicy: false, //TODO figure out how to remove in production
}));
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'UP', service: 'Item Data Service' });
});

/**
 * GraphQL Endpoint
 */
app.all('/graphql', createHandler({
  schema: schema,
  rootValue: root,
}));

app.get('/graphiql', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <title>GraphiQL</title>
      <link href="https://unpkg.com/graphiql/graphiql.min.css" rel="stylesheet" />
    </head>
    <body style="margin: 0;">
      <div id="graphiql" style="height: 100vh;"></div>
      <script crossorigin src="https://unpkg.com/react/umd/react.production.min.js"></script>
      <script crossorigin src="https://unpkg.com/react-dom/umd/react-dom.production.min.js"></script>
      <script crossorigin src="https://unpkg.com/graphiql/graphiql.min.js"></script>
      <script>
        const fetcher = GraphiQL.createFetcher({ url: '/graphql' });
        ReactDOM.render(
          React.createElement(GraphiQL, { fetcher: fetcher }),
          document.getElementById('graphiql'),
        );
      </script>
    </body>
    </html>
  `);
});

/**
 * REST Endpoints
 */
app.get('/books/:user_id', (req, res) => {
  db.all('SELECT * FROM books WHERE user_id = ?', [req.params.user_id], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Internal server error' });
    res.json(rows);
  });
});

app.post('/books', (req, res) => {
  const { user_id, title } = req.body;
  if (!user_id || !title) return res.status(400).json({ error: 'User ID and Title are required' });

  const sql = `
    INSERT INTO books (user_id, isbn, title, author, thumbnail, genre, year, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const params = [
    user_id,
    req.body.isbn || null,
    title,
    req.body.author || null,
    req.body.thumbnail || null,
    req.body.genre || null,
    req.body.year || null,
    req.body.description || null
  ];

  db.run(sql, params, function (err) {
    if (err) return res.status(500).json({ error: 'Internal server error' }); //TODO: give more info type err

    db.get('SELECT * FROM books WHERE id = ?', [this.lastID], (err, row) => {
      if (err) return res.status(500).json({ error: 'Internal server error' }); //TODO: give more info type err
      res.status(201).json(row);
    });
  });
});

//TODO: edit/update book

app.delete('/books/:id', (req, res) => {
  db.run('DELETE FROM books WHERE id = ?', [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: 'Internal server error' }); //TODO: give more info type err
    if (this.changes === 0) return res.status(404).json({ error: 'Book not found' });
    res.json({ message: 'Book deleted' });
  });
});

app.listen(PORT, () => {
  console.log(`[ITEM-DATA] Item Data Service running on port ${PORT}`);
  console.log(`[ITEM-DATA] GraphiQL available at http://localhost:${PORT}/graphiql`);
});
