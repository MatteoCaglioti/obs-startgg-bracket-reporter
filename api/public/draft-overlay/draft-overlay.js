const API_BASE = window.location.origin;
const socket = io(API_BASE, { transports: ['websocket', 'polling'] });

const overlay = document.getElementById('overlay');
const teamAName = document.getElementById('team-a-name');
const teamBName = document.getElementById('team-b-name');
const picksA = document.getElementById('picks-a');
const picksB = document.getElementById('picks-b');
const bansA = document.getElementById('bans-a');
const bansB = document.getElementById('bans-b');
const phaseBadge = document.getElementById('phase-badge');
const turnIndicator = document.getElementById('turn-indicator');

function renderSlots(container, items, maxSlots, type, teamClass) {
  container.innerHTML = '';
  for (let i = 0; i < maxSlots; i++) {
    const char = items[i];
    if (char) {
      const slot = document.createElement('div');
      slot.className = `char-slot filled ${type} ${teamClass}`;
      const img = document.createElement('img');
      img.src = `${API_BASE}${char.imagePath}`;
      img.alt = char.displayName;
      const label = document.createElement('div');
      label.className = 'char-label';
      label.textContent = char.displayName;
      slot.appendChild(img);
      slot.appendChild(label);
      container.appendChild(slot);
    } else {
      const empty = document.createElement('div');
      empty.className = 'empty-slot';
      container.appendChild(empty);
    }
  }
}

socket.on('draft:update', (state) => {
  if (!state || state.phase === 'idle') {
    overlay.classList.add('hidden');
    return;
  }
  overlay.classList.remove('hidden');

  const ruleset = state.ruleset;
  if (!ruleset) return;

  teamAName.textContent = state.teamAName || state.pendingTeam1Name || 'Team A';
  teamBName.textContent = state.teamBName || state.pendingTeam2Name || 'Team B';

  const allChars = ruleset.characters;
  const findChar = (codename) => allChars.find(c => c.codename === codename);

  const teamSize = ruleset.teamSize;
  const bansPerTeam = { a: 0, b: 0 };
  ruleset.banOrder.forEach(t => t === 0 ? bansPerTeam.a++ : bansPerTeam.b++);

  renderSlots(picksA, state.teamAPicks.map(findChar).filter(Boolean), teamSize, 'pick', 'team-a');
  renderSlots(picksB, state.teamBPicks.map(findChar).filter(Boolean), teamSize, 'pick', 'team-b');
  renderSlots(bansA, state.teamABans.map(findChar).filter(Boolean), bansPerTeam.a, 'ban', 'team-a');
  renderSlots(bansB, state.teamBBans.map(findChar).filter(Boolean), bansPerTeam.b, 'ban', 'team-b');

  // Phase badge
  const phaseLabels = {
    rps: 'Rock Paper Scissors',
    ban: 'Ban Phase',
    pick: 'Pick Phase',
    complete: 'Draft Complete'
  };
  phaseBadge.textContent = phaseLabels[state.phase] || state.phase.toUpperCase();

  // Turn indicator
  if (state.phase === 'ban' || state.phase === 'pick') {
    const actingTeam = state.currentTeam === 0
      ? (state.teamAName || 'Team A')
      : (state.teamBName || 'Team B');
    turnIndicator.textContent = `${actingTeam}'s turn`;
  } else {
    turnIndicator.textContent = '';
  }
});
