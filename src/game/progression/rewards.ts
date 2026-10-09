/**
 * GoWithFlow — Level Rewards & Cosmetic Unlocks
 */

export interface LevelReward {
  level: number;
  id: string;
  name: string;
  type: 'trail' | 'board' | 'badge' | 'shard-bonus';
  value: string;
  description: string;
  icon: string;
}

export const LEVEL_REWARDS: LevelReward[] = [
  {
    level: 2,
    id: 'reward_lvl_2_shards',
    name: 'Cadet Stash',
    type: 'shard-bonus',
    value: '75',
    description: '+75 Bonus Data Shards deposited to your cyber vault',
    icon: '💎',
  },
  {
    level: 4,
    id: 'reward_lvl_4_badge',
    name: 'Sky Strider Badge',
    type: 'badge',
    value: 'badge:sky-strider',
    description: 'Exclusive pilot profile badge commemorating Sector 1 mastery',
    icon: '☁️',
  },
  {
    level: 6,
    id: 'reward_lvl_6_shards',
    name: 'Overdrive Cache',
    type: 'shard-bonus',
    value: '150',
    description: '+150 Bonus Data Shards for advanced tech upgrades',
    icon: '⚡',
  },
  {
    level: 8,
    id: 'reward_lvl_8_board',
    name: 'Laser Edge Hoverboard',
    type: 'board',
    value: 'laser-edge',
    description: 'Razor-sharp stealth speed wedge with twin hot-orange stringers',
    icon: '🛹',
  },
  {
    level: 10,
    id: 'reward_lvl_10_badge',
    name: 'Celestial Voyager Badge',
    type: 'badge',
    value: 'badge:celestial-voyager',
    description: 'Prestige insignia for deep-sector explorers',
    icon: '🌟',
  },
  {
    level: 12,
    id: 'reward_lvl_12_trail',
    name: 'Plasma Rainbow Trail',
    type: 'trail',
    value: 'plasma-rainbow',
    description: 'Chromatic multi-frequency luminous hoverboard ion trail',
    icon: '🌈',
  },
  {
    level: 15,
    id: 'reward_lvl_15_board',
    name: 'Void Stalker Deck',
    type: 'board',
    value: 'void-stalker',
    description: 'Ultra-black dark matter composite deck with purple void rails',
    icon: '🔮',
  },
  {
    level: 20,
    id: 'reward_lvl_20_badge',
    name: 'Core Master Badge',
    type: 'badge',
    value: 'badge:core-master',
    description: 'Supreme badge awarded for conquering all five worlds',
    icon: '👑',
  },
];

export const LEVEL_REWARDS_BY_LEVEL = new Map<number, LevelReward>(
  LEVEL_REWARDS.map(r => [r.level, r])
);
