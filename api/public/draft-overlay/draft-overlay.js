const API_BASE = window.location.origin;
const socket = io(API_BASE, { transports: ['websocket', 'polling'] });

const overlay        = document.getElementById('overlay');
const nameA          = document.getElementById('team-a-name');
const nameB          = document.getElementById('team-b-name');
const picksA         = document.getElementById('picks-a');
const picksB         = document.getElementById('picks-b');
const bansA          = document.getElementById('bans-a');
const bansB          = document.getElementById('bans-b');
const firstPickA     = document.getElementById('first-pick-a');
const firstPickB     = document.getElementById('first-pick-b');
const phaseBadge     = document.getElementById('phase-badge');
const turnIndicator  = document.getElementById('turn-indicator');

// Per-container set of already-rendered codenames — prevents animation replay
const knownChars = new Map([
  [picksA, new Set()],
  [picksB, new Set()],
  [bansA,  new Set()],
  [bansB,  new Set()],
]);

const PICK_BASE = { h: 263 };
const BAN_BASE  = { h: 150 };

/**
 * Render character slots into a container.
 *
 * isRight: right-panel mode — array is reversed so the first game-pick ends up
 *   outermost (rightmost), icons pack from the right edge, and z-index is
 *   assigned so the outermost character renders on top.
 *
 * Progressive sizing: outermost character is 100% base size; each step toward
 *   center is 10% smaller (scale = 0.9^outerDistance).
 *
 * Animation: only new characters (not yet in knownChars) receive the .filled
 *   class that triggers the pop-in animation.
 */
function renderSlots(container, chars, isRight, base, progressive = true) {
  const known   = knownChars.get(container);
  const current = new Set(chars.map(c => c.codename));

  // Sync known: drop chars removed by undo so they animate again if re-added
  known.forEach(cn => { if (!current.has(cn)) known.delete(cn); });

  // Right panel: reverse render order so first pick is DOM-last = rightmost
  const ordered = isRight ? [...chars].reverse() : chars;
  const n = ordered.length;

  container.innerHTML = '';
  ordered.forEach((char, i) => {
    const isNew = !known.has(char.codename);
    if (isNew) known.add(char.codename);

    // outerDist: 0 = outermost (edge of screen), increases toward center
    const outerDist = progressive ? (isRight ? (n - 1 - i) : i) : 0;
    const scale = Math.pow(0.9, outerDist);
    const h     = Math.round(base.h * scale);

    // Outer character has highest z-index so it renders over inner ones
    // For non-progressive (bans), all slots get z-index 1
    const zIdx = progressive
      ? (isRight ? (i + 1) : (n - i))
      : 1;

    const slot = document.createElement('div');
    slot.className = isNew ? 'char-slot filled' : 'char-slot';
    slot.style.cssText = `height:${h}px;z-index:${zIdx};`;

    const img = document.createElement('img');
    img.src = `${API_BASE}${char.imagePath}`;
    img.alt = char.displayName;
    slot.appendChild(img);
    container.appendChild(slot);
  });
}

socket.on('draft:update', (state) => {
  if (!state || state.phase === 'idle') {
    overlay.classList.add('hidden');
    return;
  }
  overlay.classList.remove('hidden');

  const ruleset = state.ruleset;
  if (!ruleset) return;

  const allChars  = ruleset.characters;
  const find      = cn => allChars.find(c => c.codename === cn);

  // Left panel = original team 1 position (matches scoreboard P1 side, always)
  const team1Name = state.pendingTeam1Name || 'Team 1';
  const team2Name = state.pendingTeam2Name || 'Team 2';
  nameA.textContent = team1Name;
  nameB.textContent = team2Name;

  // rpsWinner: 1 → team1 = teamA (first pick); 2 → team2 = teamA (first pick)
  const leftIsA = !state.rpsWinner || state.rpsWinner === 1;

  renderSlots(picksA, (leftIsA ? state.teamAPicks : state.teamBPicks).map(find).filter(Boolean), false, PICK_BASE, true);
  renderSlots(bansA,  (leftIsA ? state.teamABans  : state.teamBBans ).map(find).filter(Boolean), false, BAN_BASE,  true);
  renderSlots(picksB, (leftIsA ? state.teamBPicks : state.teamAPicks).map(find).filter(Boolean), true,  PICK_BASE, true);
  renderSlots(bansB,  (leftIsA ? state.teamBBans  : state.teamABans ).map(find).filter(Boolean), true,  BAN_BASE,  true);

  firstPickA.classList.toggle('hidden', state.rpsWinner !== 1);
  firstPickB.classList.toggle('hidden', state.rpsWinner !== 2);

  const phaseLabels = { rps: 'Rock Paper Scissors', ban: 'Ban Phase', pick: 'Pick Phase', complete: 'Draft Complete' };
  phaseBadge.textContent = phaseLabels[state.phase] || state.phase.toUpperCase();

  if (state.phase === 'ban' || state.phase === 'pick') {
    const actingIsLeft = leftIsA ? (state.currentTeam === 0) : (state.currentTeam !== 0);
    turnIndicator.textContent = `${actingIsLeft ? team1Name : team2Name}'s turn`;
  } else {
    turnIndicator.textContent = '';
  }
});
