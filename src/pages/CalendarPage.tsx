import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getCalendar } from "@shared/api/client";
import { WEEKDAY_CN, getTodayBangumiWeekday } from "@shared/sort-collections";

export default function CalendarPage() {
  const navigate = useNavigate();
  const today = getTodayBangumiWeekday();
  const [currentDay, setCurrentDay] = useState<number>(today);

  const { data: calendar, isLoading, error } = useQuery({
    queryKey: ["calendar"],
    queryFn: getCalendar,
    staleTime: 1000 * 60 * 30,
  });

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setCurrentDay((d) => (d <= 1 ? 7 : d - 1));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setCurrentDay((d) => (d >= 7 ? 1 : d + 1));
      } else if (e.key === "Home") {
        e.preventDefault();
        setCurrentDay(today);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [today]);

  if (isLoading) return <p className="p-4 text-gray-500 text-sm">加载中…</p>;
  if (error) return <p className="p-4 text-red-400 text-sm">加载出错: {String(error)}</p>;
  if (!calendar || calendar.length === 0) return <p className="p-4 text-gray-500 text-sm">暂无放送数据</p>;

  const dayMap = new Map(calendar.map((day) => [day.weekday.id, day]));
  const currentDayData = dayMap.get(currentDay);
  const isToday = currentDay === today;

  return (
    <div className="flex flex-col h-full">
      {/* Header with day selector */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <button
          onClick={() => setCurrentDay((d) => (d <= 1 ? 7 : d - 1))}
          className="px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 rounded transition-colors"
        >
          ← 前一天
        </button>

        <div className="flex items-center gap-3">
          <select
            value={currentDay}
            onChange={(e) => setCurrentDay(Number(e.target.value))}
            className="px-3 py-1.5 text-sm bg-gray-800 border border-gray-600 rounded focus:border-indigo-500 focus:outline-none"
          >
            {[1, 2, 3, 4, 5, 6, 7].map((id) => (
              <option key={id} value={id}>
                {WEEKDAY_CN[id]}{id === today ? " · 今天" : ""}
              </option>
            ))}
          </select>

          {!isToday && (
            <button
              onClick={() => setCurrentDay(today)}
              className="px-3 py-1.5 text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              回到今天
            </button>
          )}
        </div>

        <button
          onClick={() => setCurrentDay((d) => (d >= 7 ? 1 : d + 1))}
          className="px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 rounded transition-colors"
        >
          后一天 →
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mb-3">
          <h2 className={`text-lg font-medium ${isToday ? "text-indigo-400" : "text-gray-300"}`}>
            {WEEKDAY_CN[currentDay]}
            {isToday && " · 今天"}
          </h2>
          {currentDayData?.weekday.ja && (
            <p className="text-xs text-gray-500 mt-0.5">{currentDayData.weekday.ja}</p>
          )}
        </div>

        {!currentDayData || currentDayData.items.length === 0 ? (
          <p className="text-sm text-gray-500">
            {isToday ? "今天暂无放送" : "暂无放送"}
          </p>
        ) : (
          <div className="space-y-2">
            {currentDayData.items.map((s) => (
              <div
                key={s.id}
                onClick={() => navigate(`/subject/${s.id}`)}
                className="flex items-center gap-3 p-2 rounded hover:bg-gray-800/50 cursor-pointer transition-colors"
              >
                {s.images?.small && (
                  <img
                    src={s.images.small}
                    alt=""
                    className="w-12 h-16 rounded object-cover shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {s.name_cn || s.name}
                  </p>
                  {s.name_cn && s.name && (
                    <p className="text-xs text-gray-500 truncate mt-0.5">{s.name}</p>
                  )}
                </div>
                {s.rating?.score && (
                  <span className="text-xs text-yellow-500 shrink-0">
                    ★ {s.rating.score.toFixed(1)}
                  </span>
                )}
                {s.rank && (
                  <span className="text-xs text-gray-500 shrink-0">
                    #{s.rank}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Keyboard hints */}
      <div className="px-4 py-2 border-t border-gray-700 text-xs text-gray-500">
        提示: 使用 ← → 方向键切换日期，Home 键回到今天
      </div>
    </div>
  );
}
