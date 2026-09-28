'use strict';

// SpinSplit is entirely client-side: no account, API key, tracking, or server required.
const $ = (id) => document.getElementById(id);
const palette = ['#a28bff', '#ff85c6', '#ffcb81', '#80e5d5', '#88b7ff', '#ff9c83', '#d6a0ff', '#b8eb88', '#fba9dc', '#80dced', '#ffe08e', '#bdb1ff'];
const MAX_WHEEL_SLICES = 10; // Keep name labels readable for very large teams.
const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
const state = {
  memberCount: 10,
  members: [],
  groupCount: 2,
  groupNames: [],
  groups: [],
  remaining: [],
  visible: [],
  completedRounds: 0,
  totalRounds: 0,
  busy: false,
  wheelRotation: 0,
  session: 0,
  finished: false
};

function randomInt(upperExclusive) {
  if (!Number.isSafeInteger(upperExclusive) || upperExclusive < 1) throw new Error('Invalid random bound');
  if (globalThis.crypto?.getRandomValues) {
    const max = 0x100000000;
    const limit = max - (max % upperExclusive);
    const buffer = new Uint32Array(1);
    do { crypto.getRandomValues(buffer); } while (buffer[0] >= limit);
    return buffer[0] % upperExclusive;
  }
  return Math.floor(Math.random() * upperExclusive);
}

function shuffleCopy(items) {
  const array = items.slice();
  for (let i = array.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function defaultGroupName(index) {
  return `Group ${String(index + 1).padStart(2, '0')}`;
}

function groupLabel(index) {
  return state.groupNames[index] || defaultGroupName(index);
}

function showError(id, message) {
  const field = $(id);
  field.textContent = message;
  field.hidden = !message;
}

function validInteger(raw, min, max) {
  const value = Number(raw);
  if (!String(raw).trim() || !Number.isSafeInteger(value) || value < min || value > max) return null;
  return value;
}

function openStep(step) {
  $('hero').hidden = true;
  $('workspace').hidden = false;
  const panelIds = ['sizePanel', 'namesPanel', 'groupsPanel', 'gamePanel'];
  panelIds.forEach((id, index) => { $(id).hidden = index !== step - 1; });
  document.querySelectorAll('.step').forEach((node, index) => {
    node.classList.toggle('is-active', index === step - 1);
    node.classList.toggle('is-done', index < step - 1);
    if (index === step - 1) node.setAttribute('aria-current', 'step');
    else node.removeAttribute('aria-current');
  });
  $('newSessionTop').hidden = false;
  window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'instant' : 'smooth' });
}

function setStepperButtons() {
  $('memberMinus').disabled = Number($('memberCount').value) <= 2;
  $('memberPlus').disabled = Number($('memberCount').value) >= 150;
  $('groupMinus').disabled = Number($('groupCount').value) <= 2;
  $('groupPlus').disabled = Number($('groupCount').value) >= state.memberCount;
}

function syncGroupNameState(count) {
  state.groupNames = Array.from({ length: count }, (_, index) => state.groupNames[index] || defaultGroupName(index));
}

function updateGroupNamesCount() {
  const inputs = Array.from($('groupNamesGrid').querySelectorAll('input'));
  const ready = inputs.filter((field) => field.value.trim()).length;
  $('groupNamesCount').textContent = `${ready} / ${inputs.length} ready`;
}

function renderGroupNameFields() {
  const desiredCount = validInteger($('groupCount').value, 2, state.memberCount);
  const builder = document.querySelector('.group-name-builder');
  builder.hidden = desiredCount === null;
  if (desiredCount === null) return;
  syncGroupNameState(desiredCount);
  const grid = $('groupNamesGrid');
  grid.replaceChildren();
  const fragment = document.createDocumentFragment();

  for (let index = 0; index < desiredCount; index++) {
    const wrapper = document.createElement('label');
    wrapper.className = 'name-field group-name-field';

    const number = document.createElement('span');
    number.className = 'name-index';
    number.textContent = String(index + 1).padStart(2, '0');

    const field = document.createElement('input');
    field.type = 'text';
    field.name = `group-${index}`;
    field.autocomplete = 'off';
    field.maxLength = 60;
    field.placeholder = defaultGroupName(index);
    field.setAttribute('aria-label', `Group ${index + 1} name`);
    field.value = state.groupNames[index] || defaultGroupName(index);
    field.addEventListener('input', () => {
      state.groupNames[index] = field.value;
      updateGroupNamesCount();
      showError('groupsError', '');
    });

    wrapper.append(number, field);
    fragment.appendChild(wrapper);
  }

  grid.appendChild(fragment);
  updateGroupNamesCount();
}

$('startButton').addEventListener('click', () => { openStep(1); $('memberCount').focus(); });
$('brand').addEventListener('click', (event) => {
  event.preventDefault();
  if ($('hero').hidden) resetSession();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});
$('memberCount').addEventListener('input', () => { showError('sizeError', ''); setStepperButtons(); });
function updateGroupControls() {
  const count = validInteger($('groupCount').value, 2, state.memberCount);
  const raw = Number($('groupCount').value);
  const message = count !== null ? ''
    : String($('groupCount').value).trim() === '' || (Number.isFinite(raw) && raw < 2)
      ? 'Please increase the number of groups to at least 2.'
      : `Please enter a whole number between 2 and ${state.memberCount}.`;
  $('buildWheelButton').disabled = count === null;
  $('groupCount').setAttribute('aria-invalid', count === null ? 'true' : 'false');
  showError('groupsError', message);
  setStepperButtons();
  renderGroupNameFields();
}
$('groupCount').addEventListener('input', updateGroupControls);

for (const [buttonId, inputId, change, min, maxFn] of [
  ['memberMinus', 'memberCount', -1, 2, () => 150], ['memberPlus', 'memberCount', 1, 2, () => 150],
  ['groupMinus', 'groupCount', -1, 2, () => state.memberCount], ['groupPlus', 'groupCount', 1, 2, () => state.memberCount]
]) {
  $(buttonId).addEventListener('click', () => {
    const input = $(inputId);
    input.value = Math.min(maxFn(), Math.max(min, (Number(input.value) || 0) + change));
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.focus();
  });
}

$('sizeForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const count = validInteger($('memberCount').value, 2, 150);
  if (count === null) {
    showError('sizeError', 'Please enter a whole number between 2 and 150.');
    $('memberCount').focus();
    return;
  }
  state.memberCount = count;
  state.members = Array.from({ length: count }, (_, i) => state.members[i] ?? { id: i, name: '' });
  renderNameFields();
  $('groupCount').max = count;
  if (Number($('groupCount').value) > count) $('groupCount').value = count;
  $('groupHint').textContent = `Choose 2 to ${count} groups. Each group must have at least one member.`;
  updateGroupControls();
  openStep(2);
  $('namesGrid').querySelector('input')?.focus();
});

function updateNamesCount() {
  const inputs = Array.from($('namesGrid').querySelectorAll('input'));
  const entered = inputs.filter((field) => field.value.trim()).length;
  $('namesCount').textContent = `${entered} / ${inputs.length} entered`;
}

function renderNameFields() {
  const grid = $('namesGrid');
  grid.replaceChildren();
  const fragment = document.createDocumentFragment();
  for (let index = 0; index < state.memberCount; index++) {
    const wrapper = document.createElement('label');
    wrapper.className = 'name-field';
    const number = document.createElement('span');
    number.className = 'name-index';
    number.textContent = String(index + 1).padStart(2, '0');
    const field = document.createElement('input');
    field.type = 'text';
    field.name = `member-${index}`;
    field.autocomplete = 'off';
    field.maxLength = 80;
    field.placeholder = `Member ${index + 1}`;
    field.setAttribute('aria-label', `Member ${index + 1} name`);
    field.value = state.members[index]?.name ?? '';
    field.addEventListener('input', () => {
      state.members[index].name = field.value;
      updateNamesCount();
      showError('namesError', '');
    });
    // Pasting newline-separated names fills the current field and the fields after it.
    field.addEventListener('paste', (event) => {
      const clipboard = event.clipboardData?.getData('text') ?? '';
      if (!/[\r\n]/.test(clipboard)) return;
      event.preventDefault();
      const lines = clipboard.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      const fields = Array.from(grid.querySelectorAll('input'));
      for (let next = index; next < Math.min(fields.length, index + lines.length); next++) {
        fields[next].value = lines[next - index].slice(0, 80);
        fields[next].dispatchEvent(new Event('input', { bubbles: true }));
      }
      fields[Math.min(fields.length - 1, index + lines.length)]?.focus();
    });
    wrapper.append(number, field);
    fragment.appendChild(wrapper);
  }
  grid.appendChild(fragment);
  updateNamesCount();
  showError('namesError', '');
}

$('namesBack').addEventListener('click', () => openStep(1));
$('namesForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const fields = Array.from($('namesGrid').querySelectorAll('input'));
  const firstMissing = fields.find((field) => !field.value.trim());
  if (firstMissing) {
    showError('namesError', 'Please enter a name for every member before continuing.');
    firstMissing.focus();
    return;
  }
  state.members = fields.map((field, index) => ({ id: index, name: field.value.trim() }));
  openStep(3);
  updateGroupControls();
  $('groupCount').focus();
});

$('groupsBack').addEventListener('click', () => openStep(2));
$('groupsForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const count = validInteger($('groupCount').value, 2, state.memberCount);
  if (count === null) {
    updateGroupControls();
    $('groupCount').focus();
    return;
  }
  state.groupCount = count;
  syncGroupNameState(count);
  const fields = Array.from($('groupNamesGrid').querySelectorAll('input'));
  state.groupNames = Array.from({ length: count }, (_, index) => fields[index]?.value.trim() || defaultGroupName(index));
  openStep(4);
  prepareGame();
});

function groupColor(index) { return palette[index % palette.length]; }

function prepareGame() {
  state.session++;
  state.busy = false;
  state.finished = false;
  state.completedRounds = 0;
  state.totalRounds = Math.ceil(state.memberCount / state.groupCount);
  state.remaining = state.members.slice();
  state.groups = Array.from({ length: state.groupCount }, () => []);
  state.wheelRotation = 0;
  renderGroupCards();
  drawWheel();
  updateGameStats();
  $('gameTag').textContent = 'READY TO SPIN';
  $('gameSubtitle').textContent = state.groupCount === 1
    ? 'One lucky name per round. Everyone joins your group.'
    : 'One click starts a round. The wheel picks one name for each group.';
  $('selectionText').textContent = 'Your first round is ready.';
  $('spinButton').disabled = false;
  $('spinButton').innerHTML = '<span class="spin-symbol">✳</span> SPIN THE WHEEL <span class="spin-mini">→</span>';
  $('spinCaption').textContent = state.groupCount === 1
    ? `You have ${state.totalRounds} ${state.totalRounds === 1 ? 'spin' : 'spins'} in total.`
    : `You have ${state.totalRounds} ${state.totalRounds === 1 ? 'round' : 'rounds'} in total. Each click spins once per group.`;
  $('copyButton').hidden = true;
  $('downloadImageButton').hidden = true;
  $('resultsSection').hidden = true;
  $('resultsPoster').replaceChildren();
  $('wheelEmpty').hidden = true;
}

function renderGroupCards() {
  const parent = $('groupsList');
  parent.replaceChildren();
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < state.groupCount; i++) {
    const card = document.createElement('article');
    card.className = 'group-card';
    card.style.setProperty('--group-color', groupColor(i));

    const heading = document.createElement('div');
    heading.className = 'group-top';

    const title = document.createElement('div');
    title.className = 'group-title';
    const dot = document.createElement('span');
    dot.className = 'group-dot';
    title.append(dot, document.createTextNode(groupLabel(i)));

    const count = document.createElement('span');
    count.className = 'group-count';
    count.id = `group-count-${i}`;
    count.textContent = '0 members';

    heading.append(title, count);

    const members = document.createElement('div');
    members.className = 'group-members';
    members.id = `group-members-${i}`;
    const empty = document.createElement('span');
    empty.className = 'empty-members';
    empty.textContent = 'Waiting for the wheel...';
    members.appendChild(empty);

    card.append(heading, members);
    fragment.appendChild(card);
  }
  parent.appendChild(fragment);
  $('groupTotalLabel').textContent = `(${state.groupCount})`;
}

function updateGameStats() {
  $('roundStat').textContent = `${state.completedRounds} / ${state.totalRounds}`;
  $('remainingStat').textContent = String(state.remaining.length);
  $('groupsStat').textContent = String(state.groupCount);
  $('assignedStat').textContent = String(state.memberCount - state.remaining.length);
  const shown = state.visible.length;
  $('wheelCounter').textContent = state.remaining.length > shown
    ? `${shown} / ${state.remaining.length} names shown`
    : `${state.remaining.length} ${state.remaining.length === 1 ? 'name' : 'names'}`;
}

function drawWheel() {
  const wheel = $('wheel');
  if (state.remaining.length === 0) {
    state.visible = [];
    wheel.hidden = true;
    $('wheelEmpty').hidden = false;
    $('wheelCounter').textContent = '0 names';
    return;
  }
  wheel.hidden = false;
  $('wheelStage').classList.remove('is-revealing', 'is-spinning');
  $('wheelEmpty').hidden = true;
  state.visible = shuffleCopy(state.remaining).slice(0, MAX_WHEEL_SLICES);
  const count = state.visible.length;
  const step = 360 / count;
  const colors = state.visible.map((_, index) => {
    const start = index * step;
    const end = (index + 1) * step;
    const accent = palette[index % palette.length];
    const separator = count > 1 ? Math.min(1, step / 15) : 0;
    return `${accent} ${start}deg ${end - separator}deg, #222842 ${end - separator}deg ${end}deg`;
  }).join(', ');

  $('wheelSegments').style.background = `conic-gradient(from 0deg, ${colors})`;
  const labels = $('wheelLabels');
  labels.replaceChildren();
  const wheelDiameter = wheel.getBoundingClientRect().width || Math.min(window.innerWidth - 40, 430);
  const fontSize = count >= 9 ? (wheelDiameter < 340 ? 8 : wheelDiameter < 430 ? 9 : 12)
    : (wheelDiameter < 340 ? 10 : wheelDiameter < 430 ? 11 : 13);
  const chipRadius = wheelDiameter * (count >= 8 ? 0.325 : 0.315);
  const chipWidth = Math.max(39, Math.min(135, wheelDiameter * Math.PI * 0.59 / count));

  state.visible.forEach((member, index) => {
    const chip = document.createElement('span');
    chip.className = 'wheel-chip';
    chip.textContent = member.name;
    chip.title = member.name;
    chip.style.setProperty('--angle', `${index * step + step / 2}deg`);
    chip.style.setProperty('--unangle', `${-(index * step + step / 2)}deg`);
    chip.style.setProperty('--chip-radius', `-${chipRadius}px`);
    chip.style.setProperty('--chip-width', `${chipWidth}px`);
    chip.style.setProperty('--chip-font', `${fontSize}px`);
    labels.appendChild(chip);
  });

  wheel.style.transition = 'none';
  state.wheelRotation = 0;
  wheel.style.transform = 'rotate(0deg)';
  updateGameStats();
}

function addMemberToGroup(member, groupIndex) {
  const target = state.groups[groupIndex];
  target.push(member);
  const container = $(`group-members-${groupIndex}`);
  container.querySelector('.empty-members')?.remove();
  const chip = document.createElement('span');
  chip.className = 'group-member';
  const symbol = document.createElement('span');
  symbol.textContent = '✦';
  chip.append(symbol, document.createTextNode(member.name));
  container.appendChild(chip);
  $(`group-count-${groupIndex}`).textContent = `${target.length} ${target.length === 1 ? 'member' : 'members'}`;
}

const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

async function spinOne(groupIndex, session) {
  if (session !== state.session || !state.remaining.length) return;
  const selectedIndex = randomInt(state.visible.length);
  const member = state.visible[selectedIndex];
  const degreesPerSlice = 360 / state.visible.length;
  const sliceCenter = (selectedIndex + 0.5) * degreesPerSlice;
  const alignment = ((360 - sliceCenter - (state.wheelRotation % 360)) % 360 + 360) % 360;
  state.wheelRotation += (5 + randomInt(3)) * 360 + alignment;

  $('selectionText').textContent = `Spinning for ${groupLabel(groupIndex)}...`;
  $('gameTag').textContent = `ROUND ${state.completedRounds + 1} · ${groupLabel(groupIndex).toUpperCase()}`;
  const duration = prefersReducedMotion ? 20 : (state.groupCount >= 6 ? 1200 : 2100);
  const wheel = $('wheel');
  $('wheelStage').classList.add('is-spinning');
  wheel.style.transition = `transform ${duration}ms cubic-bezier(.12,.72,.12,1)`;
  void wheel.offsetWidth;
  wheel.style.transform = `rotate(${state.wheelRotation}deg)`;
  await sleep(duration + 65);
  if (session !== state.session) return;
  $('wheelStage').classList.remove('is-spinning');
  $('wheelStage').classList.add('is-revealing');

  const remainingIndex = state.remaining.findIndex((entry) => entry.id === member.id);
  if (remainingIndex === -1) return;
  state.remaining.splice(remainingIndex, 1);
  addMemberToGroup(member, groupIndex);
  $('selectionText').textContent = `🎉 ${member.name} joins ${groupLabel(groupIndex)}!`;
  updateGameStats();
  await sleep(prefersReducedMotion ? 0 : 410);
  if (session !== state.session) return;
  drawWheel();
}

async function finishGame(button) {
  state.finished = true;
  $('gameTag').textContent = 'ALL GROUPS COMPLETE';
  $('selectionText').textContent = '🎉 All done! Every member has a group.';
  button.disabled = true;
  button.innerHTML = '<span class="spin-symbol">✓</span> ALL GROUPS FILLED';
  $('spinCaption').textContent = 'All members have been assigned exactly once.';
  $('copyButton').hidden = false;
  $('downloadImageButton').hidden = false;
  $('resultsSection').hidden = false;
  renderResultsPoster();
  throwConfetti();
  window.setTimeout(() => {
    $('resultsSection').scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
  }, prefersReducedMotion ? 0 : 220);
}

async function playRound(autoTriggered = false) {
  if (state.busy || state.finished || !state.remaining.length) return;
  state.busy = true;
  const session = state.session;
  const button = $('spinButton');
  button.disabled = true;
  button.innerHTML = autoTriggered
    ? '<span class="spin-symbol">⚡</span> AUTO FINISHING...'
    : '<span class="spin-symbol">✳</span> SPINNING...';

  for (let groupIndex = 0; groupIndex < state.groupCount && state.remaining.length; groupIndex++) {
    await spinOne(groupIndex, session);
    if (session !== state.session) return;
  }

  state.completedRounds++;
  state.busy = false;
  updateGameStats();

  if (state.remaining.length === 0) {
    await finishGame(button);
    return;
  }

  if (state.remaining.length <= state.groupCount) {
    $('gameTag').textContent = 'FINAL AUTO ROUND';
    $('selectionText').textContent = `Only ${state.remaining.length} member${state.remaining.length === 1 ? '' : 's'} left. Auto-finishing the last round...`;
    button.disabled = true;
    button.innerHTML = '<span class="spin-symbol">⚡</span> AUTO FINISHING...';
    $('spinCaption').textContent = 'The remaining members will be placed automatically.';
    await sleep(prefersReducedMotion ? 30 : 900);
    if (session !== state.session || state.finished) return;
    await playRound(true);
    return;
  }

  $('gameTag').textContent = `ROUND ${state.completedRounds} COMPLETE`;
  $('selectionText').textContent = `✦ Round ${state.completedRounds} finished. Ready for the next?`;
  button.disabled = false;
  button.innerHTML = '<span class="spin-symbol">✳</span> SPIN NEXT ROUND <span class="spin-mini">→</span>';
  $('spinCaption').textContent = `${state.totalRounds - state.completedRounds} ${state.totalRounds - state.completedRounds === 1 ? 'round' : 'rounds'} remaining.`;
}

$('spinButton').addEventListener('click', () => { void playRound(false); });

function throwConfetti() {
  if (prefersReducedMotion) return;
  const layer = $('confettiLayer');
  layer.replaceChildren();
  const pieces = Math.min(95, 35 + state.memberCount * 2);
  for (let i = 0; i < pieces; i++) {
    const piece = document.createElement('span');
    piece.className = 'confetti';
    piece.style.left = `${randomInt(1000) / 10}%`;
    piece.style.background = palette[randomInt(palette.length)];
    piece.style.setProperty('--duration', `${2.7 + randomInt(190) / 100}s`);
    piece.style.setProperty('--delay', `${randomInt(90) / 100}s`);
    piece.style.setProperty('--drift', `${randomInt(280) - 140}px`);
    piece.style.setProperty('--rotate', `${randomInt(1500) - 750}deg`);
    layer.appendChild(piece);
  }
  setTimeout(() => layer.replaceChildren(), 6000);
}

function renderResultsPoster() {
  const poster = $('resultsPoster');
  poster.replaceChildren();

  const hero = document.createElement('div');
  hero.className = 'results-hero';

  const badge = document.createElement('span');
  badge.className = 'results-badge';
  badge.textContent = 'Spin complete';

  const title = document.createElement('h4');
  title.textContent = 'Final team result';

  const subtitle = document.createElement('p');
  subtitle.textContent = `${state.memberCount} member${state.memberCount === 1 ? '' : 's'} split into ${state.groupCount} group${state.groupCount === 1 ? '' : 's'} in ${state.completedRounds} round${state.completedRounds === 1 ? '' : 's'}.`;

  const stats = document.createElement('div');
  stats.className = 'results-stats';
  for (const label of [
    `${state.memberCount} Members`,
    `${state.groupCount} Groups`,
    `${state.completedRounds} Rounds`
  ]) {
    const stat = document.createElement('span');
    stat.className = 'results-stat-pill';
    stat.textContent = label;
    stats.appendChild(stat);
  }

  hero.append(badge, title, subtitle, stats);

  const grid = document.createElement('div');
  grid.className = 'results-groups-grid';

  state.groups.forEach((members, index) => {
    const card = document.createElement('article');
    card.className = 'result-group-card';
    card.style.setProperty('--group-color', groupColor(index));

    const top = document.createElement('div');
    top.className = 'result-group-top';

    const heading = document.createElement('div');
    heading.className = 'result-group-title';
    const dot = document.createElement('span');
    dot.className = 'result-group-dot';
    const headingText = document.createElement('span');
    headingText.textContent = groupLabel(index);
    heading.append(dot, headingText);

    const count = document.createElement('span');
    count.className = 'result-group-count';
    count.textContent = `${members.length} ${members.length === 1 ? 'member' : 'members'}`;

    top.append(heading, count);

    const list = document.createElement('div');
    list.className = 'result-members-list';
    members.forEach((member) => {
      const item = document.createElement('span');
      item.className = 'result-member-pill';
      item.textContent = member.name;
      list.appendChild(item);
    });

    card.append(top, list);
    grid.appendChild(card);
  });

  const footer = document.createElement('div');
  footer.className = 'results-footer';
  footer.textContent = 'Made with SpinSplit • Random teams, beautiful results';

  poster.append(hero, grid, footer);
}

function roundRect(ctx, x, y, width, height, radius, fill, stroke) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}

function wrapText(ctx, text, maxWidth) {
  const words = String(text).split(/\s+/).filter(Boolean);
  if (!words.length) return [''];
  const lines = [];
  let current = words[0];
  for (let i = 1; i < words.length; i++) {
    const candidate = `${current} ${words[i]}`;
    if (ctx.measureText(candidate).width <= maxWidth) current = candidate;
    else {
      lines.push(current);
      current = words[i];
    }
  }
  lines.push(current);
  return lines;
}

function downloadResultsImage() {
  if (!state.finished) return;

  const width = 1600;
  const padding = 64;
  const contentWidth = width - padding * 2;
  const columns = state.groupCount <= 2 ? 2 : state.groupCount <= 4 ? 2 : 3;
  const gap = 28;
  const cardWidth = (contentWidth - gap * (columns - 1)) / columns;
  const headerHeight = 245;

  const measureCanvas = document.createElement('canvas');
  measureCanvas.width = width;
  measureCanvas.height = 100;
  const measureCtx = measureCanvas.getContext('2d');
  measureCtx.font = '500 23px Arial, sans-serif';

  const cards = state.groups.map((members, index) => {
    const innerPad = 26;
    const titleHeight = 52;
    const memberStartOffset = 146;
    const memberLineHeight = 27;
    const memberGap = 10;
    const wrapWidth = cardWidth - 54;

    let contentHeight = memberStartOffset;

    if (members.length) {
      members.forEach((member, memberIndex) => {
        const bullet = `${memberIndex + 1}. ${member.name}`;
        const lines = wrapText(measureCtx, bullet, wrapWidth);
        contentHeight += lines.length * memberLineHeight + memberGap;
      });
    } else {
      contentHeight += memberLineHeight + memberGap;
    }

    const height = Math.max(220, innerPad + titleHeight + innerPad, contentHeight + innerPad - 8);
    return {
      index,
      title: groupLabel(index),
      members,
      height
    };
  });

  const rowHeights = [];
  for (let i = 0; i < cards.length; i += columns) {
    const row = cards.slice(i, i + columns);
    rowHeights.push(Math.max(...row.map((card) => card.height)));
  }

  const totalRowsHeight = rowHeights.reduce((sum, value) => sum + value, 0) + gap * Math.max(0, rowHeights.length - 1);
  const footerHeight = 84;
  const height = headerHeight + totalRowsHeight + footerHeight + padding;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, '#0b1021');
  bg.addColorStop(0.55, '#131b34');
  bg.addColorStop(1, '#19182f');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  const glow1 = ctx.createRadialGradient(220, 140, 0, 220, 140, 340);
  glow1.addColorStop(0, 'rgba(160, 118, 255, 0.33)');
  glow1.addColorStop(1, 'rgba(160, 118, 255, 0)');
  ctx.fillStyle = glow1;
  ctx.fillRect(0, 0, width, height);

  const glow2 = ctx.createRadialGradient(width - 180, 220, 0, width - 180, 220, 300);
  glow2.addColorStop(0, 'rgba(252, 118, 198, 0.25)');
  glow2.addColorStop(1, 'rgba(252, 118, 198, 0)');
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  roundRect(ctx, 28, 28, width - 56, height - 56, 34, true, true);

  ctx.fillStyle = '#ffffff';
  ctx.font = '800 58px Arial, sans-serif';
  ctx.fillText('SpinSplit Final Team Result', padding, 96);

  ctx.fillStyle = 'rgba(255,255,255,0.84)';
  ctx.font = '500 26px Arial, sans-serif';
  const subtitle = `${state.memberCount} members • ${state.groupCount} groups • ${state.completedRounds} rounds`;
  ctx.fillText(subtitle, padding, 138);

  const pills = [
    `${state.memberCount} Members`,
    `${state.groupCount} Groups`,
    `${state.completedRounds} Rounds`
  ];
  let pillX = padding;
  const pillY = 172;
  for (const pill of pills) {
    ctx.font = '700 22px Arial, sans-serif';
    const pillWidth = ctx.measureText(pill).width + 34;
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    roundRect(ctx, pillX, pillY, pillWidth, 44, 22, true, true);
    ctx.fillStyle = '#f5f7ff';
    ctx.fillText(pill, pillX + 17, pillY + 29);
    pillX += pillWidth + 14;
  }

  let y = headerHeight;
  cards.forEach((card, cardIndex) => {
    const row = Math.floor(cardIndex / columns);
    const col = cardIndex % columns;
    const x = padding + col * (cardWidth + gap);
    if (col === 0 && cardIndex !== 0) y += rowHeights[row - 1] + gap;
    const cardHeight = rowHeights[row];

    ctx.fillStyle = 'rgba(18, 24, 46, 0.92)';
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    roundRect(ctx, x, y, cardWidth, cardHeight, 28, true, true);

    const accent = groupColor(card.index);
    ctx.fillStyle = accent;
    roundRect(ctx, x + 18, y + 18, cardWidth - 36, 56, 18, true, false);

    ctx.fillStyle = '#251f3b';
    ctx.beginPath();
    ctx.arc(x + 48, y + 46, 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#241e3b';
    ctx.font = '800 28px Arial, sans-serif';
    ctx.fillText(card.title, x + 72, y + 54);

    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    ctx.font = '600 20px Arial, sans-serif';
    const countText = `${card.members.length} ${card.members.length === 1 ? 'member' : 'members'}`;
    ctx.fillText(countText, x + 24, y + 108);

    ctx.font = '500 23px Arial, sans-serif';
    ctx.fillStyle = '#ffffff';
    let lineY = y + 146;
    card.members.forEach((member, memberIndex) => {
      const bullet = `${memberIndex + 1}. ${member.name}`;
      const lines = wrapText(ctx, bullet, cardWidth - 54);
      lines.forEach((line, lineIndex) => {
        ctx.fillText(line, x + 24, lineY + lineIndex * 27);
      });
      lineY += lines.length * 27 + 10;
    });
  });

  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '500 20px Arial, sans-serif';
  ctx.fillText('Made with SpinSplit • Random teams, beautiful results', padding, height - 44);

  const triggerDownload = (url) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = 'spinsplit-results.png';
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  if (canvas.toBlob) {
    canvas.toBlob((blob) => {
      if (!blob) {
        triggerDownload(canvas.toDataURL('image/png'));
        return;
      }
      const objectUrl = URL.createObjectURL(blob);
      triggerDownload(objectUrl);
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
    }, 'image/png');
  } else {
    triggerDownload(canvas.toDataURL('image/png'));
  }
}

function resetSession() {
  state.session++;
  state.busy = false;
  state.finished = false;
  state.members = [];
  state.groupNames = [];
  state.memberCount = 10;
  state.groupCount = 2;
  $('memberCount').value = '10';
  $('groupCount').value = '2';
  updateGroupControls();
  $('confettiLayer').replaceChildren();
  $('resultsPoster').replaceChildren();
  $('resultsSection').hidden = true;
  $('workspace').hidden = true;
  $('hero').hidden = false;
  $('newSessionTop').hidden = true;
  showError('sizeError', '');
  showError('namesError', '');
  showError('groupsError', '');
  window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'instant' : 'smooth' });
}

$('newSessionTop').addEventListener('click', resetSession);
$('gameRestart').addEventListener('click', resetSession);
$('copyButton').addEventListener('click', async () => {
  const results = state.groups.map((members, index) => `${groupLabel(index)}\n${members.map((member) => `- ${member.name}`).join('\n')}`).join('\n\n');
  let copied = false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(results);
      copied = true;
    }
  } catch (_) {
    /* Some file:// browsers block the Clipboard API. */
  }
  if (!copied) {
    const field = document.createElement('textarea');
    field.value = results;
    field.style.position = 'fixed';
    field.style.opacity = '0';
    document.body.appendChild(field);
    field.select();
    try { copied = document.execCommand('copy'); } catch (_) { copied = false; }
    field.remove();
  }
  $('copyButton').textContent = copied ? '✓ Results copied!' : 'Copy not available in this browser';
});
$('downloadImageButton').addEventListener('click', downloadResultsImage);

window.addEventListener('resize', () => {
  if (!$('gamePanel').hidden && !state.busy && !state.finished) drawWheel();
});

updateGroupControls();
