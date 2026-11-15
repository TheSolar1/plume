// ══════════════════════════════════════════════════════════════════
// formats.js — autres formats : HTML (page web), texte brut,
// Markdown, RTF (export), ODT (export simplifié via HTML) et format
// natif Plume (.plume = JSON complet).
// ══════════════════════════════════════════════════════════════════
import { DOMParser as PMDOMParser, DOMSerializer } from 'prosemirror-model';
import { schema } from './schema.js';
import { escapeHtml } from '../common/ui.js';
import { texToMathML } from './math.js';

export function htmlToDoc(html) {
  const dom = new DOMParser().parseFromString(html, 'text/html');
  // Nettoyage des collages Word/Google Docs
  dom.querySelectorAll('style,script,meta,link,title,o\\:p').forEach((e) => e.remove());
  return PMDOMParser.fromSchema(schema).parse(dom.body);
}

export function textToDoc(text) {
  const paras = text.replace(/\r\n?/g, '\n').split('\n').map((l) => {
    const parts = l.split('\t');
    const content = [];
    parts.forEach((p, i) => { if (i) content.push(schema.nodes.tab.create()); if (p) content.push(schema.text(p)); });
    return schema.nodes.paragraph.create(null, content);
  });
  return schema.nodes.doc.create(null, paras.length ? paras : [schema.nodes.paragraph.create()]);
}

export function docToText(doc) {
  const lines = [];
  doc.descendants((n) => {
    if (n.isTextblock) {
      let s = '';
      n.forEach((c) => { s += c.isText ? (c.marks.some((m) => m.type.name === 'deletion') ? '' : c.text) : c.type.name === 'tab' ? '\t' : c.type.name === 'hard_break' ? '\n' : c.type.name === 'field' ? c.attrs.cached || '' : c.type.name === 'equation' ? c.attrs.tex : ''; });
      lines.push(s);
      return false;
    }
    if (n.type.name === 'page_break') lines.push('\f');
    return true;
  });
  return lines.join('\n');
}

// ── Markdown ──
export function markdownToDoc(md) {
  const lines = md.replace(/\r\n?/g, '\n').split('\n');
  let html = '';
  let inList = null, inCode = false, code = [];
  const inline = (s) => escapeHtml(s)
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, '<img alt="$1" src="$2">')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*([^*]+)\*\*|__([^_]+)__/g, (_, a, b) => `<strong>${a || b}</strong>`)
    .replace(/\*([^*]+)\*|_([^_]+)_/g, (_, a, b) => `<em>${a || b}</em>`)
    .replace(/~~([^~]+)~~/g, '<s>$1</s>')
    .replace(/`([^`]+)`/g, '<span data-cstyle="CodeEnLigne">$1</span>');
  const closeList = () => { if (inList) { html += `</${inList}>`; inList = null; } };
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^```/.test(l)) {
      if (inCode) { html += code.map((c) => `<p data-style="Code">${escapeHtml(c) || '<br>'}</p>`).join(''); code = []; inCode = false; } else { closeList(); inCode = true; }
      continue;
    }
    if (inCode) { code.push(l); continue; }
    let m;
    if ((m = /^(#{1,6})\s+(.*)$/.exec(l))) { closeList(); html += `<p data-style="Titre${m[1].length}">${inline(m[2])}</p>`; continue; }
    if ((m = /^\s*[-*+]\s+\[( |x)\]\s+(.*)$/i.exec(l))) { if (inList !== 'ul data-kind="check"') { closeList(); html += '<ul data-kind="check">'; inList = 'ul data-kind="check"'; } html += `<li data-checked="${m[1] === ' ' ? 0 : 1}"><p>${inline(m[2])}</p></li>`; continue; }
    if ((m = /^\s*[-*+]\s+(.*)$/.exec(l))) { if (inList !== 'ul') { closeList(); html += '<ul>'; inList = 'ul'; } html += `<li><p>${inline(m[1])}</p></li>`; continue; }
    if ((m = /^\s*\d+[.)]\s+(.*)$/.exec(l))) { if (inList !== 'ol') { closeList(); html += '<ol>'; inList = 'ol'; } html += `<li><p>${inline(m[1])}</p></li>`; continue; }
    closeList();
    if (/^>\s?/.test(l)) { html += `<p data-style="Citation">${inline(l.replace(/^>\s?/, ''))}</p>`; continue; }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(l.trim())) { html += '<hr>'; continue; }
    if (/^\|.*\|$/.test(l.trim())) {
      const rows = [];
      while (i < lines.length && /^\|.*\|$/.test(lines[i].trim())) { if (!/^\|[\s:|-]+\|$/.test(lines[i].trim())) rows.push(lines[i].trim().slice(1, -1).split('|')); i++; }
      i--;
      html += '<table>' + rows.map((r, ri) => `<tr>${r.map((c) => `<${ri ? 'td' : 'th'}><p>${inline(c.trim())}</p></${ri ? 'td' : 'th'}>`).join('')}</tr>`).join('') + '</table>';
      continue;
    }
    if (l.trim() === '') continue;
    html += `<p>${inline(l)}</p>`;
  }
  closeList();
  return htmlToDoc(html);
}

export function docToMarkdown(doc) {
  const out = [];
  const inline = (node) => {
    let s = '';
    node.forEach((c) => {
      if (c.isText) {
        if (c.marks.some((m) => m.type.name === 'deletion')) return;
        let t = c.text.replace(/([*_`~[\]])/g, '\\$1');
        const has = (n) => c.marks.find((m) => m.type.name === n);
        if (has('charStyle') && has('charStyle').attrs.name === 'CodeEnLigne') t = '`' + c.text + '`';
        if (has('bold')) t = `**${t}**`;
        if (has('italic')) t = `*${t}*`;
        if (has('strike')) t = `~~${t}~~`;
        const link = has('link');
        if (link) t = `[${t}](${link.attrs.href})`;
        s += t;
      } else if (c.type.name === 'image') s += `![${c.attrs.alt || ''}](${c.attrs.src.startsWith('data:') ? 'image' : c.attrs.src})`;
      else if (c.type.name === 'hard_break') s += '  \n';
      else if (c.type.name === 'equation') s += `$${c.attrs.tex}$`;
      else if (c.type.name === 'field') s += c.attrs.cached || '';
      else if (c.type.name === 'footnote') s += `[^${c.attrs.id}]`;
    });
    return s;
  };
  const block = (n, indent = '') => {
    const t = n.type.name;
    if (t === 'paragraph') {
      const m = /^Titre(\d)$/.exec(n.attrs.style);
      if (m) out.push('#'.repeat(+m[1]) + ' ' + inline(n));
      else if (n.attrs.style === 'Titre') out.push('# ' + inline(n));
      else if (/^Citation/.test(n.attrs.style)) out.push('> ' + inline(n));
      else if (n.attrs.style === 'Code') out.push('    ' + n.textContent);
      else out.push(indent + inline(n));
      out.push('');
    } else if (t === 'bullet_list' || t === 'ordered_list') {
      let i = n.attrs.order || 1;
      n.forEach((li) => {
        const prefix = t === 'ordered_list' ? `${i++}. ` : li.attrs.checked != null ? `- [${li.attrs.checked ? 'x' : ' '}] ` : '- ';
        li.forEach((c, _o, idx) => {
          if (c.type.name === 'paragraph') out.push(indent + (idx === 0 ? prefix : '  ') + inline(c));
          else { const save = out.length; block(c, indent + '   '); void save; }
        });
      });
      out.push('');
    } else if (t === 'table') {
      n.forEach((row, _o, ri) => {
        const cells = [];
        row.forEach((cell) => cells.push(cell.textContent.replace(/\|/g, '\\|')));
        out.push('| ' + cells.join(' | ') + ' |');
        if (ri === 0) out.push('|' + cells.map(() => ' --- ').join('|') + '|');
      });
      out.push('');
    } else if (t === 'horizontal_rule') { out.push('---', ''); }
    else if (t === 'page_break') { out.push('<div style="page-break-after:always"></div>', ''); }
    else if (t === 'equation_block') { out.push('$$' + n.attrs.tex + '$$', ''); }
    else if (t === 'toc') { out.push(`**${n.attrs.title || ''}**`, ''); for (const e of n.attrs.entries) out.push(`${'  '.repeat((e.level || 1) - 1)}- ${e.text}`); out.push(''); }
  };
  doc.forEach((n) => block(n));
  const notes = [];
  doc.descendants((n) => { if (n.type.name === 'footnote') notes.push(`[^${n.attrs.id}]: ${n.attrs.text}`); });
  return out.join('\n').replace(/\n{3,}/g, '\n\n') + (notes.length ? '\n' + notes.join('\n') + '\n' : '');
}

// ── HTML autonome (Enregistrer sous > Page web) ──
export function docToHtml(doc, { title = 'Document', css = '', fieldValue } = {}) {
  const ser = DOMSerializer.fromSchema(schema);
  const frag = ser.serializeFragment(doc.content);
  const wrap = document.createElement('div');
  wrap.appendChild(frag);
  // rendre les objets atomiques
  wrap.querySelectorAll('span.pl-eq, div.pl-eqb').forEach((e) => { e.innerHTML = texToMathML(e.dataset.tex || '', e.tagName === 'DIV'); });
  wrap.querySelectorAll('span.pl-field').forEach((e) => { if (fieldValue) e.textContent = fieldValue({ kind: e.dataset.kind, format: e.dataset.format, target: e.dataset.target, cached: e.textContent }) ?? e.textContent; });
  let n = 0;
  const notes = [];
  wrap.querySelectorAll('sup.pl-fn').forEach((e) => { n++; e.innerHTML = `<a href="#note${n}" id="ref${n}">${n}</a>`; notes.push(`<li id="note${n}">${escapeHtml(e.dataset.text || '')} <a href="#ref${n}">↩</a></li>`); });
  wrap.querySelectorAll('div.pl-toc').forEach((e) => {
    const entries = JSON.parse(e.dataset.entries || '[]');
    e.innerHTML = (e.dataset.title ? `<p data-style="Titre1">${escapeHtml(e.dataset.title)}</p>` : '') + entries.map((en) => `<p data-style="TM${Math.min(3, en.level || 1)}">${escapeHtml(en.text || en.letter || '')}${en.page != null ? ` <span style="float:right">${escapeHtml(en.page)}</span>` : ''}</p>`).join('');
  });
  wrap.querySelectorAll('div.pl-break').forEach((e) => { e.style.pageBreakAfter = 'always'; });
  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="generator" content="Plume Texte"><title>${escapeHtml(title)}</title>
<style>body{max-width:800px;margin:40px auto;padding:0 20px;font-family:Calibri,Carlito,Arial,sans-serif;line-height:1.3}p{margin:0}table{border-collapse:collapse;width:100%;margin:6px 0}td,th{padding:4px 8px;vertical-align:top}img{max-width:100%}ins.pl-ins{color:#1a7f37}del.pl-del{display:none}.pl-comment{background:none}.pl-xe{display:none}${css}</style></head>
<body class="pl-doc"><div class="ProseMirror">${wrap.innerHTML}</div>${notes.length ? `<hr><ol class="notes">${notes.join('')}</ol>` : ''}</body></html>`;
}

// ── RTF (format texte enrichi, ouvert par tous les traitements de texte) ──
export function docToRtf(doc) {
  const colors = ['#000000'];
  const colorIdx = (c) => { let i = colors.indexOf(c); if (i < 0) { colors.push(c); i = colors.length - 1; } return i + 1; };
  const fonts = ['Calibri'];
  const fontIdx = (f) => { let i = fonts.indexOf(f); if (i < 0) { fonts.push(f); i = fonts.length - 1; } return i; };
  const esc = (s) => [...s].map((ch) => { const c = ch.codePointAt(0); if (ch === '\\' || ch === '{' || ch === '}') return '\\' + ch; if (c > 127) return `\\u${c > 32767 ? c - 65536 : c}?`; return ch; }).join('');
  let body = '';
  const para = (n, extra = '') => {
    const a = n.attrs;
    let pp = '\\pard\\plain';
    const h = /^Titre(\d)$/.exec(a.style);
    if (h) pp += `\\outlinelevel${+h[1] - 1}\\b\\fs${[32, 26, 24, 22, 22, 22][+h[1] - 1] || 22}`;
    if (a.align) pp += { center: '\\qc', right: '\\qr', justify: '\\qj', left: '\\ql' }[a.align];
    if (a.indentLeft) pp += `\\li${Math.round(a.indentLeft * 20)}`;
    if (a.indentFirst) pp += `\\fi${Math.round(a.indentFirst * 20)}`;
    pp += `\\sa${Math.round((a.spaceAfter ?? 8) * 20)}`;
    let s = pp + extra + ' ';
    n.forEach((c) => {
      if (c.isText) {
        if (c.marks.some((m) => m.type.name === 'deletion')) return;
        let open = '';
        for (const m of c.marks) {
          const t = m.type.name;
          if (t === 'bold') open += '\\b'; else if (t === 'italic') open += '\\i'; else if (t === 'underline') open += '\\ul'; else if (t === 'strike') open += '\\strike';
          else if (t === 'superscript') open += '\\super'; else if (t === 'subscript') open += '\\sub'; else if (t === 'fontSize') open += `\\fs${Math.round(m.attrs.size * 2)}`;
          else if (t === 'textColor' && /^#/.test(m.attrs.color)) open += `\\cf${colorIdx(m.attrs.color)}`;
          else if (t === 'fontFamily') open += `\\f${fontIdx(m.attrs.family)}`;
          else if (t === 'allCaps') open += '\\caps'; else if (t === 'smallCaps') open += '\\scaps';
        }
        s += open ? `{${open} ${esc(c.text)}}` : esc(c.text);
      } else if (c.type.name === 'hard_break') s += '\\line ';
      else if (c.type.name === 'tab') s += '\\tab ';
      else if (c.type.name === 'field') s += esc(c.attrs.cached || '');
      else if (c.type.name === 'footnote') s += `{\\super\\chftn}{\\footnote\\pard\\plain{\\super\\chftn} ${esc(c.attrs.text)}}`;
    });
    return s + '\\par\n';
  };
  const block = (n, depth = 0) => {
    const t = n.type.name;
    if (t === 'paragraph') body += para(n);
    else if (t === 'bullet_list' || t === 'ordered_list') {
      let i = n.attrs.order || 1;
      n.forEach((li) => li.forEach((c, _o, idx) => {
        if (c.type.name === 'paragraph') body += para(c, `\\li${720 * (depth + 1)}\\fi-360${idx === 0 ? `{\\pntext ${t === 'ordered_list' ? i++ + '.' : '\\bullet'}\\tab}` : ''}`);
        else block(c, depth + 1);
      }));
    } else if (t === 'table') {
      n.forEach((row) => {
        let defs = '\\trowd\\trgaph108';
        let x = 0;
        const w = Math.round(9000 / row.childCount);
        row.forEach(() => { x += w; defs += `\\clbrdrt\\brdrs\\clbrdrl\\brdrs\\clbrdrb\\brdrs\\clbrdrr\\brdrs\\cellx${x}`; });
        body += defs + '\n';
        row.forEach((cell) => { body += '\\pard\\intbl ' + esc(cell.textContent) + '\\cell\n'; });
        body += '\\row\n';
      });
    } else if (t === 'page_break') body += '\\page\n';
    else if (t === 'horizontal_rule') body += '\\pard\\brdrb\\brdrs\\brdrw10\\par\n';
    else if (t === 'toc') for (const e of n.attrs.entries) body += `\\pard\\li${(e.level - 1) * 240} ${esc(e.text)}\\tab ${esc(String(e.page ?? ''))}\\par\n`;
    else if (t === 'equation_block') body += `\\pard\\qc ${esc(n.attrs.tex)}\\par\n`;
  };
  doc.forEach((n) => block(n));
  const fonttbl = `{\\fonttbl${fonts.map((f, i) => `{\\f${i}\\fswiss ${esc(f)};}`).join('')}}`;
  const colortbl = `{\\colortbl;${colors.map((c) => { const n = parseInt(c.slice(1), 16); return `\\red${(n >> 16) & 255}\\green${(n >> 8) & 255}\\blue${n & 255};`; }).join('')}}`;
  return `{\\rtf1\\ansi\\ansicpg1252\\deff0\\deflang1036${fonttbl}${colortbl}\\viewkind4\\uc1\\fs22\n${body}}`;
}
