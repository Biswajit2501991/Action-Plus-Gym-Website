"use client";

import { useEffect, useState } from "react";

export function ChhathEffects({ greeting = false }: { greeting?: boolean }) {
  const [greetingHidden, setGreetingHidden] = useState(false);

  useEffect(() => {
    if (!greeting) return;
    const onScroll = () => {
      const y = window.scrollY || document.documentElement.scrollTop || 0;
      setGreetingHidden((hidden) => (hidden ? y > 24 : y > 64));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [greeting]);

  return (
    <>
      <div className="chhath-scene" aria-hidden>
        <span className="chhath-sky" />
        <span className="chhath-sun" />
        <span className="chhath-river" />
        <span className="chhath-ripple" />
        <span className="chhath-cane chhath-cane-left" />
        <span className="chhath-cane chhath-cane-right" />
        <span className="chhath-soop chhath-soop-left" />
        <span className="chhath-soop chhath-soop-right" />
        <span className="chhath-marigold chhath-marigold-a" />
        <span className="chhath-marigold chhath-marigold-b" />
        <span className="festival-diya festival-diya-left" />
        <span className="festival-diya festival-diya-right" />
      </div>
      {greeting ? (
        <div
          className={`festival-chhath-greeting${greetingHidden ? " is-hidden" : ""}`}
          aria-hidden
        >
          <p className="festival-chhath-title">छठ पूजा की हार्दिक शुभकामनाएँ</p>
          <p className="festival-chhath-wish">
            Wishing you strength, devotion, and good health.
          </p>
          <p className="festival-chhath-brand">— Action Plus Gym &amp; Fitness Club</p>
        </div>
      ) : null}
    </>
  );
}
