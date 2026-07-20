import prisma from './prisma';

// Ranks based on Level
const RANKS = [
  { minLevel: 1, name: 'Bronze V' },
  { minLevel: 3, name: 'Bronze I' },
  { minLevel: 5, name: 'Silver V' },
  { minLevel: 8, name: 'Silver I' },
  { minLevel: 12, name: 'Gold V' },
  { minLevel: 16, name: 'Gold I' },
  { minLevel: 22, name: 'Platinum V' },
  { minLevel: 30, name: 'Diamond' },
];

export async function awardUserStats(userId: string, xpGained: number, coinsGained: number) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { achievements: true },
    });

    if (!user) return null;

    let newXp = user.xp + xpGained;
    let newCoins = user.coins + coinsGained;
    let newLevel = user.level;

    // Level up calculation: XP required = level * 200
    while (newXp >= newLevel * 200) {
      newXp -= newLevel * 200;
      newLevel += 1;
    }

    // Determine Rank
    let newRank = user.rank;
    for (const rank of RANKS) {
      if (newLevel >= rank.minLevel) {
        newRank = rank.name;
      }
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        xp: newXp,
        coins: newCoins,
        level: newLevel,
        rank: newRank,
      },
    });

    // Check and trigger achievements
    await checkAchievements(userId, updatedUser.level, newCoins);

    return updatedUser;
  } catch (error) {
    console.error('Error awarding stats:', error);
    return null;
  }
}

async function checkAchievements(userId: string, level: number, coins: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      achievements: true,
      matchPlayers: true,
    },
  });
  if (!user) return;

  const unlockedIds = new Set(user.achievements.map((a) => a.achievementId));

  const allAchievements = await prisma.achievement.findMany();

  for (const ach of allAchievements) {
    if (unlockedIds.has(ach.id)) continue;

    let shouldUnlock = false;

    if (ach.name === 'First Victory') {
      const wins = user.matchPlayers.filter((mp) => mp.placement === 1).length;
      if (wins >= 1) shouldUnlock = true;
    } else if (ach.name === 'Space Scout') {
      if (user.matchPlayers.length >= 5) shouldUnlock = true;
    } else if (ach.name === 'Ludo Conqueror') {
      const ludoWins = user.matchPlayers.filter((mp) => mp.placement === 1 && mp.score > 0).length; // simple check
      if (ludoWins >= 1) shouldUnlock = true;
    }

    if (shouldUnlock) {
      await prisma.userAchievement.create({
        data: {
          userId,
          achievementId: ach.id,
        },
      });
      // Award rewards
      await prisma.user.update({
        where: { id: userId },
        data: {
          xp: { increment: ach.xpReward },
          coins: { increment: ach.coinsReward },
        },
      });
    }
  }
}
