import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { AuthenticatedRequest } from '../middleware/auth';

export const getLeaderboard = async (req: Request, res: Response) => {
  try {
    const { type, gameType } = req.query; // type: 'global', 'friends'; gameType: 'RAMUDU_SEETHA', 'LUDO'
    const limit = 20;
    const userId = (req as AuthenticatedRequest).user?.id;

    try {
      // Check if game-specific leaderboard is requested
      if (gameType && (gameType === 'RAMUDU_SEETHA' || gameType === 'LUDO')) {
        const matchPlayersGroup = await prisma.matchPlayer.groupBy({
          by: ['userId'],
          where: {
            match: {
              gameType: gameType as string
            }
          },
          _sum: {
            score: true
          },
          _count: {
            id: true
          },
          orderBy: {
            _sum: {
              score: 'desc'
            }
          },
          take: limit
        });

        const userIds = matchPlayersGroup.map((m) => m.userId);
        const users = await prisma.user.findMany({
          where: { id: { in: userIds } },
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

        const rankedUsers = matchPlayersGroup.map((group, idx) => {
          const u = users.find((user) => user.id === group.userId);
          return {
            id: group.userId,
            username: u?.username || 'Unknown Operator',
            level: u?.level || 1,
            xp: u?.xp || 0,
            rank: u?.rank || 'Bronze V',
            avatar: u?.avatar || 'default_avatar',
            profileFrame: u?.profileFrame || 'default_frame',
            score: group._sum.score || 0,
            gamesPlayed: group._count.id || 0,
            placement: idx + 1
          };
        });

        return res.json(rankedUsers);
      }

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
    } catch (dbErr: any) {
      console.warn('⚠️ [LEADERBOARD]: Database unreachable, returning fallback leaderboard.');
      return res.json([
        {
          id: 'demo_1',
          username: 'CosmicVoyager',
          level: 15,
          xp: 3200,
          rank: 'Gold V',
          avatar: 'astronaut',
          profileFrame: 'gold_frame'
        },
        {
          id: 'demo_2',
          username: 'StarLord_99',
          level: 12,
          xp: 2500,
          rank: 'Gold I',
          avatar: 'cyborg',
          profileFrame: 'cyber_frame'
        },
        {
          id: 'demo_3',
          username: 'NebulaKnight',
          level: 8,
          xp: 1800,
          rank: 'Silver I',
          avatar: 'alien',
          profileFrame: 'default_frame'
        }
      ]);
    }
  } catch (error: any) {
    res.json([]);
  }
};
