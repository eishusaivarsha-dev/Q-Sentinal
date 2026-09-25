import { useEffect, useState } from "react";
import { api, type AttackRun } from "../api";

// The demo "attack-strength slider": pick an attack, drag strength, watch the detectors fire.
export default function AttackPanel({ onResult }: { onResult: (r: AttackRun) => void }) {
  const [attacks, setAttacks] = useState<{ name: string }[]>([]);
  const [attack, setAttack] = useState("intercept_resend");
  const [strength, setStrength] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.attacks().then(setAttacks).catch(() => setAttacks([]));
  }, []);

  async function run(name = attack) {
    setBusy(true);
    setError(null);
    try {
      onResult(await api.runAttack(name, strength));
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3">
      <h2 className="font-medium">Attack simulator</h2>
      <select
        className="w-full rounded-md bg-slate-800 p-2"
        value={attack}
        onChange={(e) => setAttack(e.target.value)}
      >
        {attacks.map((a) => (
          <option key={a.name} value={a.name}>
            {a.name}
          </option>
        ))}
      </select>
      <label className="block text-sm text-slate-300">
        Adversary strength: {(strength * 100).toFixed(0)}%
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={strength}
          onChange={(e) => setStrength(Number(e.target.value))}
          className="w-full"
        />
      </label>
      <div className="flex gap-2">
        <button
          className="flex-1 rounded-md bg-rose-600 px-3 py-2 font-medium disabled:opacity-50"
          disabled={busy}
          onClick={() => run()}
        >
          Launch attack
        </button>
        <button
          className="flex-1 rounded-md bg-emerald-700 px-3 py-2 font-medium disabled:opacity-50"
          disabled={busy}
          onClick={() => run("honest")}
        >
          Honest signature
        </button>
      </div>
      {error && <p className="text-sm text-rose-400">{error}</p>}
    </section>
  );
}
