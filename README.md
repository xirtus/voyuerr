<div align="center">
  <img src="public/logo_full2.svg" alt="Voyeurr" width="420" />
  <h3>Self-Hosted Adult Media Requests — Browse, Discover, Automate</h3>
  <p>
    <a href="https://github.com/xirtus/voyuerr/blob/main/LICENSE"><img src="https://img.shields.io/github/license/xirtus/voyuerr" alt="License MIT" /></a>
    <img src="https://img.shields.io/badge/node-%3E%3D22-brightgreen" alt="Node 22+" />
    <img src="https://img.shields.io/badge/pnpm-10-blue" alt="pnpm 10" />
    <img src="https://img.shields.io/badge/docker-ready-blue" alt="Docker" />
  </p>
</div>

---

Voyeurr is a free and open source software application for managing explicit requests for your media library. Voyeurr is built on Seerr.

---

## What does it do?

You run Voyeurr on your server. Your users open it in their browser. They browse performers, studios, and scenes — then click **Request**. Whisparr finds the content on torrent/usenet trackers, sends it to qBittorrent or SABnzbd, and when it's done, it shows up in Jellyfin or Plex ready to watch. Fully automated, fully private.

<p align="center">
  <strong>Discover → Request → Download → Watch</strong><br/>
  <em>All from one interface. No manual searching. No sketchy sites.</em>
</p>

---

## Features

| | | |
|:--|:--|:--|
| 🔍 **Discover** | Performer profiles with full filmographies, studio pages, trending/new/popular sliders, mood channels | 
| 📝 **One-Click Requests** | Users request scenes. Whisparr searches, grabs, renames, and organizes. Auto-approval rules. |
| 🎬 **Rich Metadata** | Multi-source aggregation: ThePornDB, R18/JavDB, AdultDVDEmpire, nHentai, Fakku, Hanime, StashDB |
| 🔒 **Privacy First** | Age gate · VPN/proxy support · Encrypted API keys · Zero telemetry · Notification sanitization · Per-user category filters · Private browsing mode |
| 🍑 **Whisparr Integration** | Full Eros branch support: scenes, performers, studios. Quality profiles, root folders, tags. 4K/VR instances. |
| 🧲 **Indexer Hub** | Jackett + Prowlarr management UI. Adult category filtering (Newznab 5000+). Health monitoring. |
| 📺 **Media Servers** | Jellyfin, Plex, Emby library sync. Stash integration for performer DB + scene tagging. Watch status sync. |
| 📱 **PWA** | Install to home screen. Offline mode. Biometric lock. No screenshots in app switcher. |
| 🤖 **Automation** | Auto-approval rules. Quality upgrade policies. Duplicate detection. Smart request routing. Webhooks. |
| 👥 **Multi-User** | Shared collections. Activity feeds. Comments. User follows. Collaborative curation. |
| 🔗 **API & Webhooks** | REST API with scoped keys. Webhooks with HMAC-SHA256 signing and exponential backoff. |
| 📊 **Admin Dashboard** | Request metrics. Storage forecasting. Download success rates. System health. Exportable reports. |

---

## Supported Content

Voyeurr handles the full adult content taxonomy — not just movies and TV:

| Type | Examples |
|------|----------|
| **Scenes** | Single scene releases (20–60 min) — the standard unit |
| **Movies** | Full-length adult films (60–180 min) with narrative |
| **Channel Releases** | Recurring series ("Tushy Raw V47", "Blacked Raw V12") |
| **JAV** | Japanese Adult Video — censored/uncensored, studio codes |
| **Hentai** | Animated adult — 2D/3D, manga, anime OVAs |
| **VR** | 180°/360° stereoscopic — special playback |
| **Amateur / OnlyFans** | Self-produced, creator-direct content |
| **Compilations** | Multi-scene, multi-performer supercuts |

Categories are per-user filterable: show JAV, hide VR, allow hentai, block amateur — each user controls what they see.

---

## Quick Start

### One command

```bash
git clone https://github.com/xirtus/voyuerr.git && cd voyuerr && docker compose up -d
```

This launches the entire stack:

| Service | URL | Does |
|---------|-----|------|
| **Voyeurr** | `http://localhost:5055` | The interface — browse and request here |
| Whisparr | `http://localhost:6969` | Adult content automation engine |
| Prowlarr | `http://localhost:9696` | Indexer manager (connect your trackers) |
| Jackett | `http://localhost:9117` | Tracker proxy (180+ trackers unified) |
| qBittorrent | `http://localhost:8080` | Torrent download client |
| Jellyfin | `http://localhost:8096` | Media server for playback |
| Stash | `http://localhost:9999` | Adult content organizer & performer DB |
| PostgreSQL | `localhost:5432` | Database (auto-configured) |

### After launch

1. Open `http://localhost:5055` → pass the age gate
2. Create your admin account
3. Connect your media server (Jellyfin/Plex/Emby)
4. Add Whisparr in Settings → Services (API key from Whisparr → Settings → General)
5. Configure indexers in Settings → Indexers
6. Start browsing and requesting

### From source (no Docker)

```bash
git clone https://github.com/xirtus/voyuerr.git
cd voyuerr
pnpm install
pnpm build
NODE_ENV=production pnpm start
# Open http://localhost:5055
```

---

## Privacy

Voyeurr takes privacy seriously. Adult content platforms need stronger guarantees:

- **Age verification gate** — DOB check before any content loads. Configurable 18+/21+. Stored locally, expires after 30 days.
- **VPN / proxy support** — SOCKS5 and HTTP proxy for all external API calls. Route everything through Mullvad, ProtonVPN, etc.
- **Encrypted storage** — API keys and auth tokens encrypted at rest in the database.
- **Zero telemetry** — No analytics. No crash reporting. No external calls. Nothing phones home.
- **Notification privacy** — Replace scene titles with generic text in push notifications.
- **Per-user category filters** — Allow or block specific content types per user.
- **Private mode** — Submit anonymous requests not logged with username.
- **PWA privacy** — No screenshots in iOS app switcher. Biometric lock option.

---

## Development

```bash
pnpm install        # Install dependencies
pnpm dev            # Dev server with hot reload
pnpm build          # Production build
pnpm lint           # ESLint across server + client
pnpm typecheck      # Full TypeScript check
pnpm test           # Unit tests
pnpm cypress:open   # E2E tests with real browser
```

**Stack:** Next.js 16 · React 19 · Express 5 · TypeORM · PostgreSQL/SQLite · Tailwind CSS · TypeScript

---

## Project Layout

```
server/           Express API + business logic (~350 .ts files)
  entity/         TypeORM entities — Scene, Performer, Studio, Series, etc.
  api/            External API clients
    servarr/      Whisparr, Radarr, Sonarr
    indexers/     Jackett, Prowlarr
    adult/        ThePornDB, R18, nHentai, Fakku, Hanime, AdultDVDEmpire
  lib/            Engines — search, discovery, automation, integrity, webhooks
    scanners/     Availability sync — Whisparr, Jellyfin, Plex, Stash
    notifications/ Agents — Discord, Apprise, Telegram, Email, Slack, Pushover, ntfy
  routes/         REST endpoints
  migration/      Database migrations (PostgreSQL + SQLite, all reversible)

src/              Next.js frontend (~320 .tsx files)
  components/     React components — SceneDetails, PerformerProfile, VirtualGrid
  pages/          Routes — /scene/[id], /performer/[id], /studio/[id], /discover

docs/             Conversion plan, user guide
charts/           Kubernetes Helm chart
compose.yaml      Full Docker Compose stack
voyeurr-api.yml   OpenAPI 3.1 specification
```

---

## API

REST API at `/api/v1`. Generate scoped API keys from Settings → API Keys. Webhooks for 12 event types with HMAC-SHA256 signatures and automatic retry. Full spec: [`voyeurr-api.yml`](voyeurr-api.yml)

---

## License

MIT © Voyeurr Team

---

<p align="center">
  <sub>Built on the shoulders of the *arr ecosystem and the self-hosted media community.</sub>
</p>
