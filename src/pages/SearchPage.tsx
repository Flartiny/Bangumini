import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { searchSubjects } from "@shared/api/client";
import { SubjectTypeLabel } from "@shared/api/types";

export default function SearchPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const keyword = searchParams.get("q") ?? "";
  const typeFilter = searchParams.get("stype") ?? "";

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

  if (!keyword) {
    return <p className="p-4 text-gray-500 text-sm">输入关键词开始搜索</p>;
  }

  if (error) return <p className="p-4 text-red-400 text-sm">搜索出错: {String(error)}</p>;
  if (isLoading) return <p className="p-4 text-gray-500 text-sm">搜索中…</p>;

  return (
    <div className="p-4">
      {subjects.length === 0 ? (
        <p className="text-gray-500 text-sm">无结果</p>
      ) : (
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
      )}
    </div>
  );
}
