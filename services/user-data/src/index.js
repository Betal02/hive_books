require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const db = require('./db');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// Health Check
app.get('/health', (req, res) => {
    res.json({ status: 'UP', service: 'User Data Service' });
});

// Register
app.post('/register', (req, res) => {
    const { email, password, name } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const sql = 'INSERT INTO users (email, password, name) VALUES (?, ?, ?)';

    db.run(sql, [email, hashedPassword, name || null], function (err) {
        if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
                return res.status(400).json({ error: 'Email already exists' });
            }
            return res.status(500).json({ error: 'Internal server error' });
        }
        res.status(201).json({ id: this.lastID, email, name });
    });
});

// Login
app.post('/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
    }

    const sql = 'SELECT * FROM users WHERE email = ?';
    db.get(sql, [email], (err, user) => {
        if (err) return res.status(500).json({ error: 'Internal server error' });

        if (!user || !bcrypt.compareSync(password, user.password)) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Returning user without password
        const { password: _, ...userSafe } = user;
        res.json(userSafe);
    });
});

// Get User by ID
app.get('/users/:id', (req, res) => {
    const sql = 'SELECT id, email, name, created_at FROM users WHERE id = ?';
    db.get(sql, [req.params.id], (err, user) => {
        if (err) return res.status(500).json({ error: 'Internal server error' });
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json(user);
    });
});

app.listen(PORT, () => {
    console.log(`User Data Service running on port ${PORT}`); //TODO: standardize logs and allow in dev mode?
});
