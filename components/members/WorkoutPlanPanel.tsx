"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, Play, Square } from "lucide-react";
import { PortalBackButton } from "@/components/members/PortalBackButton";
import { restSecondsFromLabel } from "@/lib/member-portal/workout-programs";

type LevelId = "beginner" | "intermediate" | "advanced";

type Exercise = {
  exerciseKey: string;
  name: string;
  muscle: string;
  setsReps: string;
  rest: string;
};

type Day = {
  dayId: string;
  dayNumber: number;
  label: string;
  restDay?: boolean;
  exercises: Exercise[];
};

type Program = {
  level: LevelId;
  title: string;
  subtitle: string;
  days: Day[];
  progression: Array<{
    week: number;
    focus: string;
    setsReps: string;
    rpe: string;
    load: string;
    cardio: string;
  }>;
  trainerNote: string;
};

type Completions = Record<
  string,
  { dayId: string; exercisesDone: string[]; dayComplete: boolean }
>;

type Payload = {
  ok?: boolean;
  eligible: boolean;
  reason?: string | null;
  member?: { name: string; trainerLabel: string };
  levels?: Array<{ id: LevelId; title: string; subtitle: string }>;
  activeLevel?: LevelId | null;
  program?: Program | null;
  progress?: { startedAt?: string | null; currentWeek?: number; completions?: Completions };
  today?: string;
};

async function callApi(init?: RequestInit): Promise<Payload> {
  const res = await fetch("/api/member/workout-plan", {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    credentials: "include",
  });
  const data = (await res.json().catch(() => ({}))) as Payload & { error?: string; message?: string };
  if (!res.ok || data.ok === false) {
    throw new Error(data.message || data.error || `Request failed (${res.status})`);
  }
  return data;
}

export function WorkoutPlanPanel({ onBack }: { onBack: () => void }) {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [tab, setTab] = useState<"workout" | "progression" | "note">("workout");
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [videoName, setVideoName] = useState<string | null>(null);
  const [timerKey, setTimerKey] = useState<string | null>(null);
  const [timerLeft, setTimerLeft] = useState(0);
  const [timerOn, setTimerOn] = useState(false);

  const refresh = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const next = await callApi();
      setData(next);
      const first = next.program?.days.find((d) => !d.restDay)?.dayId;
      setOpenDay((prev) => prev || first || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load Workout Plan");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!timerOn || timerLeft <= 0) return;
    const id = window.setInterval(() => {
      setTimerLeft((s) => {
        if (s <= 1) {
          setTimerOn(false);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [timerOn, timerLeft]);

  const today = data?.today || "";
  const completions = data?.progress?.completions || {};
  const todayRow = completions[today];

  const save = async (body: Record<string, unknown>) => {
    const next = await callApi({ method: "POST", body: JSON.stringify(body) });
    setData((prev) => ({ ...(prev || { eligible: true }), ...next, eligible: true }));
  };

  const clock = useMemo(() => {
    const m = Math.floor(timerLeft / 60);
    const s = timerLeft % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }, [timerLeft]);

  return (
    <section className="space-y-4">
      <PortalBackButton onClick={onBack} />
      <div>
        <p className="text-[11px] uppercase tracking-[0.18em] text-gold/80">Training</p>
        <h2 className="font-display text-2xl text-white">Workout Plan</h2>
        <p className="mt-1 text-xs text-muted">
          Member: {data?.member?.name || "—"} · Trainer: {data?.member?.trainerLabel || "Self"}
        </p>
      </div>

      {error ? (
        <p className="rounded-xl border border-rose-500/30 bg-rose-950/40 px-3 py-2 text-sm text-rose-100">
          {error}
        </p>
      ) : null}
      {busy && !data ? <p className="text-sm text-muted">Loading your program…</p> : null}

      {data && !data.eligible ? (
        <p className="text-sm text-muted">
          Workout Plan is not available on this membership yet.
        </p>
      ) : null}

      {data?.eligible && !data.program ? (
        <div className="space-y-3">
          <p className="text-sm text-white/80">Choose your 12-week program</p>
          {(data.levels || []).map((level) => (
            <button
              key={level.id}
              type="button"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                void save({ action: "level", level: level.id }).finally(() => setBusy(false));
              }}
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-left hover:border-gold/40"
            >
              <p className="font-display text-lg uppercase tracking-wide text-gold">{level.title}</p>
              <p className="mt-1 text-xs text-muted">{level.subtitle}</p>
            </button>
          ))}
        </div>
      ) : null}

      {data?.program ? (
        <>
          <div className="flex gap-1 rounded-2xl border border-white/10 bg-black/20 p-1 text-xs">
            {(
              [
                ["workout", "Workout"],
                ["progression", "12-week"],
                ["note", "Note"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={
                  tab === id
                    ? "flex-1 rounded-xl bg-gold/20 px-2 py-2 font-medium text-gold"
                    : "flex-1 rounded-xl px-2 py-2 text-muted"
                }
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "workout" ? (
            <div className="space-y-2">
              {data.program.days.map((day) => {
                const open = openDay === day.dayId;
                const complete = todayRow?.dayId === day.dayId && todayRow.dayComplete;
                const doneSet = new Set(
                  todayRow?.dayId === day.dayId ? todayRow.exercisesDone : [],
                );
                return (
                  <div
                    key={day.dayId}
                    className={`overflow-hidden rounded-2xl border ${
                      complete ? "border-emerald-400/50 bg-emerald-950/30" : "border-white/10 bg-white/5"
                    }`}
                  >
                    <button
                      type="button"
                      className="flex w-full items-center justify-between px-3 py-3 text-left"
                      onClick={() => setOpenDay(open ? null : day.dayId)}
                    >
                      <span className="flex items-center gap-2 text-sm text-white">
                        {complete ? <Check size={16} className="text-emerald-400" /> : null}
                        Day {day.dayNumber} · {day.label}
                        {day.restDay ? <span className="text-xs text-muted"> (rest)</span> : null}
                      </span>
                      <ChevronDown
                        size={16}
                        className={open ? "rotate-180 text-muted" : "text-muted"}
                      />
                    </button>
                    {open && day.restDay ? (
                      <p className="border-t border-white/10 px-3 py-3 text-sm text-muted">
                        Rest day. Walk, mobility, or skip the gym.
                      </p>
                    ) : null}
                    {open && !day.restDay ? (
                      <div className="space-y-2 border-t border-white/10 px-3 py-3">
                        {day.exercises.map((ex) => {
                          const done = doneSet.has(ex.exerciseKey);
                          const timing = timerKey === ex.exerciseKey;
                          return (
                            <div
                              key={ex.exerciseKey}
                              className="rounded-xl border border-white/10 bg-black/20 px-3 py-2"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="text-sm font-medium text-white">{ex.name}</p>
                                  <p className="text-[11px] text-muted">
                                    {ex.muscle} · {ex.setsReps} · Rest {ex.rest}
                                  </p>
                                </div>
                                {done ? <Check size={16} className="text-emerald-400" /> : null}
                              </div>
                              <div className="mt-2 flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-2 py-1 text-[11px] text-white/90"
                                  onClick={() => setVideoName(ex.name)}
                                >
                                  <Play size={12} /> Video
                                </button>
                                <button
                                  type="button"
                                  className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-2 py-1 text-[11px] text-white/90"
                                  onClick={() => {
                                    if (timing && timerOn) setTimerOn(false);
                                    else {
                                      setTimerKey(ex.exerciseKey);
                                      setTimerLeft(restSecondsFromLabel(ex.rest));
                                      setTimerOn(true);
                                    }
                                  }}
                                >
                                  {timing && timerOn ? <Square size={12} /> : <Play size={12} />}
                                  {timing ? clock : "Timer"}
                                </button>
                                {!done ? (
                                  <button
                                    type="button"
                                    className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/40 px-2 py-1 text-[11px] text-emerald-200"
                                    onClick={() =>
                                      void save({
                                        action: "progress",
                                        dayId: day.dayId,
                                        exerciseKey: ex.exerciseKey,
                                        date: today,
                                      })
                                    }
                                  >
                                    <Check size={12} /> Done
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                        {!complete ? (
                          <button
                            type="button"
                            onClick={() =>
                              void save({
                                action: "progress",
                                dayId: day.dayId,
                                date: today,
                                dayComplete: true,
                              })
                            }
                            className="w-full rounded-xl bg-emerald-700/80 py-2 text-sm font-medium text-white"
                          >
                            Mark day complete
                          </button>
                        ) : (
                          <p className="text-center text-xs text-emerald-300">
                            Day complete — ticked green
                          </p>
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}

          {tab === "progression" ? (
            <div className="overflow-x-auto rounded-2xl border border-white/10">
              <table className="w-full min-w-[520px] text-left text-[11px] text-white/90">
                <thead className="bg-white/5 text-muted">
                  <tr>
                    <th className="px-2 py-2">Wk</th>
                    <th className="px-2 py-2">Focus</th>
                    <th className="px-2 py-2">Sets/Reps</th>
                    <th className="px-2 py-2">RPE</th>
                    <th className="px-2 py-2">Load</th>
                    <th className="px-2 py-2">Cardio</th>
                  </tr>
                </thead>
                <tbody>
                  {data.program.progression.map((row) => (
                    <tr key={row.week} className="border-t border-white/10">
                      <td className="px-2 py-2">{row.week}</td>
                      <td className="px-2 py-2">{row.focus}</td>
                      <td className="px-2 py-2">{row.setsReps}</td>
                      <td className="px-2 py-2">{row.rpe}</td>
                      <td className="px-2 py-2">{row.load}</td>
                      <td className="px-2 py-2">{row.cardio}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {tab === "note" ? (
            <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm leading-relaxed text-white/80">
              {data.program.trainerNote}
            </p>
          ) : null}
        </>
      ) : null}

      {videoName ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl border border-white/15 bg-charcoal p-4">
            <p className="font-medium text-white">{videoName}</p>
            <p className="mt-3 text-sm text-muted">
              Demo video is not mapped yet. Timer and Done still work — the workout is not blocked.
            </p>
            <button
              type="button"
              className="mt-4 w-full rounded-xl border border-white/15 py-2 text-sm text-white"
              onClick={() => setVideoName(null)}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
