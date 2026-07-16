import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Delete } from "lucide-react";

export const Route = createFileRoute("/calculator")({
  component: CalculatorPage,
  head: () => ({ meta: [{ title: "Calculator — Divakar Tea Shop" }] }),
});

const KEYS: (string | { label: string; kind: "op" | "eq" | "clear" | "del" })[] = [
  "7", "8", "9", { label: "÷", kind: "op" },
  "4", "5", "6", { label: "×", kind: "op" },
  "1", "2", "3", { label: "−", kind: "op" },
  { label: "C", kind: "clear" }, "0", ".", { label: "+", kind: "op" },
];

function CalculatorPage() {
  const [expr, setExpr] = useState("");
  const [result, setResult] = useState("0");

  const evalExpr = (e: string) => {
    try {
      const cleaned = e.replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-");
      if (!cleaned) return "0";
      // eslint-disable-next-line no-new-func
      const v = Function(`"use strict";return (${cleaned})`)();
      return String(Math.round(Number(v) * 100) / 100);
    } catch {
      return result;
    }
  };

  const push = (s: string) => {
    const next = expr + s;
    setExpr(next);
    setResult(evalExpr(next));
  };

  return (
    <AppShell title="Calculator" subtitle="Quick counter math" showFab={false}>
      <div className="glass p-6">
        <p className="min-h-6 text-right text-sm text-muted-foreground break-all">{expr || " "}</p>
        <p className="mono-amount mt-2 text-right text-5xl text-secondary">{result}</p>
      </div>

      <div className="mt-5 grid grid-cols-4 gap-3">
        {KEYS.map((k, i) => {
          if (typeof k === "string") {
            return (
              <button
                key={i}
                type="button"
                onClick={() => push(k)}
                className="press pill h-16 bg-card text-xl font-semibold text-foreground shadow-[var(--shadow-soft)]"
              >
                {k}
              </button>
            );
          }
          const styles =
            k.kind === "op"
              ? "gradient-warm text-primary-foreground"
              : k.kind === "clear"
              ? "bg-secondary text-secondary-foreground"
              : "bg-card text-foreground";
          return (
            <button
              key={i}
              type="button"
              onClick={() => {
                if (k.kind === "clear") { setExpr(""); setResult("0"); return; }
                if (k.kind === "op") push(k.label);
              }}
              className={`press pill h-16 text-xl font-bold shadow-[var(--shadow-soft)] ${styles}`}
            >
              {k.label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setExpr((e) => e.slice(0, -1))}
          className="press pill col-span-2 h-14 border border-border bg-card text-sm font-semibold"
        >
          <Delete className="mx-auto h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => { const v = evalExpr(expr); setExpr(v); setResult(v); }}
          className="press pill col-span-2 h-14 gradient-warm text-lg font-bold"
        >
          =
        </button>
      </div>
    </AppShell>
  );
}
