import { Response } from 'express';
import prisma from '../utils/prisma';
import { AuthenticatedRequest } from '../middleware/auth';

export const getUsers = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        username: true,
        email: true,
        isGuest: true,
        isBanned: true,
        role: true,
        coins: true,
        xp: true,
        level: true,
        createdAt: true,
      },
    });

    res.json(users);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const banUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId } = req.body;

    if (!userId) return res.status(400).json({ error: 'User ID is required' });

    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target) return res.status(404).json({ error: 'User not found' });

    if (target.role === 'ADMIN') {
      return res.status(400).json({ error: 'Cannot ban another admin' });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { isBanned: true },
    });

    res.json({ message: 'User banned successfully', user: updated });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const unbanUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId } = req.body;

    if (!userId) return res.status(400).json({ error: 'User ID is required' });

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { isBanned: false },
    });

    res.json({ message: 'User unbanned successfully', user: updated });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getSystemStats = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const totalUsers = await prisma.user.count();
    const guestUsers = await prisma.user.count({ where: { isGuest: true } });
    const bannedUsers = await prisma.user.count({ where: { isBanned: true } });
    const totalMatches = await prisma.match.count();
    const ludoMatches = await prisma.match.count({ where: { gameType: 'LUDO' } });
    const ramuduMatches = await prisma.match.count({ where: { gameType: 'RAMUDU_SEETHA' } });

    // Aggregate coins distribution
    const coinStats = await prisma.user.aggregate({
      _sum: { coins: true },
      _avg: { coins: true },
    });

    res.json({
      users: {
        total: totalUsers,
        guests: guestUsers,
        banned: bannedUsers,
        registered: totalUsers - guestUsers,
      },
      matches: {
        total: totalMatches,
        ludo: ludoMatches,
        ramuduSeetha: ramuduMatches,
      },
      economy: {
        totalCoinsCirculating: coinStats._sum.coins || 0,
        averageCoinsPerUser: Math.round(coinStats._avg.coins || 0),
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
