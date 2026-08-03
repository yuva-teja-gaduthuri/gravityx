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

    // Format validation
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    if (!usernameRegex.test(username)) {
      return res.status(400).json({ error: 'Username must be 3-20 characters long and contain only letters, numbers, and underscores' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email address format' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    // Pre-create check
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ username }, { email }],
      },
    });

    if (existingUser) {
      if (existingUser.username === username) {
        return res.status(400).json({ error: 'Username is already taken' });
      }
      if (existingUser.email === email) {
        return res.status(400).json({ error: 'Email is already registered' });
      }
      return res.status(400).json({ error: 'Username or email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const verificationToken = crypto.randomBytes(32).toString('hex');

    let user;
    try {
      user = await prisma.user.create({
        data: {
          username,
          email,
          passwordHash,
          isGuest: false,
          emailVerified: false, // Default is unverified
          verificationToken,
        },
      });
    } catch (dbError: any) {
      if (dbError.code === 'P2002') {
        const target = dbError.meta?.target || [];
        if (target.includes('username')) {
          return res.status(400).json({ error: 'Username is already taken' });
        }
        if (target.includes('email')) {
          return res.status(400).json({ error: 'Email is already registered' });
        }
        return res.status(400).json({ error: 'Username or email already exists' });
      }
      throw dbError;
    }

    try {
      // Send verification email
      await sendVerificationEmail(email, verificationToken, username);
    } catch (emailError: any) {
      const isSandbox = !process.env.EMAIL_FROM || process.env.EMAIL_FROM.includes('onboarding@resend.dev');
      
      if (process.env.NODE_ENV === 'production' && !isSandbox) {
        // Rollback user creation if email fails so registration can be retried in production
        await prisma.user.delete({
          where: { id: user.id },
        });
        throw emailError;
      } else {
        // In sandbox or development, log warning and auto-verify user
        console.warn(`⚠️ [MAILER WARNING]: Failed to send verification email: ${emailError.message}`);
        console.log(`🌌 [AUTO-VERIFICATION]: Auto-verifying user ${username} (${email}) due to sandbox environment or mailer failure.`);
        await prisma.user.update({
          where: { id: user.id },
          data: {
            emailVerified: true,
            verificationToken: null,
          },
        });
        return res.status(201).json({
          message: 'Registration successful! (Auto-verified due to sandbox/local mailer configuration).',
          autoVerified: true,
        });
      }
    }

    res.status(201).json({
      message: 'Verification email sent successfully. Please check your inbox to confirm your identity.'
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
        bio: user.bio,
        language: user.language,
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

    const token = crypto.randomBytes(32).toString('hex');
    await prisma.user.update({
      where: { id: user.id },
      data: { verificationToken: token },
    });

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
    let user: any = null;

    try {
      while (!isUnique) {
        username = `Guest_${Math.floor(100000 + Math.random() * 900000)}`;
        const existing = await prisma.user.findUnique({ where: { username } });
        if (!existing) isUnique = true;
      }

      user = await prisma.user.create({
        data: {
          username,
          isGuest: true,
          coins: 1000,
          xp: 0,
          level: 1,
        },
      });
    } catch (dbErr: any) {
      console.warn('⚠️ [DATABASE UNREACHABLE]: Creating ephemeral offline guest session.');
      const guestId = `guest_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
      const guestName = username || `Guest_${Math.floor(100000 + Math.random() * 900000)}`;
      user = {
        id: guestId,
        username: guestName,
        isGuest: true,
        role: 'USER',
        coins: 1000,
        xp: 0,
        level: 1,
        rank: 'Cadet',
        avatar: 'astronaut',
        profileFrame: 'default_frame',
        bio: 'Orbital Guest Explorer',
        language: 'English',
      };
    }

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role || 'USER' }, JWT_SECRET, {
      expiresIn: '24h',
    });

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        isGuest: true,
        role: user.role || 'USER',
        coins: user.coins,
        xp: user.xp,
        level: user.level,
        rank: user.rank || 'Cadet',
        avatar: user.avatar || 'astronaut',
        profileFrame: user.profileFrame || 'default_frame',
        bio: user.bio || 'Orbital Guest Explorer',
        language: user.language || 'English',
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Refresh expired/existing JWT token
 */
export const refreshToken = async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Authorization header missing' });
    }

    const token = authHeader.split(' ')[1];

    jwt.verify(token, JWT_SECRET, { ignoreExpiration: true }, async (err: any, decoded: any) => {
      if (err) {
        return res.status(403).json({ error: 'Invalid token' });
      }

      try {
        const payload = decoded as { id: string; username: string; role: string; exp?: number };

        if (payload.exp) {
          const now = Math.floor(Date.now() / 1000);
          const expiredSince = now - payload.exp;
          const gracePeriod = 7 * 24 * 3600; // 7 days grace period
          if (expiredSince > gracePeriod) {
            return res.status(401).json({ error: 'Session expired. Please log in again.' });
          }
        }

        const user = await prisma.user.findUnique({ where: { id: payload.id } });
        if (!user || user.isBanned) {
          return res.status(401).json({ error: user?.isBanned ? 'Your account has been banned' : 'User not found' });
        }

        const newToken = jwt.sign(
          { id: user.id, username: user.username, role: user.role },
          JWT_SECRET,
          { expiresIn: user.isGuest ? '24h' : '7d' }
        );

        res.json({ token: newToken });
      } catch (innerErr: any) {
        console.error('Refresh token DB error:', innerErr);
        res.status(500).json({ error: 'Database connection issue. Please retry.' });
      }
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

    let user: any = null;
    try {
      user = await prisma.user.findUnique({
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
            orderBy: { createdAt: 'desc' },
          },
        },
      });
    } catch (dbErr: any) {
      if (req.user && userId.startsWith('guest_')) {
        return res.json({
          user: {
            id: req.user.id,
            username: req.user.username,
            isGuest: true,
            role: req.user.role || 'USER',
            coins: 1000,
            xp: 0,
            level: 1,
            rank: 'Cadet',
            avatar: 'astronaut',
            profileFrame: 'default_frame',
            bio: 'Orbital Guest Explorer',
            language: 'English',
            createdAt: new Date(),
          },
          stats: {
            matchesPlayed: 0,
            wins: 0,
            losses: 0,
            winRate: 0,
          },
        });
      }
      throw dbErr;
    }

    if (!user) {
      if (req.user && userId.startsWith('guest_')) {
        return res.json({
          user: {
            id: req.user.id,
            username: req.user.username,
            isGuest: true,
            role: req.user.role || 'USER',
            coins: 1000,
            xp: 0,
            level: 1,
            rank: 'Cadet',
            avatar: 'astronaut',
            profileFrame: 'default_frame',
            bio: 'Orbital Guest Explorer',
            language: 'English',
            createdAt: new Date(),
          },
          stats: {
            matchesPlayed: 0,
            wins: 0,
            losses: 0,
            winRate: 0,
          },
        });
      }
      return res.status(404).json({ error: 'User not found' });
    }

    // Deduplicate match history records for strict match accuracy
    const uniqueMatchPlayers: any[] = [];
    const seenMatchIds = new Set<string>();
    const duplicateMatchPlayerIds: string[] = [];
    const duplicateMatchIds: string[] = [];

    for (const mp of (user.matchPlayers || [])) {
      // 1. Check for duplicate MatchPlayer entry with exact same matchId
      if (seenMatchIds.has(mp.matchId)) {
        duplicateMatchPlayerIds.push(mp.id);
        continue;
      }

      // 2. Check for near-duplicate Match entry created within 10s window with identical attributes
      const isDuplicateMatch = uniqueMatchPlayers.some((existingMp) => {
        if (!mp.match || !existingMp.match) return false;
        const sameGame = mp.match.gameType === existingMp.match.gameType;
        const samePlacement = mp.placement === existingMp.placement;
        const sameScore = mp.score === existingMp.score;
        const sameCoins = mp.coinsEarned === existingMp.coinsEarned;
        const timeDiffMs = Math.abs(
          new Date(mp.match.createdAt || mp.createdAt).getTime() - 
          new Date(existingMp.match.createdAt || existingMp.createdAt).getTime()
        );
        return sameGame && samePlacement && sameScore && sameCoins && timeDiffMs < 10000;
      });

      if (isDuplicateMatch) {
        duplicateMatchPlayerIds.push(mp.id);
        if (mp.matchId) duplicateMatchIds.push(mp.matchId);
        continue;
      }

      seenMatchIds.add(mp.matchId);
      uniqueMatchPlayers.push(mp);
    }

    // Clean up duplicate entries from database asynchronously
    if (duplicateMatchPlayerIds.length > 0) {
      prisma.matchPlayer.deleteMany({
        where: { id: { in: duplicateMatchPlayerIds } },
      }).catch((err) => console.error('Error deleting duplicate matchPlayers:', err));
    }
    if (duplicateMatchIds.length > 0) {
      prisma.match.deleteMany({
        where: { id: { in: duplicateMatchIds } },
      }).catch((err) => console.error('Error deleting duplicate matches:', err));
    }

    const matchesPlayed = uniqueMatchPlayers.length;
    const wins = uniqueMatchPlayers.filter((mp: any) => mp.placement === 1).length;
    const losses = matchesPlayed - wins;
    const winRate = matchesPlayed > 0 ? Math.round((wins / matchesPlayed) * 100) : 0;
    const likesCount = await prisma.userLike.count({
      where: { targetUsername: user.username },
    }).catch(() => 0);

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
        bio: user.bio,
        language: user.language,
        likesCount,
        createdAt: user.createdAt,
      },
      stats: {
        matchesPlayed,
        wins,
        losses,
        winRate,
      },
      inventory: (user.inventory || []).map((inv: any) => inv.item),
      achievements: (user.achievements || []).map((ach: any) => ach.achievement),
      matchHistory: uniqueMatchPlayers.map((mp: any) => ({
        matchId: mp.matchId,
        gameType: mp.match?.gameType,
        score: mp.score,
        coinsEarned: mp.coinsEarned,
        placement: mp.placement,
        date: mp.match?.createdAt || mp.createdAt,
        status: mp.match?.status || 'COMPLETED',
      })),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Update Profile parameters (username, avatar)
 */
export const updateProfile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { username, avatar, bio, language } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (username) {
      const existingUser = await prisma.user.findFirst({
        where: {
          username,
          NOT: { id: userId },
        },
      });

      if (existingUser) {
        return res.status(400).json({ error: 'Username already exists' });
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(username && { username }),
        ...(avatar && { avatar }),
        ...(bio !== undefined && { bio }),
        ...(language && { language }),
      },
    });

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        email: updatedUser.email,
        isGuest: updatedUser.isGuest,
        avatar: updatedUser.avatar,
        profileFrame: updatedUser.profileFrame,
        coins: updatedUser.coins,
        xp: updatedUser.xp,
        level: updatedUser.level,
        rank: updatedUser.rank,
        bio: updatedUser.bio,
        language: updatedUser.language,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
