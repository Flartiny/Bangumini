const TOKEN_KEY = "bangumi_token";
const USERNAME_KEY = "bangumi_username";

export function isLoggedIn(): boolean {
  return !!localStorage.getItem(TOKEN_KEY);
}

export function getAccessToken(): string {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) throw new Error("Not authenticated");
  return token;
}

export function getUsername(): string {
  return localStorage.getItem(USERNAME_KEY) ?? "";
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USERNAME_KEY);
}

export async function fetchAndCacheUsername(): Promise<string> {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return "";
  try {
    const res = await fetch("https://api.bgm.tv/v0/me", {
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": "Bangumini/0.1",
      },
    });
    if (res.ok) {
      const data = (await res.json()) as { username: string };
      if (data.username) {
        localStorage.setItem(USERNAME_KEY, data.username);
        return data.username;
      }
    }
  } catch {
    // non-critical
  }
  return "";
}
