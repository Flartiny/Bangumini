import { useState } from "react";
import { clearToken, setToken } from "../api/oauth";
import ShortcutRecorder from "../components/ShortcutRecorder";

export default function SettingsPage() {
  const [tokenText, setTokenText] = useState("");

  return (
    <div className="p-5 max-w-lg space-y-6">
      <section>
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-fg-tertiary mb-2">账户</h3>
        <label className="block text-[13px] text-fg-secondary mb-1.5">Access Token</label>
        <div className="flex gap-2">
          <input
            type="password"
            value={tokenText}
            onChange={(e) => setTokenText(e.target.value)}
            placeholder="更新 Access Token…"
            className="flex-1 px-3 py-2 text-[13px] bg-elevated rounded-md border border-line text-fg placeholder-fg-tertiary focus:border-accent focus:outline-none"
          />
          <button
            onClick={() => { setToken(tokenText.trim()); setTokenText(""); }}
            disabled={!tokenText.trim()}
            className="px-4 py-2 text-[13px] font-medium bg-accent text-accent-fg rounded-md hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            更新
          </button>
        </div>
        <p className="text-[12px] text-fg-tertiary mt-1.5">
          前往{" "}
          <a href="https://next.bgm.tv/demo/access-token" target="_blank" rel="noreferrer" className="text-accent hover:underline">
            Bangumi 开发者工具
          </a>{" "}
          生成
        </p>
      </section>

      <section>
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-fg-tertiary mb-2">全局快捷键</h3>
        <ShortcutRecorder />
      </section>

      <section>
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-fg-tertiary mb-2">通用</h3>
        <div className="flex items-center justify-between">
          <span className="text-[13px] text-fg-secondary">开机自启动</span>
          <span className="text-[12px] text-fg-tertiary">（待实现）</span>
        </div>
      </section>

      <div className="pt-2 border-t border-line">
        <button
          onClick={() => { clearToken(); window.location.reload(); }}
          className="px-4 py-2 text-[13px] font-medium bg-danger/15 hover:bg-danger/25 rounded-md text-danger transition-colors"
        >
          退出登录
        </button>
      </div>
    </div>
  );
}
