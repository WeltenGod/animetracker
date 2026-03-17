require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const authRoutes = require('./routes/auth');
const db = require('./database');

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

const axios = require('axios');

// Routes
app.use('/auth', authRoutes);

// API Routes
app.get('/api/search', async (req, res) => {
    const query = req.query.q;
    if (!query) {
        return res.status(400).json({ error: 'Search query is required' });
    }

    try {
        const graphqlQuery = `
            query ($search: String) {
                Page(page: 1, perPage: 10) {
                    media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
                        id
                        title {
                            romaji
                            english
                        }
                        coverImage {
                            large
                        }
                    }
                }
            }
        `;

        const response = await axios.post('https://graphql.anilist.co', {
            query: graphqlQuery,
            variables: { search: query }
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            }
        });

        res.json(response.data.data.Page.media);

    } catch (error) {
        console.error("Search Error:", error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Failed to search AniList' });
    }
});

app.post('/api/sync', async (req, res) => {
    const { animeId, episode, userIds } = req.body;

    if (!animeId || !episode || !userIds || !Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({ error: 'Missing required fields or user selection.' });
    }

    const results = [];

    const graphqlMutation = `
        mutation ($mediaId: Int, $progress: Int, $status: MediaListStatus) {
            SaveMediaListEntry (mediaId: $mediaId, progress: $progress, status: $status) {
                id
                status
                progress
            }
        }
    `;

    for (const userId of userIds) {
        // Fetch user from DB
        const stmt = db.prepare('SELECT name, anilist_token FROM users WHERE id = ?');
        const user = stmt.get(userId);

        if (!user || !user.anilist_token) {
            results.push({ id: userId, name: user?.name || 'Unknown', success: false, error: 'No AniList token found.' });
            continue;
        }

        try {
            await axios.post('https://graphql.anilist.co', {
                query: graphqlMutation,
                variables: {
                    mediaId: parseInt(animeId),
                    progress: parseInt(episode),
                    status: 'CURRENT' // Set to currently watching
                }
            }, {
                headers: {
                    'Authorization': `Bearer ${user.anilist_token}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                }
            });

            results.push({ id: userId, name: user.name, success: true });
        } catch (error) {
            console.error(`Sync Error for user ${user.name}:`, error.response ? error.response.data : error.message);
            results.push({ id: userId, name: user.name, success: false, error: 'API Error' });
        }
    }

    res.json({ results });
});

app.get('/', (req, res) => {
    const successMsg = req.query.success;

    // Fetch all connected users
    const stmt = db.prepare('SELECT id, name FROM users');
    const users = stmt.all();

    res.render('index', { successMsg, users });
});

app.listen(port, () => {
    console.log(`Anime Sync app listening at http://localhost:${port}`);
});
