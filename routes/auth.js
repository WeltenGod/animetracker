const express = require('express');
const axios = require('axios');
const router = express.Router();
const db = require('../database');

// 1. Redirect to AniList
router.get('/anilist', (req, res) => {
    const clientId = process.env.ANILIST_CLIENT_ID;
    const redirectUri = process.env.ANILIST_REDIRECT_URI;

    if (!clientId || !redirectUri) {
        return res.status(500).send("AniList OAuth not configured in .env");
    }

    const authUrl = `https://anilist.co/api/v2/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code`;
    res.redirect(authUrl);
});

// 2. Handle callback
router.get('/anilist/callback', async (req, res) => {
    const code = req.query.code;

    if (!code) {
        return res.status(400).send("No code provided by AniList.");
    }

    try {
        // Exchange code for access token
        const tokenResponse = await axios.post('https://anilist.co/api/v2/oauth/token', {
            client_id: process.env.ANILIST_CLIENT_ID,
            client_secret: process.env.ANILIST_CLIENT_SECRET,
            grant_type: 'authorization_code',
            redirect_uri: process.env.ANILIST_REDIRECT_URI,
            code: code,
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            }
        });

        const accessToken = tokenResponse.data.access_token;

        // Fetch user's AniList info using the token
        const userQuery = `
            query {
                Viewer {
                    id
                    name
                }
            }
        `;

        const userResponse = await axios.post('https://graphql.anilist.co', {
            query: userQuery
        }, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            }
        });

        const anilistUser = userResponse.data.data.Viewer;

        // Store or update in database
        const stmt = db.prepare(`
            INSERT INTO users (name, anilist_token, anilist_id)
            VALUES (?, ?, ?)
            ON CONFLICT(name) DO UPDATE SET
            anilist_token = excluded.anilist_token,
            anilist_id = excluded.anilist_id
        `);

        stmt.run(anilistUser.name, accessToken, anilistUser.id);

        // Save the anilist username in the session so we know who is connecting MAL next
        req.session.anilist_username = anilistUser.name;

        res.redirect('/?success=anilist_connected');

    } catch (error) {
        console.error("AniList OAuth Error:", error.response ? error.response.data : error.message);
        res.status(500).send("Failed to authenticate with AniList.");
    }
});

// 3. Redirect to MyAnimeList
router.get('/mal', (req, res) => {
    const clientId = process.env.MAL_CLIENT_ID;
    const redirectUri = process.env.MAL_REDIRECT_URI;

    if (!clientId || !redirectUri) {
        return res.status(500).send("MyAnimeList OAuth not configured in .env");
    }

    if (!req.session.anilist_username) {
        return res.status(400).send("Please connect AniList first before connecting MyAnimeList.");
    }

    // Generate code verifier (PKCE) for MAL
    const crypto = require('crypto');
    const codeVerifier = crypto.randomBytes(64).toString('base64url');

    // Save the verifier to the session
    req.session.mal_code_verifier = codeVerifier;

    const authUrl = `https://myanimelist.net/v1/oauth2/authorize?response_type=code&client_id=${clientId}&code_challenge=${codeVerifier}&state=request&redirect_uri=${encodeURIComponent(redirectUri)}`;

    res.redirect(authUrl);
});

// 4. Handle MAL callback
router.get('/mal/callback', async (req, res) => {
    const code = req.query.code;
    const codeVerifier = req.session.mal_code_verifier;
    const anilistUsername = req.session.anilist_username;

    if (!code) {
        return res.status(400).send("No code provided by MyAnimeList.");
    }

    if (!codeVerifier || !anilistUsername) {
        return res.status(400).send("Session expired or missing verifier/username. Please try connecting AniList and MAL again.");
    }

    try {
        const tokenResponse = await axios.post('https://myanimelist.net/v1/oauth2/token', new URLSearchParams({
            client_id: process.env.MAL_CLIENT_ID,
            client_secret: process.env.MAL_CLIENT_SECRET,
            grant_type: 'authorization_code',
            redirect_uri: process.env.MAL_REDIRECT_URI,
            code: code,
            code_verifier: codeVerifier
        }), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            }
        });

        const { access_token, refresh_token, expires_in } = tokenResponse.data;

        // Save to DB linked to the current user
        const stmt = db.prepare(`
            UPDATE users SET
            mal_token = ?,
            mal_refresh_token = ?,
            mal_expires_in = ?,
            mal_token_created_at = ?
            WHERE name = ?
        `);

        stmt.run(access_token, refresh_token, expires_in, Date.now(), anilistUsername);

        res.redirect('/?success=mal_connected');

    } catch (error) {
        console.error("MyAnimeList OAuth Error:", error.response ? error.response.data : error.message);
        res.status(500).send("Failed to authenticate with MyAnimeList.");
    }
});
module.exports = router;
