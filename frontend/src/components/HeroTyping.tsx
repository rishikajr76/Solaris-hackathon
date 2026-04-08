import { useEffect, useState } from "react";

interface HeroTypingProps {
  text: string;
  speed?: number;
  delay?: number;
  loop?: boolean;
}

export function HeroTyping({
  text,
  speed = 40,
  delay = 0,
  loop = false,
}: HeroTypingProps) {
  const [index, setIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;

    const currentText = text.slice(0, index);

    // 🔥 Natural typing variation
    const baseSpeed = speed + Math.random() * 40;

    // 🔥 Pause at punctuation
    const isPunctuation = /[.,!?]/.test(currentText.slice(-1));
    const adjustedSpeed = isPunctuation ? baseSpeed + 120 : baseSpeed;

    if (!isDeleting && index < text.length) {
      timeout = setTimeout(() => {
        setIndex((prev) => prev + 1);
      }, adjustedSpeed);
    } else if (!isDeleting && index === text.length && loop) {
      timeout = setTimeout(() => {
        setIsDeleting(true);
      }, 1200);
    } else if (isDeleting && index > 0) {
      timeout = setTimeout(() => {
        setIndex((prev) => prev - 1);
      }, speed / 2);
    } else if (isDeleting && index === 0) {
      setIsDeleting(false);
    }

    return () => clearTimeout(timeout);
  }, [index, isDeleting, text, speed, loop]);

  return (
    <span className="font-mono tracking-wide text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.6)]">
      {text.slice(0, index)}

      {/* 🔥 Blinking Cursor */}
      <span className="ml-1 inline-block w-[2px] h-[1em] bg-cyan-400 animate-pulse" />
    </span>
  );
}