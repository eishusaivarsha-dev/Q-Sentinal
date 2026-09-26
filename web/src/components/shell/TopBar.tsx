import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useHealth } from "@/api/hooks";
import { downloadJson, useSession } from "@/state/session";
import { stopReplay, useTelemetry } from "@/state/telemetry";
import { useUi } from "@/state/ui";
import { CipherWheel } from "../art/CipherWheel";
import { Lamp } from "../art/Instruments";
import { AiBadge, Chip } from "./primitives";

function Clock() {
  const [t, setT] = useState(() => new Date());
  useEffect(() => {
    const i = setInterval(() => setT(new Date()), 1000);
    return () => clearInterval(i);
  }, []);
  return <span className="data phosphor text-[13px]">{t.toLocaleTimeString("en-GB", { hour12: false })}</span>;
}

const LAMP = { live: "#a9c46c", connecting: "#ffc15e", down: "#e0513a", replay: "#7fb8a4" } as const;

export function TopBar() {
  const health = useHealth();
  const status = useTelemetry((s) => s.status);
  const { recording, replay, start, stop } = useSession();
  const openPresenter = useUi((s) => s.openPresenter);
  const setMenu = useUi((s) => s.setMenu);
  const h = health.data;

  return (
    <header className="no-print sticky top-0 z-40 border-b hair bg-ink/85 backdrop-blur-md">
      <div className="flex h-14 items-center gap-3 px-3 md:px-5">
        <button className="btn-ghost !px-2.5 !py-1.5 lg:hidden" onClick={() => setMenu(true)} aria-label="Open navigation">☰</button>
        <Link to="/" className="flex min-w-0 items-center gap-3">
          <CipherWheel size={34} quantum={0.9} />
          <div className="hidden min-w-0 leading-tight sm:block">
            <div className="truncate font-display text-[17px] text-paper">Q-SENTINEL <span className="text-paper-faint">Trust Console</span></div>
            <div className="label !text-[9px] !tracking-[.28em]">Bureau of Quantum Signatures · L5 operations plane</div>
          </div>
        </Link>

        <div className="ml-auto hidden min-w-0 items-center gap-3 xl:flex">
          <div className="plate-dark"><Lamp on color={LAMP[status]} size={12} pulse={status === "connecting"} /> Telemetry <span className="text-paper">{status}</span></div>
          {h ? (
            <div className="plate-dark hidden min-w-0 2xl:inline-flex" title={`ML-DSA ${h.pqc} · ${h.kem}`}>
              <span className="truncate normal-case tracking-normal">{h.backend} · {h.basis_set} · L={h.hash_bits} n={h.rounds_per_bit} · τ {h.tau}/{h.tau_transfer}</span>
            </div>
          ) : !replay && <Chip tone="bad">API offline</Chip>}
          {h?.auth === "dev-open" && <Chip tone="warn" title="QSENTINEL_API_KEYS not set: every request acts as admin">Dev mode</Chip>}
          {replay && <Chip tone="info">Replay</Chip>}
          <div className="plate-dark"><Clock /></div>
        </div>

        <div className="ml-auto flex items-center gap-2 xl:ml-2">
          <span className="xl:hidden"><Lamp on color={LAMP[status]} size={14} /></span>
          {replay ? (
            <button className="btn-ghost hidden !px-3 !py-1.5 md:inline-flex" onClick={stopReplay}>⏏ Exit replay</button>
          ) : (
            <button
              className={`btn-ghost hidden !px-3 !py-1.5 md:inline-flex ${recording ? "!border-reject !text-reject" : ""}`}
              onClick={() => (recording ? downloadJson(`qsentinel-session-${Date.now()}.json`, stop()) : start())}
              title="Record every API response and telemetry event for offline replay"
            >
              <span className={`inline-block h-2 w-2 rounded-full ${recording ? "animate-flicker bg-reject" : "bg-paper-faint"}`} />
              {recording ? "Stop & save" : "Rec"}
            </button>
          )}
          <button className="btn-ghost hidden !px-3 !py-1.5 sm:inline-flex" onClick={openPresenter}>▶ Present</button>
          <AiBadge />
        </div>
      </div>
    </header>
  );
}
