import { motion, type HTMLMotionProps } from "motion/react";

type ButtonAnimationProps = HTMLMotionProps<"div">;

export default function ButtonAnimation({
  children,
  ...props
}: ButtonAnimationProps) {
  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
