export interface Player {
  id: string;
  username: string;
  socketId: string;
  avatar: string;
  profileFrame: string;
  ready: boolean;
  role?: string; // used for Ramudu-Seetha role names
  isBot?: boolean;
}

export interface Room {
  code: string;
  name: string;
  gameType: 'RAMUDU_SEETHA' | 'LUDO';
  type: 'PUBLIC' | 'PRIVATE';
  maxPlayers: number;
  voiceChat: boolean;
  allowSpectators: boolean;
  hostId: string;
  status: 'LOBBY' | 'PLAYING';
  players: Player[];
  spectators: string[];
  gameState: any; // polymorphic game state representation
  createdAt: number;
  currentRound?: number;
  maxRounds?: number;
  sessionScoreboard?: { [userId: string]: { username: string; score: number } };
}

class RoomStore {
  private rooms: Map<string, Room> = new Map();

  createRoom(code: string, roomData: Omit<Room, 'players' | 'spectators' | 'gameState' | 'status' | 'createdAt'>): Room {
    const room: Room = {
      ...roomData,
      status: 'LOBBY',
      players: [],
      spectators: [],
      gameState: null,
      createdAt: Date.now(),
    };
    this.rooms.set(code, room);
    return room;
  }

  getRoom(code: string): Room | undefined {
    return this.rooms.get(code);
  }

  removeRoom(code: string): boolean {
    return this.rooms.delete(code);
  }

  getAllRooms(): Room[] {
    return Array.from(this.rooms.values());
  }

  addPlayer(code: string, player: Player): Room | undefined {
    const room = this.rooms.get(code);
    if (!room) return undefined;

    // Check if player already in room
    const exists = room.players.some((p) => p.id === player.id);
    if (!exists && room.players.length < room.maxPlayers) {
      room.players.push(player);
    }

    // Transfer host privilege to human player if current host is a bot
    const hostPlayer = room.players.find((p) => p.id === room.hostId);
    if (!player.isBot && (!hostPlayer || hostPlayer.isBot || room.hostId === 'BOT_HOST')) {
      room.hostId = player.id;
    }

    return room;
  }

  removePlayer(code: string, userId: string): Room | undefined {
    const room = this.rooms.get(code);
    if (!room) return undefined;

    room.players = room.players.filter((p) => p.id !== userId);

    // Reassign host to the first human player if host leaves
    if (room.hostId === userId && room.players.length > 0) {
      const firstHuman = room.players.find((p) => !p.isBot);
      room.hostId = firstHuman ? firstHuman.id : room.players[0].id;
    }

    // Delete room if no human players left
    if (room.players.length === 0 || room.players.every((p) => p.isBot)) {
      this.rooms.delete(code);
      return undefined;
    }

    // Auto rollback room back to LOBBY status if playing drops below active playing thresholds
    if (room.status === 'PLAYING') {
      const minPlayers = room.gameType === 'RAMUDU_SEETHA' ? 3 : 2;
      if (room.players.length < minPlayers) {
        room.status = 'LOBBY';
        room.gameState = null;
        room.players.forEach((p) => {
          p.ready = false;
          p.role = undefined;
        });
      }
    }

    return room;
  }

  setPlayerReady(code: string, userId: string, ready: boolean): Room | undefined {
    const room = this.rooms.get(code);
    if (!room) return undefined;

    const player = room.players.find((p) => p.id === userId);
    if (player) {
      player.ready = ready;
    }
    return room;
  }

  updateGameState(code: string, state: any): Room | undefined {
    const room = this.rooms.get(code);
    if (!room) return undefined;
    room.gameState = state;
    return room;
  }

  updateRoomStatus(code: string, status: 'LOBBY' | 'PLAYING'): Room | undefined {
    const room = this.rooms.get(code);
    if (!room) return undefined;
    room.status = status;
    return room;
  }
}

export const roomStore = new RoomStore();
