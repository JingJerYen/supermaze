import type { rules as zh } from "../zh-Hant/rules.js";

export const rules: Record<keyof typeof zh, string> = {
  "rules.goal.title": "Goal: get a key, climb the tower",
  "rules.goal.line1": "Everyone must find their own key in the maze. A light beam rises above each key.",
  "rules.goal.line2": "Then go to any door of the tower, face it, and press the action button to climb to the tower top.",
  "rules.goal.line3": "After you climb you can't go back into the maze. The sooner you reach the top, the more placement points.",

  "rules.move.title": "Moving: tap to turn, hold to walk",
  "rules.move.line1": "Tap the direction pad and your character just turns on the spot.",
  "rules.move.line2": "Hold it to start walking. Items always go on the tile in front of you, so turn first, then place.",
  "rules.move.line3": "Corridors are one tile wide, but players pass through each other and never get stuck.",

  "rules.levels.title": "Stairs, wall tops and bridges",
  "rules.levels.line1": "The maze has two levels: the paths on the ground and the tops of the walls. You can walk on both.",
  "rules.levels.line2": "Only stairs take you up to a wall top or back down. You can't jump up or jump off.",
  "rules.levels.line3": "Bridges join wall tops, and the path under a bridge stays open. Keys and item boxes can be on wall tops too.",

  "rules.bag.title": "Item boxes and your bag",
  "rules.bag.line1": "Walk over an item box to open it; contents are random. Your bag holds three items, and a full bag can't open boxes.",
  "rules.bag.line2": "First in, first out: the big round button at bottom right is your next item. Press it to use it; no choosing.",
  "rules.bag.line3": "Don't want what's in the big round button? Press the discard button above it, and the next item moves up.",

  "rules.obstacleHammer.title": "Barrier and Hammer",
  "rules.obstacleHammer.line1": "A Barrier goes on the tile in front of you and blocks everyone, including you and your teammates.",
  "rules.obstacleHammer.line2": "It vanishes after {obstacleSec} seconds, or when a Hammer breaks it.",
  "rules.obstacleHammer.line3": "A Hammer breaks the Barrier, Trap, One-way Door or Teleporter in front of you. A miss still uses it up.",

  "rules.door.title": "One-way Door",
  "rules.door.line1": "A One-way Door goes on the tile in front of you. People pass only the way you faced; a floor arrow shows it.",
  "rules.door.line2": "You can pass with the arrow; going against it is blocked.",
  "rules.door.line3": "It works on everyone, even whoever placed it. It vanishes after {doorSec} seconds.",

  "rules.trap.title": "Trap",
  "rules.trap.line1": "A Trap goes on the tile in front of you. The first to step on it is caged for {trapFreezeSec} seconds: no moving, no items.",
  "rules.trap.line2": "A Trap vanishes once it catches someone, or after {trapSec} seconds if nobody steps on it.",
  "rules.trap.line3": "It catches anyone, even you. Catching someone from another team scores points.",

  "rules.teleport.title": "Teleporter",
  "rules.teleport.line1": "Teleporters only link up in pairs. Each is a disc in your team color on the floor, with a light beam once linked.",
  "rules.teleport.line2": "Step on one and you instantly appear at the other. Only your own team can use them.",
  "rules.teleport.line3": "Stand on your team's Teleporter and press the action button to put it back in your bag, then place it elsewhere.",

  "rules.fixtures.title": "Built-in traps",
  "rules.fixtures.line1": "Some Barriers, Traps and One-way Doors are on the map from the start. They are purple.",
  "rules.fixtures.line2": "They never vanish on their own; only a Hammer removes them. A Trap still vanishes once it catches someone.",
  "rules.fixtures.line3": "When one blocks your way, open item boxes to find a Hammer.",

  "rules.lights.title": "Light switches and darkness",
  "rules.lights.line1": "Stand on a glowing switch tile and press the action button to turn the lights off or on for everyone.",
  "rules.lights.line2": "Darkness shrinks everyone's view and hides others on the minimap: dodge ghosts, lose rivals. CPUs see less too. Key beams still show.",
  "rules.lights.line3": "Each switch works once. To switch again, find another switch that is still lit.",

  "rules.ghost.title": "Ghost Tag",
  "rules.ghost.line1": "Every so often one side becomes ghosts for {ghostDurationSec} seconds, with a countdown at the top first.",
  "rules.ghost.line2": "Ghosts are faster. If one touches you, you lose your items and freeze for {caughtFreezeSec} seconds; a ghost with no key steals yours.",
  "rules.ghost.line3": "Players on the tower top are safe, so climb early once you have a key.",

  "rules.scoring.title": "Scoring and winning",
  "rules.scoring.line1": "Team Battle: the first team to get everyone onto the tower top wins, and each member's score is doubled.",
  "rules.scoring.line2": "Free-for-All: the highest score when the round ends wins.",
  "rules.scoring.line3": "The round ends when only one person hasn't climbed, or when time runs out. No climb, no placement points.",

  "rules.towerRun.title": "Solo Mode",
  "rules.towerRun.line1": "Solo mode is a {floors}-floor climb: each floor is a race against CPUs on score. It gets harder as you go up.",
  "rules.towerRun.line2": "The floor ends when you climb. Score in the top half to advance; floor scores add up to your total.",
  "rules.towerRun.line3": "Pick a skill before each floor and use it once with R or the skill button. Miss the cut and you can Continue, up to 2 times.",

  // Names of the demo players, shown over their heads and in the HUD's notices.
  "rules.name.you": "You",
  "rules.name.foe": "Rival",

  // The scoring card's table.
  "rules.table.placement": "Climb placement (1st onward)",
  "rules.table.keyFound": "Getting your key",
  "rules.table.ghostCatch": "Catching someone as a ghost",
  "rules.table.trapCatch": "Your Trap catching another team",
  "rules.table.lightSwitch": "Turning the lights on or off",
  "rules.table.leftoverItem": "Each item left when you climb",
  "rules.table.winMultiplier": "Winning team bonus (Team Battle)",

  // The tower-run card's table.
  "rules.table.passRank": "Advance if in",
  "rules.table.passRankItem": "top {rank} of {n}",
  "rules.table.listSep": " · ",
  "rules.table.cpu": "CPU",
  "rules.table.cpuValue": "{min}–{max}, stronger as you go up",
  "rules.table.floors": "Floors {from}–{to}",
  "rules.table.map.easy": "Easy maps",
  "rules.table.map.medium": "Medium maps",
  "rules.table.map.hard": "Hard maps",
  "rules.table.specialFloors": "Floors {floors}",
  "rules.table.floorSep": ", ",

  // The rules screen around the cards.
  "rules.screen.page": "Rules {page} / {total}",
  "rules.screen.prev": "Back",
  "rules.screen.next": "Next",
  "rules.screen.home": "Home",
};
