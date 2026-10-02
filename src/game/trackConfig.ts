export const LANE_WIDTH = 2.6; // world units per lane
export const LANE_COUNT = 3;
export const ROAD_HALF = (LANE_COUNT * LANE_WIDTH) / 2; // 3.9
export const ROAD_MARGIN = 0.6; // shoulder inside the rail
export const RAIL_X = ROAD_HALF + ROAD_MARGIN; // 4.5
export const DIVIDER_X = LANE_WIDTH / 2; // +-1.3 (between lanes)

/**
 * Maps lane index (-1: Left, 0: Center, +1: Right) to 3D world X.
 * Camera is positioned at -Z looking along +Z:
 * In camera space:
 * - World +X projects to Screen-Left
 * - World -X projects to Screen-Right
 * Therefore: laneToWorldX(-1) = +2.6 (Screen-Left)
 *            laneToWorldX(0)  =  0.0 (Screen-Center)
 *            laneToWorldX(+1) = -2.6 (Screen-Right)
 */
export const laneToWorldX = (lane: number): number => {
  const clampedLane = Math.max(-1, Math.min(1, Math.round(lane)));
  return -clampedLane * LANE_WIDTH;
};

export const worldXToLane = (x: number): -1 | 0 | 1 => {
  if (x > LANE_WIDTH * 0.5) return -1;
  if (x < -LANE_WIDTH * 0.5) return 1;
  return 0;
};
