/**
 * GoWithFlow — Game Mode Selection & Rules Modal
 * Phase 15 Section 10-13: Mode selection, rules preview, modifier breakdown,
 * personal records, and curated challenge launches.
 */

import React, { useState } from 'react';
import {
  X,
  Trophy,
  Clock,
  Flame,
  Target,
  Compass,
  CheckCircle2,
  XCircle,
  Play,
  Award,
  Zap,
  Calendar,
  Sparkles,
  BarChart3,
  ShieldAlert,
} from 'lucide-react';
import { GameModeManager } from '../game/modes/GameModeManager';
import {
  GameModeId,
  ChallengeDefinition,
} from '../game/modes/gameModeTypes';
import {
  GAME_MODE_DEFINITIONS,
  CURATED_CHALLENGES,
  getDailyChallenge,
  getWeeklyChallenge,
} from '../game/modes/gameModeConfig';

interface GameModesModalProps {
  gameModeMgr: GameModeManager;
  onClose: () => void;
  onSelectAndPlay: (modeId: GameModeId, challengeId?: string) => void;
}

export const GameModesModal: React.FC<GameModesModalProps> = ({
  gameModeMgr,
  onClose,
  onSelectAndPlay,
}) => {
  const [activeTab, setActiveTab] = useState<'modes' | 'challenges' | 'records'>('modes');
  const [selectedModeId, setSelectedModeId] = useState<GameModeId>(gameModeMgr.activeModeId);
  const [selectedChallengeId, setSelectedChallengeId] = useState<string | undefined>(
    gameModeMgr.getSelectedChallengeId() || CURATED_CHALLENGES[0].id
  );

  const selectedDef = GAME_MODE_DEFINITIONS[selectedModeId];
  const dailyChallenge = getDailyChallenge();
  const weeklyChallenge = getWeeklyChallenge();
  const isDailyDone = gameModeMgr.isDailyClaimed();
  const isWeeklyDone = gameModeMgr.isWeeklyClaimed();
  const records = gameModeMgr.getAllRecords();

  const handleStartMode = () => {
    if (selectedModeId === 'challenge-run') {
      onSelectAndPlay('challenge-run', selectedChallengeId);
    } else {
      onSelectAndPlay(selectedModeId);
    }
    onClose();
  };

  const handleStartChallenge = (def: ChallengeDefinition) => {
    onSelectAndPlay('challenge-run', def.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl animate-fade-in font-mono select-none">
      <div className="relative w-full max-w-2xl bg-black/95 border-2 border-cyan-500/50 rounded-2xl shadow-[0_0_50px_rgba(0,240,255,0.25)] flex flex-col max-h-[90vh] overflow-hidden">
        {/* Glow Accents */}
        <div className="absolute -top-24 -right-24 w-48 h-48 rounded-full bg-cyan-500/15 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 rounded-full bg-amber-500/15 blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-cyan-950/60 border border-cyan-500/40 text-cyan-300">
              <Compass className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-white to-amber-300 uppercase tracking-tight">
                FLIGHT OPERATIONS & MODES
              </h2>
              <p className="text-[11px] text-white/50">
                CHOOSE YOUR OPERATIONAL DIRECTIVE // FIVE-WORLD TELEMETRY
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-all"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="grid grid-cols-3 border-b border-white/10 bg-slate-950/80 text-xs font-bold">
          <button
            onClick={() => setActiveTab('modes')}
            className={`py-3 text-center border-b-2 transition-all flex items-center justify-center space-x-2 ${
              activeTab === 'modes'
                ? 'border-cyan-400 text-cyan-300 bg-cyan-950/30 font-black'
                : 'border-transparent text-white/60 hover:text-white'
            }`}
          >
            <Compass className="w-4 h-4" />
            <span>GAME MODES</span>
          </button>
          <button
            onClick={() => setActiveTab('challenges')}
            className={`py-3 text-center border-b-2 transition-all flex items-center justify-center space-x-2 ${
              activeTab === 'challenges'
                ? 'border-amber-400 text-amber-300 bg-amber-950/30 font-black'
                : 'border-transparent text-white/60 hover:text-white'
            }`}
          >
            <Target className="w-4 h-4" />
            <span>TRIALS & ROTATIONS</span>
          </button>
          <button
            onClick={() => setActiveTab('records')}
            className={`py-3 text-center border-b-2 transition-all flex items-center justify-center space-x-2 ${
              activeTab === 'records'
                ? 'border-emerald-400 text-emerald-300 bg-emerald-950/30 font-black'
                : 'border-transparent text-white/60 hover:text-white'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>PERSONAL BESTS</span>
          </button>
        </div>

        {/* Tab 1: Game Modes & Rules */}
        {activeTab === 'modes' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            {/* Mode Selection Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(Object.values(GAME_MODE_DEFINITIONS) as typeof selectedDef[]).map((def) => {
                const isSelected = selectedModeId === def.id;
                return (
                  <button
                    key={def.id}
                    onClick={() => setSelectedModeId(def.id)}
                    className={`p-3.5 rounded-xl border text-left transition-all relative overflow-hidden flex flex-col justify-between ${
                      isSelected
                        ? 'border-cyan-400 bg-cyan-950/40 shadow-lg shadow-cyan-950/50'
                        : 'border-white/10 bg-white/5 hover:border-white/30 hover:bg-white/[0.08]'
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute top-2 right-2 flex items-center space-x-1 text-[10px] font-black text-cyan-300 uppercase px-2 py-0.5 rounded bg-cyan-500/20 border border-cyan-400/50">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>SELECTED</span>
                      </div>
                    )}
                    <div>
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="text-xl">{def.icon}</span>
                        <span className="font-black text-white text-sm uppercase">{def.name}</span>
                      </div>
                      <div className="text-[11px] text-cyan-300 font-semibold mb-1.5">{def.tagline}</div>
                      <p className="text-[11px] text-white/60 line-clamp-2">{def.description}</p>
                    </div>
                    <div className="mt-3 pt-2 border-t border-white/10 flex items-center justify-between text-[10px] text-white/50">
                      <span>{def.allowsRevive ? '✓ Revives OK' : '✕ No Revive'}</span>
                      <span className="font-bold text-cyan-400">{def.targetLabel}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Mode Rules Preview Panel (Phase 15 Section 11) */}
            <div className="p-4 rounded-xl bg-slate-950/90 border border-cyan-500/30 text-left space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-2xl">{selectedDef.icon}</span>
                  <div>
                    <h3 className="font-black text-base text-white uppercase">{selectedDef.name}</h3>
                    <p className="text-xs text-cyan-300">{selectedDef.tagline}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-white/50 uppercase">OBJECTIVE</span>
                  <div className="text-xs font-bold text-amber-300">{selectedDef.targetLabel}</div>
                </div>
              </div>

              <div className="border-t border-white/10 pt-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-white/50 mb-2 block">
                  FLIGHT PROTOCOL RULES & CONDITIONS:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {selectedDef.rules.map((rule, idx) => (
                    <div key={idx} className="flex items-start space-x-2 p-2 rounded-lg bg-white/5 border border-white/5">
                      {rule.allowed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <div className="font-bold text-white text-[11px]">{rule.label}</div>
                        <div className="text-[10px] text-white/50">{rule.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Start Flight Button */}
            <button
              onClick={handleStartMode}
              className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-black font-black text-sm uppercase tracking-widest shadow-[0_0_30px_rgba(0,240,255,0.4)] active:scale-[0.98] transition-all flex items-center justify-center space-x-2"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>ENGAGE {selectedDef.name.toUpperCase()}</span>
            </button>
          </div>
        )}

        {/* Tab 2: Curated & Rotating Challenges */}
        {activeTab === 'challenges' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-left">
            {/* Daily Challenge Hero Banner (Phase 15 Section 7) */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-amber-950/60 to-purple-950/60 border border-amber-500/40 relative overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <Calendar className="w-4 h-4 text-amber-400" />
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-300">
                    TODAY'S SPECIAL ROTATION // {dailyChallenge.dateKey}
                  </span>
                </div>
                {isDailyDone ? (
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/40 px-2 py-0.5 rounded">
                    COMPLETED & CLAIMED
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-amber-300 bg-amber-950/60 border border-amber-500/40 px-2 py-0.5 rounded">
                    AVAILABLE
                  </span>
                )}
              </div>
              <div className="text-base font-black text-white mb-1">{dailyChallenge.title}</div>
              <p className="text-xs text-white/70 mb-3">{dailyChallenge.description}</p>
              <div className="flex items-center justify-between pt-2 border-t border-white/10">
                <div className="flex items-center space-x-1.5 text-xs text-amber-300 font-bold">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>+{dailyChallenge.rewardXp} PILOT XP</span>
                </div>
                <button
                  onClick={() => handleStartChallenge(dailyChallenge)}
                  className="px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-black text-xs font-black uppercase tracking-wider transition-all shadow-md active:scale-95"
                >
                  START DAILY TRIAL
                </button>
              </div>
            </div>

            {/* Weekly Challenge Banner (Phase 15 Section 8) */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-rose-950/60 to-red-950/60 border border-rose-500/40 relative overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <Trophy className="w-4 h-4 text-rose-400" />
                  <span className="text-[10px] font-black uppercase tracking-wider text-rose-300">
                    WEEKLY MASTER OPERATION // {weeklyChallenge.dateKey}
                  </span>
                </div>
                {isWeeklyDone ? (
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/40 px-2 py-0.5 rounded">
                    COMPLETED & CLAIMED
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-rose-300 bg-rose-950/60 border border-rose-500/40 px-2 py-0.5 rounded">
                    HIGH STAKES
                  </span>
                )}
              </div>
              <div className="text-base font-black text-white mb-1">{weeklyChallenge.title}</div>
              <p className="text-xs text-white/70 mb-3">{weeklyChallenge.description}</p>
              <div className="flex items-center justify-between pt-2 border-t border-white/10">
                <div className="flex items-center space-x-3 text-xs font-bold">
                  <span className="text-rose-300">+{weeklyChallenge.rewardXp} XP</span>
                  <span className="text-amber-300">🌋 EXCLUSIVE COSMETIC</span>
                </div>
                <button
                  onClick={() => handleStartChallenge(weeklyChallenge)}
                  className="px-4 py-2 rounded-lg bg-rose-500 hover:bg-rose-400 text-white text-xs font-black uppercase tracking-wider transition-all shadow-md active:scale-95"
                >
                  START MASTER TRIAL
                </button>
              </div>
            </div>

            {/* Curated Challenges Catalogue */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/50 block">
                PERMANENT CHALLENGE OPERATIONS:
              </span>
              <div className="grid grid-cols-1 gap-2.5">
                {CURATED_CHALLENGES.map((def) => {
                  const isDone = gameModeMgr.isChallengeCompleted(def.id);
                  return (
                    <div
                      key={def.id}
                      className="p-3 rounded-xl bg-slate-950/80 border border-white/10 hover:border-white/20 transition-all flex items-center justify-between"
                    >
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">{def.icon}</span>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-sm text-white">{def.title}</span>
                            {isDone && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/40">
                                CLEARED
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-white/60">{def.description}</p>
                          <div className="flex items-center space-x-2 mt-1 text-[10px] text-amber-300 font-bold">
                            <span>+{def.rewardXp} XP</span>
                            {def.rewardCosmeticId && <span>• 💎 Cosmetic Reward</span>}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleStartChallenge(def)}
                        className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-black uppercase transition-all shrink-0 active:scale-95"
                      >
                        LAUNCH
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Personal Records & Leaderboard (Phase 15 Section 12-13) */}
        {activeTab === 'records' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-left">
            <div className="p-3.5 rounded-xl bg-slate-950/90 border border-cyan-500/30">
              <div className="flex items-center space-x-2 text-xs font-bold text-cyan-300 uppercase mb-3">
                <Trophy className="w-4 h-4 text-amber-400" />
                <span>FLIGHT TELEMETRY ARCHIVE // LOCAL RECORDS</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 rounded-lg bg-white/5 border border-white/5">
                  <div className="text-[9px] text-white/50 uppercase">HIGHEST SCORE</div>
                  <div className="text-lg font-black text-amber-300 font-mono mt-0.5">
                    {Math.max(
                      records['standard-run']?.highestScore || 0,
                      records['score-attack']?.highestScore || 0
                    ).toLocaleString()}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-white/5 border border-white/5">
                  <div className="text-[9px] text-white/50 uppercase">LONGEST RUN</div>
                  <div className="text-lg font-black text-cyan-300 font-mono mt-0.5">
                    {Math.max(
                      records['standard-run']?.longestDistance || 0,
                      records['survival']?.longestDistance || 0
                    ).toLocaleString()}m
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-white/5 border border-white/5">
                  <div className="text-[9px] text-white/50 uppercase">TIME TRIAL BEST</div>
                  <div className="text-lg font-black text-emerald-300 font-mono mt-0.5">
                    {records['time-trial']?.bestTimeSeconds
                      ? `${records['time-trial'].bestTimeSeconds.toFixed(1)}s`
                      : 'NO RECORD'}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-white/5 border border-white/5">
                  <div className="text-[9px] text-white/50 uppercase">MAX SURVIVAL</div>
                  <div className="text-lg font-black text-rose-300 font-mono mt-0.5">
                    {records['survival']?.longestSurvivalTime
                      ? `${Math.floor(records['survival'].longestSurvivalTime)}s`
                      : 'NO RECORD'}
                  </div>
                </div>
              </div>
            </div>

            {/* Breakdown per mode */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/50 block">
                MODE SUMMARY STATS:
              </span>
              <div className="space-y-2">
                {(['standard-run', 'score-attack', 'time-trial', 'survival'] as GameModeId[]).map((mId) => {
                  const mDef = GAME_MODE_DEFINITIONS[mId];
                  const rec = records[mId] || { highestScore: 0, longestDistance: 0, bestTimeSeconds: 0, longestSurvivalTime: 0, completedCount: 0 };
                  return (
                    <div
                      key={mId}
                      className="p-3 rounded-xl bg-slate-950/80 border border-white/10 flex items-center justify-between"
                    >
                      <div className="flex items-center space-x-2.5">
                        <span className="text-xl">{mDef.icon}</span>
                        <div>
                          <div className="font-bold text-white text-xs">{mDef.name}</div>
                          <div className="text-[10px] text-white/50">{mDef.tagline}</div>
                        </div>
                      </div>
                      <div className="text-right text-xs font-mono">
                        {mId === 'time-trial' ? (
                          <div className="text-emerald-400 font-bold">
                            {rec.bestTimeSeconds ? `${rec.bestTimeSeconds.toFixed(1)}s` : '—'}
                          </div>
                        ) : mId === 'survival' ? (
                          <div className="text-rose-400 font-bold">
                            {rec.longestSurvivalTime ? `${Math.floor(rec.longestSurvivalTime)}s` : '—'}
                          </div>
                        ) : (
                          <div className="text-amber-300 font-bold">
                            {rec.highestScore.toLocaleString()} PTS
                          </div>
                        )}
                        <div className="text-[10px] text-white/40">{rec.longestDistance}m Max</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
