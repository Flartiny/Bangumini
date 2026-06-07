import { useState } from "react";
import { isLoggedIn } from "../api/oauth";

export function useAuth() {
  const [authenticated, setAuthenticated] = useState(() => isLoggedIn());

  function handleLogin() {
    const ok = isLoggedIn();
    setAuthenticated(ok);
    return ok;
  }

  return { authLoading: false, authenticated, handleLogin };
}
