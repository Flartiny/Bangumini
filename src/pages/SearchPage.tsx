import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { searchSubjects } from "@shared/api/client";
import { SubjectTypeLabel } from "@shared/api/types";

export default function SearchPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [typeFilter, setTypeFilter] = useState("2");
  const keyword = searchParams.get("q") ?? "";

  const { data, isLoading, error } = useQuery({
    queryKey: ["search", keyword, typeFilter],
    queryFn: () =>
      searchSubjects({
        keyword,
        type: typeFilter ? [parseInt(typeFilter)] : undefined,
      }),
    enabled: keyword.length > 0,
    staleTime: 30_000,
  });

  const subjects = data?.data ?? [];

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-2 py-1 text-sm bg-gray-800 rounded-md border border-gray-700 text-gray-200 focus:border-indigo-500 focus:outline-none"
        >
          <option value="">全部</option>
          <option value="2">动画</option>
          <option value="1">书籍</option>
          <option value="3">音乐</option>
          <option value="4">游戏</option>
          <option value="6">三次元</option>
        </select>
        <span className="text-xs text-gray-500 ml-auto">
          在顶部搜索框输入关键词后按回车
        </span>
      </div>

      {!keyword && <p className="text-gray-500 text-sm">输入关键词开始搜索</p>}
      {error && <p className="text-red-400 text-sm">搜索出错: {String(error)}</p>}
      {isLoading && <p className="text-gray-500 text-sm">搜索中…</p>}
      {!isLoading && !error && keyword && subjects.length === 0 && (
        <p className="text-gray-500 text-sm">无结果</p>
      )}

      <div className="space-y-1">
        {subjects.map((s) => (
            <div
              key={s.id}
              onClick={() => navigate(`/subject/${s.id}`)}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-800/50 cursor-pointer transition-colors"
            >
              {s.images?.small && (
                <img src={s.images.small} alt="" className="w-10 h-14 rounded object-cover shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{s.name_cn || s.name}</div>
                {s.name_cn && <div className="text-xs text-gray-500 truncate">{s.name}</div>}
              </div>
              <span className="text-xs text-gray-500 shrink-0">{SubjectTypeLabel[s.type]}</span>
              {s.rating?.score && (
                <span className="text-xs text-yellow-500 shrink-0">★ {s.rating.score.toFixed(1)}</span>
              )}
            </div>
        ))}
      </div>
    </div>
  );
}
