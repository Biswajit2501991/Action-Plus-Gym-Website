"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Pause, Play, RotateCcw, X } from "lucide-react";
import {
  WorkoutPlanMusicButton,
  WorkoutPlanMusicPlayer,
} from "@/components/members/WorkoutPlanMusicPlayer";
import {
  PortalBackButton,
  PORTAL_BACK_BUTTON_CLASS,
} from "@/components/members/PortalBackButton";
import { restSecondsFromLabel } from "@/lib/member-portal/workout-programs";
import {
  playRestTimerDone,
  primeRestTimerAudio,
  readRestTimerSoundOn,
  stopRestTimerAlert,
  writeRestTimerSoundOn,
} from "@/lib/member-portal/rest-timer-alert";
import {
  WORKOUT_GOAL_OPTIONS,
  type WorkoutGoalId,
} from "@/lib/member-portal/workout-goals";
import {
  peekWorkoutMusicCache,
  peekWorkoutPlanCache,
  readWorkoutMusicCache,
  readWorkoutPlanCache,
  WORKOUT_MUSIC_SOFT_TTL_MS,
  WORKOUT_PLAN_SOFT_TTL_MS,
  writeWorkoutMusicCache,
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
  goals?: WorkoutGoalId[];
  goalStatus?: "unset" | "skipped" | "set";
  goalNote?: string | null;
  goalOptions?: Array<{ id: WorkoutGoalId; label: string }>;
  needsConfirm?: boolean;
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
  initialMusic = null,
}: {
  onBack: () => void;
  memberUuid?: string;
  initialMusic?: { title: string; mp4Url: string } | null;
}) {
  const [data, setData] = useState<Payload | null>(() => {
    const cached = readWorkoutPlanCache<Payload>(memberUuid);
    return cached && typeof cached === "object" ? cached : null;
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(() => !readWorkoutPlanCache<Payload>(memberUuid));
  const [pickingLevel, setPickingLevel] = useState(false);
  const [askingGoals, setAskingGoals] = useState(false);
  const [pickedGoals, setPickedGoals] = useState<WorkoutGoalId[]>([]);
  const [tab, setTab] = useState<"workout" | "progression" | "note">("workout");
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [video, setVideo] = useState<{ name: string; url: string | null } | null>(null);
  const [music, setMusic] = useState<{ title: string; mp4Url: string } | null>(() => {
    if (initialMusic?.mp4Url) return initialMusic;
    return readWorkoutMusicCache<{ title: string; mp4Url: string } | null>(memberUuid);
  });
  const [musicOpen, setMusicOpen] = useState(false);
  const [timerOpen, setTimerOpen] = useState(false);
  const [timerKey, setTimerKey] = useState<string | null>(null);
  const [timerName, setTimerName] = useState("");
  const [timerTotal, setTimerTotal] = useState(60);
  const [timerLeft, setTimerLeft] = useState(0);
  const [timerOn, setTimerOn] = useState(false);
  const [timerEndsAt, setTimerEndsAt] = useState<number | null>(null);
  const [timerSound, setTimerSound] = useState(true);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const timerRun = useRef(0);
  const timerEndsAtRef = useRef<number | null>(null);
  const timerLeftRef = useRef(0);
  const timerTotalRef = useRef(60);
  const timerSoundRef = useRef(true);
  timerEndsAtRef.current = timerEndsAt;
  timerLeftRef.current = timerLeft;
  timerTotalRef.current = timerTotal;
  timerSoundRef.current = timerSound;

  const closeTimer = useCallback(() => {
    timerRun.current += 1;
    timerEndsAtRef.current = null;
    stopRestTimerAlert();
    setTimerOn(false);
    setTimerOpen(false);
    setTimerKey(null);
    setTimerLeft(0);
    setTimerEndsAt(null);
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
    timerRun.current += 1;
    timerEndsAtRef.current = null;
    stopRestTimerAlert();
    setTimerOn(false);
    setTimerOpen(false);
    setTimerKey(null);
    setTimerLeft(0);
    setTimerEndsAt(null);
  }, []);

  const startCountdown = useCallback((seconds: number) => {
    primeRestTimerAudio();
    const total = Math.max(1, Math.round(seconds));
    const ends = Date.now() + total * 1000;
    timerRun.current += 1;
    timerEndsAtRef.current = ends;
    setTimerLeft(total);
    setTimerEndsAt(ends);
    setTimerOn(true);
    setTimerOpen(true);
  }, []);

  const startTimerForExercise = useCallback(
    (ex: Exercise) => {
      const total = restSecondsFromLabel(ex.rest);
      setTimerKey(ex.exerciseKey);
      setTimerName(ex.name);
      setTimerTotal(total);
      startCountdown(total);
    },
    [startCountdown],
  );

  const pauseTimer = useCallback(() => {
    const ends = timerEndsAtRef.current;
    timerRun.current += 1;
    if (ends != null) {
      setTimerLeft(Math.max(0, Math.ceil((ends - Date.now()) / 1000)));
    }
    timerEndsAtRef.current = null;
    setTimerEndsAt(null);
    setTimerOn(false);
  }, []);

  const resumeTimer = useCallback(() => {
    const left =
      timerLeftRef.current <= 0
        ? Math.max(1, timerTotalRef.current || 60)
        : timerLeftRef.current;
    startCountdown(left);
  }, [startCountdown]);

  const restartTimer = useCallback(() => {
    startCountdown(Math.max(1, timerTotalRef.current || 60));
  }, [startCountdown]);

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
      setError(null);
      setBusy(false);
    },
    [memberUuid],
  );

  const refresh = useCallback(
    async (opts?: { force?: boolean }) => {
      const force = opts?.force === true;
      // Soft TTL may still paint from cache, but never skip the network when force=true
      // (staff rename / visibility must pick up fresh exercise display names).
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
    // Instant paint from cache, then always force-network so renames/labels stay in sync.
    if (cached && cached.eligible !== false) applyPayload(cached);

    const pull = (force: boolean) => {
      void refresh({ force }).catch(() => {
        if (cancelled) return;
      });
    };

    pull(true);
    const onVisible = () => {
      if (document.visibilityState === "visible") pull(true);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh, memberUuid, applyPayload]);

  useEffect(() => {
    if (initialMusic?.mp4Url) {
      setMusic(initialMusic);
      writeWorkoutMusicCache(memberUuid, initialMusic);
      return;
    }
    const cached = readWorkoutMusicCache<{ title: string; mp4Url: string } | null>(memberUuid);
    if (cached?.mp4Url) setMusic(cached);
  }, [initialMusic, memberUuid]);

  useEffect(() => {
    let cancelled = false;
    if (!data?.eligible) {
      if (!initialMusic?.mp4Url) {
        setMusic(null);
        setMusicOpen(false);
        writeWorkoutMusicCache(memberUuid, null);
      }
      return;
    }
    const peek = peekWorkoutMusicCache<{ title: string; mp4Url: string } | null>(memberUuid);
    // Soft TTL: skip network if login/me already warmed a fresh cache.
    if (peek?.data?.mp4Url && peek.ageMs < WORKOUT_MUSIC_SOFT_TTL_MS) {
      setMusic(peek.data);
      return;
    }
    void fetch("/api/member/workout-plan-music", {
      cache: "no-store",
      credentials: "include",
    })
      .then((res) => res.json())
      .then((json: { ok?: boolean; music?: { title?: string; mp4Url?: string } | null }) => {
        if (cancelled) return;
        const url = String(json?.music?.mp4Url || "").trim();
        const next = url
          ? {
              title: String(json.music?.title || "Gym music").trim() || "Gym music",
              mp4Url: url,
            }
          : null;
        setMusic(next);
        writeWorkoutMusicCache(memberUuid, next);
      })
      .catch(() => {
        /* keep cached /me music if network fails */
      });
    return () => {
      cancelled = true;
    };
  }, [data?.eligible, memberUuid, initialMusic?.mp4Url]);

  useEffect(() => {
    const on = readRestTimerSoundOn();
    timerSoundRef.current = on;
    setTimerSound(on);
  }, []);

  useEffect(() => {
    if (!timerOn || timerEndsAt == null) return;
    const token = timerRun.current;
    const endsAt = timerEndsAt;
    const tick = () => {
      if (timerRun.current !== token) return;
      const msLeft = endsAt - Date.now();
      if (msLeft <= 0) {
        timerRun.current += 1;
        timerEndsAtRef.current = null;
        setTimerLeft(0);
        setTimerOn(false);
        setTimerEndsAt(null);
        if (timerSoundRef.current) {
          const el = videoRef.current;
          const resumeVideo = Boolean(el && !el.paused && !el.ended && el.currentSrc);
          if (resumeVideo && el) el.pause();
          void playRestTimerDone().finally(() => {
            if (!resumeVideo || !el) return;
            if (videoRef.current !== el || !el.isConnected || el.ended || !el.currentSrc) return;
            void el.play().catch(() => {
              /* leave the video paused if the phone blocks autoplay */
            });
          });
        }
        return;
      }
      const next = Math.ceil(msLeft / 1000);
      setTimerLeft((prev) => (prev === next ? prev : next));
    };
    tick();
    const id = window.setInterval(tick, 250);
    const wake = () => tick();
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("focus", wake);
    window.addEventListener("pageshow", wake);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("focus", wake);
      window.removeEventListener("pageshow", wake);
    };
  }, [timerOn, timerEndsAt]);

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
      goals: next.goals ?? data?.goals,
      goalStatus: next.goalStatus ?? data?.goalStatus,
      goalNote: next.goalNote ?? data?.goalNote,
      goalOptions: next.goalOptions ?? data?.goalOptions,
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
      await save({ action: "level", level: levelId });
      setOpenDay(null);
      setTab("workout");
      setPickingLevel(false);
      setPickedGoals([]);
      setAskingGoals(true);
      closeVideo();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change program");
    } finally {
      setBusy(false);
    }
  };

  const goalOptions = data?.goalOptions?.length ? data.goalOptions : [...WORKOUT_GOAL_OPTIONS];

  const submitGoals = async (skip: boolean) => {
    if (!skip && pickedGoals.length === 0) {
      setError("Choose at least one goal, or skip to keep this program.");
      return;
    }
    if (data?.goalStatus === "set") {
      const ok = window.confirm(
        "Update your exercise list for these goals?\n\nYour current week stays. Saved ticks are kept.",
      );
      if (!ok) return;
    }
    setBusy(true);
    setError(null);
    try {
      const next = await save({
        action: "goals",
        goals: skip ? [] : pickedGoals,
        skip,
        confirm: data?.goalStatus === "set",
      });
      if (next.needsConfirm) return;
      setAskingGoals(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save goals");
    } finally {
      setBusy(false);
    }
  };

  const toggleTimerSound = () => {
    const next = !timerSoundRef.current;
    timerSoundRef.current = next;
    setTimerSound(next);
    writeRestTimerSoundOn(next);
    if (!next) stopRestTimerAlert();
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
            if (askingGoals) {
              setAskingGoals(false);
              return;
            }
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
            onClick={() => {
              setAskingGoals(false);
              setPickingLevel(true);
            }}
          >
            Change program
          </button>
        ) : null}
      </div>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
            <p className="shrink-0 text-[11px] uppercase tracking-[0.18em] text-gold/80">
              Training
            </p>
            <h2 className="font-display text-xl text-white sm:text-2xl">Workout Plan</h2>
          </div>
          {showProgram && music ? (
            <WorkoutPlanMusicButton
              disabled={busy}
              playing={musicOpen}
              onClick={() => {
                // Close exercise video popup so only one media overlay is active.
                if (video) {
                  const el = videoRef.current;
                  if (el) {
                    el.pause();
                    el.removeAttribute("src");
                    el.load();
                  }
                  setVideo(null);
                }
                setMusicOpen(true);
              }}
            />
          ) : null}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <p className="min-w-0 text-xs text-muted">
            Member: {data?.member?.name || "—"} · Trainer: {data?.member?.trainerLabel || "Self"}
            {activeLevelId && showProgram
              ? ` · ${data?.program?.title || activeLevelId}`
              : null}
          </p>
          {showProgram &&
          weekMeta.motivation &&
          weekMeta.motivation !== weekMeta.thisWeekAim ? (
            <p className="max-w-sm rounded-2xl border border-gold/30 bg-gold/10 px-3 py-2 text-xs leading-relaxed text-gold/95 sm:text-right">
              {weekMeta.motivation}
            </p>
          ) : null}
        </div>
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
          {data.goalStatus === "set" && (data.goals || []).length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              {(data.goals || []).map((id) => {
                const label = goalOptions.find((g) => g.id === id)?.label || id;
                return (
                  <span
                    key={id}
                    className="rounded-full border border-gold/40 bg-gold/10 px-2.5 py-1 text-[11px] text-gold"
                  >
                    {label}
                  </span>
                );
              })}
              <button
                type="button"
                className="text-xs text-white/70 underline"
                disabled={busy}
                onClick={() => {
                  setPickedGoals([...(data.goals || [])]);
                  setAskingGoals(true);
                }}
              >
                Change goals
              </button>
              {data.goalNote ? (
                <p className="w-full text-xs leading-relaxed text-muted">{data.goalNote}</p>
              ) : null}
            </div>
          ) : null}

          {data.goalStatus === "skipped" && !askingGoals ? (
            <button
              type="button"
              className="text-left text-xs text-white/70 underline"
              disabled={busy}
              onClick={() => {
                setPickedGoals([]);
                setAskingGoals(true);
              }}
            >
              Choose goals
            </button>
          ) : null}

          {data.goalStatus === "unset" && !askingGoals ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-sm text-white">What is your goal?</p>
              <p className="mt-1 text-xs text-muted">
                Optional. You can pick more than one. Skip keeps this exact program.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  className="rounded-full bg-gold px-4 py-2 text-xs font-semibold text-black"
                  onClick={() => {
                    setPickedGoals([]);
                    setAskingGoals(true);
                  }}
                >
                  Choose goals
                </button>
                <button
                  type="button"
                  disabled={busy}
                  className="rounded-full border border-white/15 px-4 py-2 text-xs text-white/80"
                  onClick={() => {
                    void submitGoals(true);
                  }}
                >
                  Not now
                </button>
              </div>
            </div>
          ) : null}

          {askingGoals ? (
            <div className="space-y-3 rounded-2xl border border-gold/30 bg-black/30 px-4 py-4">
              <p className="text-sm text-white">What is your goal?</p>
              <p className="text-xs text-muted">
                Pick any that fit. Your week stays the same. Only the exercise list can change.
              </p>
              <div className="space-y-2">
                {goalOptions.map((goal) => {
                  const on = pickedGoals.includes(goal.id);
                  return (
                    <button
                      key={goal.id}
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        setPickedGoals((prev) =>
                          prev.includes(goal.id)
                            ? prev.filter((id) => id !== goal.id)
                            : [...prev, goal.id],
                        )
                      }
                      className={`flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left text-sm ${
                        on ? "border-gold/50 bg-gold/15 text-white" : "border-white/10 bg-white/5 text-white/85"
                      }`}
                    >
                      {goal.label}
                      {on ? <Check className="h-4 w-4 text-gold" /> : null}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  className="rounded-full bg-gold px-4 py-2 text-xs font-semibold text-black"
                  onClick={() => {
                    void submitGoals(false);
                  }}
                >
                  Use these goals
                </button>
                <button
                  type="button"
                  disabled={busy}
                  className="rounded-full border border-white/15 px-4 py-2 text-xs text-white/80"
                  onClick={() => {
                    void submitGoals(true);
                  }}
                >
                  Skip
                </button>
              </div>
            </div>
          ) : null}

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
                <button
                  type="button"
                  className="mx-auto mt-2 block rounded-full border border-white/15 px-3 py-1 text-[11px] text-white/80"
                  onClick={toggleTimerSound}
                >
                  {timerSound ? "Sound on" : "Sound off"}
                </button>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {timerOn ? (
                    <button
                      type="button"
                      className="inline-flex items-center justify-center gap-1 rounded-full border border-white/20 bg-white/5 px-2 py-2 text-xs font-medium text-white"
                      onClick={pauseTimer}
                    >
                      <Pause size={14} /> Pause
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="inline-flex items-center justify-center gap-1 rounded-full border border-gold/45 bg-gold/15 px-2 py-2 text-xs font-medium text-gold"
                      onClick={resumeTimer}
                    >
                      <Play size={14} /> Continue
                    </button>
                  )}
                  <button
                    type="button"
                    className="inline-flex items-center justify-center gap-1 rounded-full border border-white/20 bg-white/5 px-2 py-2 text-xs font-medium text-white"
                    onClick={restartTimer}
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
                    if (!timerKey && video) {
                      setTimerName(video.name);
                    }
                    if (timerLeft <= 0) restartTimer();
                    else resumeTimer();
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
              <button
                type="button"
                className="mt-3 rounded-full border border-white/15 px-3 py-1 text-[11px] text-white/80"
                onClick={toggleTimerSound}
              >
                {timerSound ? "Sound on" : "Sound off"}
              </button>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              {timerOn ? (
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-1.5 rounded-full border border-white/20 bg-white/5 px-3 py-3 text-sm font-medium text-white"
                  onClick={pauseTimer}
                >
                  <Pause size={16} /> Pause
                </button>
              ) : (
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-1.5 rounded-full border border-gold/45 bg-gold/15 px-3 py-3 text-sm font-medium text-gold"
                  onClick={resumeTimer}
                  disabled={!timerKey}
                >
                  <Play size={16} /> Continue
                </button>
              )}
              <button
                type="button"
                className="inline-flex items-center justify-center gap-1.5 rounded-full border border-white/20 bg-white/5 px-3 py-3 text-sm font-medium text-white"
                onClick={restartTimer}
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

      {music ? (
        <WorkoutPlanMusicPlayer
          music={music}
          open={musicOpen}
          onClose={() => setMusicOpen(false)}
        />
      ) : null}
    </section>
  );
}
