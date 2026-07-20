# GravityX Gaming Platform

GravityX is a high-fidelity, real-time multiplayer gaming platform themed around an orbital space station. It features sleek glassmorphic UI cards, neon border glows, custom space starfield backgrounds, and seamless WebSocket synchronization.

The platform includes two games built from scratch:
1. **Ramudu-Seetha**: An exclusive hidden identity deduction game for 3 to 10 players.
2. **Cosmic Ludo**: A turn-based classic board game supporting 2 or 4 players with dice rolling animations, yard releases, token collisions, turn timers, and automatic turn fallbacks.

---

## Technical Architecture

* **Frontend**: Next.js (App Router), React, TypeScript, TailwindCSS, Socket.IO-Client, Lucide React, Canvas-Confetti.
* **Backend**: Node.js, Express, TypeScript, Socket.IO, Prisma Client, JWT Session Signatures, BCrypt Hashing.
* **Database**: SQLite (local development fallback) & PostgreSQL (production Docker targets).
* **Containers**: Docker and Docker Compose orchestrators.

---

## Folder Organization

```
GravityX/
├── backend/                  # API endpoints, socket game logic & database models
│   ├── prisma/               # Schema configurations and database seeding scripts
│   ├── src/
│   │   ├── controllers/      # REST endpoint handlers (Auth, Store, Social, Admin)
│   │   ├── middleware/       # JWT auth token and Admin checks
│   │   ├── models/           # In-memory Lobby/Room manager
│   │   ├── routes/           # Express API router maps
│   │   ├── sockets/          # Socket.IO game engines (RS and Ludo loops)
│   │   ├── utils/            # Prisma Client, leveling, XP, achievements helper
│   │   └── app.ts            # Main application bootloader
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile
├── frontend/                 # Client interfaces and custom components
│   ├── src/
│   │   ├── app/              # Next.js page routers (Landing, Dashboard, Lobbies, Store, Config)
│   │   ├── components/       # Reusable components (Ludo board, RS cards, Social drawer)
│   │   ├── hooks/            # useSocket and useAuth wrappers
│   │   └── styles/           # CSS grids, 3D dice faces, space nebulas
│   ├── package.json
│   ├── tailwind.config.ts
│   └── Dockerfile
├── docker-compose.yml        # Multi-container launcher (Web, API, Postgres)
└── README.md                 # Project guide
```

---

## Local Development (Zero-Config Startup)

You can launch GravityX locally without running Docker. The backend will automatically generate a local SQLite database (`dev.db`).

### 1. Run the Backend API
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install npm packages, push database models, and run the shop/achievement seeds:
   ```bash
   npm install
   npx prisma db push
   npx prisma db seed
   ```
3. Start the dev API:
   ```bash
   npm run dev
   ```
* The API will listen on `http://localhost:3001`.

### 2. Run the Frontend App
1. Open a new terminal window and navigate to the frontend directory:
   ```bash
   cd ../frontend
   ```
2. Install npm packages:
   ```bash
   npm install
   ```
3. Start the client dev server:
   ```bash
   npm run dev
   ```
* The website will render on `http://localhost:3000`.

---

## Production Deployment (Docker Compose)

To launch GravityX in a production-ready environment with a dedicated PostgreSQL database:

1. Open your terminal in the root directory and run:
   ```bash
   docker-compose up --build
   ```
2. Docker will build the frontend next.js image, backend api node image, fetch the postgres image, spin them up, and map ports:
   * **Web Server**: `http://localhost:3000`
   * **API Gateway**: `http://localhost:3001`
   * **PostgreSQL Database**: `localhost:5432`

---

## Socket Event Protocol

### 1. Lobby Rooms
* `create_room`: Sent by client to generate a room code. Returns `room_created`.
* `join_room`: Sent by client to enter a room. Broadcasts `room_state_updated`.
* `leave_room`: Sent by client to exit a lobby.
* `toggle_ready`: Sent by client to switch preparation status.
* `send_room_message`: Dispatches room chat messages.

### 2. Ramudu-Seetha (Social Deduction)
* `rs_start_game`: Sent by Host to assign roles and start the match.
* `rs_game_started`: Broadcasts secret roles (privatised per user connection) and transitions screen.
* `rs_guess`: Sent by Ramudu player with target player ID.
* `rs_guess_result`: Broadcasts guess outcomes (true/false) and reveals characters.
* `rs_match_ended`: Broadcasts winner placements, coins earned, and final scoreboard.

### 3. Cosmic Ludo
* `ludo_start_game`: Sent by Host to initialize board tokens.
* `ludo_game_started`: Broadcasts color configurations and token starting placements.
* `ludo_roll_dice`: Sent by current player to roll.
* `ludo_dice_rolled`: Broadcasts roll values and valid token moves.
* `ludo_move_token`: Sent by current player to advance tokens.
* `ludo_token_moved`: Broadcasts token movements and collision knock-backs.
* `ludo_match_ended`: Broadcasts placement scoreboards.
