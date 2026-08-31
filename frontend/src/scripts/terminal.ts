type TerminalResponse = {
  command: string;
  lines: string[];
  exitCode: number;
  clear?: boolean;
};

const terminal = document.querySelector<HTMLElement>('[data-terminal]');
const output = terminal?.querySelector<HTMLElement>('[data-terminal-output]');
const form = terminal?.querySelector<HTMLFormElement>('[data-terminal-form]');
const input = terminal?.querySelector<HTMLInputElement>('[data-terminal-input]');
const openers = document.querySelectorAll<HTMLElement>('[data-terminal-open]');
const closer = terminal?.querySelector<HTMLButtonElement>('[data-terminal-close]');

const history: string[] = [];
let historyIndex = 0;

function setOpen(open: boolean) {
  if (!terminal) return;
  terminal.dataset.open = open ? 'true' : 'false';
  terminal.setAttribute('aria-hidden', open ? 'false' : 'true');
  terminal.toggleAttribute('inert', !open);
  document.documentElement.dataset.terminal = open ? 'open' : 'closed';
  if (open) requestAnimationFrame(() => input?.focus());
}

function appendPrompt(command: string) {
  if (!output) return;
  const row = document.createElement('div');
  row.className = 'terminal-message terminal-command';
  const prompt = document.createElement('span');
  prompt.textContent = 'alec@portfolio:~$ ';
  const text = document.createElement('span');
  text.textContent = command;
  row.append(prompt, text);
  output.append(row);
}

function appendLines(lines: string[], exitCode = 0) {
  if (!output || lines.length === 0) return;
  const block = document.createElement('pre');
  block.className = exitCode === 0 ? 'terminal-message terminal-response' : 'terminal-message terminal-error';
  block.textContent = lines.join('\n');
  output.append(block);
  output.scrollTop = output.scrollHeight;
}

async function run(command: string) {
  appendPrompt(command);
  try {
    const response = await fetch('/api/terminal', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ command }),
    });

    if (!response.ok) throw new Error(`backend returned ${response.status}`);
    const result = await response.json() as TerminalResponse;
    if (result.clear && output) {
      output.replaceChildren();
      return;
    }
    appendLines(result.lines, result.exitCode);
  } catch {
    appendLines(['portfolio-backend: unavailable'], 1);
  }
}

openers.forEach((opener) => opener.addEventListener('click', () => setOpen(true)));
closer?.addEventListener('click', () => setOpen(false));

terminal?.addEventListener('click', (event) => {
  if (event.target === terminal) setOpen(false);
});

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && terminal?.dataset.open === 'true') {
    event.preventDefault();
    setOpen(false);
    return;
  }

  if (event.key === '`' && !event.ctrlKey && !event.metaKey && !event.altKey) {
    const target = event.target as HTMLElement | null;
    if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return;
    event.preventDefault();
    setOpen(terminal?.dataset.open !== 'true');
  }
});

input?.addEventListener('keydown', (event) => {
  if (!history.length) return;
  if (event.key === 'ArrowUp') {
    event.preventDefault();
    historyIndex = Math.max(0, historyIndex - 1);
    input.value = history[historyIndex] ?? '';
  } else if (event.key === 'ArrowDown') {
    event.preventDefault();
    historyIndex = Math.min(history.length, historyIndex + 1);
    input.value = history[historyIndex] ?? '';
  }
});

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const command = input?.value.trim() ?? '';
  if (!command) return;

  history.push(command);
  historyIndex = history.length;
  if (input) input.value = '';
  await run(command);
});
