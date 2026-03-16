# Anime Watch Party Sync

This is a lightweight Node.js application designed to run in a Proxmox container (or any Docker/LXC environment) to automatically synchronize anime watch progress across multiple AniList and MyAnimeList accounts simultaneously.

## Features
- **Centralized Dashboard**: See who has connected their accounts.
- **Unified Search**: Search for an anime once, and the app automatically maps it to both AniList and MyAnimeList IDs.
- **One-Click Sync**: Enter the episode number you just finished watching, click sync, and everyone's linked accounts will be updated instantly.

## Prerequisites
- Node.js (v16+)
- A local SQLite database (created automatically on the first run).

---

## 🚀 Setup Instructions for Proxmox / Local Server

### 1. Clone & Install
Log into your Proxmox container, navigate to the directory where you want to host this, and run:

```bash
git clone <your-repo-url>
cd anime-sync-app
npm install
```

### 2. Configure Environment Variables
You need to create a `.env` file to hold your API keys.

```bash
cp .env.example .env
```

Now you need to generate API keys for both AniList and MyAnimeList.

#### 🔑 Getting AniList API Keys
1. Go to your [AniList Developer Settings](https://anilist.co/settings/developer).
2. Click **Create New Client**.
3. Set the name to "Anime Watch Party Sync".
4. Set the **Redirect URL** to: `http://<YOUR_CONTAINER_IP>:3000/auth/anilist/callback` *(replace `<YOUR_CONTAINER_IP>` with your Proxmox container's IP address, or `localhost` if testing locally)*.
5. Save, then copy the **Client ID** and **Client Secret** into your `.env` file under `ANILIST_CLIENT_ID` and `ANILIST_CLIENT_SECRET`.

#### 🔑 Getting MyAnimeList API Keys
1. Go to your [MyAnimeList API Settings](https://myanimelist.net/apiconfig).
2. Click **Create ID**.
3. Choose "Web Application" and fill out the details.
4. Set the **App Redirect URL** to: `http://<YOUR_CONTAINER_IP>:3000/auth/mal/callback`.
5. Save, then copy the **Client ID** and **Client Secret** into your `.env` file under `MAL_CLIENT_ID` and `MAL_CLIENT_SECRET`.

Update your `.env` file so the redirect URIs match your IP. Example `.env`:
```env
PORT=3000
SESSION_SECRET=super_secret_string_123
ANILIST_CLIENT_ID=your_id_here
ANILIST_CLIENT_SECRET=your_secret_here
ANILIST_REDIRECT_URI=http://192.168.1.50:3000/auth/anilist/callback

MAL_CLIENT_ID=your_mal_id
MAL_CLIENT_SECRET=your_mal_secret
MAL_REDIRECT_URI=http://192.168.1.50:3000/auth/mal/callback
```

### 3. Start the Server
Run the database initializer, then start the server:
```bash
node database.js
npm start
```

*Note: For a production Proxmox container, it's highly recommended to use a process manager like `pm2` to keep the app running in the background:*
```bash
npm install -g pm2
pm2 start server.js --name anime-sync
pm2 save
pm2 startup
```

## How to Use
1. **Connect Accounts**: Have your two friends navigate to `http://<YOUR_CONTAINER_IP>:3000` in their web browsers.
2. They should click **Connect AniList** first. This creates their profile in the database.
3. Immediately after, they should click **Connect MyAnimeList** to link their MAL account to the same session.
4. **Syncing**: Every Friday, simply pull up the dashboard, search for the anime you are watching, input the episode number, and click **Sync to All**.
