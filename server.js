require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const authRoutes = require('./routes/auth');

const app = express();
const port = process.env.PORT || 3000;

// Set up view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Session
app.use(session({
    secret: process.env.SESSION_SECRET || 'fallback_secret',
    resave: false,
    saveUninitialized: false
}));

// Routes
app.use('/auth', authRoutes);

app.get('/', (req, res) => {
    const successMsg = req.query.success;
    let html = `<h1>Anime Watch Party Sync</h1>`;
    if (successMsg) {
        html += `<p style="color: green;">Success: ${successMsg}</p>`;
    }
    html += `
        <ul>
            <li><a href="/auth/anilist">Connect AniList</a></li>
            <li><a href="/auth/mal">Connect MyAnimeList</a></li>
        </ul>
        <p>Dashboard functionality coming soon.</p>
    `;
    res.send(html);
});

app.listen(port, () => {
    console.log(`Anime Sync app listening at http://localhost:${port}`);
});
