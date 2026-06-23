# ArchiveForge

Exportateur de serveurs Discord. Extrait les messages, salons, threads, membres, rôles et pièces jointes via un bot Discord (pas de self-bot), et génère une archive téléchargeable en ZIP.

## Formats d'export

| Format | Description |
|--------|-------------|
| **SPA Viewer** | Visionneuse offline navigable — recherche, lightbox, threads |
| **HTML statique** | Un fichier par salon, lisible dans n'importe quel navigateur |
| **JSON brut** | Données complètes, idéal pour traitement automatisé |

## Stack

| Composant | Technologie |
|-----------|-------------|
| Bot | Node.js + discord.js v14 |
| Queue | BullMQ + Redis |
| Web | Next.js 15 App Router (standalone) |
| Auth | NextAuth v5 — Discord OAuth, whitelist par ID |
| DB | SQLite (better-sqlite3 + Drizzle ORM, WAL mode) |
| CSS | Plain CSS (thème Discord dark) |
| Deploy | Docker Compose + nginx + Certbot |

## Fonctionnalités

- Export complet : messages (pagination curseur), threads actifs et archivés, membres, rôles, emojis
- Retry automatique sur HTTP 429 avec backoff exponentiel (×7)
- Reprise sur erreur via BullMQ (persistance Redis)
- Barre de progression en temps réel (polling 3s)
- Téléchargement ZIP direct depuis le portail web
- Vérification des liens CDN morts
- Portail admin sécurisé (1 seul compte autorisé par `ADMIN_DISCORD_ID`)

## Prérequis

- Docker + Docker Compose
- Bot Discord avec les intents privilégiés activés :
  - **Server Members Intent**
  - **Message Content Intent**
- Application Discord OAuth2 (Client ID + Secret)

## Installation

### 1. Cloner

```bash
git clone https://github.com/Heiphaistos/ArchiveForge.git
cd ArchiveForge
```

### 2. Configurer le `.env`

```bash
cp .env.example .env
```

Remplir les variables :

```env
# Bot Discord
DISCORD_TOKEN=ton_token_bot

# OAuth2 Discord (Developer Portal → OAuth2)
DISCORD_CLIENT_ID=ton_client_id
DISCORD_CLIENT_SECRET=ton_client_secret

# Ton Discord ID (clic droit sur ton profil → Copier l'identifiant)
ADMIN_DISCORD_ID=ton_discord_id

# Générer avec : openssl rand -base64 32
NEXTAUTH_SECRET=une_clé_secrète_longue

# URL publique du portail
NEXTAUTH_URL=https://ton-domaine.com

# Redis (interne Docker, ne pas modifier)
REDIS_URL=redis://redis:6379
```

### 3. Redirect URI Discord

Dans le [Developer Portal](https://discord.com/developers/applications) → **OAuth2** → **Redirects**, ajouter :

```
https://ton-domaine.com/api/auth/callback/discord
```

### 4. Démarrer

```bash
docker compose up -d
```

Le portail est accessible sur le port `3009` (ou celui configuré dans `docker-compose.yml`).

## Architecture

```
┌─────────────────────────────────────────────────┐
│                   nginx / SSL                   │
└────────────────────┬────────────────────────────┘
                     │
         ┌───────────▼───────────┐
         │    Next.js 15 Web     │  :3009
         │  Dashboard + API REST │
         └───────┬───────────────┘
                 │ BullMQ (add job)
         ┌───────▼───────────────┐
         │       Redis           │
         └───────┬───────────────┘
                 │ BullMQ (consume)
         ┌───────▼───────────────┐
         │   discord.js Bot      │
         │  Export Worker ×2     │
         └───────────────────────┘
```

Le web est **producteur** de jobs, le bot est **consommateur**. Les statuts remontent via `QueueEvents` (Redis pub/sub) → SQLite.

## Variables d'environnement

| Variable | Obligatoire | Description |
|----------|-------------|-------------|
| `DISCORD_TOKEN` | Oui | Token du bot Discord |
| `DISCORD_CLIENT_ID` | Oui | Client ID OAuth2 |
| `DISCORD_CLIENT_SECRET` | Oui | Client Secret OAuth2 |
| `ADMIN_DISCORD_ID` | Oui | Seul Discord ID autorisé à se connecter |
| `NEXTAUTH_SECRET` | Oui | Clé de chiffrement des sessions |
| `NEXTAUTH_URL` | Oui | URL publique du portail (`https://...`) |
| `AUTH_TRUST_HOST` | VPS | `true` si derrière un reverse proxy |
| `REDIS_URL` | Non | `redis://redis:6379` par défaut |
| `DATABASE_DIR` | Non | Répertoire SQLite, `./data` par défaut |

## Développement

```bash
# Lancer Redis local
docker compose -f docker-compose.dev.yml up -d redis

# Bot
cd bot && npm install && npm run dev

# Web
cd web && npm install && npm run dev
```

## Déploiement VPS

```bash
# Sur le VPS
git clone https://github.com/Heiphaistos/ArchiveForge.git /opt/archiveforge
cd /opt/archiveforge
nano .env  # remplir les variables

mkdir -p logs exports data
chown -R 1000:1000 logs exports data

docker compose up -d
```

nginx + SSL (Certbot) — configurer un reverse proxy vers `127.0.0.1:PORT`.

## Limitations connues

- Les MPs ne sont pas exportables (limitation API Discord)
- Les salons vocaux ne contiennent pas de messages
- Les serveurs très grands (>500k messages) peuvent prendre plusieurs heures

## Licence

MIT
