import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { API_URL, OPS_URL, api, errorText, getApiKey, setApiKey } from "@/api/client";
import { useHealth } from "@/api/hooks";
import type { SessionFile } from "@/state/session";
import { useSession } from "@/state/session";
import { startReplay, stopReplay } from "@/state/telemetry";
import { Chip, LinkText, PageHeader, Panel } from "@/components/shell/primitives";

export default function Settings() {
  const qc = useQueryClient();
  const [key, setKey] = useState(getApiKey());
  const health = useHealth();
  const who = useQuery({ queryKey: ["participants", key], queryFn: api.participants, retry: false });
  const replay = useSession((s) => s.replay);
  const [fileError, setFileError] = useState("");
  const file = useRef<HTMLInputElement>(null);

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
    <div>
      <PageHeader directive="Directive 10 · Switchboard" title="Settings" lede="Access, endpoints, and the offline replay that keeps a demo safe from the network." />
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Access" code="RBAC">
          <p className="text-[12.5px] text-paper-dim">The backend runs in {health.data?.auth === "api-keys" ? <Chip tone="info">API-key mode</Chip> : <Chip tone="warn">open dev mode</Chip>}. With keys enabled, your identity and role come from your key, not from what you type.</p>
          <label className="mt-4 block">
            <span className="label">X-API-Key · kept in this tab only (sessionStorage)</span>
            <div className="mt-1 flex gap-2">
              <input type="password" autoComplete="off" className="field" value={key} onChange={(e) => setKey(e.target.value)} placeholder="••••••••" />
              <button className="btn-primary" onClick={() => { setApiKey(key); qc.invalidateQueries(); }}>Save</button>
            </div>
          </label>
          <p className="mt-3 text-[12px]">
            {who.error ? <span className="text-reject">Key check: {errorText(who.error)}</span>
              : who.data && <span className="text-accept">Key accepted (analyst access). Signers: {who.data.signers.join(", ")} · verifiers: {who.data.verifiers.join(", ")} · honeypots: {who.data.honeypots}</span>}
          </p>
        </Panel>
        <Panel title="Endpoints" code="VITE_API_URL · VITE_OPS_URL">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[12.5px]">
            <dt className="label self-center">API</dt><dd className="data break-all text-paper">{API_URL}</dd>
            <dt className="label self-center">Ops</dt><dd className="data break-all text-paper">{OPS_URL}</dd>
            {health.data && <><dt className="label self-center">Backend</dt><dd className="data text-paper-dim">{health.data.backend} · {health.data.profile} · ML-DSA {health.data.pqc}</dd></>}
          </dl>
          <p className="mt-3 font-type text-[11px] text-paper-faint">Change them in web/.env (see the repository's .env.example).</p>
        </Panel>
        <Panel title="Offline replay" code="session recorder">
          <p className="text-[12.5px] text-paper-dim">Record a live session with the Rec button in the top bar, save it, and replay it here with no backend. Presenter Mode re-runs its steps from the recording.</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button className="btn-ghost" onClick={() => file.current?.click()}>Load recording…</button>
            <input ref={file} type="file" accept="application/json" hidden onChange={(e) => { void loadFile(e.target.files?.[0]); e.target.value = ""; }} />
            {replay && <button className="btn-ghost" onClick={stopReplay}>⏏ Exit replay</button>}
            {replay && <Chip tone="info">replaying</Chip>}
          </div>
          {fileError && <p className="mt-2 text-[12px] text-reject">{fileError}</p>}
        </Panel>
        <Panel title="Documents" code="print">
          <div className="flex flex-wrap gap-4">
            <Link to="/report"><LinkText>Open security report →</LinkText></Link>
            <Link to="/verdicts"><LinkText>Print a verdict certificate →</LinkText></Link>
          </div>
        </Panel>
      </div>
    </div>
  );
}
