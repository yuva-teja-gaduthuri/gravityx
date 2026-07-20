import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { AuthenticatedRequest } from '../middleware/auth';

export const getLeaderboard = async (req: Request, res: Response) => {
  try {
    const { type } = req.query; // 'global', 'daily', 'weekly', 'friends'
    const limit = 20;

    // Filter by daily or weekly or monthly could use match history stats or creation date, let's pull top users sorted by XP
    // For friends leaderboard, we would check the request's user ID and filter to user + their accepted friends.
    const userId = (req as AuthenticatedRequest).user?.id;

    if (type === 'friends' && userId) {
      // Find accepted friend IDs
      const friends1 = await prisma.friend.findMany({
        where: { userId, status: 'ACCEPTED' },
        select: { friendId: true },
      });
      const friends2 = await prisma.friend.findMany({
        where: { friendId: userId, status: 'ACCEPTED' },
        select: { userId: true },
      });

      const friendIds = [
        userId,
        ...friends1.map((f) => f.friendId),
        ...friends2.map((f) => f.userId),
      ];

      const users = await prisma.user.findMany({
        where: { id: { in: friendIds } },
        orderBy: { xp: 'desc' },
        take: limit,
        select: {
          id: true,
          username: true,
          level: true,
          xp: true,
          rank: true,
          avatar: true,
          profileFrame: true,
        },
      });

      return res.json(users);
    }

    // Default: Global / Daily / Weekly sorted by XP/level
    const users = await prisma.user.findMany({
      orderBy: { xp: 'desc' },
      take: limit,
      select: {
        id: true,
        username: true,
        level: true,
        xp: true,
        rank: true,
        avatar: true,
        profileFrame: true,
      },
    });

    res.json(users);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
