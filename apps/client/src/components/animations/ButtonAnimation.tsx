import { motion, type HTMLMotionProps } from "motion/react";

type ButtonAnimationProps = HTMLMotionProps<"div">;

export default function ButtonAnimation({
  children,
  ...props
}: ButtonAnimationProps) {
  return (
    <motion.div
      whileHover={{ scale: 2 }}
      whileTap={{ scale: 0.8 }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
