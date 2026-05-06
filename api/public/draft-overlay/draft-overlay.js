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

// Per-container map of codename → 'pending' | 'confirmed'
// Tracks the last-known render state to determine transition animations.
const knownChars = new Map([
  [picksA, new Map()],
  [picksB, new Map()],
  [bansA,  new Map()],
  [bansB,  new Map()],
]);

const PICK_BASE = { h: 263, maxWidthRatio: 1, overlap: -88 };
const BAN_BASE  = { h: 150, maxWidthRatio: 1, overlap: -24 };

/**
 * Render character slots into a container.
 *
 * confirmedChars: characters that have been locked in (opacity 1)
 * pendingChars:   characters currently staged but not yet confirmed (opacity 0.3)
 *
 * Animations are driven by state transitions in knownChars:
 *   undefined → pending:   pop-in-pending  (slides in, ends at 0.3 opacity)
 *   undefined → confirmed: pop-in-confirmed (slides in, ends at 1.0 opacity)
 *   pending → confirmed:   confirm-flash   (brightness spike on the char pixels)
 *   confirmed → pending:   no animation    (snap to 0.3 opacity, undo scenario)
 */
function renderSlots(container, confirmedChars, pendingChars, isRight, base, progressive = true) {
  const known = knownChars.get(container);

  const confirmedSet = new Set(confirmedChars.map(c => c.codename));
  const allChars     = [...confirmedChars, ...pendingChars];
  const currentSet   = new Set(allChars.map(c => c.codename));

  // Remove chars that are no longer present (undo removed them entirely)
  known.forEach((_state, cn) => { if (!currentSet.has(cn)) known.delete(cn); });

  // Right panel: reverse so first pick ends up rightmost (DOM-last)
  const ordered = isRight ? [...allChars].reverse() : allChars;
  const n = ordered.length;

  container.innerHTML = '';
  ordered.forEach((char, i) => {
    const prevState = known.get(char.codename);
    const newState  = confirmedSet.has(char.codename) ? 'confirmed' : 'pending';

    // Determine which animation class to apply for this transition
    let animClass = '';
    if (prevState === undefined) {
      animClass = newState === 'confirmed' ? 'pop-in-confirmed' : 'pop-in-pending';
    } else if (prevState === 'pending' && newState === 'confirmed') {
      animClass = 'confirm-flash';
    }
    // confirmed→pending (undo): no animation, just opacity change via CSS class

    known.set(char.codename, newState);

    const outerDist = progressive ? (isRight ? (n - 1 - i) : i) : 0;
    const scale  = Math.pow(0.9, outerDist);
    const h      = Math.round(base.h * scale);
    const maxW   = base.maxWidthRatio ? Math.round(h * base.maxWidthRatio) : '';
    const zIdx   = progressive ? (isRight ? (i + 1) : (n - i)) : 1;

    let marginLeft = '';
    if (i > 0) {
      marginLeft = `margin-left:${base.overlap}px;`;
    }

    const offsetPct = char.portraitOffset || 0;
    const offsetPx  = offsetPct !== 0 ? Math.round(h * offsetPct / 100) : 0;
    // For left panel: shift image right (positive = away from edge).
    // For right panel: negate so the same portraitOffset value shifts toward the edge on both sides.
    const shiftPx = isRight ? -offsetPx : offsetPx;

    const slot = document.createElement('div');
    slot.className = ['char-slot', newState, animClass].filter(Boolean).join(' ');
    slot.style.cssText = `height:${h}px;z-index:${zIdx};${maxW ? `max-width:${maxW}px;` : ''}${marginLeft}`;

    const img = document.createElement('img');
    img.src = `${API_BASE}${char.imagePath}`;
    img.alt = char.displayName;
    if (shiftPx !== 0) img.style.cssText = `position:relative;left:${shiftPx}px;`;
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

  const allChars = ruleset.characters;
  const find     = cn => allChars.find(c => c.codename === cn);

  const team1Name = state.pendingTeam1Name || 'Team 1';
  const team2Name = state.pendingTeam2Name || 'Team 2';
  nameA.textContent = team1Name;
  nameB.textContent = team2Name;

  // leftIsA: left panel shows teamA picks/bans (rpsWinner=1 means team1 won and is teamA)
  const leftIsA = !state.rpsWinner || state.rpsWinner === 1;

  // Confirmed chars per panel
  const confirmedPicksLeft  = (leftIsA ? state.teamAPicks : state.teamBPicks).map(find).filter(Boolean);
  const confirmedBansLeft   = (leftIsA ? state.teamABans  : state.teamBBans ).map(find).filter(Boolean);
  const confirmedPicksRight = (leftIsA ? state.teamBPicks : state.teamAPicks).map(find).filter(Boolean);
  const confirmedBansRight  = (leftIsA ? state.teamBBans  : state.teamABans ).map(find).filter(Boolean);

  // Pending chars from staging state
  let pendingPicksLeft = [], pendingBansLeft = [], pendingPicksRight = [], pendingBansRight = [];
  if (state.staging) {
    const { codenames, action } = state.staging;
    const pendingChars  = codenames.map(find).filter(Boolean);
    const actingIsA     = state.currentTeam === 0;
    const actingIsLeft  = leftIsA ? actingIsA : !actingIsA;
    if (action === 'pick') {
      if (actingIsLeft) pendingPicksLeft  = pendingChars;
      else              pendingPicksRight = pendingChars;
    } else {
      if (actingIsLeft) pendingBansLeft  = pendingChars;
      else              pendingBansRight = pendingChars;
    }
  }

  renderSlots(picksA, confirmedPicksLeft,  pendingPicksLeft,  false, PICK_BASE, true);
  renderSlots(bansA,  confirmedBansLeft,   pendingBansLeft,   false, BAN_BASE,  true);
  renderSlots(picksB, confirmedPicksRight, pendingPicksRight, true,  PICK_BASE, true);
  renderSlots(bansB,  confirmedBansRight,  pendingBansRight,  true,  BAN_BASE,  true);

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
