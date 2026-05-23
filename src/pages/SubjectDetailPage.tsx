import { useState, useRef, useEffect } from "react";
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

export default function SubjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const subjectId = Number(id);
  const [targetEp, setTargetEp] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const initialEpStatus = useRef<number | null>(null);

  // Backspace to go back
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Backspace" && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        handleBack();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  function handleBack() {
    const state = location.state as { fromCollections?: boolean } | null;
    const currentEpStatus = collection?.ep_status ?? 0;
    const hasChanged = initialEpStatus.current !== null && initialEpStatus.current !== currentEpStatus;

    if (state?.fromCollections && hasChanged) {
      navigate("/collections", { state: { fromSubject: true, subjectId } });
    } else {
      navigate(-1);
    }
  }

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
    try {
      await postUserCollection(subjectId, { type });
      refetchCollection();
    } finally {
      setLoading(false);
    }
  }

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
          {/* Summary */}
          {subject?.summary && (
            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-2">简介</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{subject.summary}</p>
            </div>
          )}

          {/* Staff */}
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

          {/* Cast */}
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
          {/* Cover */}
          {subject?.images?.large && (
            <img src={subject.images.large} alt="" className="w-full rounded-lg" />
          )}

          {/* Rating & Rank */}
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

            {/* Air date */}
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

            {/* Collection status */}
            <div>
              <span className="text-gray-500">状态 </span>
              {collection ? (
                <span className="text-indigo-400">{CollectionTypeLabel[collection.type]}</span>
              ) : (
                <span className="text-gray-600">未收藏</span>
              )}
            </div>

            {/* Progress */}
            {totalEp > 0 && (
              <div>
                <span className="text-gray-500">进度 </span>
                <span className={isDirty ? "text-green-400" : ""}>
                  {isDirty ? `${currentEp} → ${displayTarget} / ${totalEp}` : `${currentEp} / ${totalEp}`}
                </span>
              </div>
            )}
          </div>

          {/* Progress Controls */}
          {totalEp > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const base = targetEp ?? currentEp;
                    setTargetEp(Math.max(0, base - 1));
                  }}
                  className="w-8 h-8 text-sm bg-gray-700 rounded hover:bg-gray-600 transition-colors"
                >
                  −
                </button>
                <input
                  type="number"
                  min={0}
                  max={totalEp}
                  value={displayTarget}
                  onChange={(e) => {
                    const v = parseInt(e.target.value);
                    if (!isNaN(v) && v >= 0 && v <= totalEp) setTargetEp(v);
                  }}
                  className="w-14 px-2 py-1 text-sm text-center bg-gray-800 border border-gray-600 rounded focus:border-indigo-500 focus:outline-none"
                />
                <span className="text-xs text-gray-500">/ {totalEp}</span>
                <button
                  onClick={() => {
                    const base = targetEp ?? currentEp;
                    setTargetEp(Math.min(totalEp, base + 1));
                  }}
                  className="w-8 h-8 text-sm bg-gray-700 rounded hover:bg-gray-600 transition-colors"
                >
                  +
                </button>
                {isDirty && (
                  <button
                    onClick={commitProgress}
                    disabled={loading}
                    className="ml-auto px-3 py-1 text-xs bg-indigo-600 rounded hover:bg-indigo-500 disabled:opacity-40 transition-colors"
                  >
                    {loading ? "…" : "提交"}
                  </button>
                )}
              </div>

              {/* Quick jump buttons */}
              <div className="flex gap-1 flex-wrap">
                {[0, ...mainEps.map((_, i) => i + 1).filter((n) => n % 12 === 0 || n === totalEp)].map((n, idx, arr) => {
                  if (idx === arr.length - 1) return null;
                  return (
                    <button
                      key={n}
                      onClick={() => setTargetEp(n)}
                      className={`px-1.5 py-0.5 text-xs rounded ${
                        displayTarget === n ? "bg-indigo-600" : "bg-gray-700 hover:bg-gray-600"
                      }`}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Collection Type */}
          <div className="space-y-1">
            {([1, 2, 3, 4, 5] as CollectionType[]).map((t) => (
              <button
                key={t}
                onClick={() => setCollectionType(t)}
                disabled={loading}
                className={`w-full px-3 py-1.5 text-xs rounded text-left transition-colors ${
                  collection?.type === t
                    ? "bg-indigo-600"
                    : "bg-gray-700 hover:bg-gray-600"
                } disabled:opacity-40`}
              >
                {CollectionTypeLabel[t]}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
