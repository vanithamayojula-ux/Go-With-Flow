import React, { useState } from 'react';
import {
  Trophy,
  Award,
  Zap,
  Target,
  Gift,
  CheckCircle2,
  Lock,
  ChevronRight,
  Sparkles,
  Flame,
  X,
  Compass,
  Star,
} from 'lucide-react';
import { ProgressionManager, ProgressionSaveData } from '../game/progression';
import { getXPProgress } from '../game/progression/progressionConfig';

interface ProgressionModalProps {
  progressionMgr: ProgressionManager;
  onClose: () => void;
  onClaimChallenge?: (id: string) => void;
  onClaimAchievement?: (id: string) => void;
}

export const ProgressionModal: React.FC<ProgressionModalProps> = ({
  progressionMgr,
  onClose,
  onClaimChallenge,
  onClaimAchievement,
}) => {
  const [activeTab, setActiveTab] = useState<'challenges' | 'achievements' | 'rewards'>('challenges');
  const [data, setData] = useState<ProgressionSaveData>(() => progressionMgr.getData());

  const progress = getXPProgress(data.xp, data.level);
  const challenges = progressionMgr.getActiveChallenges();
  const achievements = progressionMgr.getAllAchievements();
  const rewards = progressionMgr.getAllRewards();

  const handleClaimChallenge = (id: string) => {
    const res = progressionMgr.claimChallengeReward(id);
    if (res.success) {
      setData(progressionMgr.getData());
      onClaimChallenge?.(id);
    }
  };

  const handleClaimAchievement = (id: string) => {
    const res = progressionMgr.claimAchievementReward(id);
    if (res.success) {
      setData(progressionMgr.getData());
      onClaimAchievement?.(id);
    }
  };

  const completedAchievementsCount = achievements.filter(a => a.unlocked).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in font-mono">
      <div className="relative w-full max-w-2xl bg-slate-950/95 border border-cyan-500/40 rounded-2xl shadow-[0_0_50px_rgba(0,240,255,0.2)] text-white overflow-hidden max-h-[90vh] flex flex-col">
        {/* Glow Effects */}
        <div className="absolute -top-24 -right-24 w-48 h-48 rounded-full bg-cyan-500/15 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 rounded-full bg-pink-500/15 blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10 bg-black/40">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center text-black font-black text-lg shadow-[0_0_15px_rgba(0,240,255,0.4)]">
              {progress.currentLevel}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-black tracking-wider text-cyan-300 uppercase">PILOT PROGRESSION</h2>
                <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-500/30 uppercase">
                  RANK {progress.currentLevel}
                </span>
              </div>
              <p className="text-xs text-white/50">Level progression, daily operations & career milestones</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* XP Level Bar Card */}
        <div className="p-5 bg-black/60 border-b border-white/5">
          <div className="flex items-center justify-between text-xs mb-1.5 font-bold">
            <span className="text-cyan-400 flex items-center space-x-1">
              <Zap className="w-3.5 h-3.5 text-cyan-400" />
              <span>LEVEL {progress.currentLevel} PROTOCOL</span>
            </span>
            <span className="text-white/70 font-mono">
              {progress.currentLevelXP.toLocaleString()} / {progress.nextLevelXPRequired.toLocaleString()} XP
              <span className="text-cyan-400 ml-1.5 font-bold">({progress.percent}%)</span>
            </span>
          </div>
          <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden border border-white/10 p-0.5">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-400 rounded-full transition-all duration-500 shadow-[0_0_12px_rgba(0,240,255,0.5)]"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
          <div className="flex justify-between items-center text-[10px] text-white/40 mt-1.5 font-mono">
            <span>TOTAL XP EARNED: {data.xp.toLocaleString()}</span>
            <span>NEXT LEVEL: {progress.xpRemaining.toLocaleString()} XP NEEDED</span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-white/10 bg-slate-900/60 px-5 pt-2">
          <button
            onClick={() => setActiveTab('challenges')}
            className={`flex items-center space-x-2 py-3 px-4 border-b-2 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === 'challenges'
                ? 'border-cyan-400 text-cyan-300 bg-cyan-950/20'
                : 'border-transparent text-white/50 hover:text-white hover:bg-white/5'
            }`}
          >
            <Target className="w-4 h-4" />
            <span>DAILY OPERATIONS ({challenges.filter(c => c.completed && !c.claimed).length > 0 ? '!' : challenges.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('achievements')}
            className={`flex items-center space-x-2 py-3 px-4 border-b-2 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === 'achievements'
                ? 'border-amber-400 text-amber-300 bg-amber-950/20'
                : 'border-transparent text-white/50 hover:text-white hover:bg-white/5'
            }`}
          >
            <Trophy className="w-4 h-4" />
            <span>ACHIEVEMENTS ({completedAchievementsCount}/{achievements.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('rewards')}
            className={`flex items-center space-x-2 py-3 px-4 border-b-2 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === 'rewards'
                ? 'border-emerald-400 text-emerald-300 bg-emerald-950/20'
                : 'border-transparent text-white/50 hover:text-white hover:bg-white/5'
            }`}
          >
            <Gift className="w-4 h-4" />
            <span>LEVEL UNLOCKS</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="p-5 flex-1 overflow-y-auto space-y-3 max-h-[50vh]">
          {/* TAB 1: CHALLENGES */}
          {activeTab === 'challenges' && (
            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs text-white/60 mb-1">
                <span>DAILY ROTATION // RESETS 00:00 UTC</span>
                <span className="text-cyan-400 font-mono">OPERATIONAL DIRECTIVES</span>
              </div>
              {challenges.map(c => {
                const pct = Math.min(100, Math.round((c.current / c.target) * 100));
                return (
                  <div
                    key={c.id}
                    className={`p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      c.completed
                        ? 'bg-emerald-950/20 border-emerald-500/30'
                        : 'bg-black/40 border-white/10 hover:border-cyan-500/30'
                    }`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-black text-white">{c.title}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-white/60 uppercase font-mono">
                          {c.type}
                        </span>
                      </div>
                      <p className="text-xs text-white/60 mt-0.5">{c.description}</p>
                      <div className="w-full bg-slate-900 rounded-full h-2 mt-2 overflow-hidden border border-white/5">
                        <div
                          className={`h-full transition-all duration-300 ${
                            c.completed ? 'bg-emerald-400' : 'bg-cyan-400'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] font-mono text-white/40 mt-1">
                        <span>PROGRESS</span>
                        <span>
                          {c.current} / {c.target} ({pct}%)
                        </span>
                      </div>
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-2 sm:pt-0 border-white/5 min-w-[120px]">
                      <div className="text-right">
                        <div className="text-xs font-mono text-cyan-300 font-bold">+{c.xpReward} XP</div>
                        {c.shardReward > 0 && (
                          <div className="text-[11px] font-mono text-amber-300">+{c.shardReward} 💎</div>
                        )}
                      </div>
                      {c.claimed ? (
                        <span className="mt-1 text-xs text-emerald-400 font-bold flex items-center space-x-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>CLAIMED</span>
                        </span>
                      ) : c.completed ? (
                        <button
                          onClick={() => handleClaimChallenge(c.id)}
                          className="mt-1 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black tracking-wider uppercase transition-all shadow-[0_0_15px_rgba(0,255,102,0.4)] cursor-pointer"
                        >
                          CLAIM
                        </button>
                      ) : (
                        <span className="mt-1 text-[11px] text-white/40 font-mono">IN PROGRESS</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 2: ACHIEVEMENTS */}
          {activeTab === 'achievements' && (
            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs text-white/60 mb-1">
                <span>CAREER RECORD // PERMANENT MILESTONES</span>
                <span className="text-amber-400 font-mono">
                  {completedAchievementsCount}/{achievements.length} UNLOCKED
                </span>
              </div>
              {achievements.map(a => (
                <div
                  key={a.id}
                  className={`p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    a.unlocked
                      ? 'bg-amber-950/20 border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.1)]'
                      : 'bg-black/40 border-white/10 opacity-70'
                  }`}
                >
                  <div className="flex items-start space-x-3 flex-1">
                    <div className="text-2xl pt-0.5">{a.icon}</div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-black text-white">{a.title}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-white/60 uppercase font-mono">
                          {a.category}
                        </span>
                      </div>
                      <p className="text-xs text-white/60 mt-0.5">{a.description}</p>
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-2 sm:pt-0 border-white/5 min-w-[120px]">
                    <div className="text-right">
                      <div className="text-xs font-mono text-cyan-300 font-bold">+{a.xpReward} XP</div>
                      {a.shardReward > 0 && (
                        <div className="text-[11px] font-mono text-amber-300">+{a.shardReward} 💎</div>
                      )}
                    </div>
                    {a.claimed ? (
                      <span className="mt-1 text-xs text-emerald-400 font-bold flex items-center space-x-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>CLAIMED</span>
                      </span>
                    ) : a.unlocked ? (
                      <button
                        onClick={() => handleClaimAchievement(a.id)}
                        className="mt-1 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-black tracking-wider uppercase transition-all shadow-[0_0_15px_rgba(245,158,11,0.4)] cursor-pointer"
                      >
                        CLAIM
                      </button>
                    ) : (
                      <span className="mt-1 text-[11px] text-white/40 flex items-center space-x-1 font-mono">
                        <Lock className="w-3 h-3" />
                        <span>LOCKED</span>
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 3: REWARDS */}
          {activeTab === 'rewards' && (
            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs text-white/60 mb-1">
                <span>PILOT RANK REWARDS // REACH HIGHER LEVELS</span>
                <span className="text-emerald-400 font-mono">RANK ROADMAP</span>
              </div>
              {rewards.map(r => {
                const isUnlocked = progress.currentLevel >= r.level;
                return (
                  <div
                    key={r.level}
                    className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                      isUnlocked
                        ? 'bg-emerald-950/20 border-emerald-500/30'
                        : 'bg-black/30 border-white/10 opacity-60'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm ${
                          isUnlocked
                            ? 'bg-emerald-500 text-black shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                            : 'bg-white/10 text-white/40'
                        }`}
                      >
                        {r.level}
                      </div>
                      <div>
                        <div className="text-sm font-black text-white">{r.title}</div>
                        <p className="text-xs text-white/60">{r.description}</p>
                      </div>
                    </div>

                    <div className="text-right">
                      {isUnlocked ? (
                        <span className="text-xs text-emerald-400 font-bold flex items-center space-x-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>UNLOCKED</span>
                        </span>
                      ) : (
                        <span className="text-xs text-white/40 flex items-center space-x-1 font-mono">
                          <Lock className="w-3 h-3" />
                          <span>REQ LVL {r.level}</span>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-white/10 bg-black/60 flex justify-between items-center">
          <div className="text-xs text-white/50 font-mono">
            WALLET: <span className="text-white font-bold">{data.unlockedRewards.length} MILESTONES UNLOCKED</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-black text-xs uppercase tracking-wider transition-all cursor-pointer shadow-[0_0_15px_rgba(0,240,255,0.3)]"
          >
            DISMISS
          </button>
        </div>
      </div>
    </div>
  );
};
