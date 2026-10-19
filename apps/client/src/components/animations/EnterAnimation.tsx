import type { ReactNode } from "react";
import { motion } from "motion/react";

type EnterAnimationProps = {
  children: ReactNode;
  className?: string;
};

export default function EnterAnimation({ children, className }: EnterAnimationProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{
        duration: 0.2,
        scale: { type: "spring", visualDuration: 0.3, bounce: 0.2 },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
