/**
 * Predefined animation configurations for Motion (formerly Framer Motion)
 * Import Motion using: import { motion } from 'motion/react'
 */

// Slide animations
export const slideInFromBottom = {
  initial: { y: '100%', opacity: 0 },
  animate: { y: 0, opacity: 1 },
  exit: { y: '100%', opacity: 0 },
  transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] }
};

export const slideInFromRight = {
  initial: { x: '100%', opacity: 0 },
  animate: { x: 0, opacity: 1 },
  exit: { x: '100%', opacity: 0 },
  transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] }
};

export const slideInFromLeft = {
  initial: { x: '-100%', opacity: 0 },
  animate: { x: 0, opacity: 1 },
  exit: { x: '-100%', opacity: 0 },
  transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] }
};

export const slideInFromTop = {
  initial: { y: '-100%', opacity: 0 },
  animate: { y: 0, opacity: 1 },
  exit: { y: '-100%', opacity: 0 },
  transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] }
};

// Fade animations
export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.2 }
};

export const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 20 },
  transition: { duration: 0.2 }
};

// Scale animations
export const scaleIn = {
  initial: { scale: 0.9, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
  exit: { scale: 0.9, opacity: 0 },
  transition: { duration: 0.2 }
};

export const scaleInSpring = {
  initial: { scale: 0.8, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
  exit: { scale: 0.8, opacity: 0 },
  transition: { type: 'spring', stiffness: 500, damping: 30 }
};

// Spring animations
export const springBounce = {
  type: 'spring',
  stiffness: 500,
  damping: 30
};

export const springSmooth = {
  type: 'spring',
  stiffness: 300,
  damping: 25
};

export const springGentle = {
  type: 'spring',
  stiffness: 200,
  damping: 20
};

// Stagger animations (for lists)
export const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.05
    }
  }
};

export const staggerItem = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 }
};

// Tap animations (for buttons)
export const tapScale = {
  whileTap: { scale: 0.96 },
  transition: { duration: 0.1 }
};

export const tapScaleLarge = {
  whileTap: { scale: 0.92 },
  transition: { duration: 0.1 }
};

// Backdrop animations
export const backdropFade = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.15 }
};

/**
 * Example usage:
 * 
 * import { motion } from 'motion/react';
 * import { slideInFromBottom, tapScale } from './mobileAnimations';
 * 
 * <motion.div {...slideInFromBottom}>
 *   Content slides in from bottom
 * </motion.div>
 * 
 * <motion.button {...tapScale}>
 *   Button scales on tap
 * </motion.button>
 */
