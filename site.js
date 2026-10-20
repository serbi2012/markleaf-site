const THEME_KEY = 'markleaf-site-theme';
const DEMO_STAGES = ['raw', 'doc', 'edit', 'saved'];
const DEMO_RAW_MS = 1900;
const DEMO_DOC_MS = 1500;
const DEMO_SELECT_MS = 650;
const DEMO_TYPE_MS = 75;
const DEMO_SAVING_MS = 700;
const REVEAL_MARGIN = '0px 0px -8% 0px';

const prefers_reduced_motion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function readStoredTheme() {
  try {
    return localStorage.getItem(THEME_KEY);
  } catch {
    return null;
  }
}

function storeTheme(theme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    return;
  }
}

function currentTheme() {
  const forced = document.documentElement.dataset.theme;
  if (forced) return forced;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function bindThemeToggle() {
  const button = document.querySelector('[data-theme-toggle]');
  if (!button) return;
  const sync = () => button.setAttribute('aria-pressed', String(currentTheme() === 'dark'));
  button.addEventListener('click', () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    storeTheme(next);
    sync();
  });
  sync();
}

function bindNavShadow() {
  const nav = document.querySelector('.nav');
  if (!nav) return;
  const update = () => nav.toggleAttribute('data-scrolled', window.scrollY > 8);
  window.addEventListener('scroll', update, { passive: true });
  update();
}

function bindReveal() {
  const targets = document.querySelectorAll('[data-reveal]');
  if (prefers_reduced_motion || !('IntersectionObserver' in window)) {
    targets.forEach((target) => target.classList.add('is-visible'));
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    },
    { rootMargin: REVEAL_MARGIN },
  );
  targets.forEach((target) => observer.observe(target));
}

function bindTabs() {
  for (const root of document.querySelectorAll('[data-tabs]')) {
    const tabs = Array.from(root.querySelectorAll('[role="tab"]'));
    const select = (tab, focus) => {
      for (const other of tabs) {
        const selected = other === tab;
        other.setAttribute('aria-selected', String(selected));
        other.tabIndex = selected ? 0 : -1;
        document.getElementById(other.getAttribute('aria-controls')).hidden = !selected;
      }
      if (focus) tab.focus();
    };
    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => select(tab, false));
      tab.addEventListener('keydown', (event) => {
        const moves = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
        if (event.key === 'Home') select(tabs[0], true);
        else if (event.key === 'End') select(tabs[tabs.length - 1], true);
        else if (moves[event.key]) select(tabs[(index + moves[event.key] + tabs.length) % tabs.length], true);
        else return;
        event.preventDefault();
      });
    });
  }
}

function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      window.clearTimeout(timer);
      reject(new DOMException('aborted', 'AbortError'));
    });
  });
}

function createDemo(root) {
  const edit = root.querySelector('[data-demo-edit]');
  const save = root.querySelector('[data-demo-save]');
  const steps = Array.from(root.querySelectorAll('[data-demo-step]'));
  const replay = root.querySelector('[data-demo-replay]');
  const before = edit.dataset.before;
  const after = edit.dataset.after;
  let controller = new AbortController();

  const setSave = (state) => {
    save.dataset.state = state;
    save.textContent = save.dataset[`label${state[0].toUpperCase()}${state.slice(1)}`];
  };

  const show = (stage) => {
    root.dataset.stage = stage;
    const reached = DEMO_STAGES.indexOf(stage);
    steps.forEach((step) => {
      const index = DEMO_STAGES.indexOf(step.dataset.demoStep);
      step.toggleAttribute('data-active', index === reached);
      step.toggleAttribute('data-done', index < reached);
    });
  };

  const settle = (stage) => {
    edit.classList.remove('is-selected', 'is-typing');
    edit.textContent = stage === 'edit' || stage === 'saved' ? after : before;
    setSave(stage === 'saved' ? 'saved' : stage === 'edit' ? 'unsaved' : 'idle');
    show(stage);
  };

  const play = async (signal) => {
    settle('raw');
    await wait(DEMO_RAW_MS, signal);
    show('doc');
    await wait(DEMO_DOC_MS, signal);
    show('edit');
    edit.classList.add('is-selected');
    await wait(DEMO_SELECT_MS, signal);
    edit.classList.remove('is-selected');
    edit.classList.add('is-typing');
    edit.textContent = '';
    setSave('unsaved');
    for (const char of after) {
      edit.textContent += char;
      await wait(DEMO_TYPE_MS, signal);
    }
    edit.classList.remove('is-typing');
    setSave('saving');
    await wait(DEMO_SAVING_MS, signal);
    settle('saved');
  };

  const restart = () => {
    controller.abort();
    controller = new AbortController();
    play(controller.signal).catch(() => undefined);
  };

  steps.forEach((step) =>
    step.addEventListener('click', () => {
      controller.abort();
      settle(step.dataset.demoStep);
    }),
  );
  replay?.addEventListener('click', restart);

  if (prefers_reduced_motion) {
    settle('saved');
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    observer.disconnect();
    restart();
  });
  observer.observe(root);
}

function bindYear() {
  document.querySelectorAll('[data-year]').forEach((element) => {
    element.textContent = String(new Date().getFullYear());
  });
}

const stored_theme = readStoredTheme();
if (stored_theme === 'dark' || stored_theme === 'light') document.documentElement.dataset.theme = stored_theme;
document.documentElement.classList.add('js');
bindThemeToggle();
bindNavShadow();
bindReveal();
bindTabs();
bindYear();
document.querySelectorAll('[data-demo]').forEach(createDemo);
