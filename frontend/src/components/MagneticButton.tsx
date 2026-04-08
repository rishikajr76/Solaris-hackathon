import { useRef } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

interface MagneticButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

export function MagneticButton({
  children,
  onClick,
  className = "",
}: MagneticButtonProps) {
  const ref = useRef<HTMLButtonElement | null>(null);

  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const springX = useSpring(x, { stiffness: 150, damping: 12 });
  const springY = useSpring(y, { stiffness: 150, damping: 12 });

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!ref.current) return;

    const rect = ref.current.getBoundingClientRect();

    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const dx = e.clientX - centerX;
    const dy = e.clientY - centerY;

    const distance = Math.sqrt(dx * dx + dy * dy) || 1;

    const maxDistance = 100;
    const strength = Math.max(0, 1 - distance / maxDistance);

    x.set((dx / distance) * 15 * strength);
    y.set((dy / distance) * 15 * strength);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.button
      ref={ref}
      style={{ x: springX, y: springY }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      whileTap={{ scale: 0.96 }}
      className={`relative overflow-hidden px-6 py-3 rounded-xl font-medium 
                  bg-gradient-to-r from-purple-600 to-cyan-500 text-white
                  shadow-lg hover:shadow-cyan-500/30 transition-all duration-300
                  ${className}`}
      data-interactive="true"
    >
      {/* 🔥 Glow layer */}
      <span className="absolute inset-0 opacity-0 hover:opacity-100 transition duration-300">
        <span className="absolute inset-0 bg-gradient-to-r from-cyan-400/20 to-purple-500/20 blur-xl" />
      </span>

      {/* Content */}
      <span className="relative z-10">{children}</span>
    </motion.button>
  );
}