import { Response } from 'express';
import prisma from '../utils/prisma';
import { AuthenticatedRequest } from '../middleware/auth';

export const getItems = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const items = await prisma.storeItem.findMany();
    res.json(items);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const buyItem = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { itemId } = req.body;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!itemId) return res.status(400).json({ error: 'Item ID is required' });

    const item = await prisma.storeItem.findUnique({
      where: { id: itemId },
    });

    if (!item) {
      return res.status(404).json({ error: 'Store item not found' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { inventory: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if user already owns it
    const ownsItem = user.inventory.some((inv) => inv.itemId === itemId);
    if (ownsItem) {
      return res.status(400).json({ error: 'You already own this item' });
    }

    if (user.coins < item.price) {
      return res.status(400).json({ error: 'Insufficient coins' });
    }

    // Process transaction in Prisma
    const [updatedUser, newInventory] = await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { coins: user.coins - item.price },
      }),
      prisma.userInventory.create({
        data: { userId, itemId },
      }),
    ]);

    res.json({
      message: 'Item purchased successfully',
      coins: updatedUser.coins,
      item,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const equipItem = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { identifier, type } = req.body; // type: AVATAR, DICE, BOARD, FRAME, EFFECT

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!identifier || !type) {
      return res.status(400).json({ error: 'Item identifier and type are required' });
    }

    // If equipping "default", it is always owned
    if (identifier !== 'default_avatar' && identifier !== 'default_dice' && identifier !== 'default_frame' && identifier !== 'default_board' && identifier !== 'default_victory') {
      const userInventory = await prisma.userInventory.findFirst({
        where: {
          userId,
          item: { identifier },
        },
        include: { item: true },
      });

      if (!userInventory) {
        return res.status(400).json({ error: 'You do not own this item' });
      }
    }

    // Update user based on item type
    let updateData = {};
    if (type === 'AVATAR') updateData = { avatar: identifier };
    else if (type === 'DICE') updateData = { diceSkin: identifier };
    else if (type === 'BOARD') updateData = { boardTheme: identifier };
    else if (type === 'FRAME') updateData = { profileFrame: identifier };
    else if (type === 'EFFECT') updateData = { victoryEffect: identifier };
    else {
      return res.status(400).json({ error: 'Invalid item type' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    res.json({
      message: 'Item equipped successfully',
      user: {
        avatar: updatedUser.avatar,
        diceSkin: updatedUser.diceSkin,
        boardTheme: updatedUser.boardTheme,
        profileFrame: updatedUser.profileFrame,
        victoryEffect: updatedUser.victoryEffect,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
