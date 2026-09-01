type TerminalEntry = {
  name: string;
  kind: 'dir' | 'file';
};

type TerminalResponse = {
  command: string;
  cwd: string;
  lines: string[];
  entries?: TerminalEntry[];
  exitCode: number;
  clear?: boolean;
  close?: boolean;
};

const terminal = document.querySelector<HTMLElement>('[data-terminal]');
const screen = terminal?.querySelector<HTMLElement>('[data-terminal-screen]');
const output = terminal?.querySelector<HTMLElement>('[data-terminal-output]');
const form = terminal?.querySelector<HTMLFormElement>('[data-terminal-form]');
const input = terminal?.querySelector<HTMLInputElement>('[data-terminal-input]');
const pathLabel = terminal?.querySelector<HTMLElement>('[data-terminal-path]');
const title = terminal?.querySelector<HTMLElement>('[data-terminal-title]');
const renderCommand = terminal?.querySelector<HTMLElement>('[data-terminal-render-command]');
const renderRest = terminal?.querySelector<HTMLElement>('[data-terminal-render-rest]');
const suggestionNode = terminal?.querySelector<HTMLElement>('[data-terminal-suggestion]');
const openers = document.querySelectorAll<HTMLElement>('[data-terminal-open]');
const closer = terminal?.querySelector<HTMLButtonElement>('[data-terminal-close]');

const commands = [
  'help',
  'fastfetch',
  'whoami',
  'projects',
  'stack',
  'trace',
  'runtime',
  'health',
  'pwd',
  'ls',
  'cd',
  'cat',
  'github',
  'clear',
  'exit',
];

const entriesByCWD: Record<string, TerminalEntry[]> = {
  '/': [
    { name: 'architecture/', kind: 'dir' },
    { name: 'projects/', kind: 'dir' },
    { name: 'infrastructure/', kind: 'dir' },
    { name: 'about/', kind: 'dir' },
    { name: 'README.md', kind: 'file' },
  ],
  '/architecture': [
    { name: 'system.md', kind: 'file' },
    { name: 'boundaries.md', kind: 'file' },
  ],
  '/projects': [
    { name: 'minecartainer/', kind: 'dir' },
    { name: 'mc-router/', kind: 'dir' },
    { name: 'yw1-iv-calculator/', kind: 'dir' },
  ],
  '/projects/minecartainer': [{ name: 'README.md', kind: 'file' }],
  '/projects/mc-router': [{ name: 'README.md', kind: 'file' }],
  '/projects/yw1-iv-calculator': [{ name: 'README.md', kind: 'file' }],
  '/infrastructure': [{ name: 'home-kubernetes.md', kind: 'file' }],
  '/about': [{ name: 'profile.md', kind: 'file' }],
};

const history: string[] = [];
let historyIndex = 0;
let cwd = '/';
let suggestion = '';
let lastFocused: HTMLElement | null = null;

function displayPath(value: string) {
  return value === '/' ? '~/portfolio' : `~/portfolio${value}`;
}

function setPromptPath(value: string) {
  const visible = displayPath(value);
  if (pathLabel) pathLabel.textContent = visible;
  if (title) title.textContent = visible;
}

function scrollToPrompt() {
  if (!screen) return;
  requestAnimationFrame(() => {
    screen.scrollTop = screen.scrollHeight;
  });
}

function terminalFocusableItems() {
  if (!terminal) return [];
  return Array.from(terminal.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'))
    .filter((item) => item.tabIndex !== -1 && !item.closest('[inert]'));
}

function fallbackOpener() {
  return Array.from(openers).find((opener) => opener.offsetParent !== null && !opener.closest('[inert]')) ?? null;
}

function restoreTerminalFocus() {
  const target = lastFocused?.isConnected && !lastFocused.closest('[inert]')
    ? lastFocused
    : fallbackOpener();
  requestAnimationFrame(() => target?.focus());
}

function setOpen(open: boolean, restoreFocus = true) {
  if (!terminal) return;

  if (open && terminal.dataset.open !== 'true') {
    lastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : fallbackOpener();
  }

  terminal.dataset.open = open ? 'true' : 'false';
  terminal.setAttribute('aria-hidden', open ? 'false' : 'true');
  terminal.toggleAttribute('inert', !open);
  document.documentElement.dataset.terminal = open ? 'open' : 'closed';
  openers.forEach((opener) => opener.setAttribute('aria-expanded', open ? 'true' : 'false'));

  if (open) {
    requestAnimationFrame(() => {
      input?.focus();
      scrollToPrompt();
    });
  } else if (restoreFocus) {
    restoreTerminalFocus();
  }
}

function commandIsKnown(value: string) {
  const name = value.trim().split(/\s+/, 1)[0]?.toLowerCase() ?? '';
  return name === '' || commands.includes(name) || name === 'neofetch';
}

function completionCandidates(value: string) {
  const trimmedStart = value.trimStart();
  const firstSpace = trimmedStart.search(/\s/);
  if (firstSpace === -1) return commands;

  const name = trimmedStart.slice(0, firstSpace).toLowerCase();
  const argument = trimmedStart.slice(firstSpace).trimStart();
  const currentEntries = entriesByCWD[cwd] ?? [];

  if (name === 'trace') {
    return [
      'trace --system',
      'trace --network',
      'trace --deployment',
      'trace --runtime',
      'trace --state',
      'trace --help',
    ].filter((candidate) => candidate.toLowerCase().startsWith(trimmedStart.toLowerCase()));
  }

  if (name === 'cd') {
    return ['~', '..', ...currentEntries.filter((entry) => entry.kind === 'dir').map((entry) => entry.name.replace(/\/$/, ''))]
      .map((entry) => `cd ${entry}`)
      .filter((candidate) => candidate.toLowerCase().startsWith(`cd ${argument}`.toLowerCase()));
  }

  if (name === 'cat') {
    return currentEntries
      .filter((entry) => entry.kind === 'file')
      .map((entry) => `cat ${entry.name}`)
      .filter((candidate) => candidate.toLowerCase().startsWith(`cat ${argument}`.toLowerCase()));
  }

  if (name === 'ls') {
    return currentEntries
      .map((entry) => `ls ${entry.name.replace(/\/$/, '')}`)
      .filter((candidate) => candidate.toLowerCase().startsWith(`ls ${argument}`.toLowerCase()));
  }

  return [];
}

function findSuggestion(value: string) {
  if (!value) return '';
  const normalized = value.toLowerCase();

  const historyMatch = [...history].reverse().find((item) => item.length > value.length && item.toLowerCase().startsWith(normalized));
  if (historyMatch) return historyMatch;

  return completionCandidates(value).find((candidate) => candidate.length > value.length && candidate.toLowerCase().startsWith(normalized)) ?? '';
}

function renderInput() {
  if (!input || !renderCommand || !renderRest || !suggestionNode) return;

  const value = input.value;
  const firstSpace = value.search(/\s/);
  const commandPart = firstSpace === -1 ? value : value.slice(0, firstSpace);
  const restPart = firstSpace === -1 ? '' : value.slice(firstSpace);

  renderCommand.textContent = commandPart;
  renderCommand.className = commandIsKnown(value) ? 'fish-command-valid' : 'fish-command-invalid';
  renderRest.textContent = restPart;

  suggestion = findSuggestion(value);
  suggestionNode.textContent = suggestion ? suggestion.slice(value.length) : '';
}

function appendPrompt(command: string, promptCWD: string) {
  if (!output) return;

  const row = document.createElement('div');
  row.className = 'terminal-message terminal-command';

  const promptPath = document.createElement('span');
  promptPath.className = 'terminal-history-path';
  promptPath.textContent = displayPath(promptCWD);

  const chevron = document.createElement('span');
  chevron.className = 'terminal-history-chevron';
  chevron.textContent = '❯';

  const text = document.createElement('span');
  text.className = commandIsKnown(command) ? 'terminal-history-command valid' : 'terminal-history-command invalid';
  text.textContent = command;

  row.append(promptPath, chevron, text);
  output.append(row);
}

const terminalURLPattern = /https?:\/\/[^\s<>"'`]+/g;

function appendTerminalText(parent: HTMLElement, text: string) {
  let offset = 0;

  for (const match of text.matchAll(terminalURLPattern)) {
    const start = match.index ?? 0;
    const rawURL = match[0];

    if (start > offset) parent.append(document.createTextNode(text.slice(offset, start)));

    try {
      const url = new URL(rawURL);
      if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('unsupported URL protocol');

      const link = document.createElement('a');
      link.className = 'terminal-url';
      link.dataset.terminalUrl = '';
      link.href = url.href;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = rawURL;
      link.title = 'Ctrl/Cmd+Click to open in a new tab';
      link.setAttribute('aria-label', `${rawURL} — open in a new tab`);
      link.addEventListener('click', (event) => {
        event.stopPropagation();

        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          window.open(link.href, '_blank', 'noopener,noreferrer');
          return;
        }

        // Keyboard activation has detail=0 and keeps normal anchor semantics.
        // A plain pointer click stays inside the terminal; middle-click is an
        // auxclick event and therefore keeps the browser's native new-tab path.
        if (event.detail === 0) return;
        event.preventDefault();
      });
      parent.append(link);
    } catch {
      parent.append(document.createTextNode(rawURL));
    }

    offset = start + rawURL.length;
  }

  if (offset < text.length) parent.append(document.createTextNode(text.slice(offset)));
}

function appendLines(lines: string[], exitCode = 0) {
  if (!output || lines.length === 0) return;
  const block = document.createElement('pre');
  block.className = exitCode === 0 ? 'terminal-message terminal-response' : 'terminal-message terminal-error';

  lines.forEach((line, index) => {
    if (index > 0) block.append(document.createTextNode('\n'));
    appendTerminalText(block, line);
  });

  output.append(block);
}

function appendEntries(entries: TerminalEntry[]) {
  if (!output || entries.length === 0) return;
  const listing = document.createElement('div');
  listing.className = 'terminal-message terminal-listing';

  for (const entry of entries) {
    const item = document.createElement('span');
    item.className = entry.kind === 'dir' ? 'terminal-entry directory' : 'terminal-entry file';
    item.textContent = entry.name;
    listing.append(item);
  }

  output.append(listing);
}

async function run(command: string) {
  const commandCWD = cwd;
  appendPrompt(command, commandCWD);

  try {
    const response = await fetch('/api/terminal', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ command, cwd }),
    });

    if (!response.ok) throw new Error(`backend returned ${response.status}`);
    const result = await response.json() as TerminalResponse;

    cwd = result.cwd || '/';
    setPromptPath(cwd);

    if (result.clear && output) {
      output.replaceChildren();
    } else {
      appendLines(result.lines, result.exitCode);
      appendEntries(result.entries ?? []);
    }

    if (result.close) {
      setOpen(false);
      return;
    }
  } catch {
    appendLines(['portfolio-backend: unavailable'], 1);
  }

  scrollToPrompt();
}

function acceptSuggestion() {
  if (!input || !suggestion) return false;
  input.value = suggestion;
  input.setSelectionRange(input.value.length, input.value.length);
  renderInput();
  return true;
}

openers.forEach((opener) => opener.addEventListener('click', () => setOpen(true)));
closer?.addEventListener('click', () => setOpen(false));

terminal?.addEventListener('click', (event) => {
  if (event.target === terminal) setOpen(false);
});

screen?.addEventListener('click', () => {
  if (window.getSelection()?.isCollapsed !== false) input?.focus();
});

window.addEventListener('keydown', (event) => {
  const isOpen = terminal?.dataset.open === 'true';

  if (isOpen && event.key === 'Escape') {
    event.preventDefault();
    setOpen(false);
    return;
  }

  if (isOpen && event.key === 'Tab' && !event.defaultPrevented) {
    const items = terminalFocusableItems();
    if (items.length) {
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  if (event.key === '`' && !event.ctrlKey && !event.metaKey && !event.altKey) {
    const target = event.target as HTMLElement | null;
    if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return;
    event.preventDefault();
    setOpen(!isOpen);
  }
});

input?.addEventListener('input', renderInput);

input?.addEventListener('keydown', (event) => {
  if (event.ctrlKey && event.key.toLowerCase() === 'l') {
    event.preventDefault();
    output?.replaceChildren();
    scrollToPrompt();
    return;
  }

  if (event.ctrlKey && event.key.toLowerCase() === 'c') {
    event.preventDefault();
    const command = input.value;
    appendPrompt(command ? `${command}^C` : '^C', cwd);
    input.value = '';
    renderInput();
    scrollToPrompt();
    return;
  }

  if (event.key === 'Tab') {
    if (acceptSuggestion()) event.preventDefault();
    return;
  }

  if (event.key === 'ArrowRight' && input.selectionStart === input.value.length && input.selectionEnd === input.value.length) {
    if (acceptSuggestion()) event.preventDefault();
    return;
  }

  if (event.key === 'ArrowUp' && history.length) {
    event.preventDefault();
    historyIndex = Math.max(0, historyIndex - 1);
    input.value = history[historyIndex] ?? '';
    input.setSelectionRange(input.value.length, input.value.length);
    renderInput();
    return;
  }

  if (event.key === 'ArrowDown' && history.length) {
    event.preventDefault();
    historyIndex = Math.min(history.length, historyIndex + 1);
    input.value = history[historyIndex] ?? '';
    input.setSelectionRange(input.value.length, input.value.length);
    renderInput();
  }
});

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const command = input?.value.trim() ?? '';
  if (!command) return;

  history.push(command);
  historyIndex = history.length;
  if (input) input.value = '';
  renderInput();
  await run(command);
});

setPromptPath(cwd);
renderInput();