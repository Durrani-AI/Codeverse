"use client";

import { useState, useEffect, useCallback } from "react";

const phrases = [
  "Crush your next coding challenge.",
  "Practice like it's the real thing.",
  "AI feedback that actually hits.",
  "From nervous to confident.",
  "Your coding prep, leveled up.",
  "No more winging it.",
  "Built different. Code different.",
  "Where devs come to lock in.",
  "Coding practice that doesn't miss.",
];

export default function TypingAnimation() {
  const [text, setText] = useState("");
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const currentPhrase = phrases[phraseIndex];

  const tick = useCallback(() => {
    if (isPaused) return;

    if (!isDeleting) {
      // Typing
      if (text.length < currentPhrase.length) {
        setText(currentPhrase.slice(0, text.length + 1));
      } else {
        // Finished typing - pause before deleting
        setIsPaused(true);
        setTimeout(() => {
          setIsPaused(false);
          setIsDeleting(true);
        }, 2000);
      }
    } else {
      // Deleting
      if (text.length > 0) {
        setText(currentPhrase.slice(0, text.length - 1));
      } else {
        // Finished deleting - move to next phrase
        setIsDeleting(false);
        setPhraseIndex((prev) => (prev + 1) % phrases.length);
      }
    }
  }, [text, isDeleting, isPaused, currentPhrase]);

  useEffect(() => {
    const speed = isDeleting ? 30 : 50 + Math.random() * 40;
    const timer = setTimeout(tick, speed);
    return () => clearTimeout(timer);
  }, [tick, isDeleting]);

  return (
    <div className="h-[1.4em] flex items-center justify-center">
      <span className="text-foreground-muted text-lg sm:text-xl font-light tracking-wide">
        {text}
        <span className="inline-block w-[2px] h-[1.1em] bg-brand-400 ml-0.5 align-middle animate-pulse" />
      </span>
    </div>
  );
}
