"use client";

import { useEffect } from "react";
import { googleLoginChannel } from "@/lib/members/google-login-flow";

export function GoogleLoginComplete({ authenticated, attempt, error }: { authenticated: boolean; attempt?: string; error?: string }) {
  useEffect(() => {
    const name = googleLoginChannel(attempt);
    if (!authenticated && name) {
      try {
        const channel = new BroadcastChannel(name);
        channel.postMessage({ type: "error", error: error ?? "authentication_failed" });
        channel.close();
      } catch { /* The callback page itself also explains how to retry. */ }
    }
    if (authenticated) window.close();
  }, [authenticated, attempt, error]);
  return <button type="button" onClick={() => window.close()}>Fechar esta janela</button>;
}
