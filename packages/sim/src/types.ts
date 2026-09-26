/** Opaque-ish identifiers. Kept as plain strings so they serialise trivially. */
export type PlayerId = string;
export type TeamId = string;

/** Simulation tick counter. Starts at 0 when a round begins. */
export type Tick = number;

/**
 * Who is currently driving a participant's inputs.
 * A disconnected human is taken over by `cpu` without changing the participant.
 */
export type Controller = "human" | "cpu";

export interface Participant {
  id: PlayerId;
  teamId: TeamId;
  controller: Controller;
  /** Display name chosen by the player; purely cosmetic. */
  name?: string;
}

/** Where a player is in the round. `tower` is permanent for the rest of the round. */
export type PlayerPhase = "maze" | "tower";
