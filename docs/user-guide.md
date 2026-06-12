# Voyeurr User Guide

## Overview

Voyeurr is an adult media request and discovery platform — the adult-content equivalent
of Overseerr/Jellyseerr. It provides a unified interface for browsing, requesting, and
managing adult content across performers, studios, and scenes.

## Prerequisites

- **Node.js** 22+ with pnpm
- **PostgreSQL** 16+ (recommended) or SQLite
- Services (at least one combination):
  - **Whisparr** — adult content automation
  - **Jackett** or **Prowlarr** — torrent/usenet indexers
  - **qBittorrent** or **SABnzbd** — download clients
  - **Jellyfin**, **Plex**, or **Emby** — media servers
  - **Stash** (optional) — adult content organizer

## Quick Start (Docker Compose)

```bash
# Clone and start the full stack
git clone https://github.com/xirtus/voyuerr.git
cd voyeurr
docker compose up -d
```

This starts: Voyeurr (port 5055), Whisparr (6969), Prowlarr (9696), Jackett (9117),
qBittorrent (8080), Jellyfin (8096), Stash (9999), and a PostgreSQL database.

## Manual Installation

```bash
git clone https://github.com/xirtus/voyuerr.git
cd voyeurr
pnpm install
pnpm build
NODE_ENV=production pnpm start
```

Voyeurr will be available at `http://localhost:5055`.

## Initial Setup

1. Open `http://localhost:5055` in your browser
2. Complete the age verification gate (required on first visit)
3. Create an admin account via the setup wizard
4. Connect to your media server (Jellyfin/Plex/Emby)

### Age Verification

On first launch, Voyeurr presents an age verification gate. You must be at least
18 years old (configurable to 21+) to proceed. The verification is stored locally
in your browser and expires after 30 days.

## Configuring Services

### Whisparr Setup

1. Go to Settings → Services → Whisparr
2. Add your Whisparr instance (hostname, port, API key)
3. Configure quality profiles, root folders, and tags
4. Enable sync for availability tracking

Whisparr manages adult scene acquisition — it monitors for new releases, searches
indexers, and sends download commands to qBittorrent/SABnzbd.

### Indexer Setup (Jackett / Prowlarr)

1. Go to Settings → Services → Indexers
2. Choose Jackett or Prowlarr
3. Enter hostname, port, and API key
4. Configure category mappings for adult content

Recommended adult trackers to add in Jackett/Prowlarr:
- Adult content trackers (Empornium, Pornolab, etc.)
- General trackers with adult categories
- Usenet indexers with adult categories

### Download Client

1. Set up qBittorrent (port 8080) or SABnzbd
2. Configure in Whisparr: Settings → Download Clients
3. Set download paths to `/downloads` (or your preferred location)

### Media Server

Voyeurr supports Jellyfin, Plex, and Emby. Configure in Settings → General:

1. Select your media server type
2. Enter connection details (hostname, port, API key)
3. Sync libraries to detect existing content
4. Create separate libraries for 4K/VR content if desired

### Stash Integration (Optional)

Stash provides comprehensive performer databases and scene tagging:

1. Go to Settings → Stash
2. Enable Stash integration
3. Enter your Stash instance hostname, port, and optional API key
4. Click "Test Connection" to verify
5. Click "Sync Now" to import performers, studios, and scenes

Stash sync imports:
- Performers → Voyeurr performer profiles
- Studios → Voyeurr studio pages
- Scenes → Voyeurr scene entries with performer associations

## Making Your First Request

1. Browse the Discover page to find content
2. Use the filter sidebar to narrow by category (Western, JAV, Hentai, etc.)
3. Click on a scene card to view details
4. Click "Request" to submit a download request
5. Whisparr picks up the request, searches indexers, and sends to qBittorrent
6. Once downloaded and imported into your media library, the scene shows as "Available"

## Privacy Features

Voyeurr includes comprehensive privacy controls:

- **Age Gate**: Required before accessing any content
- **Category Filters**: Per-user allow/block lists for content categories
- **Privacy Mode**: Anonymous requests (not logged with username)
- **Notification Privacy**: Generic notification titles instead of scene names
- **NSFW Blur**: Images blurred until hovered
- **VPN/Proxy**: SOCKS5 and HTTP proxy support for all external connections
- **Field Encryption**: API keys and tokens encrypted at rest in database
- **Zero Telemetry**: No analytics, no crash reporting, no external calls

Configure privacy settings at: Profile → Privacy Settings

## Troubleshooting

### Cannot connect to Whisparr
- Verify Whisparr is running: `curl http://whisparr:6969/api/v3/system/status`
- Check API key is correct in Settings → Services → Whisparr
- Ensure both containers are on the same Docker network

### No scenes appear in Discover
- Run a Stash sync or add metadata via external providers (ThePornDB)
- Check that your Whisparr libraries are configured
- Verify the database has scene entries (check Studio/Performer pages)

### Download fails
- Check Whisparr logs for connection issues to indexers
- Verify qBittorrent is accessible from Whisparr
- Check disk space on download volume

### Stash connection fails
- Verify Stash is running: `curl http://stash:9999/graphql`
- Check "Allow insecure certificates" if using self-signed SSL
- Ensure API key (if set) matches Stash's configuration
