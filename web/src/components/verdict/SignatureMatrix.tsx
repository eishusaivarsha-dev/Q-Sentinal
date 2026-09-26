import type { AttackInfo } from "@/api/types";
import { attackCopy, attacksForClass, DETECTOR_IDS } from "@/lib/attribution";
import { cn } from "@/lib/cn";

/**
 * Field guide: which detectors the backend declares for each attack (GET /attacks). Rows matching
 * the current incident's class are lit and the detectors that actually fired are marked.
 */
export default function SignatureMatrix({ attacks, classLabel, fired }: { attacks: AttackInfo[]; classLabel?: string; fired: Set<string> }) {
  const hot = new Set(classLabel ? attacksForClass(classLabel) : []);
  return (
    <div className="overflow-x-auto" data-lenis-prevent>
      <table className="w-full min-w-[480px] border-separate border-spacing-0 text-[14px]">
        <thead>
          <tr>
            <th className="label pb-2 pr-3 text-left !text-[12px]">Attack</th>
            {DETECTOR_IDS.map((d) => (
              <th key={d} className={cn("data w-12 pb-2 text-center text-[13px] font-semibold", fired.has(d) ? "text-bad" : "text-ink-3")}>{d}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {attacks.filter((a) => a.name !== "honest").map((a) => {
            const on = hot.has(a.name);
            const copy = attackCopy(a.name);
            return (
              <tr key={a.name} className={cn("transition-colors", on && "bg-bad/8")}>
                <td className={cn("border-t border-line py-2 pr-3", on ? "font-semibold text-bad" : "text-ink-2")} title={copy.oneLiner}>
                  <span className="data mr-2 text-[12px] text-ink-3">{copy.code}</span>{copy.label}
                </td>
                {DETECTOR_IDS.map((d) => (
                  <td key={d} className="border-t border-line text-center">
                    {a.detectors.includes(d)
                      ? <span className={cn("inline-block h-3 w-3 rounded-full", on ? "bg-bad shadow-[0_0_10px_rgb(var(--bad))]" : "bg-brand/60")} />
                      : <span className="text-line-2">·</span>}
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
