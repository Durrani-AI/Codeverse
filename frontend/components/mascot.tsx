"use client";

import { useState, useEffect, useCallback } from "react";

const motivationalMessages = [
  "Ready to crush some coding challenges today?",
  "Let's ace this interview together!",
  "You've got this, time to level up!",
  "Another day, another chance to get better.",
  "Let's lock in and write some clean code!",
  "Believe in your skills, you're built for this.",
  "Today's the day you surprise yourself.",
  "Hard work beats talent when talent doesn't practice.",
  "One more interview closer to your dream job!",
  "Stay focused. Stay sharp. Let's go!",
  "You're not just practicing, you're preparing to win.",
  "Great devs aren't born, they're built. Let's build.",
  "The grind never stops. Neither do you.",
  "Code like nobody's watching. Interview like everybody is.",
  "Your future self will thank you for this session.",
];

interface MascotProps {
  username: string;
}

export default function Mascot({ username }: MascotProps) {
  const [message, setMessage] = useState("");
  const [isTyping, setIsTyping] = useState(true);
  const [fullMessage, setFullMessage] = useState("");

  // Pick a random message on mount
  useEffect(() => {
    const greeting = `Hey ${username}! `;
    const random = motivationalMessages[Math.floor(Math.random() * motivationalMessages.length)];
    setFullMessage(greeting + random);
  }, [username]);

  // Typing effect
  const tick = useCallback(() => {
    if (!fullMessage) return;
    setMessage((prev) => {
      if (prev.length < fullMessage.length) {
        return fullMessage.slice(0, prev.length + 1);
      }
      setIsTyping(false);
      return prev;
    });
  }, [fullMessage]);

  useEffect(() => {
    if (!fullMessage) return;
    setMessage("");
    setIsTyping(true);
    const interval = setInterval(tick, 35);
    return () => clearInterval(interval);
  }, [fullMessage, tick]);

  // Cycle messages every 8 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      const greeting = `Hey ${username}! `;
      const random = motivationalMessages[Math.floor(Math.random() * motivationalMessages.length)];
      setFullMessage(greeting + random);
    }, 8000);
    return () => clearInterval(timer);
  }, [username]);

  return (
    <div className="flex items-end gap-4">
      {/* Robot mascot */}
      <div className="shrink-0 relative">
        <svg
          width="72"
          height="72"
          viewBox="0 0 120 120"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="drop-shadow-[0_0_12px_rgba(139,92,246,0.3)]"
        >
          {/* Antenna */}
          <line x1="60" y1="8" x2="60" y2="24" stroke="#a78bfa" strokeWidth="3" strokeLinecap="round" />
          <circle cx="60" cy="6" r="4" fill="#8b5cf6" className="animate-pulse-slow" />

          {/* Head */}
          <rect x="24" y="24" width="72" height="56" rx="16" fill="#18181f" stroke="#8b5cf6" strokeWidth="2.5" />

          {/* Eyes */}
          <circle cx="44" cy="48" r="8" fill="#0c0c12" />
          <circle cx="76" cy="48" r="8" fill="#0c0c12" />
          <circle cx="44" cy="48" r="5" fill="#8b5cf6" className="animate-pulse-slow" />
          <circle cx="76" cy="48" r="5" fill="#8b5cf6" className="animate-pulse-slow" />
          {/* Eye highlights */}
          <circle cx="46" cy="46" r="2" fill="#c4b5fd" opacity="0.8" />
          <circle cx="78" cy="46" r="2" fill="#c4b5fd" opacity="0.8" />

          {/* Mouth - friendly smile */}
          <path d="M46 62 Q60 72 74 62" fill="none" stroke="#a78bfa" strokeWidth="2.5" strokeLinecap="round" />

          {/* Ear accents */}
          <rect x="16" y="38" width="8" height="20" rx="4" fill="#8b5cf6" opacity="0.6" />
          <rect x="96" y="38" width="8" height="20" rx="4" fill="#8b5cf6" opacity="0.6" />

          {/* Body */}
          <rect x="32" y="82" width="56" height="30" rx="10" fill="#18181f" stroke="#8b5cf6" strokeWidth="2" />

          {/* Chest emblem - </> */}
          <text x="60" y="102" textAnchor="middle" fill="#8b5cf6" fontSize="14" fontFamily="monospace" fontWeight="bold">&lt;/&gt;</text>
        </svg>
      </div>

      {/* Speech bubble */}
      <div className="relative flex-1 max-w-md">
        {/* Bubble tail pointing left toward robot */}
        <div
          className="absolute left-[-8px] bottom-4 w-0 h-0"
          style={{
            borderTop: "6px solid transparent",
            borderBottom: "6px solid transparent",
            borderRight: "8px solid #1e1e2a",
          }}
        />
        <div
          className="absolute left-[-7px] bottom-4 w-0 h-0"
          style={{
            borderTop: "5px solid transparent",
            borderBottom: "5px solid transparent",
            borderRight: "7px solid #111118",
          }}
        />

        <div className="bg-surface-card border border-surface-border rounded-xl px-5 py-3.5 shadow-[0_0_20px_rgba(139,92,246,0.06)]">
          <p className="text-foreground text-sm leading-relaxed min-h-[1.4em]">
            {message}
            {isTyping && (
              <span className="inline-block w-[2px] h-[14px] bg-brand-400 ml-0.5 align-middle animate-pulse" />
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
