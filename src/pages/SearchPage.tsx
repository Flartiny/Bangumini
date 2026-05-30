import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { searchSubjects } from "@shared/api/client";
import { SubjectTypeLabel } from "@shared/api/types";
import { SubjectRow, Rating, Meta } from "../components/SubjectRow";
import { SearchIcon } from "../components/icons";

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-fg-tertiary">
      <SearchIcon size={32} className="opacity-40" />
      <p className="text-[13px]">{children}</p>
    </div>
  );
}

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

  if (!keyword) return <EmptyState>输入关键词开始搜索</EmptyState>;
  if (error) return <EmptyState>搜索出错: {String(error)}</EmptyState>;
  if (isLoading) return <EmptyState>搜索中…</EmptyState>;
  if (subjects.length === 0) return <EmptyState>无结果</EmptyState>;

  return (
    <div className="p-2.5 space-y-0.5">
      {subjects.map((s) => (
        <SubjectRow
          key={s.id}
          coverUrl={s.images?.small}
          title={s.name_cn || s.name}
          subtitle={s.name_cn ? s.name : undefined}
          onClick={() => navigate(`/subject/${s.id}`)}
          accessories={
            <>
              <Meta>{SubjectTypeLabel[s.type]}</Meta>
              {s.rating?.score ? <Rating score={s.rating.score} /> : null}
            </>
          }
        />
      ))}
    </div>
  );
}

