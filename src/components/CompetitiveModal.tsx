/**
 * GoWithFlow — Competitive & Social Hub Modal
 * Phase 16 Section 19: Global Leaderboards, Friend Challenges, Pilot Profile & Seasonal Hub.
 */

import React, { useState } from 'react';
import {
  X,
  Trophy,
  Users,
  User,
  Sparkles,
  Swords,
  Share2,
  Check,
  Shield,
  Eye,
  EyeOff,
  Calendar,
  Award,
  Zap,
  Flame,
  Globe,
  Trash2,
  Clock,
  Bell,
  Gift,
  CheckCircle2,
} from 'lucide-react';
import { SocialManager } from '../game/social/SocialManager';
import {
  LeaderboardCategory,
  LeaderboardTimeWindow,
  CURRENT_SEASON_NAME,
  CURRENT_SEASON_TAG,
} from '../game/social/socialConfig';
import { ProgressionManager } from '../game/progression';

interface CompetitiveModalProps {
  socialMgr: SocialManager;
  progressionMgr?: ProgressionManager;
  onClose: () => void;
  onLaunchFriendChallenge?: (challengeId: string) => void;
}

export const CompetitiveModal: React.FC<CompetitiveModalProps> = ({
  socialMgr,
  progressionMgr,
  onClose,
  onLaunchFriendChallenge,
}) => {
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'challenges' | 'profile' | 'season'>('leaderboard');
  const [category, setCategory] = useState<LeaderboardCategory>('score');
  const [timeWindow, setTimeWindow] = useState<LeaderboardTimeWindow>('seasonal');
  const [modeFilter, setModeFilter] = useState<string>('all');
  const [renameInput, setRenameInput] = useState('');
  const [renameMessage, setRenameMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [copiedSuccess, setCopiedSuccess] = useState(false);

  const profile = socialMgr.profileService.getProfile();
  const leaderboards = socialMgr.leaderboardService.getLeaderboard(category, timeWindow, modeFilter, 25);
  const playerRank = socialMgr.leaderboardService.getPlayerRank(profile.id, modeFilter !== 'all' ? modeFilter : undefined);
  const friendChallenges = socialMgr.challengeService.getActiveChallenges();
  const seasonalRewards = socialMgr.getSeasonalRewards();
  const liveOps = socialMgr.liveOpsManager;
  const activeSeason = liveOps.getActiveSeason();
  const dailyChallenge = liveOps.getDailyChallenge();
  const weeklyChallenge = liveOps.getWeeklyChallenge();
  const activeEvents = liveOps.getActiveEvents();
  const announcements = liveOps.getAnnouncements();
  const seasonPassTiers = liveOps.getSeasonPassTiers();
  const [claimFeedback, setClaimFeedback] = useState<string | null>(null);

  const handleClaimChallenge = (id: string) => {
    const res = liveOps.claimChallengeReward(id, profile.id, progressionMgr);
    if (res.success) {
      setClaimFeedback(`Claimed +${res.xpAwarded} XP & +${res.shardsAwarded} Shards!`);
      setTimeout(() => setClaimFeedback(null), 3000);
    } else {
      setClaimFeedback(res.error || 'Failed to claim');
      setTimeout(() => setClaimFeedback(null), 3000);
    }
  };

  const handleClaimTier = (tierNumber: number) => {
    const res = liveOps.claimSeasonPassTier(tierNumber, profile.id, progressionMgr);
    if (res.success) {
      setClaimFeedback(`Tier ${tierNumber} reward claimed!`);
      setTimeout(() => setClaimFeedback(null), 3000);
    } else {
      setClaimFeedback(res.error || 'Failed to claim tier');
      setTimeout(() => setClaimFeedback(null), 3000);
    }
  };

  const handleDismissAnnouncement = (id: string) => {
    liveOps.dismissAnnouncement(id);
    setClaimFeedback('Announcement dismissed');
    setTimeout(() => setClaimFeedback(null), 1000);
  };

  const handleUpdateName = (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameInput.trim()) return;
    const res = socialMgr.profileService.updateUsername(renameInput.trim());
    if (res.success) {
      setRenameMessage({ text: 'Username updated successfully!' });
      setRenameInput('');
    } else {
      setRenameMessage({ text: res.error || 'Failed to update username', error: true });
    }
  };

  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const handleToggleLeaderboardPrivacy = () => {
    socialMgr.profileService.updatePrivacy({
      showOnLeaderboards: !profile.privacy.showOnLeaderboards,
    });
  };

  const handleDeleteAccount = () => {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      return;
    }
    const res = socialMgr.deleteAccount();
    if (res.success) {
      setRenameMessage({ text: 'Account and personal data erased.' });
      setDeleteConfirm(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl animate-fade-in font-mono select-none">
      <div className="relative w-full max-w-3xl bg-black/95 border-2 border-cyan-500/50 rounded-2xl shadow-[0_0_50px_rgba(0,240,255,0.25)] flex flex-col max-h-[90vh] overflow-hidden">
        {/* Neon Glow Accents */}
        <div className="absolute -top-24 -right-24 w-48 h-48 rounded-full bg-cyan-500/15 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 rounded-full bg-pink-500/15 blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-cyan-950/60 border border-cyan-500/40 text-cyan-300">
              <Trophy className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-pink-400 to-amber-300 uppercase tracking-tight">
                COMPETITIVE REPLAY & SOCIAL
              </h2>
              <p className="text-[11px] text-white/50">
                GLOBAL RANKINGS // ASYNCHRONOUS TRIALS // {CURRENT_SEASON_NAME}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-all cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="grid grid-cols-4 border-b border-white/10 bg-slate-950/80 text-xs font-bold">
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`py-3 text-center border-b-2 transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
              activeTab === 'leaderboard'
                ? 'border-cyan-400 text-cyan-300 bg-cyan-950/30 font-black'
                : 'border-transparent text-white/60 hover:text-white'
            }`}
          >
            <Globe className="w-4 h-4" />
            <span className="hidden sm:inline">LEADERBOARDS</span>
            <span className="sm:hidden">RANKS</span>
          </button>
          <button
            onClick={() => setActiveTab('challenges')}
            className={`py-3 text-center border-b-2 transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
              activeTab === 'challenges'
                ? 'border-pink-400 text-pink-300 bg-pink-950/30 font-black'
                : 'border-transparent text-white/60 hover:text-white'
            }`}
          >
            <Swords className="w-4 h-4" />
            <span className="hidden sm:inline">FRIEND TRIALS</span>
            <span className="sm:hidden">TRIALS</span>
          </button>
          <button
            onClick={() => setActiveTab('season')}
            className={`py-3 text-center border-b-2 transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
              activeTab === 'season'
                ? 'border-amber-400 text-amber-300 bg-amber-950/30 font-black'
                : 'border-transparent text-white/60 hover:text-white'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span className="hidden sm:inline">LIVE OPS & SEASON</span>
            <span className="sm:hidden">LIVE</span>
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={`py-3 text-center border-b-2 transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
              activeTab === 'profile'
                ? 'border-emerald-400 text-emerald-300 bg-emerald-950/30 font-black'
                : 'border-transparent text-white/60 hover:text-white'
            }`}
          >
            <User className="w-4 h-4" />
            <span className="hidden sm:inline">PILOT PROFILE</span>
            <span className="sm:hidden">PROFILE</span>
          </button>
        </div>

        {/* Tab 1: Leaderboards */}
        {activeTab === 'leaderboard' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-left">
            {/* Filters Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-950/90 border border-white/10 text-xs">
              {/* Category selector */}
              <div className="flex items-center space-x-1">
                {(['score', 'distance'] as LeaderboardCategory[]).map(cat => (
                  <button
                    key={cat}
                    onClick={() => setCategory(cat)}
                    className={`px-2.5 py-1 rounded font-bold uppercase transition-all cursor-pointer ${
                      category === cat
                        ? 'bg-cyan-500 text-black font-black'
                        : 'text-white/60 hover:text-white bg-white/5'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Time window selector */}
              <div className="flex items-center space-x-1">
                {(['seasonal', 'all-time'] as LeaderboardTimeWindow[]).map(win => (
                  <button
                    key={win}
                    onClick={() => setTimeWindow(win)}
                    className={`px-2.5 py-1 rounded font-bold uppercase transition-all cursor-pointer ${
                      timeWindow === win
                        ? 'bg-amber-400 text-black font-black'
                        : 'text-white/60 hover:text-white bg-white/5'
                    }`}
                  >
                    {win.replace('-', ' ')}
                  </button>
                ))}
              </div>

              {/* Mode filter */}
              <select
                value={modeFilter}
                onChange={e => setModeFilter(e.target.value)}
                className="bg-black border border-white/20 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-400 cursor-pointer"
              >
                <option value="all">ALL MODES</option>
                <option value="score-attack">SCORE ATTACK</option>
                <option value="standard-run">STANDARD RUN</option>
                <option value="survival">SURVIVAL</option>
              </select>
            </div>

            {/* Player's Current Standing Banner */}
            <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-400/40 flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2">
                <span className="text-xl">{profile.avatarIcon}</span>
                <div>
                  <div className="font-bold text-white flex items-center space-x-1.5">
                    <span>{profile.username} (YOU)</span>
                    <span className="text-[10px] text-cyan-400 font-normal">LVL {profile.level}</span>
                  </div>
                  <div className="text-[10px] text-white/50">{profile.title}</div>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[9px] text-white/50 uppercase">YOUR STANDING</span>
                <div className="text-sm font-black text-amber-300 font-mono">
                  {playerRank.rank > 0 ? `#${playerRank.rank} / ${playerRank.totalParticipants}` : 'UNRANKED'}
                </div>
              </div>
            </div>

            {/* Leaderboard Entries List */}
            <div className="space-y-1.5">
              {leaderboards.map((entry) => {
                const isMe = entry.playerId === profile.id;
                return (
                  <div
                    key={entry.playerId}
                    className={`p-2.5 sm:p-3 rounded-xl border flex items-center justify-between transition-all ${
                      isMe
                        ? 'bg-cyan-950/60 border-cyan-400 shadow-md shadow-cyan-950/40'
                        : entry.rank === 1
                        ? 'bg-amber-950/30 border-amber-400/40'
                        : 'bg-slate-950/80 border-white/10'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      {/* Rank number badge */}
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs font-mono shrink-0 ${
                          entry.rank === 1
                            ? 'bg-amber-400 text-black shadow-md shadow-amber-400/40'
                            : entry.rank === 2
                            ? 'bg-slate-300 text-black'
                            : entry.rank === 3
                            ? 'bg-amber-700 text-white'
                            : 'bg-white/10 text-white/70'
                        }`}
                      >
                        {entry.rank}
                      </div>

                      {/* Pilot info */}
                      <div>
                        <div className="font-bold text-xs sm:text-sm text-white flex items-center space-x-1.5">
                          <span>{entry.username}</span>
                          {entry.title && (
                            <span className="text-[10px] text-cyan-400 font-normal hidden sm:inline">
                              // {entry.title}
                            </span>
                          )}
                          {isMe && (
                            <span className="text-[9px] px-1 py-0.2 rounded bg-cyan-400 text-black font-black">
                              YOU
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-white/50 flex items-center space-x-2">
                          <span>{entry.modeId.toUpperCase()}</span>
                          <span>•</span>
                          <span>{entry.worldReached}</span>
                          <span>•</span>
                          <span>{entry.durationFormatted}</span>
                        </div>
                      </div>
                    </div>

                    {/* Score / Distance Metric */}
                    <div className="text-right shrink-0">
                      <div className="text-base sm:text-lg font-black text-amber-300 font-mono tracking-tight">
                        {category === 'distance' ? `${entry.distance.toLocaleString()}m` : entry.score.toLocaleString()}
                      </div>
                      <div className="text-[9px] text-white/40">
                        {category === 'distance' ? `${entry.score.toLocaleString()} pts` : `${entry.distance.toLocaleString()}m`}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 2: Friend Challenges */}
        {activeTab === 'challenges' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-left">
            <div className="p-3.5 rounded-xl bg-pink-950/30 border border-pink-500/30 flex items-center justify-between">
              <div>
                <h3 className="font-black text-sm text-white uppercase">ASYNCHRONOUS PILOT TRIALS</h3>
                <p className="text-xs text-white/60">
                  Accept challenges posted by peer runners. Beat their target scores to earn +300 XP.
                </p>
              </div>
              <Swords className="w-6 h-6 text-pink-400 shrink-0" />
            </div>

            <div className="space-y-2.5">
              {friendChallenges.map((chal) => (
                <div
                  key={chal.id}
                  className="p-3.5 rounded-xl bg-slate-950/80 border border-white/10 hover:border-pink-500/40 transition-all flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="font-bold text-sm text-white">{chal.challengerName}'s Challenge</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-white/10 text-pink-300 font-bold uppercase">
                        {chal.modeId}
                      </span>
                    </div>
                    <div className="text-xs font-mono text-amber-300 font-bold">
                      TARGET TO BEAT: {chal.targetScore.toLocaleString()} PTS
                    </div>
                    <div className="text-[10px] text-white/50 mt-1">
                      Reached: {chal.worldReached} ({chal.targetDistance}m) • Reward: +{chal.rewardXp} XP
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      onLaunchFriendChallenge?.(chal.id);
                      onClose();
                    }}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-pink-500 to-purple-500 hover:brightness-110 text-white font-black text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer shrink-0"
                  >
                    ACCEPT TRIAL
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 3: Season & Live Operations Hub */}
        {activeTab === 'season' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-left">
            {/* Feedback Alert Toast */}
            {claimFeedback && (
              <div className="p-2.5 rounded-lg bg-cyan-500/20 border border-cyan-400 text-cyan-300 text-xs font-bold flex items-center space-x-2 animate-fade-in">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-cyan-400" />
                <span>{claimFeedback}</span>
              </div>
            )}

            {/* Active Season Banner */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-purple-950/80 via-indigo-950/70 to-cyan-950/80 border border-purple-500/50 shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2 text-[10px] text-purple-300 font-bold uppercase">
                  <Calendar className="w-3.5 h-3.5 text-purple-400" />
                  <span>{activeSeason.name}</span>
                </div>
                <div className="flex items-center space-x-1.5 px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold uppercase">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  <span>{activeSeason.status}</span>
                </div>
              </div>

              <div className="flex items-center space-x-3 mb-2">
                <span className="text-3xl">{activeSeason.theme.icon}</span>
                <div>
                  <h3 className="text-xl font-black text-white uppercase tracking-tight">
                    {activeSeason.name}
                  </h3>
                  <p className="text-xs text-white/70">
                    {activeSeason.theme.tagline}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3 text-[11px] text-cyan-300 font-mono pt-1 border-t border-white/10">
                <span className="flex items-center space-x-1">
                  <Clock className="w-3 h-3 text-cyan-400" />
                  <span>Focus: {activeSeason.theme.focusWorld.replace('-', ' ').toUpperCase()}</span>
                </span>
                <span className="text-white/30">•</span>
                <span>Authoritative Server Sync: {liveOps.isOnline() ? 'ONLINE' : 'OFFLINE (CACHED)'}</span>
              </div>
            </div>

            {/* Live Announcements / Broadcasts */}
            {announcements.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center space-x-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                  <Bell className="w-3.5 h-3.5 text-amber-400" />
                  <span>LIVE OPERATIONS BROADCAST:</span>
                </div>
                {announcements.map(ann => (
                  <div
                    key={ann.id}
                    className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/40 flex items-start justify-between space-x-2"
                  >
                    <div className="flex items-start space-x-2.5">
                      <span className="text-xl shrink-0 mt-0.5">{ann.icon || '📢'}</span>
                      <div>
                        <div className="font-bold text-xs text-amber-200 flex items-center space-x-2">
                          <span>{ann.title}</span>
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase">
                            {ann.priority}
                          </span>
                        </div>
                        <p className="text-[11px] text-white/70 mt-0.5">{ann.body}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDismissAnnouncement(ann.id)}
                      className="p-1 rounded bg-white/5 hover:bg-white/10 text-white/50 hover:text-white text-xs cursor-pointer"
                      title="Dismiss"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Active Live Events & Modifiers */}
            {activeEvents.length > 0 && (
              <div className="space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-white/50 block">
                  LIMITED-TIME ACTIVE EVENTS:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {activeEvents.map(evt => (
                    <div
                      key={evt.id}
                      className="p-3 rounded-xl bg-slate-950/80 border border-cyan-500/30 flex items-start space-x-2.5"
                    >
                      <span className="text-2xl shrink-0">{evt.icon}</span>
                      <div className="flex-1">
                        <div className="font-bold text-xs text-cyan-300">{evt.name}</div>
                        <div className="text-[10px] text-white/60 mb-1.5">{evt.tagline}</div>
                        {evt.modifiers.map((m, mIdx) => (
                          <span
                            key={mIdx}
                            className="inline-flex items-center space-x-1 text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-200 border border-cyan-500/40 font-mono font-bold"
                          >
                            <Zap className="w-2.5 h-2.5 text-cyan-300" />
                            <span>{m.description}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Deterministic Rotating Challenges */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/50 block">
                ROTATING CHALLENGES:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Daily Challenge Card */}
                <div className="p-3.5 rounded-xl bg-slate-950/80 border border-white/10 flex flex-col justify-between space-y-2">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-xl">{dailyChallenge.icon}</span>
                        <div>
                          <div className="font-bold text-xs text-white">{dailyChallenge.title}</div>
                          <span className="text-[9px] text-cyan-400 uppercase font-mono">DAILY CHALLENGE</span>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-amber-300">
                        +{dailyChallenge.rewardXp} XP • +{dailyChallenge.rewardShards} 💎
                      </span>
                    </div>
                    <p className="text-[11px] text-white/60 mb-2">{dailyChallenge.description}</p>

                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] font-mono text-white/50">
                        <span>Progress</span>
                        <span>{dailyChallenge.currentValue} / {dailyChallenge.targetValue}</span>
                      </div>
                      <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-cyan-400 transition-all duration-300"
                          style={{
                            width: `${Math.min(100, (dailyChallenge.currentValue / dailyChallenge.targetValue) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleClaimChallenge(dailyChallenge.id)}
                    disabled={!dailyChallenge.completed || dailyChallenge.claimed}
                    className={`w-full py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                      dailyChallenge.claimed
                        ? 'bg-white/5 text-white/30 border border-white/10 cursor-not-allowed'
                        : dailyChallenge.completed
                        ? 'bg-gradient-to-r from-cyan-400 to-emerald-400 text-black shadow-lg animate-pulse'
                        : 'bg-white/5 text-white/40 border border-white/10 cursor-not-allowed'
                    }`}
                  >
                    {dailyChallenge.claimed ? 'CLAIMED' : dailyChallenge.completed ? 'CLAIM REWARD' : 'INCOMPLETE'}
                  </button>
                </div>

                {/* Weekly Challenge Card */}
                <div className="p-3.5 rounded-xl bg-slate-950/80 border border-white/10 flex flex-col justify-between space-y-2">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-xl">{weeklyChallenge.icon}</span>
                        <div>
                          <div className="font-bold text-xs text-white">{weeklyChallenge.title}</div>
                          <span className="text-[9px] text-pink-400 uppercase font-mono">WEEKLY CHALLENGE</span>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-amber-300">
                        +{weeklyChallenge.rewardXp} XP • +{weeklyChallenge.rewardShards} 💎
                      </span>
                    </div>
                    <p className="text-[11px] text-white/60 mb-2">{weeklyChallenge.description}</p>

                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] font-mono text-white/50">
                        <span>Progress</span>
                        <span>{weeklyChallenge.currentValue} / {weeklyChallenge.targetValue}</span>
                      </div>
                      <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-pink-400 transition-all duration-300"
                          style={{
                            width: `${Math.min(100, (weeklyChallenge.currentValue / weeklyChallenge.targetValue) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleClaimChallenge(weeklyChallenge.id)}
                    disabled={!weeklyChallenge.completed || weeklyChallenge.claimed}
                    className={`w-full py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                      weeklyChallenge.claimed
                        ? 'bg-white/5 text-white/30 border border-white/10 cursor-not-allowed'
                        : weeklyChallenge.completed
                        ? 'bg-gradient-to-r from-pink-400 to-purple-400 text-white shadow-lg animate-pulse'
                        : 'bg-white/5 text-white/40 border border-white/10 cursor-not-allowed'
                    }`}
                  >
                    {weeklyChallenge.claimed ? 'CLAIMED' : weeklyChallenge.completed ? 'CLAIM REWARD' : 'INCOMPLETE'}
                  </button>
                </div>
              </div>
            </div>

            {/* Mini Season Pass Track (Tiers 1-5) */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/50 block">
                SEASON PASS MILESTONES (TIERS 1–5):
              </span>
              <div className="space-y-1.5">
                {seasonPassTiers.map(tier => (
                  <div
                    key={tier.tier}
                    className="p-3 rounded-xl bg-slate-950/80 border border-white/10 flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-lg">
                        {tier.rewardIcon}
                      </div>
                      <div>
                        <div className="font-bold text-xs text-white flex items-center space-x-2">
                          <span>TIER {tier.tier}</span>
                          <span className="text-[10px] text-white/40 font-mono">({tier.requiredXp.toLocaleString()} Season XP)</span>
                        </div>
                        <div className="text-[11px] text-cyan-300 font-mono">{tier.rewardLabel}</div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleClaimTier(tier.tier)}
                      disabled={!tier.isUnlocked || tier.isClaimed}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                        tier.isClaimed
                          ? 'bg-white/5 text-white/30 border border-white/10 cursor-not-allowed'
                          : tier.isUnlocked
                          ? 'bg-gradient-to-r from-amber-400 to-yellow-300 text-black shadow-md'
                          : 'bg-white/5 text-white/40 border border-white/10 cursor-not-allowed'
                      }`}
                    >
                      {tier.isClaimed ? 'CLAIMED' : tier.isUnlocked ? 'CLAIM' : 'LOCKED'}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Seasonal Placement Rewards */}
            <div className="space-y-2 pt-2 border-t border-white/10">
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/50 block">
                SEASONAL LEADERBOARD PLACEMENT TIERS:
              </span>
              <div className="grid grid-cols-1 gap-2">
                {seasonalRewards.map((rew, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-slate-950/80 border border-white/10 flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-3">
                      <Award className="w-5 h-5 text-amber-400 shrink-0" />
                      <div>
                        <div className="font-bold text-sm text-white">{rew.tierName}</div>
                        <div className="text-[11px] text-cyan-300 font-mono">
                          Cosmetic ID: {rew.rewardCosmeticId}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-black text-amber-300">+{rew.rewardXp} XP</span>
                      <div className="text-[10px] text-white/40">Guaranteed Tier Reward</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Pilot Profile */}
        {activeTab === 'profile' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-left">
            {/* Identity Card */}
            <div className="p-4 rounded-xl bg-slate-950/90 border border-cyan-500/30 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-xl bg-cyan-950/80 border border-cyan-400/50 flex items-center justify-center text-2xl shadow-inner">
                  {profile.avatarIcon}
                </div>
                <div>
                  <div className="text-base font-black text-white flex items-center space-x-2">
                    <span>{profile.username}</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-mono border border-cyan-500/40 uppercase">
                      {profile.accountType}
                    </span>
                  </div>
                  <div className="text-xs text-white/50">{profile.title} • LVL {profile.level}</div>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[9px] text-white/50 uppercase">PILOT ID</span>
                <div className="text-xs font-mono text-cyan-400 font-bold">{profile.id.substring(0, 10)}...</div>
              </div>
            </div>

            {/* Rename Form */}
            <form onSubmit={handleUpdateName} className="p-3.5 rounded-xl bg-slate-950/80 border border-white/10 space-y-2">
              <label className="text-[10px] font-bold text-white/60 uppercase block">
                CHANGE DISPLAY NAME (3-16 ALPHANUMERIC CHARS):
              </label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={renameInput}
                  onChange={e => setRenameInput(e.target.value)}
                  placeholder="Enter new callsign..."
                  className="flex-1 bg-black/60 border border-white/20 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400 font-mono"
                  maxLength={16}
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-black text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
                >
                  SAVE
                </button>
              </div>
              {renameMessage && (
                <div className={`text-[10px] font-bold ${renameMessage.error ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {renameMessage.text}
                </div>
              )}
            </form>

            {/* Privacy Controls (Phase 16 Section 22) */}
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-white/10 space-y-2.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/50 block">
                PRIVACY & COMPETITIVE CONTROLS:
              </span>
              <div className="flex items-center justify-between p-2 rounded-lg bg-white/5">
                <div>
                  <div className="text-xs font-bold text-white">Public Leaderboard Visibility</div>
                  <div className="text-[10px] text-white/50">Allow your best scores to be ranked on community boards</div>
                </div>
                <button
                  onClick={handleToggleLeaderboardPrivacy}
                  className={`p-2 rounded-lg border transition-all cursor-pointer ${
                    profile.privacy.showOnLeaderboards
                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                      : 'bg-white/5 border-white/20 text-white/40'
                  }`}
                >
                  {profile.privacy.showOnLeaderboards ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-rose-950/20 border border-rose-500/20">
                <div>
                  <div className="text-xs font-bold text-rose-300">Erase Account & Personal Data</div>
                  <div className="text-[10px] text-white/50">Purge profile, cancel challenges & remove rankings</div>
                </div>
                <button
                  onClick={handleDeleteAccount}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                    deleteConfirm
                      ? 'bg-rose-600 border-rose-500 text-white animate-pulse'
                      : 'bg-rose-500/10 border-rose-500/40 text-rose-300 hover:bg-rose-500/20'
                  }`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{deleteConfirm ? 'CONFIRM PURGE' : 'ERASE'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
