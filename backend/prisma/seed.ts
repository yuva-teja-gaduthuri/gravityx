import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding store items...');

  const storeItems = [
    // Avatars
    {
      name: 'Cyber Pilot Avatar',
      type: 'AVATAR',
      identifier: 'cyber_pilot',
      price: 200,
      imageUrl: '/assets/avatars/cyber_pilot.png',
    },
    {
      name: 'Nebula Ghost Avatar',
      type: 'AVATAR',
      identifier: 'nebula_ghost',
      price: 500,
      imageUrl: '/assets/avatars/nebula_ghost.png',
    },
    {
      name: 'Cosmic Emperor Avatar',
      type: 'AVATAR',
      identifier: 'cosmic_emperor',
      price: 1000,
      imageUrl: '/assets/avatars/cosmic_emperor.png',
    },

    // Dice
    {
      name: 'Plasma Core Dice',
      type: 'DICE',
      identifier: 'plasma_core',
      price: 150,
      imageUrl: '/assets/dice/plasma_core.png',
    },
    {
      name: 'Quantum Roll Dice',
      type: 'DICE',
      identifier: 'quantum_roll',
      price: 400,
      imageUrl: '/assets/dice/quantum_roll.png',
    },
    {
      name: 'Gold Gravity Dice',
      type: 'DICE',
      identifier: 'gold_gravity',
      price: 800,
      imageUrl: '/assets/dice/gold_gravity.png',
    },

    // Board Themes
    {
      name: 'Neon Abyss Board',
      type: 'BOARD',
      identifier: 'neon_abyss',
      price: 300,
      imageUrl: '/assets/boards/neon_abyss.png',
    },
    {
      name: 'Void Station Board',
      type: 'BOARD',
      identifier: 'void_station',
      price: 600,
      imageUrl: '/assets/boards/void_station.png',
    },

    // Profile Frames
    {
      name: 'Neon Glow Frame',
      type: 'FRAME',
      identifier: 'neon_glow',
      price: 100,
      imageUrl: '/assets/frames/neon_glow.png',
    },
    {
      name: 'Event Horizon Frame',
      type: 'FRAME',
      identifier: 'event_horizon',
      price: 400,
      imageUrl: '/assets/frames/event_horizon.png',
    },
  ];

  for (const item of storeItems) {
    await prisma.storeItem.upsert({
      where: { identifier: item.identifier },
      update: {},
      create: item,
    });
  }

  console.log('Seeding achievements...');

  const achievements = [
    {
      name: 'First Victory',
      description: 'Win your first multiplayer match on GravityX',
      badgeUrl: '/assets/badges/first_victory.png',
      xpReward: 100,
      coinsReward: 50,
    },
    {
      name: 'Space Scout',
      description: 'Play 5 complete matches on the platform',
      badgeUrl: '/assets/badges/space_scout.png',
      xpReward: 250,
      coinsReward: 100,
    },
    {
      name: "Ramudu's Vision",
      description: 'Find Seetha on your very first guess',
      badgeUrl: '/assets/badges/ramudus_vision.png',
      xpReward: 300,
      coinsReward: 150,
    },
    {
      name: "Seetha's Stealth",
      description: 'Stay hidden as Seetha for over 2 minutes in a single game',
      badgeUrl: '/assets/badges/seethas_stealth.png',
      xpReward: 200,
      coinsReward: 100,
    },
    {
      name: 'Ludo Conqueror',
      description: 'Win a 4-player Ludo game on the platform',
      badgeUrl: '/assets/badges/ludo_conqueror.png',
      xpReward: 300,
      coinsReward: 150,
    },
  ];

  for (const ach of achievements) {
    await prisma.achievement.upsert({
      where: { name: ach.name },
      update: {},
      create: ach,
    });
  }

  console.log('Seeding initial game feedback...');
  const initialFeedback = [
    { game: 'RAMUDU_SEETHA', username: 'CosmicVoyager', rating: 5, comment: 'Phenomenal deduction mechanics! Really challenges your logical thinking.', createdAt: new Date('2026-07-24') },
    { game: 'RAMUDU_SEETHA', username: 'LudoKing', rating: 4, comment: 'Very interesting game, although requires exactly 3+ players.', createdAt: new Date('2026-07-23') },
    { game: 'LUDO', username: 'SpaceRacer', rating: 5, comment: 'Classic traditional Ludo in space! The board looks amazing.', createdAt: new Date('2026-07-24') },
    { game: 'LUDO', username: 'StarGazer', rating: 4, comment: 'Really love the team mode and quick emojis in chat.', createdAt: new Date('2026-07-24') },
    { game: 'CHESS', username: 'Grandmaster', rating: 5, comment: 'Sleek interface. The chess board layout feels premium.', createdAt: new Date('2026-07-25') }
  ];

  for (const fb of initialFeedback) {
    const existing = await prisma.feedback.findFirst({
      where: {
        game: fb.game,
        username: fb.username,
        comment: fb.comment
      }
    });
    if (!existing) {
      await prisma.feedback.create({ data: fb });
    }
  }

  console.log('Seeding division ranks up to Conqueror...');
  const divisionRanks = [
    { minLevel: 1, name: 'Bronze V', badgeIcon: 'bronze_badge' },
    { minLevel: 3, name: 'Bronze I', badgeIcon: 'bronze_badge' },
    { minLevel: 5, name: 'Silver V', badgeIcon: 'silver_badge' },
    { minLevel: 8, name: 'Silver I', badgeIcon: 'silver_badge' },
    { minLevel: 12, name: 'Gold V', badgeIcon: 'gold_badge' },
    { minLevel: 16, name: 'Gold I', badgeIcon: 'gold_badge' },
    { minLevel: 22, name: 'Platinum V', badgeIcon: 'platinum_badge' },
    { minLevel: 30, name: 'Diamond', badgeIcon: 'diamond_badge' },
    { minLevel: 40, name: 'Crown', badgeIcon: 'crown_badge' },
    { minLevel: 50, name: 'Ace', badgeIcon: 'ace_badge' },
    { minLevel: 65, name: 'Conqueror', badgeIcon: 'conqueror_badge' },
    { minLevel: 80, name: 'Cosmic Conqueror', badgeIcon: 'cosmic_conqueror_badge' },
  ];

  for (const rank of divisionRanks) {
    await prisma.divisionRank.upsert({
      where: { minLevel: rank.minLevel },
      update: { name: rank.name, badgeIcon: rank.badgeIcon },
      create: rank,
    });
  }

  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
