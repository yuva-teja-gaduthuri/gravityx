import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../utils/prisma';
import { AuthenticatedRequest } from '../middleware/auth';

const JWT_SECRET = process.env.JWT_SECRET || 'gravityx-secret-key-space-anti-gravity';

export const register = async (req: Request, res: Response) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email and password are required' });
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ username }, { email }],
      },
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        username,
        email,
        passwordHash,
        isGuest: false,
      },
    });

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, {
      expiresIn: '7d',
    });

    res.status(201).json({ token, user: { id: user.id, username: user.username, email: user.email } });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { emailOrUsername, password } = req.body;

    if (!emailOrUsername || !password) {
      return res.status(400).json({ error: 'Email/Username and password are required' });
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: emailOrUsername }, { username: emailOrUsername }],
      },
    });

    if (!user || user.isBanned) {
      return res.status(401).json({ error: user?.isBanned ? 'Your account has been banned' : 'Invalid credentials' });
    }

    if (!user.passwordHash) {
      return res.status(400).json({ error: 'Account created without password (social/guest). Please log in accordingly' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);

    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, {
      expiresIn: '7d',
    });

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        coins: user.coins,
        xp: user.xp,
        level: user.level,
        rank: user.rank,
        avatar: user.avatar,
        profileFrame: user.profileFrame,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const guestLogin = async (req: Request, res: Response) => {
  try {
    // Generate a unique Guest Username
    let isUnique = false;
    let username = '';
    while (!isUnique) {
      username = `Guest_${Math.floor(100000 + Math.random() * 900000)}`;
      const existing = await prisma.user.findUnique({ where: { username } });
      if (!existing) isUnique = true;
    }

    const user = await prisma.user.create({
      data: {
        username,
        isGuest: true,
        coins: 1000,
        xp: 0,
        level: 1,
      },
    });

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, {
      expiresIn: '24h',
    });

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        isGuest: true,
        role: user.role,
        coins: user.coins,
        xp: user.xp,
        level: user.level,
        rank: user.rank,
        avatar: user.avatar,
        profileFrame: user.profileFrame,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getProfile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        inventory: {
          include: { item: true },
        },
        achievements: {
          include: { achievement: true },
        },
        matchPlayers: {
          include: { match: true },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Calculate match statistics
    const matchesPlayed = user.matchPlayers.length;
    const wins = user.matchPlayers.filter((mp) => mp.placement === 1).length;
    const losses = matchesPlayed - wins;
    const winRate = matchesPlayed > 0 ? Math.round((wins / matchesPlayed) * 100) : 0;

    res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        isGuest: user.isGuest,
        coins: user.coins,
        xp: user.xp,
        level: user.level,
        rank: user.rank,
        avatar: user.avatar,
        diceSkin: user.diceSkin,
        boardTheme: user.boardTheme,
        profileFrame: user.profileFrame,
        victoryEffect: user.victoryEffect,
        role: user.role,
        createdAt: user.createdAt,
      },
      stats: {
        matchesPlayed,
        wins,
        losses,
        winRate,
      },
      inventory: user.inventory.map((inv) => inv.item),
      achievements: user.achievements.map((ach) => ach.achievement),
      matchHistory: user.matchPlayers.map((mp) => ({
        matchId: mp.matchId,
        gameType: mp.match.gameType,
        score: mp.score,
        coinsEarned: mp.coinsEarned,
        placement: mp.placement,
        date: mp.match.createdAt,
        status: mp.match.status,
      })),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
