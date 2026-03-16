const express = require('express');
const session = require('express-session');
const path = require('path');
require('dotenv').config();

const db = require('./database');
const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

// Setup Session Middleware
app.use(session({
    secret: process.env.SESSION_SECRET || 'fallback_secret',
    resave: false,
    saveUninitialized: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static('public'));

// Routes
app.use('/auth', authRoutes);
app.use('/api', apiRoutes);

// Main Page
app.get('/', (req, res) => {
    const users = db.prepare('SELECT name, anilist_token, mal_token FROM users').all();
    res.render('index', { users });
});

app.listen(PORT, () => {
    console.log(`Anime Sync Server running at http://localhost:${PORT}`);
});
