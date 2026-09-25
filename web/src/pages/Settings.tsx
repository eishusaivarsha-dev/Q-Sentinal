import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { API_URL, OPS_URL, api, errorText, getApiKey, setApiKey } from "../api/client";
import { Button, Card, Pill } from "../components/ui";
import type { SessionFile } from "../state/session";
import { useSession } from "../state/session";
import { startReplay, stopReplay } from "../state/telemetry";

export default function Settings() {
  const qc = useQueryClient();
  const [key, setKey] = useState(getApiKey());
  const health = useQuery({ queryKey: ["health"], queryFn: api.health });
  const who = useQuery({ queryKey: ["participants", key], queryFn: api.participants, retry: false });
  const replay = useSession((s) => s.replay);
  const [fileError, setFileError] = useState("");

  const loadFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      const data = JSON.parse(await f.text()) as SessionFile;
      if (data.version !== 1 || !Array.isArray(data.events)) throw new Error("not a Q-SENTINEL session file");
      startReplay(data);
      setFileError("");
      qc.invalidateQueries();
    } catch (e) {
      setFileError(errorText(e));
    }
  };

  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <Card title="Access">
        <p className="text-sm text-slate-400">The backend runs in {health.data?.auth === "api-keys" ? <Pill tone="info">API-key mode</Pill> : <Pill tone="warn">open dev mode</Pill>}. With keys enabled, your identity and role come from your key.</p>
        <div className="mt-3 flex gap-2">
          <input type="password" className="flex-1 rounded-lg bg-slate-800 p-2 font-mono text-sm" value={key} onChange={(e) => setKey(e.target.value)} placeholder="X-API-Key (kept in this tab only)" />
          <Button onClick={() => { setApiKey(key); qc.invalidateQueries(); }}>Save</Button>
        </div>
        <p className="mt-2 text-sm">{who.error ? <span className="text-rose-300">Key check: {errorText(who.error)}</span> : who.data && <span className="text-emerald-300">Key accepted (analyst access). Signers: {who.data.signers.join(", ")} · verifiers: {who.data.verifiers.join(", ")}</span>}</p>
      </Card>
      <Card title="Endpoints">
        <p className="font-mono text-sm">API {API_URL}</p>
        <p className="font-mono text-sm">Ops {OPS_URL}</p>
        <p className="mt-1 text-xs text-slate-500">Change with VITE_API_URL / VITE_OPS_URL in web/.env.</p>
      </Card>
      <Card title="Offline replay">
        <p className="text-sm text-slate-400">Record a live session with the ● button in the top bar, save it, and replay it here with no backend – the demo's safety net.</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input type="file" accept="application/json" onChange={(e) => loadFile(e.target.files?.[0])} className="text-sm" />
          {replay && <Button variant="ghost" onClick={stopReplay}>Exit replay</Button>}
        </div>
        {fileError && <p className="mt-2 text-sm text-rose-300">{fileError}</p>}
      </Card>
    </div>
  );
}
