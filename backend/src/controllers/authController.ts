import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import prisma from '../utils/prisma';
import { AuthenticatedRequest } from '../middleware/auth';
import { sendVerificationEmail, sendResetPasswordEmail } from '../utils/mailer';

const JWT_SECRET = process.env.JWT_SECRET || 'gravityx-secret-key-space-anti-gravity';

/**
 * Register a new user
 */
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
    const verificationToken = crypto.randomBytes(32).toString('hex');

    await prisma.user.create({
      data: {
        username,
        email,
        passwordHash,
        isGuest: false,
        emailVerified: false, // Default is unverified
        verificationToken,
      },
    });

    // Send verification email asynchronously
    await sendVerificationEmail(email, verificationToken, username);

    res.status(201).json({
      message: 'Verification email sent. Please check your inbox to confirm your identity.'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Authenticate existing credentials
 */
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

    // Verify email status (only for registered accounts, guests bypass it)
    if (!user.isGuest && !user.emailVerified) {
      return res.status(403).json({
        error: 'Email verification required',
        email: user.email,
        unverified: true
      });
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

/**
 * Verify Email Token
 */
export const verifyEmail = async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    const user = await prisma.user.findFirst({
      where: { verificationToken: token },
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired verification token' });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        verificationToken: null,
      },
    });

    res.json({ message: 'Email verified successfully! You can now log in.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Resend Email Verification Token
 */
export const resendVerification = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(404).json({ error: 'No user registered with this email' });
    }

    if (user.emailVerified) {
      return res.status(400).json({ error: 'Email is already verified' });
    }

    let token = user.verificationToken;
    if (!token) {
      token = crypto.randomBytes(32).toString('hex');
      await prisma.user.update({
        where: { id: user.id },
        data: { verificationToken: token },
      });
    }

    await sendVerificationEmail(user.email!, token, user.username);
    res.json({ message: 'Verification email resent successfully! Please check your inbox.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Initiate Forgot Password Flow
 */
export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Security: return success to avoid user-enum attacks
      return res.json({ message: 'If that email exists in our logs, a password reset link has been dispatched.' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 3600000); // 1 hour expiration

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordToken: resetToken,
        resetPasswordExpires: resetExpires,
      },
    });

    await sendResetPasswordEmail(user.email!, resetToken, user.username);
    res.json({ message: 'If that email exists in our logs, a password reset link has been dispatched.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Override Credentials / Reset Password
 */
export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ error: 'Token and password are required' });
    }

    const user = await prisma.user.findFirst({
      where: {
        resetPasswordToken: token,
        resetPasswordExpires: { gt: new Date() },
      },
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetPasswordToken: null,
        resetPasswordExpires: null,
      },
    });

    res.json({ message: 'Password reset successfully! You can now log in.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Authenticate Guest Session
 */
export const guestLogin = async (req: Request, res: Response) => {
  try {
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

/**
 * Retrieve Authenticated Profile
 */
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
