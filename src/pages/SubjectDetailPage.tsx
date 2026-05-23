import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  getSubject,
  getSubjectPersons,
  getSubjectCharacters,
  getEpisodes,
  getUserCollection,
  patchSubjectEpisodes,
  postUserCollection,
} from "@shared/api/client";
import { CollectionTypeLabel } from "@shared/api/types";
import type { CollectionType } from "@shared/api/types";
import { getUsername } from "../api/oauth";

const COLLECTION_OPTIONS: { type: CollectionType; label: string; key: string }[] = [
  { type: 1, label: "想看", key: "1" },
  { type: 2, label: "看过", key: "2" },
  { type: 3, label: "在看", key: "3" },
  { type: 4, label: "搁置", key: "4" },
  { type: 5, label: "抛弃", key: "5" },
];

export default function SubjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const subjectId = Number(id);
  const [targetEp, setTargetEp] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteIndex, setPaletteIndex] = useState(0);
  const initialEpStatus = useRef<number | null>(null);

  const { data: subject } = useQuery({
    queryKey: ["subject", subjectId],
    queryFn: () => getSubject(subjectId),
  });

  const { data: persons } = useQuery({
    queryKey: ["persons", subjectId],
    queryFn: () => getSubjectPersons(subjectId),
  });

  const { data: characters } = useQuery({
    queryKey: ["characters", subjectId],
    queryFn: () => getSubjectCharacters(subjectId),
  });

  const { data: episodeData } = useQuery({
    queryKey: ["episodes", subjectId],
    queryFn: () => getEpisodes(subjectId),
  });

  const { data: collection, refetch: refetchCollection } = useQuery({
    queryKey: ["collection", subjectId],
    queryFn: async () => {
      try {
        const uname = getUsername();
        if (!uname) return null;
        const result = await getUserCollection(uname, subjectId);
        if (initialEpStatus.current === null && result) {
          initialEpStatus.current = result.ep_status;
        }
        return result;
      } catch {
        return null;
      }
    },
  });

  const sorted = episodeData?.data?.slice().sort((a, b) => a.sort - b.sort) ?? [];
  const mainEps = sorted.filter((e) => e.type === 0);
  const totalEp = mainEps.length > 0 ? mainEps.length : (subject?.total_episodes ?? 0);
  const currentEp = collection?.ep_status ?? 0;
  const displayTarget = targetEp ?? currentEp;
  const isDirty = targetEp !== null && targetEp !== currentEp;

  async function commitProgress() {
    if (!isDirty || targetEp === null) return;
    setLoading(true);
    try {
      const from = Math.min(currentEp, targetEp);
      const to = Math.max(currentEp, targetEp);
      const ids = mainEps.slice(from, to).map((e) => e.id);
      if (ids.length > 0) {
        await patchSubjectEpisodes(subjectId, { episode_id: ids, type: targetEp > currentEp ? 2 : 0 });
      }
      setTargetEp(null);
      refetchCollection();
    } finally {
      setLoading(false);
    }
  }

  async function setCollectionType(type: CollectionType) {
    setLoading(true);
    setPaletteOpen(false);
    try {
      await postUserCollection(subjectId, { type });
      refetchCollection();
    } finally {
      setLoading(false);
    }
  }

  const handleBack = useCallback(() => {
    const state = location.state as { fromCollections?: boolean } | null;
    const currentEpStatus = collection?.ep_status ?? 0;
    const hasChanged = initialEpStatus.current !== null && initialEpStatus.current !== currentEpStatus;
    if (state?.fromCollections && hasChanged) {
      navigate("/collections", { state: { fromSubject: true, subjectId } });
    } else {
      navigate(-1);
    }
  }, [collection, location, navigate, subjectId]);

  // Global keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      const isInput = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";

      // Ctrl+K: command palette
      if (e.key === "k" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setPaletteOpen((prev) => !prev);
        setPaletteIndex(0);
        return;
      }

      if (paletteOpen) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setPaletteIndex((i) => Math.min(COLLECTION_OPTIONS.length - 1, i + 1));
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setPaletteIndex((i) => Math.max(0, i - 1));
          return;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          const opt = COLLECTION_OPTIONS[paletteIndex];
          if (opt) setCollectionType(opt.type);
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setPaletteOpen(false);
          return;
        }
        // Number key quick select
        const num = parseInt(e.key);
        if (num >= 1 && num <= 5) {
          e.preventDefault();
          setCollectionType(num as CollectionType);
          return;
        }
        return;
      }

      if (isInput) return;

      // Backspace: go back
      if (e.key === "Backspace") {
        e.preventDefault();
        handleBack();
        return;
      }

      if (totalEp <= 0) return;

      // ArrowRight: increment target episode
      if (e.key === "ArrowRight") {
        e.preventDefault();
        setTargetEp((prev) => Math.min(totalEp, (prev ?? currentEp) + 1));
        return;
      }
      // ArrowLeft: decrement target episode
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setTargetEp((prev) => Math.max(0, (prev ?? currentEp) - 1));
        return;
      }
      // Enter: commit progress
      if (e.key === "Enter" && isDirty) {
        e.preventDefault();
        commitProgress();
        return;
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [paletteOpen, paletteIndex, totalEp, currentEp, targetEp, isDirty, handleBack]);

  const staffMap = new Map<string, string[]>();
  (persons ?? []).forEach((p) => {
    const role = p.relation || "其他";
    const names = staffMap.get(role) ?? [];
    names.push(p.name);
    staffMap.set(role, names);
  });

  return (
    <div className="h-screen flex flex-col bg-[#1a1a2e] text-gray-200">
      {/* Header */}
      <header className="flex items-center gap-2 px-4 py-2 border-b border-gray-800 shrink-0">
        <button onClick={handleBack} className="text-gray-400 hover:text-white text-sm">
          ← 返回
        </button>
        <span className="text-sm font-medium truncate">{subject?.name_cn || subject?.name || "条目详情"}</span>
        <span className="text-xs text-gray-500 ml-2">
          Ctrl+K 操作 | ← → 调进度 | Enter 确认 | Backspace 返回
        </span>
        <button
          onClick={() => window.open(`https://bgm.tv/subject/${subjectId}`)}
          className="ml-auto text-xs text-indigo-400 hover:underline"
        >
          Bangumi ↗
        </button>
      </header>

      {/* Two-column body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left column: scrollable content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {subject?.summary && (
            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-2">简介</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{subject.summary}</p>
            </div>
          )}

          {staffMap.size > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-2">Staff</h3>
              <div className="space-y-1">
                {[...staffMap].map(([role, names]) => (
                  <div key={role} className="text-sm leading-relaxed">
                    <span className="text-gray-500">{role}: </span>
                    <span>{names.join(" / ")}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(characters ?? []).length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-2">角色 / Cast</h3>
              <div className="space-y-1">
                {(characters ?? []).map((ch) => (
                  <div key={ch.id} className="text-sm leading-relaxed">
                    <span>{ch.name}</span>
                    {ch.actors.length > 0 && (
                      <span className="text-gray-500"> CV: {ch.actors.map((a) => a.name).join(" / ")}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column: fixed info panel */}
        <div className="w-72 shrink-0 border-l border-gray-800 p-5 flex flex-col gap-4 overflow-y-auto">
          {subject?.images?.large && (
            <img src={subject.images.large} alt="" className="w-full rounded-lg" />
          )}

          <div className="space-y-2 text-sm">
            <div>
              <span className="text-gray-500">评分 </span>
              <span className="text-yellow-400 text-lg font-medium">
                {subject?.rating?.score?.toFixed(1) ?? "暂无"}
              </span>
              {subject?.rank ? (
                <span className="text-gray-500 ml-2">排名 #{subject.rank}</span>
              ) : null}
            </div>

            {subject?.date && (
              <div>
                <span className="text-gray-500">放送 </span>
                <span>{subject.date}</span>
                {subject.air_weekday ? (
                  <span className="text-gray-500 ml-1">
                    ({["", "周一", "周二", "周三", "周四", "周五", "周六", "周日"][subject.air_weekday]})
                  </span>
                ) : null}
              </div>
            )}

            <div>
              <span className="text-gray-500">状态 </span>
              {collection ? (
                <span className="text-indigo-400">{CollectionTypeLabel[collection.type]}</span>
              ) : (
                <span className="text-gray-600">未收藏</span>
              )}
            </div>

            {totalEp > 0 && (
              <div>
                <span className="text-gray-500">进度 </span>
                {isDirty ? (
                  <span className="text-green-400">
                    {currentEp} → {displayTarget} / {totalEp}
                  </span>
                ) : (
                  <span>
                    {currentEp} / {totalEp}
                  </span>
                )}
                {isDirty && (
                  <span className="text-xs text-gray-500 ml-1">按 Enter 提交</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Command Palette Overlay */}
      {paletteOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
          <div className="fixed inset-0 bg-black/50" onClick={() => setPaletteOpen(false)} />
          <div className="relative w-80 bg-gray-800 border border-gray-600 rounded-lg shadow-2xl overflow-hidden">
            <div className="px-3 py-2 text-xs text-gray-500 border-b border-gray-700">
              收藏状态 · 按数字键或回车选择
            </div>
            {COLLECTION_OPTIONS.map((opt, i) => (
              <button
                key={opt.type}
                onClick={() => setCollectionType(opt.type)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors ${
                  i === paletteIndex
                    ? "bg-indigo-600 text-white"
                    : collection?.type === opt.type
                      ? "bg-indigo-500/20 text-indigo-300"
                      : "text-gray-300 hover:bg-gray-700"
                }`}
              >
                <span className="text-xs text-gray-500 w-5">{opt.key}</span>
                <span>{opt.label}</span>
                {collection?.type === opt.type && (
                  <span className="ml-auto text-xs text-indigo-400">当前</span>
                )}
              </button>
            ))}
            <div className="px-3 py-2 text-xs text-gray-600 border-t border-gray-700">
              ↑↓ 导航 · Enter/数字键 选择 · Esc 关闭
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
