const API_BASE = window.location.origin;
const socket = io(API_BASE, { transports: ['websocket', 'polling'] });

const overlay      = document.getElementById('overlay');
const nameA        = document.getElementById('team-a-name');
const nameB        = document.getElementById('team-b-name');
const picksA       = document.getElementById('picks-a');
const picksB       = document.getElementById('picks-b');
const bansA        = document.getElementById('bans-a');
const bansB        = document.getElementById('bans-b');
const firstPickA   = document.getElementById('first-pick-a');
const firstPickB   = document.getElementById('first-pick-b');
const phaseBadge   = document.getElementById('phase-badge');
const turnIndicator = document.getElementById('turn-indicator');

function renderSlots(container, chars) {
  container.innerHTML = '';
  chars.forEach(char => {
    if (!char) return;
    const slot = document.createElement('div');
    slot.className = 'char-slot filled';
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

  const allChars = ruleset.characters;
  const findChar = (codename) => allChars.find(c => c.codename === codename);

  // Left panel = original team 1 position (matches scoreboard P1 side, always).
  // Right panel = original team 2 position.
  // rpsWinner: 1 → team1 is teamA (first pick); 2 → team2 is teamA (first pick).
  const team1Name = state.pendingTeam1Name || 'Team 1';
  const team2Name = state.pendingTeam2Name || 'Team 2';
  nameA.textContent = team1Name;
  nameB.textContent = team2Name;

  const leftIsA = !state.rpsWinner || state.rpsWinner === 1;

  renderSlots(picksA, (leftIsA ? state.teamAPicks : state.teamBPicks).map(findChar).filter(Boolean));
  renderSlots(bansA,  (leftIsA ? state.teamABans  : state.teamBBans ).map(findChar).filter(Boolean));
  renderSlots(picksB, (leftIsA ? state.teamBPicks : state.teamAPicks).map(findChar).filter(Boolean));
  renderSlots(bansB,  (leftIsA ? state.teamBBans  : state.teamABans ).map(findChar).filter(Boolean));

  // First pick badge
  firstPickA.classList.toggle('hidden', state.rpsWinner !== 1);
  firstPickB.classList.toggle('hidden', state.rpsWinner !== 2);

  // Phase badge
  const phaseLabels = { rps: 'Rock Paper Scissors', ban: 'Ban Phase', pick: 'Pick Phase', complete: 'Draft Complete' };
  phaseBadge.textContent = phaseLabels[state.phase] || state.phase.toUpperCase();

  // Turn indicator — map currentTeam (0=teamA, 1=teamB) back to original position name
  if (state.phase === 'ban' || state.phase === 'pick') {
    const actingIsA    = state.currentTeam === 0;
    const actingIsLeft = leftIsA ? actingIsA : !actingIsA;
    turnIndicator.textContent = `${actingIsLeft ? team1Name : team2Name}'s turn`;
  } else {
    turnIndicator.textContent = '';
  }
});
