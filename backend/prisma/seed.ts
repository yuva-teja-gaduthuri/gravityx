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

  console.log('Seeding 100+ items per category for Store...');

  // 1. Generate 100 Avatars
  const baseAvatars = [
    { name: 'Cyber Pilot Avatar', identifier: 'cyber_pilot', price: 200 },
    { name: 'Nebula Ghost Avatar', identifier: 'nebula_ghost', price: 500 },
    { name: 'Cosmic Emperor Avatar', identifier: 'cosmic_emperor', price: 1000 },
    { name: 'Grandmaster Knight', identifier: 'grandmaster_knight', price: 750 },
    { name: 'Alien Warlord Avatar', identifier: 'alien_warlord', price: 350 },
    { name: 'Supernova Titan Avatar', identifier: 'supernova_titan', price: 650 },
    { name: 'Android Vanguard Avatar', identifier: 'android_vanguard', price: 400 },
    { name: 'Galactic Ranger Avatar', identifier: 'galactic_ranger', price: 300 },
    { name: 'Starship Captain Avatar', identifier: 'starship_captain', price: 450 },
    { name: 'Void Stalker Avatar', identifier: 'void_stalker', price: 700 },
    { name: 'Solar Sentinel Avatar', identifier: 'solar_sentinel', price: 600 },
    { name: 'Archmage Merlin Avatar', identifier: 'archmage_merlin', price: 800 },
    { name: 'Enchantress Sorceress Avatar', identifier: 'enchantress_sorceress', price: 750 },
    { name: 'Spellbound Scholar Avatar', identifier: 'spellbound_scholar', price: 400 },
    { name: 'Phoenix Summoner Avatar', identifier: 'phoenix_summoner', price: 900 },
    { name: 'Crystal Alchemist Avatar', identifier: 'crystal_alchemist', price: 600 },
    { name: 'Shadow Necromancer Avatar', identifier: 'shadow_necromancer', price: 700 },
    { name: 'Celestial Astrologer Avatar', identifier: 'celestial_astrologer', price: 550 },
    { name: 'Mystic Druid Avatar', identifier: 'mystic_druid', price: 450 },
    { name: 'Arcane Illusionist Avatar', identifier: 'arcane_illusionist', price: 500 },
    { name: 'Rune Warden Avatar', identifier: 'rune_warden', price: 650 },
    { name: 'Sovereign Chess King', identifier: 'sovereign_chess_king', price: 1000 },
    { name: 'Imperial Chess Queen', identifier: 'imperial_chess_queen', price: 1000 },
    { name: 'Iron Fortress Rook', identifier: 'iron_fortress_rook', price: 600 },
    { name: 'Battle Bishop Avatar', identifier: 'battle_bishop', price: 650 },
    { name: 'Brave Vanguard Pawn', identifier: 'brave_vanguard_pawn', price: 250 },
    { name: 'Wizard Chess Golem', identifier: 'wizard_chess_golem', price: 850 },
    { name: 'Chess Strategist Avatar', identifier: 'chess_strategist', price: 500 },
    { name: 'Speed Blitz Master', identifier: 'speed_blitz_master', price: 700 },
    { name: 'Checkmate Champion Avatar', identifier: 'checkmate_champion', price: 900 },
    { name: 'Ludo King Monarch', identifier: 'ludo_king_monarch', price: 850 },
    { name: 'Ludo Queen Empress', identifier: 'ludo_queen_empress', price: 850 },
    { name: 'Golden Dice Roller Avatar', identifier: 'golden_dice_roller', price: 500 },
    { name: 'Lucky Six Legend Avatar', identifier: 'lucky_six_legend', price: 600 },
    { name: 'Crimson General Avatar', identifier: 'crimson_general', price: 400 },
    { name: 'Emerald Pathfinder Avatar', identifier: 'emerald_pathfinder', price: 400 },
    { name: 'Sapphire Voyager Avatar', identifier: 'sapphire_voyager', price: 400 },
    { name: 'Amber Conqueror Avatar', identifier: 'amber_conqueror', price: 400 },
    { name: 'Royal Court Jester', identifier: 'royal_court_jester', price: 450 },
    { name: 'Champion of the Realm', identifier: 'champion_realm', price: 950 },
    { name: 'Infernal Dragon Avatar', identifier: 'infernal_dragon', price: 1200 },
    { name: 'Royal Lion Heart Avatar', identifier: 'royal_lion_heart', price: 800 },
    { name: 'Shadow Ninja Avatar', identifier: 'shadow_ninja', price: 650 },
    { name: 'Cyberpunk Samurai Avatar', identifier: 'cyberpunk_samurai', price: 750 },
    { name: 'Golden Eagle Avatar', identifier: 'golden_eagle', price: 550 },
    { name: 'Frost Wolf Avatar', identifier: 'frost_wolf', price: 600 },
    { name: 'Thunder Falcon Avatar', identifier: 'thunder_falcon', price: 500 },
    { name: 'Cyber Panther Avatar', identifier: 'cyber_panther', price: 700 },
    { name: 'Cosmic Valkyrie Avatar', identifier: 'cosmic_valkyrie', price: 850 },
    { name: 'Omega Overlord Avatar', identifier: 'omega_overlord', price: 1500 },
    { name: 'Quantum Hacker Avatar', identifier: 'quantum_hacker', price: 600 },
    { name: 'Master Tactician Avatar', identifier: 'master_tactician', price: 750 },
  ];

  const avatarThemes = ['Quantum', 'Astra', 'Vortex', 'Hyperion', 'Eclipse', 'Starlight', 'Chrono', 'Titan', 'Zenith', 'Nebula', 'Pulsar', 'Cosmo'];
  const avatarRoles = ['Guardian', 'Warlock', 'Phantom', 'Templar', 'Assassin', 'Vanguard', 'Archon', 'Striker'];

  const avatarsList = [...baseAvatars];
  let avatarCount = baseAvatars.length;
  for (const theme of avatarThemes) {
    for (const role of avatarRoles) {
      if (avatarCount >= 105) break;
      const id = `${theme.toLowerCase()}_${role.toLowerCase()}`;
      avatarsList.push({
        name: `${theme} ${role} Avatar`,
        identifier: id,
        price: 250 + (avatarCount * 15) % 850,
      });
      avatarCount++;
    }
  }

  // 2. Generate 100 Dice Skins
  const diceBase = [
    { name: 'Ludo King Royal Red Dice', identifier: 'ludo_king_red', price: 250 },
    { name: 'Plasma Core Dice', identifier: 'plasma_core', price: 350 },
    { name: 'Quantum Neon Blue Dice', identifier: 'quantum_roll', price: 450 },
    { name: 'Chess.com Emerald Dice', identifier: 'chesscom_emerald', price: 600 },
    { name: 'Gold Gravity Crown Dice', identifier: 'gold_gravity', price: 800 },
    { name: 'Diamond Crystal Dice', identifier: 'diamond_crystal', price: 1000 },
    { name: 'Dragon Flame Dice', identifier: 'dragon_flame', price: 750 },
  ];

  const diceStyles = ['Ruby Spark', 'Sapphire Storm', 'Emerald Blitz', 'Amethyst Void', 'Topaz Fire', 'Obsidian Fury', 'Lunar Glow', 'Solar Flare', 'Galaxy Swirl', 'Vortex Roll', 'Frost Sparkle', 'Titan Gold', 'Inferno Flame', 'Cosmic Aura', 'Neon Pulse'];
  const diceEditions = ['Edition I', 'Pro', 'Ultra', 'Prime', 'Collector', 'Legendary', 'VIP'];

  const diceList = [...diceBase];
  let diceCount = diceBase.length;
  for (const style of diceStyles) {
    for (const ed of diceEditions) {
      if (diceCount >= 105) break;
      const id = `${style.toLowerCase().replace(/ /g, '_')}_${ed.toLowerCase().replace(/ /g, '_')}`;
      diceList.push({
        name: `${style} Dice (${ed})`,
        identifier: id,
        price: 200 + (diceCount * 20) % 900,
      });
      diceCount++;
    }
  }

  // 3. Generate 100 Board Skins
  const boardBase = [
    { name: 'Ludo King Royal Board', identifier: 'ludo_king_royal', price: 600 },
    { name: 'Ludo Club Star Arena', identifier: 'ludo_club_star', price: 500 },
    { name: 'MPL Pro Cyber Arena', identifier: 'mpl_pro_cyber', price: 700 },
    { name: 'Neon Abyss Ludo Board', identifier: 'neon_abyss', price: 450 },
    { name: 'Mahogany Vintage Wood Board', identifier: 'mahogany_vintage', price: 550 },
    { name: 'Chess.com Green & Buff Board', identifier: 'chesscom_green', price: 650 },
    { name: 'Chess.com Walnut & Maple Board', identifier: 'chesscom_walnut', price: 800 },
    { name: 'Lichess Slate Blue Board', identifier: 'lichess_blue', price: 600 },
    { name: 'Chess24 Synthwave Cyber Board', identifier: 'chess24_synth', price: 750 },
    { name: 'Royal Onyx & Marble Board', identifier: 'royal_marble', price: 900 },
  ];

  const boardThemes = ['Cosmic Void', 'Cyberpunk Neon', 'Royal Gold Marble', 'Deep Abyss', 'Starlight Galaxy', 'Magma Lava', 'Arctic Frost', 'Emerald Forest', 'Ruby Crimson', 'Violet Nebula', 'Solar Flare', 'Diamond Zenith', 'Obsidian Shadow', 'Astra Orbit', 'Titan Fortress'];
  const boardTypes = ['Arena', 'Domain', 'Grid', 'Square', 'Nexus', 'Matrix', 'Field'];

  const boardList = [...boardBase];
  let boardCount = boardBase.length;
  for (const bTheme of boardThemes) {
    for (const bType of boardTypes) {
      if (boardCount >= 105) break;
      const id = `${bTheme.toLowerCase().replace(/ /g, '_')}_${bType.toLowerCase()}`;
      boardList.push({
        name: `${bTheme} ${bType}`,
        identifier: id,
        price: 350 + (boardCount * 15) % 950,
      });
      boardCount++;
    }
  }

  // 4. Generate 100 Profile Frames
  const frameBase = [
    { name: 'Ludo King Golden Crown', identifier: 'ludo_king_crown', price: 500 },
    { name: 'Chess.com Grandmaster Laurel', identifier: 'chesscom_laurel', price: 750 },
    { name: 'Neon Glow Cyber Frame', identifier: 'neon_glow', price: 350 },
    { name: 'Event Horizon Void Frame', identifier: 'event_horizon', price: 600 },
    { name: 'Diamond League Crest Frame', identifier: 'diamond_crest', price: 900 },
  ];

  const frameStyles = ['Golden Laurel', 'Cyber Neon Ring', 'Void Singularity', 'Dragon Flame Crest', 'Supernova Burst', 'Quantum Shield', 'Galactic Empire', 'Phoenix Wings', 'Astral Star Border', 'Diamond Sovereign', 'Hyperion Gold', 'Plasma Ring', 'Vortex Shield', 'Aura Celestial', 'Titan Crown'];
  const frameTiers = ['Rank I', 'Rank II', 'Master', 'Grandmaster', 'Legend', 'Conqueror', 'Supreme'];

  const frameList = [...frameBase];
  let frameCount = frameBase.length;
  for (const fStyle of frameStyles) {
    for (const fTier of frameTiers) {
      if (frameCount >= 105) break;
      const id = `${fStyle.toLowerCase().replace(/ /g, '_')}_${fTier.toLowerCase().replace(/ /g, '_')}`;
      frameList.push({
        name: `${fStyle} Frame (${fTier})`,
        identifier: id,
        price: 300 + (frameCount * 15) % 900,
      });
      frameCount++;
    }
  }

  // Build total store items array
  const storeItems = [
    ...avatarsList.map(item => ({ ...item, type: 'AVATAR', imageUrl: `/assets/avatars/${item.identifier}.png` })),
    ...diceList.map(item => ({ ...item, type: 'DICE', imageUrl: `/assets/dice/${item.identifier}.png` })),
    ...boardList.map(item => ({ ...item, type: 'BOARD', imageUrl: `/assets/boards/${item.identifier}.png` })),
    ...frameList.map(item => ({ ...item, type: 'FRAME', imageUrl: `/assets/frames/${item.identifier}.png` })),
  ];

  console.log(`Total store items to seed: ${storeItems.length}`);

  await prisma.storeItem.createMany({
    data: storeItems,
    skipDuplicates: true,
  });

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

  console.log('Seed completed successfully with 400+ store items!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
