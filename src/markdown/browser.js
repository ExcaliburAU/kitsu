import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeParse from 'rehype-parse';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import Prism from 'prismjs';
import 'prismjs/components/prism-markup';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-diff';

const schema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: [...(defaultSchema.attributes?.code || []), ['className'], ['class']],
    pre: [...(defaultSchema.attributes?.pre || []), ['className'], ['class']],
    span: [
      ...(defaultSchema.attributes?.span || []),
      ['className'],
      ['class'],
      ['title'],
      ['dataMdSpoiler'],
    ],
    a: [
      ...(defaultSchema.attributes?.a || []),
      ['href'],
      ['title'],
      ['target'],
      ['rel'],
      ['className'],
      ['class'],
    ],
    img: [
      ...(defaultSchema.attributes?.img || []),
      ['src'],
      ['alt'],
      ['title'],
      ['width'],
      ['height'],
    ],
  },
  tagNames: [
    ...(defaultSchema.tagNames || []),
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'hr',
    'table',
    'thead',
    'tbody',
    'tr',
    'th',
    'td',
    'del',
    'u',
    'input',
  ],
};

function looksLikeMarkdown(text) {
  const sample = String(text || '');
  if (!sample.trim()) return false;
  if (/(^|\n)\s{0,3}(#{1,6}\s|[-*+]\s|\d+\.\s|>\s|```|~~~|\|.+\|)/m.test(sample)) return true;
  if (/```[\s\S]*?```/.test(sample)) return true;
  if (/`[^`\n]+`/.test(sample)) return true;
  // Bold / italic / bold-italic including ***text*** and ___text___
  if (/\*{1,3}\S(?:[\s\S]*?\S)?\*{1,3}/.test(sample)) return true;
  if (/_{1,3}\S(?:[\s\S]*?\S)?_{1,3}/.test(sample)) return true;
  if (/~~\S(?:[\s\S]*?\S)?~~/.test(sample)) return true;
  if (/\|\|\S(?:[\s\S]*?\S)?\|\|/.test(sample)) return true;
  if (/\[[^\]]+\]\([^)]+\)/.test(sample)) return true;
  if (/<\/?(?:u|font|span|br|mx-reply|del|strong|em|code|pre|a|b|i)\b/i.test(sample)) return true;
  return false;
}

function preprocessClientMarkdown(markdown) {
  // Discord/Paarrot spoilers → placeholder HTML consumed after stringify.
  return String(markdown || '').replace(
    /\|\|([\s\S]+?)\|\|/g,
    '%%RELAYSPOILER%%$1%%/RELAYSPOILER%%',
  );
}

function postprocessClientHtml(html) {
  return String(html || '')
    .replace(
      /%%RELAYSPOILER%%([\s\S]+?)%%\/RELAYSPOILER%%/g,
      '<span class="message-spoiler" title="Spoiler">$1</span>',
    )
    .replace(/<p>\s*<\/p>/g, '');
}

async function sanitizeHtml(html) {
  const file = await unified()
    .use(rehypeParse, { fragment: true })
    .use(rehypeSanitize, schema)
    .use(rehypeStringify)
    .process(postprocessClientHtml(html));
  return String(file);
}

async function markdownToHtml(markdown) {
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: false })
    .use(rehypeSanitize, schema)
    .use(rehypeStringify)
    .process(preprocessClientMarkdown(markdown));
  return postprocessClientHtml(String(file));
}

function enhanceLinks(root) {
  root.querySelectorAll('a[href]').forEach((anchor) => {
    const href = anchor.getAttribute('href') || '';
    try {
      const url = new URL(href, window.location.href);
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        anchor.classList.add('message-link');
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
      }
    } catch {
      // leave as-is
    }
  });
}

function codeLanguageLabel(block) {
  const className = block?.className || '';
  const match = /language-([\w#+-]+)/i.exec(className);
  return match ? match[1].toLowerCase() : '';
}

function countCodeLines(text) {
  const value = String(text || '').replace(/\n$/, '');
  if (!value) return 1;
  return value.split('\n').length;
}

async function copyCodeText(text, button) {
  const value = String(text || '');
  let ok = false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      ok = true;
    }
  } catch {
    ok = false;
  }
  if (!ok) {
    try {
      const area = document.createElement('textarea');
      area.value = value;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      ok = document.execCommand('copy');
      area.remove();
    } catch {
      ok = false;
    }
  }
  if (!button) return;
  const previous = button.textContent;
  button.textContent = ok ? 'Copied' : 'Failed';
  button.disabled = true;
  window.setTimeout(() => {
    button.textContent = previous || 'Copy';
    button.disabled = false;
  }, 1400);
}

function enhanceCodeBlocks(root) {
  if (!root) return;
  root.querySelectorAll('pre').forEach((pre) => {
    if (pre.closest('.message-code')) return;
    const code = pre.querySelector('code');
    const raw = code?.textContent || pre.textContent || '';
    const lang = codeLanguageLabel(code);
    const lines = countCodeLines(raw);

    const shell = document.createElement('div');
    shell.className = 'message-code';
    if (lines > 15) shell.classList.add('is-tall');

    const bar = document.createElement('div');
    bar.className = 'message-code-bar';

    const label = document.createElement('span');
    label.className = 'message-code-lang';
    label.textContent = lang || 'code';

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'message-code-copy';
    copyBtn.textContent = 'Copy';
    copyBtn.title = 'Copy code';
    copyBtn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      void copyCodeText(raw, copyBtn);
    });

    bar.appendChild(label);
    bar.appendChild(copyBtn);

    pre.replaceWith(shell);
    shell.appendChild(bar);
    shell.appendChild(pre);
    pre.classList.add('message-code-pre');
  });
}

function highlight(root) {
  if (!root) return;
  root.querySelectorAll('pre code').forEach((block) => {
    const className = block.className || '';
    const match = /language-([\w#+-]+)/i.exec(className);
    if (match) {
      const lang = match[1].toLowerCase();
      if (!Prism.languages[lang] && Prism.languages[lang.replace('#', 'sharp')]) {
        block.className = `language-${lang.replace('#', 'sharp')}`;
      }
    }
    try {
      Prism.highlightElement(block);
    } catch {
      // ignore unknown languages
    }
  });
}

async function renderMessage({ body = '', html = '' } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'message-md';

  const htmlIn = String(html || '').trim();
  const bodyIn = String(body || '');
  let sourceHtml = '';

  if (htmlIn) {
    sourceHtml = await sanitizeHtml(htmlIn);
    // Some clients send markdown in body and broken/plain formatted_body — prefer real markup.
    const plainHtml = sourceHtml.replace(/<[^>]+>/g, '').trim();
    const plainBody = bodyIn.replace(/\s+/g, ' ').trim();
    if (
      looksLikeMarkdown(bodyIn) &&
      plainHtml &&
      plainBody &&
      (plainHtml === plainBody || plainHtml.includes('***') || plainHtml.includes('~~'))
    ) {
      sourceHtml = await markdownToHtml(bodyIn);
    }
  } else if (looksLikeMarkdown(bodyIn)) {
    // Underline / raw HTML snippets from the composer toolbar.
    if (/<\/?[a-z][^>]*>/i.test(bodyIn) && !/(\*{1,3}|_{1,3}|~~|`)/.test(bodyIn.replace(/<[^>]+>/g, ''))) {
      sourceHtml = await sanitizeHtml(bodyIn);
    } else {
      sourceHtml = await markdownToHtml(bodyIn);
    }
  } else {
    return null;
  }

  wrap.innerHTML = sourceHtml;
  enhanceLinks(wrap);
  highlight(wrap);
  enhanceCodeBlocks(wrap);
  wrap.querySelectorAll('.message-spoiler').forEach((el) => {
    el.addEventListener('click', (event) => {
      event.preventDefault();
      el.classList.toggle('is-revealed');
    });
  });
  return wrap;
}

window.RelayMarkdown = {
  markdownToHtml,
  sanitizeHtml,
  looksLikeMarkdown,
  highlight,
  renderMessage,
  Prism,
};
