"use client";

/** CSS/SVG celebration layer for New Year 2027. Display only; never captures clicks. */
export function NewYearCelebrateDecor() {
  return (
    <div className="ny-celebrate-layer" aria-hidden>
      <span className="ny-orb ny-orb-1" />
      <span className="ny-orb ny-orb-2" />
      <span className="ny-orb ny-orb-3" />
      <span className="ny-star ny-star-a" />
      <span className="ny-star ny-star-b" />
      <span className="ny-star ny-star-c" />
      <span className="ny-star ny-star-d" />
      <span className="ny-star ny-star-e" />
      <span className="ny-star ny-star-f" />
      <span className="ny-balloon ny-balloon-a" />
      <span className="ny-balloon ny-balloon-b" />
      <span className="ny-balloon ny-balloon-c" />
      <span className="ny-ribbon ny-ribbon-l" />
      <span className="ny-ribbon ny-ribbon-r" />
      <span className="ny-popper ny-popper-l" />
      <span className="ny-popper ny-popper-r" />
      {Array.from({ length: 12 }, (_, i) => (
        <span key={i} className={`ny-confetti ny-confetti-${i + 1}`} />
      ))}
    </div>
  );
}
