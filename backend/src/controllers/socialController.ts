import { Response } from 'express';
import prisma from '../utils/prisma';
import { AuthenticatedRequest } from '../middleware/auth';

export const getFriends = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    // Find all accepted friends where user is either sender or receiver
    const friends1 = await prisma.friend.findMany({
      where: { userId, status: 'ACCEPTED' },
      include: { friend: true },
    });

    const friends2 = await prisma.friend.findMany({
      where: { friendId: userId, status: 'ACCEPTED' },
      include: { user: true },
    });

    const friendList = [
      ...friends1.map((f) => ({
        id: f.friend.id,
        username: f.friend.username,
        avatar: f.friend.avatar,
        profileFrame: f.friend.profileFrame,
        level: f.friend.level,
        rank: f.friend.rank,
      })),
      ...friends2.map((f) => ({
        id: f.user.id,
        username: f.user.username,
        avatar: f.user.avatar,
        profileFrame: f.user.profileFrame,
        level: f.user.level,
        rank: f.user.rank,
      })),
    ];

    res.json(friendList);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getPendingRequests = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const requests = await prisma.friend.findMany({
      where: { friendId: userId, status: 'PENDING' },
      include: { user: true },
    });

    const pending = requests.map((r) => ({
      requestId: r.id,
      userId: r.user.id,
      username: r.user.username,
      avatar: r.user.avatar,
    }));

    res.json(pending);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const sendFriendRequest = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { friendUsername } = req.body;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!friendUsername) return res.status(400).json({ error: 'Username is required' });

    const friend = await prisma.user.findUnique({
      where: { username: friendUsername },
    });

    if (!friend) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (friend.id === userId) {
      return res.status(400).json({ error: 'You cannot add yourself' });
    }

    // Check if relation already exists
    const existing = await prisma.friend.findFirst({
      where: {
        OR: [
          { userId, friendId: friend.id },
          { userId: friend.id, friendId: userId },
        ],
      },
    });

    if (existing) {
      return res.status(400).json({ error: 'Friend request already sent or you are already friends' });
    }

    const request = await prisma.friend.create({
      data: {
        userId,
        friendId: friend.id,
        status: 'PENDING',
      },
    });

    res.status(201).json({ message: 'Friend request sent', request });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const acceptFriendRequest = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { requestId } = req.body;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!requestId) return res.status(400).json({ error: 'Request ID is required' });

    const request = await prisma.friend.findUnique({
      where: { id: requestId },
    });

    if (!request || request.friendId !== userId) {
      return res.status(404).json({ error: 'Friend request not found' });
    }

    const updated = await prisma.friend.update({
      where: { id: requestId },
      data: { status: 'ACCEPTED' },
    });

    res.json({ message: 'Friend request accepted', request: updated });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const rejectFriendRequest = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { requestId } = req.body;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!requestId) return res.status(400).json({ error: 'Request ID is required' });

    const request = await prisma.friend.findUnique({
      where: { id: requestId },
    });

    if (!request || request.friendId !== userId) {
      return res.status(404).json({ error: 'Friend request not found' });
    }

    await prisma.friend.delete({
      where: { id: requestId },
    });

    res.json({ message: 'Friend request rejected/deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getDirectMessages = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { friendId } = req.params;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!friendId) return res.status(400).json({ error: 'Friend ID is required' });

    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: userId, receiverId: friendId },
          { senderId: friendId, receiverId: userId },
        ],
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json(messages);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const sendDirectMessage = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { friendId } = req.params;
    const { content } = req.body;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!friendId) return res.status(400).json({ error: 'Friend ID is required' });
    if (!content) return res.status(400).json({ error: 'Content is required' });

    const msg = await prisma.message.create({
      data: {
        senderId: userId,
        receiverId: friendId,
        content,
      },
    });

    res.status(201).json(msg);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
