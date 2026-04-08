import { useEffect, useRef } from "react";

type Position = {
  x: number;
  y: number;
};

export function CustomCursor() {
  const cursorRef = useRef<HTMLDivElement | null>(null);
  const ringRef = useRef<HTMLDivElement | null>(null);

  const position = useRef<Position>({ x: 0, y: 0 });
  const ringPosition = useRef<Position>({ x: 0, y: 0 });

  const isHoveringRef = useRef(false);

  useEffect(() => {
    // ❌ Disable on touch devices (important)
    if ("ontouchstart" in window) return;

    let animationFrame: number;

    const handleMouseMove = (e: MouseEvent) => {
      position.current = { x: e.clientX, y: e.clientY };

      const target = e.target as HTMLElement;
      const interactive =
        target.tagName === "BUTTON" ||
        target.tagName === "A" ||
        target.closest("[data-interactive]");

      // ✅ Avoid unnecessary re-renders
      isHoveringRef.current = !!interactive;
    };

    const animate = () => {
      // Smooth trailing effect
      ringPosition.current.x +=
        (position.current.x - ringPosition.current.x) * 0.15;
      ringPosition.current.y +=
        (position.current.y - ringPosition.current.y) * 0.15;

      if (cursorRef.current) {
        cursorRef.current.style.transform = `translate3d(${position.current.x}px, ${position.current.y}px, 0) translate(-50%, -50%)`;

        cursorRef.current.className = `fixed w-3 h-3 rounded-full pointer-events-none z-50 transition-all duration-150 ${
          isHoveringRef.current
            ? "bg-cyan-400 scale-150 shadow-[0_0_14px_#22d3ee]"
            : "bg-purple-400 shadow-[0_0_10px_#a855f7]"
        }`;
      }

      if (ringRef.current) {
        ringRef.current.style.transform = `translate3d(${ringPosition.current.x}px, ${ringPosition.current.y}px, 0) translate(-50%, -50%)`;

        ringRef.current.className = `fixed w-8 h-8 border-2 rounded-full pointer-events-none z-50 transition-all duration-300 ${
          isHoveringRef.current
            ? "border-cyan-400 scale-125 opacity-100"
            : "border-purple-400 opacity-80"
        }`;
      }

      animationFrame = requestAnimationFrame(animate);
    };

    animationFrame = requestAnimationFrame(animate);
    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  return (
    <>
      <div ref={cursorRef} />
      <div ref={ringRef} />
    </>
  );
}