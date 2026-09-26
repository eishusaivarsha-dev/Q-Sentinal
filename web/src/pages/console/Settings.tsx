// Settings: access (API key, sessionStorage only), endpoints, the offline replay that keeps a demo
// safe from the network, and appearance.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, CircleStop, KeyRound, Moon, Server, Sun, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { API_URL, OPS_URL, api, errorText, getApiKey, setApiKey } from "@/api/client";
import { useHealth } from "@/api/hooks";
import type { SessionFile } from "@/state/session";
import { useSession } from "@/state/session";
import { startReplay, stopReplay } from "@/state/telemetry";
import { useUi } from "@/state/ui";
import { to } from "@/components/shell/nav";
import { Card, Chip, KeyVal, PageHeader } from "@/components/ui";

export default function Settings() {
  const qc = useQueryClient();
  const [key, setKey] = useState(getApiKey());
  const health = useHealth();
  const ops = useQuery({ queryKey: ["ops-health"], queryFn: api.opsHealth, retry: false });
  const who = useQuery({ queryKey: ["participants", key], queryFn: api.participants, retry: false });
  const replay = useSession((s) => s.replay);
  const theme = useUi((s) => s.theme);
  const setTheme = useUi((s) => s.setTheme);
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
      <PageHeader eyebrow="Assist · configuration" title="Console" accent="settings" lede="Access, endpoints, and the offline replay that keeps a live demo safe from the network." />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Access" sub="role-based (RBAC)" icon={KeyRound}>
          <p className="text-[15px] text-ink-2">The backend runs in {health.data?.auth === "api-keys" ? <Chip tone="info">API-key mode</Chip> : <Chip tone="warn">open demo mode</Chip>}. With keys enabled, your identity and role come from your key, not from what you type.</p>
          <label className="mt-5 block">
            <span className="text-[14px] font-semibold text-ink-2">X-API-Key · kept in this tab only (sessionStorage)</span>
            <div className="mt-2 flex gap-2">
              <input type="password" autoComplete="off" className="field" value={key} onChange={(e) => setKey(e.target.value)} placeholder="••••••••" />
              <button className="btn-primary" onClick={() => { setApiKey(key); qc.invalidateQueries(); }}>Save</button>
            </div>
          </label>
          <p className="mt-3 text-[14px]">
            {who.error ? <span className="text-bad">Key check: {errorText(who.error)}</span>
              : who.data && <span className="text-ok">Access OK. Signers: {who.data.signers.join(", ")} · verifiers: {who.data.verifiers.join(", ")} · honeypots: {who.data.honeypots}</span>}
          </p>
        </Card>
        <Card title="Endpoints" sub="VITE_API_URL · VITE_OPS_URL" icon={Server}>
          <KeyVal cols={2} items={[
            ["Trust kernel", <span className="break-all" key="a">{API_URL}</span>], ["Kernel status", health.data ? `${health.data.status} · ${health.data.backend} · ${health.data.profile}` : health.error ? "offline" : "…"],
            ["Advisory AI", <span className="break-all" key="o">{OPS_URL}</span>], ["AI status", ops.data ? `${ops.data.status} · copilot ${ops.data.copilot}` : ops.error ? "offline" : "…"],
            ["Post-quantum", health.data ? `ML-DSA ${health.data.pqc} · KEM ${health.data.kem}` : "–"], ["Telemetry mirror", health.data?.telemetry_mirror ?? "–"],
          ]} />
          <p className="mt-4 text-[13px] text-ink-3">Change them in web/.env (see .env.example). The public image serves both under /api and /ops on one origin.</p>
        </Card>
        <Card title="Offline replay" sub="session recorder" icon={Upload}>
          <p className="text-[15px] text-ink-2">Record a live session with the ● button in the top bar, save it, and replay it here with no backend. Presenter Mode re-runs its steps from the recording.</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button className="btn-ghost" onClick={() => file.current?.click()}><Upload size={16} />Load recording…</button>
            <input ref={file} type="file" accept="application/json" hidden onChange={(e) => { void loadFile(e.target.files?.[0]); e.target.value = ""; }} />
            {replay && <button className="btn-ghost" onClick={stopReplay}><CircleStop size={16} />Exit replay</button>}
            {replay && <Chip tone="info" dot>replaying</Chip>}
          </div>
          {fileError && <p className="mt-2 text-[14px] text-bad">{fileError}</p>}
        </Card>
        <Card title="Appearance & documents" icon={BookOpen}>
          <div className="flex flex-wrap gap-2">
            <button className={theme === "light" ? "btn-primary" : "btn-ghost"} onClick={() => setTheme("light")}><Sun size={16} />Light</button>
            <button className={theme === "dark" ? "btn-primary" : "btn-ghost"} onClick={() => setTheme("dark")}><Moon size={16} />Dark</button>
          </div>
          <div className="mt-5 flex flex-wrap gap-4 text-[15px]">
            <Link className="link" to={to("report")}>Security report →</Link>
            <Link className="link" to={to("verdicts")}>Print a verdict certificate →</Link>
            <a className="link" href={`${API_URL}/docs`} target="_blank" rel="noreferrer">API docs (OpenAPI) →</a>
          </div>
        </Card>
      </div>
    </div>
  );
}
