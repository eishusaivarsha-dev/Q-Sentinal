import type { AttackInfo } from "@/api/types";
import { attackCopy, attacksForClass, DETECTOR_IDS } from "@/lib/attribution";

/**
 * Field guide: which detectors the backend declares for each attack (GET /attacks). Rows matching
 * the current incident's class are lit and the detectors that actually fired are underlined, so an
 * analyst can name the attack at a glance.
 */
export function SignatureMatrix({ attacks, classLabel, fired }: { attacks: AttackInfo[]; classLabel?: string; fired: Set<string> }) {
  const hot = new Set(classLabel ? attacksForClass(classLabel) : []);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] border-separate border-spacing-0 text-[11.5px]">
        <thead>
          <tr>
            <th className="label py-1.5 pr-2 text-left font-normal">Attack</th>
            {DETECTOR_IDS.map((d) => (
              <th key={d} className={`data w-10 py-1.5 text-center font-normal ${fired.has(d) ? "text-reject" : "text-paper-faint"}`}>
                {d}{fired.has(d) && <div className="mx-auto mt-0.5 h-[2px] w-5 bg-reject" />}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {attacks.filter((a) => a.name !== "honest").map((a) => {
            const on = hot.has(a.name);
            const copy = attackCopy(a.name);
            return (
              <tr key={a.name} className={on ? "bg-reject/15" : ""}>
                <td className={`border-t border-amber/10 py-1.5 pr-2 ${on ? "text-reject" : "text-paper-dim"}`} title={copy.oneLiner}>
                  <span className="data mr-2 text-[10px] text-paper-mute">{copy.code}</span>{copy.label}{on && " ◀"}
                </td>
                {DETECTOR_IDS.map((d) => (
                  <td key={d} className="border-t border-amber/10 text-center">
                    {a.detectors.includes(d)
                      ? <span className={`inline-block h-2.5 w-2.5 rounded-full ${on ? "bg-reject shadow-[0_0_8px_#e0513a]" : "bg-amber/60"}`} />
                      : <span className="text-paper-mute">·</span>}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
