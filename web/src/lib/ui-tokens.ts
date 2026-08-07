/**
 * Numeric tokens for third-party components that cannot consume CSS variables.
 * Keep visual values in CSS unless a component API requires a number.
 */
export const activityVisualTokens = {
  icon: {
    size: 15,
    strokeWidth: 1.65,
  },
  resourceIcon: {
    size: 16,
    strokeWidth: 1.55,
  },
  triggerIcon: {
    size: 15,
    strokeWidth: 1.6,
  },
  thinkingOrb: {
    size: 20,
    speed: 0.95,
  },
} as const;
