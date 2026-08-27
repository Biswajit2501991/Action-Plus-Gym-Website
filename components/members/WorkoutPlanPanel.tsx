"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Pause, Play, RotateCcw, X } from "lucide-react";
import {
  PortalBackButton,
  PORTAL_BACK_BUTTON_CLASS,
} from "@/components/members/PortalBackButton";
import { restSecondsFromLabel } from "@/lib/member-portal/workout-programs";
import {
  peekWorkoutPlanCache,
  readWorkoutPlanCache,
  WORKOUT_PLAN_SOFT_TTL_MS,
  writeWorkoutPlanCache,
} from "@/lib/member-portal/panel-cache";
import {
  completedDayIdsInWeek,
  lastWeekMotivationMessage,
  thisWeekAimMessage,
  weekRowForDay,
  weekWindows,
} from "@/lib/member-portal/workout-plan-week";

type LevelId = "beginner" | "intermediate" | "advanced";

type Exercise = {
  exerciseKey: string;
  name: string;
  muscle: string;
  setsReps: string;
  rest: string;
  mp4Url?: string | null;
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
  videos?: Record<string, string>;
  program?: Program | null;
  progress?: { startedAt?: string | null; currentWeek?: number; completions?: Completions };
  today?: string;
  action?: string;
};

function resolveExerciseVideoUrl(
  exercise: Exercise,
  videos?: Record<string, string> | null,
) {
  const direct = String(exercise.mp4Url || "").trim();
  if (direct) return direct;
  if (!videos) return null;
  const nameKey = exercise.name.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return (
    videos[exercise.exerciseKey] ||
    videos[exercise.name] ||
    videos[nameKey] ||
    null
  );
}

async function callApi(init?: RequestInit): Promise<Payload> {
  const res = await fetch("/api/member/workout-plan", {
    ...init,
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    credentials: "include",
  });
  const data = (await res.json().catch(() => ({}))) as Payload & { error?: string; message?: string };
  if (!res.ok || data.ok === false) {
    throw new Error(data.message || data.error || `Request failed (${res.status})`);
  }
  return data;
}

export function WorkoutPlanPanel({
  onBack,
  memberUuid = "",
}: {
  onBack: () => void;
  memberUuid?: string;
}) {
  const [data, setData] = useState<Payload | null>(() => {
    const cached = readWorkoutPlanCache<Payload>(memberUuid);
    return cached && typeof cached === "object" ? cached : null;
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(() => !readWorkoutPlanCache<Payload>(memberUuid));
  const [pickingLevel, setPickingLevel] = useState(false);
  const [tab, setTab] = useState<"workout" | "progression" | "note">("workout");
  const [openDay, setOpenDay] = useState<string | null>(() => {
    const cached = readWorkoutPlanCache<Payload>(memberUuid);
    return cached?.program?.days.find((d) => !d.restDay)?.dayId || null;
  });
  const [video, setVideo] = useState<{ name: string; url: string | null } | null>(null);
  const [timerOpen, setTimerOpen] = useState(false);
  const [timerKey, setTimerKey] = useState<string | null>(null);
  const [timerName, setTimerName] = useState("");
  const [timerTotal, setTimerTotal] = useState(60);
  const [timerLeft, setTimerLeft] = useState(0);
  const [timerOn, setTimerOn] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const closeTimer = useCallback(() => {
    setTimerOn(false);
    setTimerOpen(false);
    setTimerKey(null);
    setTimerLeft(0);
  }, []);

  const closeVideo = useCallback(() => {
    const el = videoRef.current;
    if (el) {
      el.pause();
      el.removeAttribute("src");
      el.load();
    }
    setVideo(null);
    // Closing the main video popup also stops the timer (combined session).
    setTimerOn(false);
    setTimerOpen(false);
    setTimerKey(null);
    setTimerLeft(0);
  }, []);

  const startTimerForExercise = useCallback((ex: Exercise) => {
    const total = restSecondsFromLabel(ex.rest);
    setTimerKey(ex.exerciseKey);
    setTimerName(ex.name);
    setTimerTotal(total);
    setTimerLeft(total);
    setTimerOn(true);
    setTimerOpen(true);
  }, []);

  /** Timer alone — closes any open video so only the timer popup shows. */
  const openTimer = useCallback(
    (ex: Exercise) => {
      const el = videoRef.current;
      if (el) {
        el.pause();
        el.removeAttribute("src");
        el.load();
      }
      setVideo(null);
      startTimerForExercise(ex);
    },
    [startTimerForExercise],
  );

  /** Video opens combined popup and auto-starts the rest timer on top. */
  const openVideoWithTimer = useCallback(
    (ex: Exercise) => {
      setVideo({
        name: ex.name,
        url: resolveExerciseVideoUrl(ex, data?.videos),
      });
      startTimerForExercise(ex);
    },
    [data?.videos, startTimerForExercise],
  );

  useEffect(() => {
    if (!video && !timerOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // Combined session: Escape closes everything.
      if (video) {
        closeVideo();
        return;
      }
      if (timerOpen) closeTimer();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [video, timerOpen, closeVideo, closeTimer]);

  const applyPayload = useCallback(
    (next: Payload) => {
      setData(next);
      writeWorkoutPlanCache(memberUuid, next);
      const first = next.program?.days.find((d) => !d.restDay)?.dayId;
      setOpenDay((prev) => prev || first || null);
      setError(null);
      setBusy(false);
    },
    [memberUuid],
  );

  const refresh = useCallback(
    async (opts?: { force?: boolean }) => {
      const force = opts?.force === true;
      if (!force) {
        const peek = peekWorkoutPlanCache<Payload>(memberUuid);
        // Never reuse a cached ineligible payload — staff may have just enabled this member.
        if (
          peek &&
          peek.ageMs < WORKOUT_PLAN_SOFT_TTL_MS &&
          peek.data.eligible !== false
        ) {
          applyPayload(peek.data);
          return peek.data;
        }
      }
      if (!readWorkoutPlanCache<Payload>(memberUuid)) setBusy(true);
      setError(null);
      try {
        const next = await callApi();
        if (next.eligible !== false) {
          applyPayload(next);
        } else {
          setData(next);
          setError(null);
          setBusy(false);
        }
        return next;
      } catch (err) {
        if (!readWorkoutPlanCache<Payload>(memberUuid)) {
          setError(err instanceof Error ? err.message : "Could not load Workout Plan");
        }
        setBusy(false);
        throw err;
      }
    },
    [applyPayload, memberUuid],
  );

  useEffect(() => {
    let cancelled = false;
    const cached = readWorkoutPlanCache<Payload>(memberUuid);
    if (cached && cached.eligible !== false) applyPayload(cached);

    const pull = (force: boolean) => {
      void refresh({ force }).catch(() => {
        if (cancelled) return;
      });
    };

    // Always re-check eligibility on open (esp. after staff toggles per-member access).
    pull(!cached || cached.eligible === false);
    const onVisible = () => {
      if (document.visibilityState === "visible") pull(false);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh, memberUuid, applyPayload]);

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

  const weekMeta = useMemo(() => {
    if (!today || !data?.program) {
      return {
        weekCompleteIds: new Set<string>(),
        motivation: null as string | null,
        thisWeekAim: null as string | null,
      };
    }
    const { thisWeek, lastWeek } = weekWindows(today);
    const weekCompleteIds = completedDayIdsInWeek(completions, thisWeek);
    const planned = data.program.days.filter((d) => !d.restDay).length;
    const lastDoneIds = completedDayIdsInWeek(completions, lastWeek);
    const hadActivityLastWeek = lastWeek.some((date) => Boolean(completions[date]));
    const motivation = lastWeekMotivationMessage({
      plannedWorkDays: planned,
      completedLastWeek: lastDoneIds.size,
      hadActivityLastWeek,
    });
    return {
      weekCompleteIds,
      motivation,
      thisWeekAim: thisWeekAimMessage(planned),
      thisWeek,
    };
  }, [completions, data?.program, today]);

  const save = async (body: Record<string, unknown>) => {
    const next = await callApi({ method: "POST", body: JSON.stringify(body) });
    const merged: Payload = {
      ...(data || { eligible: true }),
      ...next,
      eligible: true,
      // Slim progress responses omit program/videos — keep current UI payload.
      program: next.program ?? data?.program ?? null,
      videos: next.videos ?? data?.videos,
      member: next.member ?? data?.member,
      levels: next.levels ?? data?.levels,
    };
    applyPayload(merged);
    return merged;
  };

  /** Instant green tick; persist in background; roll back if save fails. */
  const markProgress = async (input: {
    dayId: string;
    exerciseKey?: string;
    date: string;
    dayComplete?: boolean;
  }) => {
    const snapshot = data;
    if (!snapshot?.program) {
      await save({ action: "progress", ...input });
      return;
    }
    const day = snapshot.program.days.find((d) => d.dayId === input.dayId);
    if (!day || day.restDay) return;

    const date = input.date;
    const prevRow = snapshot.progress?.completions?.[date];
    const done = new Set(prevRow?.dayId === input.dayId ? prevRow.exercisesDone : []);
    if (input.exerciseKey) done.add(input.exerciseKey);
    const allKeys = day.exercises.map((ex) => ex.exerciseKey);
    const dayComplete =
      input.dayComplete === true ||
      (allKeys.length > 0 && allKeys.every((key) => done.has(key)));

    const optimistic: Payload = {
      ...snapshot,
      progress: {
        startedAt: snapshot.progress?.startedAt ?? null,
        currentWeek: snapshot.progress?.currentWeek ?? 1,
        completions: {
          ...(snapshot.progress?.completions || {}),
          [date]: {
            dayId: input.dayId,
            exercisesDone: [...done],
            dayComplete,
          },
        },
      },
    };
    applyPayload(optimistic);
    setError(null);

    try {
      const next = await callApi({
        method: "POST",
        body: JSON.stringify({ action: "progress", ...input }),
      });
      applyPayload({
        ...optimistic,
        activeLevel: next.activeLevel ?? optimistic.activeLevel,
        progress: next.progress || optimistic.progress,
        today: next.today || optimistic.today,
        program: next.program ?? optimistic.program,
        videos: next.videos ?? optimistic.videos,
        eligible: true,
      });
    } catch (err) {
      applyPayload(snapshot);
      setError(err instanceof Error ? err.message : "Could not save progress");
    }
  };

  const selectLevel = async (levelId: LevelId) => {
    const current = data?.activeLevel || data?.program?.level || null;
    const levels = data?.levels || [];
    const nextLabel =
      levels.find((l) => l.id === levelId)?.title || levelId;
    const currentLabel =
      levels.find((l) => l.id === current)?.title || current || "";

    if (pickingLevel && current === levelId) {
      setPickingLevel(false);
      return;
    }

    if (pickingLevel && current && current !== levelId) {
      const ok = window.confirm(
        `Switch from ${currentLabel} to ${nextLabel}?\n\nYour exercise list will change. Saved ticks stay — nothing is deleted.`,
      );
      if (!ok) return;
    }

    setBusy(true);
    setError(null);
    try {
      const next = await save({ action: "level", level: levelId });
      const first =
        next.program?.days.find((d) => !d.restDay)?.dayId ||
        next.program?.days[0]?.dayId ||
        null;
      setOpenDay(first);
      setTab("workout");
      setPickingLevel(false);
      closeVideo();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change program");
    } finally {
      setBusy(false);
    }
  };

  const clock = useMemo(() => {
    const m = Math.floor(timerLeft / 60);
    const s = timerLeft % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }, [timerLeft]);

  const showLevelPicker = Boolean(data?.eligible && (!data.program || pickingLevel));
  const showProgram = Boolean(data?.program && !pickingLevel);
  const activeLevelId = data?.activeLevel || data?.program?.level || null;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <PortalBackButton
          onClick={() => {
            if (pickingLevel && data?.program) {
              setPickingLevel(false);
              return;
            }
            onBack();
          }}
        />
        {showProgram ? (
          <button
            type="button"
            className={PORTAL_BACK_BUTTON_CLASS}
            disabled={busy}
            onClick={() => setPickingLevel(true)}
          >
            Change program
          </button>
        ) : null}
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.18em] text-gold/80">Training</p>
          <h2 className="font-display text-2xl text-white">Workout Plan</h2>
          <p className="mt-1 text-xs text-muted">
            Member: {data?.member?.name || "—"} · Trainer: {data?.member?.trainerLabel || "Self"}
            {activeLevelId && showProgram
              ? ` · ${data?.program?.title || activeLevelId}`
              : null}
          </p>
        </div>
        {showProgram &&
        weekMeta.motivation &&
        weekMeta.motivation !== weekMeta.thisWeekAim ? (
          <p className="max-w-sm rounded-2xl border border-gold/30 bg-gold/10 px-3 py-2 text-xs leading-relaxed text-gold/95 sm:text-right">
            {weekMeta.motivation}
          </p>
        ) : null}
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

      {showLevelPicker ? (
        <div className="space-y-3">
          <p className="text-sm text-white/80">
            {pickingLevel ? "Choose a different 12-week program" : "Choose your 12-week program"}
          </p>
          {pickingLevel ? (
            <p className="text-xs text-muted">
              Switching only changes the exercise list. Your saved ticks are kept.
            </p>
          ) : null}
          {(data?.levels || []).map((level) => {
            const isCurrent = activeLevelId === level.id;
            return (
              <button
                key={level.id}
                type="button"
                disabled={busy}
                onClick={() => {
                  void selectLevel(level.id);
                }}
                className={`w-full rounded-2xl border px-4 py-4 text-left hover:border-gold/40 ${
                  isCurrent
                    ? "border-gold/45 bg-gold/10"
                    : "border-white/10 bg-white/5"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-display text-lg uppercase tracking-wide text-gold">
                    {level.title}
                  </p>
                  {isCurrent ? (
                    <span className="rounded-full border border-emerald-400/45 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-200">
                      Current
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-muted">{level.subtitle}</p>
              </button>
            );
          })}
          {pickingLevel && data?.program ? (
            <button
              type="button"
              disabled={busy}
              className="w-full rounded-full border border-white/15 px-4 py-2 text-sm text-white/80"
              onClick={() => setPickingLevel(false)}
            >
              Cancel
            </button>
          ) : null}
        </div>
      ) : null}

      {showProgram && data?.program ? (
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

          {tab === "workout" && weekMeta.thisWeekAim ? (
            <p className="text-sm leading-relaxed text-white/85">{weekMeta.thisWeekAim}</p>
          ) : null}

          {tab === "workout" ? (
            <div className="space-y-2">
              {data.program.days.map((day) => {
                const open = openDay === day.dayId;
                const weekDone = !day.restDay && weekMeta.weekCompleteIds.has(day.dayId);
                const weekRow =
                  weekRowForDay(
                    completions,
                    day.dayId,
                    weekMeta.thisWeek || [],
                    today,
                  ) || null;
                const todayMatch = todayRow?.dayId === day.dayId;
                const complete =
                  weekDone || (todayMatch && todayRow?.dayComplete === true);
                const doneSet = new Set(
                  todayMatch
                    ? todayRow?.exercisesDone || []
                    : weekRow?.exercisesDone || [],
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
                      <span
                        className={`flex items-center gap-2 text-sm ${
                          weekDone ? "font-semibold text-emerald-300" : "text-white"
                        }`}
                      >
                        {complete ? <Check size={16} className="text-emerald-400" /> : null}
                        <span>
                          <span className={weekDone ? "text-emerald-300" : undefined}>
                            Day {day.dayNumber}
                          </span>
                          {" · "}
                          {day.label}
                        </span>
                        {day.restDay ? <span className="text-xs text-muted"> (rest)</span> : null}
                        {weekDone ? (
                          <span className="rounded-full border border-emerald-400/40 bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-200">
                            This week
                          </span>
                        ) : null}
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
                                  onClick={() => openVideoWithTimer(ex)}
                                >
                                  <Play size={12} /> Video
                                </button>
                                <button
                                  type="button"
                                  className="inline-flex items-center gap-1 rounded-lg border border-gold/40 px-2 py-1 text-[11px] text-gold"
                                  onClick={() => openTimer(ex)}
                                >
                                  <Play size={12} /> Timer
                                </button>
                                {!done ? (
                                  <button
                                    type="button"
                                    className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/40 px-2 py-1 text-[11px] text-emerald-200"
                                    onClick={() =>
                                      void markProgress({
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
                              void markProgress({
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

      {video ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-4 sm:items-center"
          onClick={closeVideo}
          role="presentation"
        >
          <div
            className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/15 bg-charcoal p-3 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={video.name}
          >
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="truncate font-medium text-white">{video.name}</p>
              <button
                type="button"
                className="rounded-full border border-white/15 p-1.5 text-white/80"
                aria-label="Close video"
                onClick={closeVideo}
              >
                <X size={16} />
              </button>
            </div>

            {timerOpen ? (
              <div className="mb-3 rounded-2xl border border-gold/35 bg-black/45 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gold">
                    Rest timer
                  </p>
                  <button
                    type="button"
                    className="rounded-full border border-white/15 px-2 py-0.5 text-[11px] text-white/80"
                    aria-label="Close timer only"
                    onClick={closeTimer}
                  >
                    ✕ Close timer
                  </button>
                </div>
                <p
                  className={`text-center font-display text-5xl tracking-wide ${
                    timerLeft === 0 ? "text-emerald-300" : "text-gold"
                  }`}
                >
                  {clock}
                </p>
                <p className="mt-1 text-center text-[11px] text-muted">
                  {timerLeft === 0
                    ? "Rest complete"
                    : timerOn
                      ? "Running"
                      : "Paused"}
                  {" · "}
                  Target {Math.floor(timerTotal / 60)}:
                  {String(timerTotal % 60).padStart(2, "0")}
                </p>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {timerOn ? (
                    <button
                      type="button"
                      className="inline-flex items-center justify-center gap-1 rounded-full border border-white/20 bg-white/5 px-2 py-2 text-xs font-medium text-white"
                      onClick={() => setTimerOn(false)}
                    >
                      <Pause size={14} /> Pause
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="inline-flex items-center justify-center gap-1 rounded-full border border-gold/45 bg-gold/15 px-2 py-2 text-xs font-medium text-gold"
                      onClick={() => {
                        if (timerLeft <= 0) setTimerLeft(timerTotal);
                        setTimerOn(true);
                      }}
                    >
                      <Play size={14} /> Continue
                    </button>
                  )}
                  <button
                    type="button"
                    className="inline-flex items-center justify-center gap-1 rounded-full border border-white/20 bg-white/5 px-2 py-2 text-xs font-medium text-white"
                    onClick={() => {
                      setTimerLeft(timerTotal);
                      setTimerOn(true);
                    }}
                  >
                    <RotateCcw size={14} /> Restart
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center justify-center gap-1 rounded-full border border-white/20 bg-white/5 px-2 py-2 text-xs font-medium text-white/85"
                    onClick={closeTimer}
                  >
                    <X size={14} /> Hide
                  </button>
                </div>
              </div>
            ) : (
              <div className="mb-3 flex justify-end">
                <button
                  type="button"
                  className="rounded-full border border-gold/40 px-3 py-1 text-[11px] font-semibold text-gold"
                  onClick={() => {
                    if (timerLeft <= 0) setTimerLeft(timerTotal || 60);
                    if (!timerKey && video) {
                      setTimerName(video.name);
                    }
                    setTimerOn(true);
                    setTimerOpen(true);
                  }}
                >
                  Show timer
                </button>
              </div>
            )}

            {video.url ? (
              <div
                className="overflow-hidden rounded-xl bg-black"
                onClick={(e) => e.stopPropagation()}
              >
                <video
                  ref={videoRef}
                  key={video.url}
                  src={video.url}
                  controls
                  playsInline
                  preload="metadata"
                  className="max-h-[55vh] min-h-[200px] w-full bg-black"
                />
              </div>
            ) : (
              <p className="px-1 py-6 text-sm text-muted">
                Demo video is not uploaded yet. Timer still works above.
              </p>
            )}
          </div>
        </div>
      ) : null}

      {!video && timerOpen ? (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/80 p-4 sm:items-center"
          onClick={closeTimer}
          role="presentation"
        >
          <div
            className="relative w-full max-w-md overflow-hidden rounded-3xl border border-gold/35 bg-charcoal p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="workout-timer-title"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gold">
                  Rest timer
                </p>
                <h3
                  id="workout-timer-title"
                  className="mt-1 truncate font-display text-xl text-white"
                >
                  {timerName || "Timer"}
                </h3>
              </div>
              <button
                type="button"
                className="rounded-full border border-white/15 p-1.5 text-white/80"
                aria-label="Close timer"
                onClick={closeTimer}
              >
                <X size={18} />
              </button>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-10 text-center">
              <p
                className={`font-display text-6xl tracking-wide sm:text-7xl ${
                  timerLeft === 0 ? "text-emerald-300" : "text-gold"
                }`}
              >
                {clock}
              </p>
              <p className="mt-3 text-xs text-muted">
                {timerLeft === 0
                  ? "Rest complete"
                  : timerOn
                    ? "Running"
                    : "Paused"}
                {" · "}
                Target {Math.floor(timerTotal / 60)}:
                {String(timerTotal % 60).padStart(2, "0")}
              </p>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              {timerOn ? (
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-1.5 rounded-full border border-white/20 bg-white/5 px-3 py-3 text-sm font-medium text-white"
                  onClick={() => setTimerOn(false)}
                >
                  <Pause size={16} /> Pause
                </button>
              ) : (
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-1.5 rounded-full border border-gold/45 bg-gold/15 px-3 py-3 text-sm font-medium text-gold"
                  onClick={() => {
                    if (timerLeft <= 0) {
                      setTimerLeft(timerTotal);
                    }
                    setTimerOn(true);
                  }}
                  disabled={!timerKey}
                >
                  <Play size={16} /> Continue
                </button>
              )}
              <button
                type="button"
                className="inline-flex items-center justify-center gap-1.5 rounded-full border border-white/20 bg-white/5 px-3 py-3 text-sm font-medium text-white"
                onClick={() => {
                  setTimerLeft(timerTotal);
                  setTimerOn(true);
                }}
              >
                <RotateCcw size={16} /> Restart
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center gap-1.5 rounded-full border border-white/20 bg-white/5 px-3 py-3 text-sm font-medium text-white/85"
                onClick={closeTimer}
              >
                <X size={16} /> Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

    </section>
  );
}
