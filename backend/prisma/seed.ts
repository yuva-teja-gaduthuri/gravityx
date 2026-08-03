import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding default Super Admin account...');
  const passwordHash = await bcrypt.hash('AdminPassword123!', 10);
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {
      role: 'ADMIN',
      emailVerified: true,
    },
    create: {
      username: 'admin',
      email: 'admin@gravityx.com',
      passwordHash,
      role: 'ADMIN',
      coins: 99999,
      level: 80,
      xp: 0,
      rank: 'Cosmic Conqueror',
      isGuest: false,
      emailVerified: true,
    },
  });

  console.log('Seeding store items...');

  const storeItems = [
    // Avatars
    // Avatars (50+ Unique Avatars)
    { name: 'Cyber Pilot Avatar', type: 'AVATAR', identifier: 'cyber_pilot', price: 200, imageUrl: '/assets/avatars/cyber_pilot.png' },
    { name: 'Nebula Ghost Avatar', type: 'AVATAR', identifier: 'nebula_ghost', price: 500, imageUrl: '/assets/avatars/nebula_ghost.png' },
    { name: 'Cosmic Emperor Avatar', type: 'AVATAR', identifier: 'cosmic_emperor', price: 1000, imageUrl: '/assets/avatars/cosmic_emperor.png' },
    { name: 'Grandmaster Knight', type: 'AVATAR', identifier: 'grandmaster_knight', price: 750, imageUrl: '/assets/avatars/grandmaster_knight.png' },
    { name: 'Alien Warlord Avatar', type: 'AVATAR', identifier: 'alien_warlord', price: 350, imageUrl: '/assets/avatars/alien_warlord.png' },
    { name: 'Supernova Titan Avatar', type: 'AVATAR', identifier: 'supernova_titan', price: 650, imageUrl: '/assets/avatars/supernova_titan.png' },
    { name: 'Android Vanguard Avatar', type: 'AVATAR', identifier: 'android_vanguard', price: 400, imageUrl: '/assets/avatars/android_vanguard.png' },
    { name: 'Galactic Ranger Avatar', type: 'AVATAR', identifier: 'galactic_ranger', price: 300, imageUrl: '/assets/avatars/galactic_ranger.png' },
    { name: 'Starship Captain Avatar', type: 'AVATAR', identifier: 'starship_captain', price: 450, imageUrl: '/assets/avatars/starship_captain.png' },
    { name: 'Void Stalker Avatar', type: 'AVATAR', identifier: 'void_stalker', price: 700, imageUrl: '/assets/avatars/void_stalker.png' },
    { name: 'Solar Sentinel Avatar', type: 'AVATAR', identifier: 'solar_sentinel', price: 600, imageUrl: '/assets/avatars/solar_sentinel.png' },
    { name: 'Archmage Merlin Avatar', type: 'AVATAR', identifier: 'archmage_merlin', price: 800, imageUrl: '/assets/avatars/archmage_merlin.png' },
    { name: 'Enchantress Sorceress Avatar', type: 'AVATAR', identifier: 'enchantress_sorceress', price: 750, imageUrl: '/assets/avatars/enchantress_sorceress.png' },
    { name: 'Spellbound Scholar Avatar', type: 'AVATAR', identifier: 'spellbound_scholar', price: 400, imageUrl: '/assets/avatars/spellbound_scholar.png' },
    { name: 'Phoenix Summoner Avatar', type: 'AVATAR', identifier: 'phoenix_summoner', price: 900, imageUrl: '/assets/avatars/phoenix_summoner.png' },
    { name: 'Crystal Alchemist Avatar', type: 'AVATAR', identifier: 'crystal_alchemist', price: 600, imageUrl: '/assets/avatars/crystal_alchemist.png' },
    { name: 'Shadow Necromancer Avatar', type: 'AVATAR', identifier: 'shadow_necromancer', price: 700, imageUrl: '/assets/avatars/shadow_necromancer.png' },
    { name: 'Celestial Astrologer Avatar', type: 'AVATAR', identifier: 'celestial_astrologer', price: 550, imageUrl: '/assets/avatars/celestial_astrologer.png' },
    { name: 'Mystic Druid Avatar', type: 'AVATAR', identifier: 'mystic_druid', price: 450, imageUrl: '/assets/avatars/mystic_druid.png' },
    { name: 'Arcane Illusionist Avatar', type: 'AVATAR', identifier: 'arcane_illusionist', price: 500, imageUrl: '/assets/avatars/arcane_illusionist.png' },
    { name: 'Rune Warden Avatar', type: 'AVATAR', identifier: 'rune_warden', price: 650, imageUrl: '/assets/avatars/rune_warden.png' },
    { name: 'Sovereign Chess King', type: 'AVATAR', identifier: 'sovereign_chess_king', price: 1000, imageUrl: '/assets/avatars/sovereign_chess_king.png' },
    { name: 'Imperial Chess Queen', type: 'AVATAR', identifier: 'imperial_chess_queen', price: 1000, imageUrl: '/assets/avatars/imperial_chess_queen.png' },
    { name: 'Iron Fortress Rook', type: 'AVATAR', identifier: 'iron_fortress_rook', price: 600, imageUrl: '/assets/avatars/iron_fortress_rook.png' },
    { name: 'Battle Bishop Avatar', type: 'AVATAR', identifier: 'battle_bishop', price: 650, imageUrl: '/assets/avatars/battle_bishop.png' },
    { name: 'Brave Vanguard Pawn', type: 'AVATAR', identifier: 'brave_vanguard_pawn', price: 250, imageUrl: '/assets/avatars/brave_vanguard_pawn.png' },
    { name: 'Wizard Chess Golem', type: 'AVATAR', identifier: 'wizard_chess_golem', price: 850, imageUrl: '/assets/avatars/wizard_chess_golem.png' },
    { name: 'Chess Strategist Avatar', type: 'AVATAR', identifier: 'chess_strategist', price: 500, imageUrl: '/assets/avatars/chess_strategist.png' },
    { name: 'Speed Blitz Master', type: 'AVATAR', identifier: 'speed_blitz_master', price: 700, imageUrl: '/assets/avatars/speed_blitz_master.png' },
    { name: 'Checkmate Champion Avatar', type: 'AVATAR', identifier: 'checkmate_champion', price: 900, imageUrl: '/assets/avatars/checkmate_champion.png' },
    { name: 'Ludo King Monarch', type: 'AVATAR', identifier: 'ludo_king_monarch', price: 850, imageUrl: '/assets/avatars/ludo_king_monarch.png' },
    { name: 'Ludo Queen Empress', type: 'AVATAR', identifier: 'ludo_queen_empress', price: 850, imageUrl: '/assets/avatars/ludo_queen_empress.png' },
    { name: 'Golden Dice Roller Avatar', type: 'AVATAR', identifier: 'golden_dice_roller', price: 500, imageUrl: '/assets/avatars/golden_dice_roller.png' },
    { name: 'Lucky Six Legend Avatar', type: 'AVATAR', identifier: 'lucky_six_legend', price: 600, imageUrl: '/assets/avatars/lucky_six_legend.png' },
    { name: 'Crimson General Avatar', type: 'AVATAR', identifier: 'crimson_general', price: 400, imageUrl: '/assets/avatars/crimson_general.png' },
    { name: 'Emerald Pathfinder Avatar', type: 'AVATAR', identifier: 'emerald_pathfinder', price: 400, imageUrl: '/assets/avatars/emerald_pathfinder.png' },
    { name: 'Sapphire Voyager Avatar', type: 'AVATAR', identifier: 'sapphire_voyager', price: 400, imageUrl: '/assets/avatars/sapphire_voyager.png' },
    { name: 'Amber Conqueror Avatar', type: 'AVATAR', identifier: 'amber_conqueror', price: 400, imageUrl: '/assets/avatars/amber_conqueror.png' },
    { name: 'Royal Court Jester', type: 'AVATAR', identifier: 'royal_court_jester', price: 450, imageUrl: '/assets/avatars/royal_court_jester.png' },
    { name: 'Champion of the Realm', type: 'AVATAR', identifier: 'champion_realm', price: 950, imageUrl: '/assets/avatars/champion_realm.png' },
    { name: 'Infernal Dragon Avatar', type: 'AVATAR', identifier: 'infernal_dragon', price: 1200, imageUrl: '/assets/avatars/infernal_dragon.png' },
    { name: 'Royal Lion Heart Avatar', type: 'AVATAR', identifier: 'royal_lion_heart', price: 800, imageUrl: '/assets/avatars/royal_lion_heart.png' },
    { name: 'Shadow Ninja Avatar', type: 'AVATAR', identifier: 'shadow_ninja', price: 650, imageUrl: '/assets/avatars/shadow_ninja.png' },
    { name: 'Cyberpunk Samurai Avatar', type: 'AVATAR', identifier: 'cyberpunk_samurai', price: 750, imageUrl: '/assets/avatars/cyberpunk_samurai.png' },
    { name: 'Golden Eagle Avatar', type: 'AVATAR', identifier: 'golden_eagle', price: 550, imageUrl: '/assets/avatars/golden_eagle.png' },
    { name: 'Frost Wolf Avatar', type: 'AVATAR', identifier: 'frost_wolf', price: 600, imageUrl: '/assets/avatars/frost_wolf.png' },
    { name: 'Thunder Falcon Avatar', type: 'AVATAR', identifier: 'thunder_falcon', price: 500, imageUrl: '/assets/avatars/thunder_falcon.png' },
    { name: 'Cyber Panther Avatar', type: 'AVATAR', identifier: 'cyber_panther', price: 700, imageUrl: '/assets/avatars/cyber_panther.png' },
    { name: 'Cosmic Valkyrie Avatar', type: 'AVATAR', identifier: 'cosmic_valkyrie', price: 850, imageUrl: '/assets/avatars/cosmic_valkyrie.png' },
    { name: 'Omega Overlord Avatar', type: 'AVATAR', identifier: 'omega_overlord', price: 1500, imageUrl: '/assets/avatars/omega_overlord.png' },
    { name: 'Quantum Hacker Avatar', type: 'AVATAR', identifier: 'quantum_hacker', price: 600, imageUrl: '/assets/avatars/quantum_hacker.png' },
    { name: 'Master Tactician Avatar', type: 'AVATAR', identifier: 'master_tactician', price: 750, imageUrl: '/assets/avatars/master_tactician.png' },

    // Dices
    {
      name: 'Ludo King Royal Red Dice',
      type: 'DICE',
      identifier: 'ludo_king_red',
      price: 250,
      imageUrl: '/assets/dice/ludo_king_red.png',
    },
    {
      name: 'Plasma Core Dice',
      type: 'DICE',
      identifier: 'plasma_core',
      price: 350,
      imageUrl: '/assets/dice/plasma_core.png',
    },
    {
      name: 'Quantum Neon Blue Dice',
      type: 'DICE',
      identifier: 'quantum_roll',
      price: 450,
      imageUrl: '/assets/dice/quantum_roll.png',
    },
    {
      name: 'Chess.com Emerald Dice',
      type: 'DICE',
      identifier: 'chesscom_emerald',
      price: 600,
      imageUrl: '/assets/dice/chesscom_emerald.png',
    },
    {
      name: 'Gold Gravity Crown Dice',
      type: 'DICE',
      identifier: 'gold_gravity',
      price: 800,
      imageUrl: '/assets/dice/gold_gravity.png',
    },
    {
      name: 'Diamond Crystal Dice',
      type: 'DICE',
      identifier: 'diamond_crystal',
      price: 1000,
      imageUrl: '/assets/dice/diamond_crystal.png',
    },
    {
      name: 'Dragon Flame Dice',
      type: 'DICE',
      identifier: 'dragon_flame',
      price: 750,
      imageUrl: '/assets/dice/dragon_flame.png',
    },

    // Ludo Boards
    {
      name: 'Ludo King Royal Board',
      type: 'BOARD',
      identifier: 'ludo_king_royal',
      price: 600,
      imageUrl: '/assets/boards/ludo_king_royal.png',
    },
    {
      name: 'Ludo Club Star Arena',
      type: 'BOARD',
      identifier: 'ludo_club_star',
      price: 500,
      imageUrl: '/assets/boards/ludo_club_star.png',
    },
    {
      name: 'MPL Pro Cyber Arena',
      type: 'BOARD',
      identifier: 'mpl_pro_cyber',
      price: 700,
      imageUrl: '/assets/boards/mpl_pro_cyber.png',
    },
    {
      name: 'Neon Abyss Ludo Board',
      type: 'BOARD',
      identifier: 'neon_abyss',
      price: 450,
      imageUrl: '/assets/boards/neon_abyss.png',
    },
    {
      name: 'Mahogany Vintage Wood Board',
      type: 'BOARD',
      identifier: 'mahogany_vintage',
      price: 550,
      imageUrl: '/assets/boards/mahogany_vintage.png',
    },

    // Chess Boards
    {
      name: 'Chess.com Green & Buff Board',
      type: 'BOARD',
      identifier: 'chesscom_green',
      price: 650,
      imageUrl: '/assets/boards/chesscom_green.png',
    },
    {
      name: 'Chess.com Walnut & Maple Board',
      type: 'BOARD',
      identifier: 'chesscom_walnut',
      price: 800,
      imageUrl: '/assets/boards/chesscom_walnut.png',
    },
    {
      name: 'Lichess Slate Blue Board',
      type: 'BOARD',
      identifier: 'lichess_blue',
      price: 600,
      imageUrl: '/assets/boards/lichess_blue.png',
    },
    {
      name: 'Chess24 Synthwave Cyber Board',
      type: 'BOARD',
      identifier: 'chess24_synth',
      price: 750,
      imageUrl: '/assets/boards/chess24_synth.png',
    },
    {
      name: 'Royal Onyx & Marble Board',
      type: 'BOARD',
      identifier: 'royal_marble',
      price: 900,
      imageUrl: '/assets/boards/royal_marble.png',
    },

    // Profile Frames
    {
      name: 'Ludo King Golden Crown',
      type: 'FRAME',
      identifier: 'ludo_king_crown',
      price: 500,
      imageUrl: '/assets/frames/ludo_king_crown.png',
    },
    {
      name: 'Chess.com Grandmaster Laurel',
      type: 'FRAME',
      identifier: 'chesscom_laurel',
      price: 750,
      imageUrl: '/assets/frames/chesscom_laurel.png',
    },
    {
      name: 'Neon Glow Cyber Frame',
      type: 'FRAME',
      identifier: 'neon_glow',
      price: 350,
      imageUrl: '/assets/frames/neon_glow.png',
    },
    {
      name: 'Event Horizon Void Frame',
      type: 'FRAME',
      identifier: 'event_horizon',
      price: 600,
      imageUrl: '/assets/frames/event_horizon.png',
    },
    {
      name: 'Diamond League Crest Frame',
      type: 'FRAME',
      identifier: 'diamond_crest',
      price: 900,
      imageUrl: '/assets/frames/diamond_crest.png',
    },
  ];

  // Batch store items in chunks to maintain database connection stability
  const batchSize = 10;
  for (let i = 0; i < storeItems.length; i += batchSize) {
    const batch = storeItems.slice(i, i + batchSize);
    await prisma.$transaction(
      batch.map((item) =>
        prisma.storeItem.upsert({
          where: { identifier: item.identifier },
          update: {
            name: item.name,
            price: item.price,
            imageUrl: item.imageUrl,
            type: item.type,
          },
          create: item,
        })
      )
    );
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
