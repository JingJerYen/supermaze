/**
 * Client-only feel parameters: camera, rendering, interpolation.
 * Game-rule numbers live in @supermaze/sim, not here.
 */
export const CLIENT_TUNING = {
  climb: {
    /** Door slides open, then the character walks in, then the light climbs the shaft. Seconds. */
    doorOpenSec: 0.7,
    walkInSec: 1.0,
    doorCloseSec: 0.5,
    ascentSec: 1.6,
    /** Light pouring out of the open door: colour, how far the beam reaches (tiles), peak strength. */
    spillColor: 0xffe2a0,
    spillReach: 2.4,
    spillOpacity: 0.5,
    spillLightIntensity: 5,
    /** Your own climb: the camera rides up with the light, then swings down to the overview at this blend rate per second. */
    overviewPerSec: 1.1,
    /** Seconds the overview swing gets before the result screen may cover it. */
    settleSec: 1.8,
  },
  intro: {
    /** Opening fly-in (its length is the sim's round.introSec): share of it spent holding the wide shot before moving. */
    holdShare: 0.25,
    /** Room above the tower top in the wide shot, world units, and how much larger than the tower the frame is. */
    headroom: 1.5,
    margin: 1.35,
    /** Camera height in the wide shot as a share of the framed height. */
    eyeShare: 0.45,
  },
  /** The Eagle Eye skill's view: straight down over the player (render/camera.ts "above"). */
  eagleEye: {
    /** Camera height above the player, world units (one tile is 1). */
    heightTiles: 16,
    /** Within this many tiles of the tower centre the camera rises to stay this far above its platform. */
    towerClearRadius: 6,
    towerClearance: 4,
  },
  overview: {
    /** Extra room around the map when looking straight down from the tower, as a factor. */
    margin: 1.08,
    /** Blend speed of the camera swing between follow and overview, per second. */
    transitionPerSec: 3,
  },
  camera: {
    /** Height above the focus point, world units (1 unit = 1 tile). Kept near the tower platform height so the platform reads edge-on and occludes little. */
    height: 8,
    /** Horizontal distance behind the focus point. */
    distance: 9,
    /** Vertical field of view on tall-ish screens (16:10 desktop). */
    fovDeg: 45,
    /**
     * Wide screens keep this horizontal field of view instead, so a landscape phone
     * does not spread the same vertical slice over a huge width and shrink everything.
     */
    horizontalFovDeg: 72,
    /** On short viewports (CSS px) the camera moves closer by this factor. */
    shortScreenMaxPx: 520,
    shortScreenZoom: 0.8,
    /** Exponential follow smoothing per second. Higher = snappier, lower = floatier. */
    followLerpPerSec: 10,
  },
  tower: {
    /** Height of the slender shaft, world units (1 unit = 1 tile). */
    shaftHeight: 12,
    /** Distance across the octagonal shaft between opposite flat faces, tiles. */
    shaftWidth: 1.6,
    /** Platform overhang per side. Must equal the sim's PLATFORM_RING (1 tile) so the walkable tiles match the slab. */
    platformOverhang: 1,
    platformThickness: 0.35,
    /** Platform slab opacity seen from the maze (follow camera). */
    platformOpacityFollow: 0.55,
    /** Platform and shaft opacity while looking straight down from the tower top. */
    platformOpacityOverview: 0.12,
    shaftOpacityOverview: 0.25,
    /** Opacity of the tower's solid parts while it hides the local player from the camera. */
    occludedOpacity: 0.35,
    /** How fast it fades in and out, per second. */
    occlusionFadePerSec: 8,
    /** The player counts as hidden when the line of sight passes this close to the tower, tiles. */
    occlusionMargin: 0.3,
    /** Low base covering the whole footprint so the blocked tiles read as tower ground. */
    baseHeight: 0.3,
  },
  itemBox: {
    /** Cube edge length, tiles. */
    size: 0.42,
    /** Gap between the floor and the cube's lowest tip, tiles. */
    hover: 0.25,
    opacity: 0.45,
    /** Rotations per second of the cube and of the question mark. */
    spinPerSec: 0.35,
    markSpinPerSec: 0.8,
    /** Full hue cycle per second for the glass tint; 0 keeps a fixed colour. */
    hueCyclePerSec: 0.12,
  },
  teleportBeam: {
    /** Beam above a paired teleport node, world units. */
    height: 2.2,
    opacity: 0.4,
  },
  dpad: {
    /** Side length of the whole cross, px, capped at a share of the viewport height; each arm is a third of it. */
    sizePx: 150,
    maxHeightVh: 38,
    /** Distance from the bottom-left screen corner (or the safe area), px. */
    marginPx: 18,
    /** Radius around the hub where a press registers no direction, px. */
    deadZonePx: 14,
    /** Pad opacity on touch devices, and on desktop where the keyboard is primary. */
    opacity: 0.9,
    opacityDesktop: 0.45,
  },
  /**
   * The joystick, the settings page's alternative to the pad: a ring fixed in
   * the pad's corner. A light push only turns the player; a push past
   * `turnShare` of the radius walks.
   */
  stick: {
    /** Ring radius, px, capped at a share of the viewport height (the same size as the pad). */
    radiusPx: 75,
    maxRadiusVh: 19,
    /** Knob size as a share of the ring radius. */
    knobShare: 0.5,
    /** A press counts when it lands within this share of the radius from the centre. */
    hitShare: 1.1,
    /** Movement under this many px from the centre is ignored. */
    deadZonePx: 8,
    /** Up to this share of the radius the push only turns; beyond it walks. */
    turnShare: 0.5,
    /** The other axis must beat the current one by this factor to change direction, so a push near a diagonal does not flicker. */
    switchBias: 1.2,
    /** Ticks before a turn that did not show up in the state (lag) is sent again. */
    turnRetryTicks: 10,
    /** Opacity on touch devices, and on desktop where the keyboard is primary. */
    opacity: 0.9,
    opacityDesktop: 0.45,
  },
  audio: {
    /** Master volume, 0 to 1. `M` mutes; `?mute` starts muted. */
    volume: 0.7,
    /** Relative volume of things happening to other players (keys, traps, catches, climbs). */
    othersVolume: 0.3,
    /** Relative volume of the light switch, heard by everyone. */
    lightsVolume: 0.85,
    /** Relative volume of the tick when a menu button is pressed. */
    clickVolume: 1,
    /** Background music volume relative to the master; 0 turns it off. `?nomusic` also turns it off. */
    musicVolume: 0.75,
    /** Seconds to fade between tracks (home screen and match). */
    musicFadeSec: 1.2,
    /**
     * A music file that is not a seamless loop (a song with an intro and an
     * ending) is looped by blending its last this-many seconds into its start.
     */
    musicLoopBlendSec: 1.5,
    /** Playback rate in a round's last `musicHurrySec` seconds, and while a ghost chase is on: faster and a little higher. */
    musicHurryRate: 1.1,
    musicHurrySec: 30,
    musicGhostRate: 1.06,
    /** Seconds to ease the rate in and out. */
    musicRateEaseSec: 0.8,
  },
  cage: {
    /** Iron cage over a trapped player (world units; the character is 0.9 tall). */
    radius: 0.4,
    height: 0.95,
    domeHeight: 0.22,
    bars: 10,
    barRadius: 0.018,
    color: 0x5a616e,
    hoopColor: 0x2f343d,
    /** It falls from this height in dropSec, with a small bounce, and lifts away in liftSec. */
    dropHeight: 1.8,
    dropSec: 0.22,
    liftSec: 0.3,
    bounce: 0.05,
  },
  fixtureLook: {
    /**
     * Map fixtures (permanent doors, obstacles, traps): every colour is turned
     * to this hue (0..1, 0.75 = violet), keeping its lightness, then darkened.
     * No placed item is violet, so fixtures stand apart from what players put down.
     */
    hue: 0.76,
    darken: 0.9,
  },
  minimap: {
    /** The map's longer side is drawn this long on screen, whatever the map size; also capped at maxVh of the window height. */
    boxPx: 150,
    maxVh: 26,
    /** Dot radius as a share of one map cell: yours, everyone else's (the same size; yours has the white ring), and the factor for players on the tower. */
    selfDot: 0.62,
    otherDot: 0.62,
    towerDotScale: 0.7,
    /** Everyone for themselves: your colour and the colour of all the others. Two teams use the team colours. */
    soloSelfColor: 0xffd23f,
    soloOtherColor: 0xff6b6b,
  },
  /** Ads and the full version (CLAUDE.md section 4.1). */
  monetize: {
    /** Seconds the placeholder rewarded ad runs before the reward is earned; the real ad's length is the network's. */
    placeholderAdSec: 5,
    /**
     * When the app cannot load a rewarded ad (offline, no fill), grant the
     * reward anyway: no ad could be shown, so nothing is lost, and the game is
     * meant to play offline. False makes the player wait for an ad instead.
     */
    grantWhenNoAd: true,
  },
    /** The tower run's pierce skill: the character turns see-through while it lasts. */
  pierce: {
    opacity: 0.45,
  },
  /** The tower run's jump skill: the step onto or off a wall is drawn as a hop. */
  jump: {
    /** Extra height at the middle of the hop, world units (a wall is 1 tall). */
    arcHeight: 0.6,
  },
  /** The character's show on the achievements page (render/showRoutine.ts). */
  show: {
    /** Idle seconds between moves, drawn from this range. */
    pauseMinSec: 1.2,
    pauseMaxSec: 2.6,
    /** How far it glances aside between moves, radians. */
    lookYaw: 0.55,
    /** Lift at the top of a hop and of a spinning flip, world units (the character is 1.6 tall). */
    hop: 0.45,
    flipHop: 0.8,
    /** Seconds of running on the spot, and of playing dead before getting up. */
    runSec: 1.6,
    playDeadSec: 1.3,
    /** Cross-fade between moves, seconds. */
    fadeSec: 0.2,
  },
  selfMarker: {
    /** Height of the arrow's tip above the feet, world units (the character is 0.9 tall). */
    height: 1.25,
    /** Cone radius and length, world units. */
    radius: 0.14,
    length: 0.26,
    /** Bob amplitude (world units) and rate (cycles per second). */
    bobAmp: 0.06,
    bobHz: 1.1,
    opacity: 0.95,
  },
  prediction: {
    /** A corrected prediction is eased into place at this rate, per second. */
    easePerSec: 12,
    /** Corrections larger than this many tiles are shown at once instead (teleports, long stalls). */
    snapBeyondTiles: 1.5,
  },
  separation: {
    /**
     * Purely visual: characters closer than `radius` (tiles) are spread out on
     * screen so models do not hide each other. The simulation lets players
     * overlap; this never moves anyone's real position.
     */
    radius: 0.45,
    /** Gap aimed for between neighbours in a group, tiles. */
    spacing: 0.45,
    /** Largest ring radius for three or more, tiles: keeps a crowd inside its tile, off the walls. */
    maxRing: 0.3,
    /** How fast the offsets settle, per second. */
    easePerSec: 12,
  },
  ghostModel: {
    /** How high the ghost model floats above the tile, world units, plus a slow bob. */
    hover: 0.12,
    bobAmp: 0.05,
    bobHz: 0.7,
  },
  keyBeam: {
    /** World units above the key. */
    height: 3.5,
    radius: 0.12,
    /** Alpha at the base; fades to 0 at the top. */
    opacity: 0.55,
    color: 0xffe08a,
  },
  metal: {
    /** Specular colour and shininess of the "metal" map themes' walls, wall tops and floors: a soft sheen, not a mirror. */
    specular: 0x3a4658,
    shininess: 28,
  },
  dark: {
    /** Residual ambient light when the map is dark; 0 is pitch black outside the circle. */
    ambient: 0.04,
    lampIntensity: 12,
    /** Higher decay = sharper edge to the visible circle. */
    lampDecay: 2,
    /** Main lamp offset from the player: up and toward the camera (south, +z), so faces are lit, not just heads. */
    lampOffsetY: 2.2,
    lampOffsetZ: 1.6,
    /** Weak fill at face height on the camera side; 0 disables it. */
    fillIntensity: 3,
    fillOffsetY: 0.9,
    fillOffsetZ: 1.2,
    /** Background colour while dark; the lit background comes from the map theme. */
    clearColor: 0x05060a,
  },
  render: {
    /** Cap the device pixel ratio to keep phones smooth. */
    maxPixelRatio: 2,
    clearColor: 0x101318,
  },
  /** Automatic quality for weak devices (render/quality.ts). ?dpr= or ?quality=off turns it off; ?quality=reset forgets. */
  quality: {
    enabled: true,
    /** Seconds after a match starts before frames count (loading, shader compile, the opening shot). */
    warmupSec: 3,
    /** Frames are judged in windows of this many seconds, by their median frame time. */
    windowSec: 4,
    /** After a step down, seconds to let things settle before judging it. */
    settleSec: 1,
    /** Below this median frame rate the pixel ratio steps down. */
    slowFps: 45,
    /** A step must raise the frame rate by this share, else it is undone and adjusting stops. */
    minGain: 0.1,
    /** Pixel ratios to step through below the device's own. */
    ratioSteps: [1.5, 1.25, 1, 0.8],
    /** Once this browser has gone to this ratio or below, the next launch also turns antialiasing off. */
    antialiasAboveRatio: 1,
  },
  loop: {
    /** Largest frame delta we accept, seconds. Tab switches must not teleport players. */
    maxFrameDeltaSec: 0.25,
  },
} as const;
