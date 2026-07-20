import { Router } from 'express';
import { register, login, guestLogin, getProfile } from '../controllers/authController';
import {
  getFriends,
  getPendingRequests,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  getDirectMessages,
  sendDirectMessage,
} from '../controllers/socialController';
import { getItems, buyItem, equipItem } from '../controllers/storeController';
import { getLeaderboard } from '../controllers/leaderboardController';
import { getUsers, banUser, unbanUser, getSystemStats } from '../controllers/adminController';
import { authenticateJWT, requireAdmin } from '../middleware/auth';

const router = Router();

// Auth Routes
router.post('/auth/register', register);
router.post('/auth/login', login);
router.post('/auth/guest', guestLogin);
router.get('/auth/profile', authenticateJWT, getProfile);

// Social Routes
router.get('/social/friends', authenticateJWT, getFriends);
router.get('/social/requests', authenticateJWT, getPendingRequests);
router.post('/social/request', authenticateJWT, sendFriendRequest);
router.post('/social/accept', authenticateJWT, acceptFriendRequest);
router.post('/social/reject', authenticateJWT, rejectFriendRequest);
router.get('/social/messages/:friendId', authenticateJWT, getDirectMessages);
router.post('/social/messages/:friendId', authenticateJWT, sendDirectMessage);

// Store Routes
router.get('/store/items', authenticateJWT, getItems);
router.post('/store/buy', authenticateJWT, buyItem);
router.post('/store/equip', authenticateJWT, equipItem);

// Leaderboard Route
router.get('/leaderboard', authenticateJWT, getLeaderboard);

// Admin Routes
router.get('/admin/users', authenticateJWT, requireAdmin, getUsers);
router.post('/admin/ban', authenticateJWT, requireAdmin, banUser);
router.post('/admin/unban', authenticateJWT, requireAdmin, unbanUser);
router.get('/admin/stats', authenticateJWT, requireAdmin, getSystemStats);

export default router;
