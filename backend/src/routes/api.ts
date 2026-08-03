import { Router } from 'express';
import { register, login, guestLogin, getProfile, updateProfile, verifyEmail, resendVerification, forgotPassword, resetPassword, refreshToken } from '../controllers/authController';
import {
  getFriends,
  getPendingRequests,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  getDirectMessages,
  sendDirectMessage,
  likePlayer,
  reviewPlayer,
  getPlayerReviews,
  getPlayerLikes,
  getUserSocialStatus,
  getNotifications,
  markNotificationsRead,
  clearNotifications,
} from '../controllers/socialController';
import { getItems, buyItem, equipItem } from '../controllers/storeController';
import { getLeaderboard } from '../controllers/leaderboardController';
import { 
  getUsers, banUser, unbanUser, getSystemStats, updateUser, deleteUser,
  getModerationReviews, deleteReview, getModerationFeedback, deleteFeedback,
  getDivisionRanks, upsertDivisionRank, deleteDivisionRank
} from '../controllers/adminController';
import { submitFeedback, getGameFeedback } from '../controllers/feedbackController';
import { authenticateJWT, requireAdmin } from '../middleware/auth';
import { rateLimitMiddleware } from '../middleware/rateLimit';
import { roomStore } from '../models/roomStore';

const router = Router();

// Auth Routes
router.post('/auth/register', rateLimitMiddleware, register);
router.post('/auth/login', rateLimitMiddleware, login);
router.post('/auth/guest', guestLogin);
router.get('/auth/profile', authenticateJWT, getProfile);
router.put('/auth/profile', authenticateJWT, updateProfile);
router.post('/auth/verify', verifyEmail);
router.post('/auth/resend-verification', resendVerification);
router.post('/auth/forgot-password', rateLimitMiddleware, forgotPassword);
router.post('/auth/reset-password', rateLimitMiddleware, resetPassword);
router.post('/auth/refresh', refreshToken);


// Social Routes
router.get('/social/friends', authenticateJWT, getFriends);
router.get('/social/requests', authenticateJWT, getPendingRequests);
router.post('/social/request', authenticateJWT, sendFriendRequest);
router.post('/social/accept', authenticateJWT, acceptFriendRequest);
router.post('/social/reject', authenticateJWT, rejectFriendRequest);
router.get('/social/messages/:friendId', authenticateJWT, getDirectMessages);
router.post('/social/messages/:friendId', authenticateJWT, sendDirectMessage);
router.post('/social/like', authenticateJWT, likePlayer);
router.post('/social/review', authenticateJWT, reviewPlayer);
router.get('/social/reviews/:username', authenticateJWT, getPlayerReviews);
router.get('/social/likes/:username', authenticateJWT, getPlayerLikes);
router.get('/social/card-status/:targetUsername', authenticateJWT, getUserSocialStatus);
router.get('/social/notifications', authenticateJWT, getNotifications);
router.post('/social/notifications/read', authenticateJWT, markNotificationsRead);
router.post('/social/notifications/clear', authenticateJWT, clearNotifications);

// Store Routes
router.get('/store/items', authenticateJWT, getItems);
router.post('/store/buy', authenticateJWT, buyItem);
router.post('/store/equip', authenticateJWT, equipItem);

// Leaderboard Route
router.get('/leaderboard', authenticateJWT, getLeaderboard);

// Feedback Routes
router.post('/feedback', authenticateJWT, submitFeedback);
router.get('/feedback/:game', authenticateJWT, getGameFeedback);

// Public Lobby Rooms
router.get('/rooms', authenticateJWT, (req, res) => {
  try {
    const rooms = roomStore.getAllRooms();
    const publicLobbies = rooms
      .filter((r: any) => r.type === 'PUBLIC' && r.status === 'LOBBY')
      .map((r: any) => ({
        code: r.code,
        name: r.name,
        gameType: r.gameType,
        maxPlayers: r.maxPlayers,
        playerCount: r.players.length,
        hostName: r.players.find((p: any) => p.id === r.hostId)?.username || r.players[0]?.username || 'Captain',
      }));
    res.json(publicLobbies);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin Routes
router.get('/admin/users', authenticateJWT, requireAdmin, getUsers);
router.post('/admin/user/update', authenticateJWT, requireAdmin, updateUser);
router.post('/admin/user/delete', authenticateJWT, requireAdmin, deleteUser);
router.post('/admin/ban', authenticateJWT, requireAdmin, banUser);
router.post('/admin/unban', authenticateJWT, requireAdmin, unbanUser);
router.get('/admin/stats', authenticateJWT, requireAdmin, getSystemStats);

// Super Admin Moderation Routes
router.get('/admin/reviews', authenticateJWT, requireAdmin, getModerationReviews);
router.delete('/admin/reviews/:id', authenticateJWT, requireAdmin, deleteReview);
router.get('/admin/feedback', authenticateJWT, requireAdmin, getModerationFeedback);
router.delete('/admin/feedback/:id', authenticateJWT, requireAdmin, deleteFeedback);

// Super Admin Division Ranks Routes
router.get('/admin/ranks', authenticateJWT, requireAdmin, getDivisionRanks);
router.post('/admin/ranks', authenticateJWT, requireAdmin, upsertDivisionRank);
router.delete('/admin/ranks/:id', authenticateJWT, requireAdmin, deleteDivisionRank);

export default router;
