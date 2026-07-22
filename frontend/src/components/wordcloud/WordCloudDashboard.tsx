"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  PieChart,
  Activity,
  Zap,
  Award,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { api } from "@/lib/api";
import type { SkillModule, SkillData as ApiSkillData } from "@/types";

interface DisplaySkillData {
  name: string;
  count: number;
  trend: number;
  category: string;
}

interface DisplayModuleData {
  id: string;
  name: string;
  value: number;
  trend: number;
  icon: string;
}

interface RankItem {
  rank: number;
  name: string;
  value: number;
  progress: number;
  trend: "up" | "down" | "stable";
}

interface ModuleCache {
  skills: DisplaySkillData[];
  updatedAt: Date;
}

export function WordCloudDashboard() {
  const [selectedModule, setSelectedModule] = useState<string>("frontend");
  const [modules, setModules] = useState<DisplayModuleData[]>([]);
  const [currentSkills, setCurrentSkills] = useState<DisplaySkillData[]>([]);
  const [rankItems, setRankItems] = useState<RankItem[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingModule, setIsLoadingModule] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [chartType, setChartType] = useState<"trend" | "compare" | "distribution">("trend");
  
  const cacheRef = useRef<Map<string, ModuleCache>>(new Map());
  const preloadingRef = useRef<Set<string>>(new Set());

  const calculateRankItems = useCallback((skills: DisplaySkillData[]): RankItem[] => {
    const maxCount = Math.max(...skills.map((s) => s.count), 1);
    const ranks: RankItem[] = skills.map((skill) => ({
      rank: skill.count > 0 ? skills.filter((s) => s.count > skill.count).length + 1 : skills.length,
      name: skill.name,
      value: skill.count,
      progress: (skill.count / maxCount) * 100,
      trend: skill.trend > 5 ? "up" : skill.trend < -5 ? "down" : "stable",
    }));
    ranks.sort((a, b) => a.rank - b.rank);
    return ranks;
  }, []);

  const loadModuleData = useCallback(async (moduleType: string, forceRefresh: boolean = false) => {
    const cache = cacheRef.current.get(moduleType);
    const isPreloading = preloadingRef.current.has(moduleType);
    
    if (!forceRefresh && cache && !isPreloading) {
      setCurrentSkills(cache.skills);
      setRankItems(calculateRankItems(cache.skills));
      setLastUpdate(cache.updatedAt);
      return;
    }
    
    if (isPreloading && !forceRefresh) {
      const maxWait = 5000;
      const startTime = Date.now();
      
      while (preloadingRef.current.has(moduleType) && Date.now() - startTime < maxWait) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      const newCache = cacheRef.current.get(moduleType);
      if (newCache) {
        setCurrentSkills(newCache.skills);
        setRankItems(calculateRankItems(newCache.skills));
        setLastUpdate(newCache.updatedAt);
        return;
      }
    }
    
    setIsLoadingModule(true);
    setError(null);
    
    try {
      const response = await api.wordcloud.getData(moduleType);
      
      const displayModules: DisplayModuleData[] = response.modules.map((m: SkillModule) => ({
        id: m.module_type,
        name: m.name,
        value: m.skill_count,
        trend: m.trend,
        icon: m.icon,
      }));
      setModules(displayModules);
      
      const displaySkills: DisplaySkillData[] = response.skills.map((s: ApiSkillData) => ({
        name: s.skill_name,
        count: s.demand_count,
        trend: s.trend,
        category: s.category,
      }));
      setCurrentSkills(displaySkills);
      
      const ranks = calculateRankItems(displaySkills);
      setRankItems(ranks);
      
      const updatedAt = new Date(response.updated_at);
      setLastUpdate(updatedAt);
      
      cacheRef.current.set(moduleType, {
        skills: displaySkills,
        updatedAt: updatedAt,
      });
      
      if (isInitialLoading && displayModules.length > 0) {
        setTimeout(() => {
          for (const module of displayModules) {
            if (module.id !== moduleType && !cacheRef.current.has(module.id) && !preloadingRef.current.has(module.id)) {
              preloadingRef.current.add(module.id);
              api.wordcloud.getData(module.id)
                .then((res) => {
                  const skills: DisplaySkillData[] = res.skills.map((s: ApiSkillData) => ({
                    name: s.skill_name,
                    count: s.demand_count,
                    trend: s.trend,
                    category: s.category,
                  }));
                  cacheRef.current.set(module.id, {
                    skills: skills,
                    updatedAt: new Date(res.updated_at),
                  });
                })
                .catch((err) => {
                  console.error(`Failed to preload module ${module.id}:`, err);
                })
                .finally(() => {
                  preloadingRef.current.delete(module.id);
                });
            }
          }
        }, 100);
      }
    } catch (err) {
      console.error("Failed to load wordcloud data:", err);
      setError(err instanceof Error ? err.message : "加载数据失败");
    } finally {
      setIsLoadingModule(false);
      setIsInitialLoading(false);
    }
  }, [calculateRankItems, isInitialLoading]);

  useEffect(() => {
    loadModuleData(selectedModule);
  }, [selectedModule, loadModuleData]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setError(null);
    try {
      const response = await api.wordcloud.refresh(selectedModule);
      if (response.success) {
        cacheRef.current.delete(selectedModule);
        await loadModuleData(selectedModule, true);
      } else {
        setError(response.message);
      }
    } catch (err) {
      console.error("Failed to refresh wordcloud data:", err);
      setError(err instanceof Error ? err.message : "刷新数据失败");
    } finally {
      setIsRefreshing(false);
    }
  }, [selectedModule, loadModuleData]);

  const handleModuleChange = useCallback((moduleType: string) => {
    if (moduleType === selectedModule) return;
    setError(null);
    setSelectedModule(moduleType);
  }, [selectedModule]);

  const selectedModuleData = modules.find((m) => m.id === selectedModule);

  if (isInitialLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-12 w-12 animate-spin mx-auto mb-4 text-cyan-400" />
          <p className="text-lg">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="mx-auto max-w-[1920px] px-6 py-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">简历词云</h1>
            <p className="mt-1 text-sm text-slate-400">技能需求分析大屏 · 数据来源：BOSS直聘等招聘平台</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right text-sm text-slate-400">
              <div>最后更新</div>
              <div className="font-mono text-xs text-cyan-400">{lastUpdate.toLocaleTimeString()}</div>
            </div>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-400 transition-all hover:bg-cyan-500/20 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              刷新数据
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-rose-400">
            <AlertCircle className="h-5 w-5" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-12 gap-6" style={{ minHeight: "calc(100vh - 200px)" }}>
          <div className="col-span-3 space-y-3">
            <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-4 backdrop-blur-sm">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-300">
                <Activity className="h-4 w-4 text-cyan-400" />
                业务模块
              </h2>
              <div className="space-y-2">
                {modules.map((module) => {
                  const isSelected = selectedModule === module.id;
                  return (
                    <button
                      key={module.id}
                      onClick={() => handleModuleChange(module.id)}
                      className={`w-full rounded-lg border p-3 text-left transition-all duration-300 ${
                        isSelected
                          ? "border-cyan-500/50 bg-cyan-500/10 shadow-lg shadow-cyan-500/20"
                          : "border-slate-700/30 bg-slate-800/20 hover:border-slate-600/50 hover:bg-slate-700/30"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{module.icon}</span>
                          <span className="text-sm font-medium">{module.name}</span>
                        </div>
                        {isSelected && <Zap className="h-4 w-4 text-cyan-400" />}
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs">
                        <span className="text-slate-400">技能数</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold text-white">{module.value}</span>
                          <span
                            className={`flex items-center ${
                              module.trend > 0 ? "text-emerald-400" : "text-rose-400"
                            }`}
                          >
                            {module.trend > 0 ? (
                              <TrendingUp className="h-3 w-3" />
                            ) : (
                              <TrendingDown className="h-3 w-3" />
                            )}
                            {Math.abs(module.trend).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="col-span-6 space-y-4">
            <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-6 backdrop-blur-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="flex items-center gap-2 text-lg font-semibold">
                    <BarChart3 className="h-5 w-5 text-cyan-400" />
                    {selectedModuleData?.name || "技能分析"}
                    {isLoadingModule && (
                      <RefreshCw className="h-4 w-4 animate-spin text-cyan-400 ml-2" />
                    )}
                  </h2>
                  <p className="mt-1 text-xs text-slate-400">技能需求趋势与分布</p>
                </div>
                <div className="flex gap-2">
                  {[
                    { type: "trend" as const, label: "趋势", icon: TrendingUp },
                    { type: "compare" as const, label: "对比", icon: BarChart3 },
                    { type: "distribution" as const, label: "分布", icon: PieChart },
                  ].map((item) => {
                    const Icon = item.icon;
                    const isActive = chartType === item.type;
                    return (
                      <button
                        key={item.type}
                        onClick={() => setChartType(item.type)}
                        className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                          isActive
                            ? "bg-cyan-500/20 text-cyan-400"
                            : "bg-slate-700/30 text-slate-400 hover:bg-slate-700/50"
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="min-h-[400px]">
                {isLoadingModule ? (
                  <div className="flex items-center justify-center h-[400px]">
                    <RefreshCw className="h-8 w-8 animate-spin text-cyan-400" />
                  </div>
                ) : (
                  <>
                    {chartType === "trend" && (
                      <div className="space-y-3">
                        {currentSkills.slice(0, 8).map((skill, index) => {
                          const maxCount = Math.max(...currentSkills.map((s) => s.count));
                          const percentage = maxCount > 0 ? (skill.count / maxCount) * 100 : 0;
                          return (
                            <div
                              key={skill.name}
                              className="group rounded-lg border border-slate-700/30 bg-slate-800/20 p-3 transition-all hover:border-cyan-500/30 hover:bg-slate-700/30"
                            >
                              <div className="mb-2 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="w-6 text-right text-xs font-mono text-slate-500">
                                    {index + 1}
                                  </span>
                                  <span className="text-sm font-medium">{skill.name}</span>
                                  <span className="rounded bg-slate-700/50 px-2 py-0.5 text-xs text-slate-400">
                                    {skill.category}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="font-mono text-sm font-semibold">{skill.count}</span>
                                  <span
                                    className={`flex items-center gap-1 text-xs ${
                                      skill.trend > 0 ? "text-emerald-400" : "text-rose-400"
                                    }`}
                                  >
                                    {skill.trend > 0 ? (
                                      <TrendingUp className="h-3 w-3" />
                                    ) : (
                                      <TrendingDown className="h-3 w-3" />
                                    )}
                                    {Math.abs(skill.trend).toFixed(1)}%
                                  </span>
                                </div>
                              </div>
                              <div className="h-2 overflow-hidden rounded-full bg-slate-900">
                                <div
                                  className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500 transition-all duration-500"
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {chartType === "compare" && (
                      <div className="grid grid-cols-2 gap-4">
                        {currentSkills.slice(0, 8).map((skill) => {
                          const maxCount = Math.max(...currentSkills.map((s) => s.count));
                          const percentage = maxCount > 0 ? (skill.count / maxCount) * 100 : 0;
                          return (
                            <div
                              key={skill.name}
                              className="rounded-lg border border-slate-700/30 bg-slate-800/20 p-4"
                            >
                              <div className="mb-3 flex items-center justify-between">
                                <span className="text-sm font-medium">{skill.name}</span>
                                <span className="font-mono text-lg font-bold text-cyan-400">
                                  {skill.count}
                                </span>
                              </div>
                              <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-slate-900">
                                <div
                                  className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500"
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                              <div className="flex items-center justify-between text-xs text-slate-400">
                                <span>{skill.category}</span>
                                <span
                                  className={
                                    skill.trend > 0 ? "text-emerald-400" : "text-rose-400"
                                  }
                                >
                                  {skill.trend > 0 ? "+" : ""}
                                  {skill.trend.toFixed(1)}%
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {chartType === "distribution" && (
                      <div className="flex flex-wrap gap-3 p-4">
                        {currentSkills.map((skill) => {
                          const maxCount = Math.max(...currentSkills.map((s) => s.count));
                          const size = maxCount > 0 ? Math.max(60, (skill.count / maxCount) * 150) : 60;
                          const hue = skill.trend > 10 ? 160 : skill.trend > 0 ? 180 : 200;
                          return (
                            <div
                              key={skill.name}
                              className="flex items-center justify-center rounded-lg border border-slate-700/30 bg-slate-800/20 transition-all hover:scale-105 hover:border-cyan-500/30"
                              style={{
                                width: `${size}px`,
                                height: `${size}px`,
                              }}
                            >
                              <div className="text-center">
                                <div
                                  className="text-sm font-bold"
                                  style={{ color: `hsl(${hue}, 70%, 60%)` }}
                                >
                                  {skill.name}
                                </div>
                                <div className="mt-1 font-mono text-xs text-slate-400">
                                  {skill.count}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="col-span-3 space-y-3">
            <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-4 backdrop-blur-sm">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-300">
                <Award className="h-4 w-4 text-amber-400" />
                TOP 技能排行
              </h2>
              <div className="space-y-2">
                {rankItems.map((item, index) => (
                  <div
                    key={item.name}
                    className="group rounded-lg border border-slate-700/30 bg-slate-800/20 p-3 transition-all hover:border-amber-500/30"
                    style={{
                      animation: `slideIn 0.3s ease-out ${index * 0.05}s both`,
                    }}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                            item.rank === 1
                              ? "bg-amber-500/20 text-amber-400"
                              : item.rank === 2
                                ? "bg-slate-400/20 text-slate-300"
                                : item.rank === 3
                                  ? "bg-orange-500/20 text-orange-400"
                                  : "bg-slate-700/50 text-slate-500"
                          }`}
                        >
                          {item.rank}
                        </span>
                        <span className="text-sm font-medium">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold">{item.value}</span>
                        {item.trend === "up" && (
                          <TrendingUp className="h-3 w-3 text-emerald-400" />
                        )}
                        {item.trend === "down" && (
                          <TrendingDown className="h-3 w-3 text-rose-400" />
                        )}
                      </div>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-900">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-500"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-4 backdrop-blur-sm">
              <h2 className="mb-3 text-sm font-semibold text-slate-300">数据统计</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">总技能数</span>
                  <span className="font-mono font-semibold text-cyan-400">
                    {currentSkills.length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">平均需求</span>
                  <span className="font-mono font-semibold">
                    {currentSkills.length > 0
                      ? Math.round(
                          currentSkills.reduce((sum, s) => sum + s.count, 0) / currentSkills.length
                        )
                      : 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">增长技能</span>
                  <span className="font-mono font-semibold text-emerald-400">
                    {currentSkills.filter((s) => s.trend > 0).length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">下降技能</span>
                  <span className="font-mono font-semibold text-rose-400">
                    {currentSkills.filter((s) => s.trend < 0).length}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
}
