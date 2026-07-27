import { Response } from 'express';
import prisma from '../utils/prisma';
import { AuthenticatedRequest } from '../middleware/auth';

export const submitFeedback = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const username = req.user?.username;
    const { game, rating, comment } = req.body;

    if (!username) return res.status(401).json({ error: 'Unauthorized' });
    if (!game || rating === undefined || !comment) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const feedback = await prisma.feedback.create({
      data: {
        game,
        username,
        rating: Number(rating),
        comment,
      },
    });

    res.status(201).json(feedback);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getGameFeedback = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { game } = req.params;
    if (!game) return res.status(400).json({ error: 'Game parameter is required' });

    const feedbackList = await prisma.feedback.findMany({
      where: { game },
      orderBy: { createdAt: 'desc' },
    });

    res.json(feedbackList);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
