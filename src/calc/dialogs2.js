// ══════════════════════════════════════════════════════════════════
// dialogs2.js — boîtes de dialogue de Plume Tableur (2/2) : outils de
// données et d'analyse (tableau croisé, doublons, conversion, valeur
// cible, scénarios, table de données, prévision, consolidation,
// sous-totaux, plan), audit des formules, import, vérification.
// ══════════════════════════════════════════════════════════════════
import { h, icon, toast, dialog, alertDlg, field, select, numberInput, checkbox, pickFile, readAsText, prefs } from '../common/ui.js';
import { MAX_COLS, keyOf } from './model.js';
import { colName, addr, rangeStr, parseRange, toLocal, toCanonical, isErr, parseNumberText, refsOf } from './formula.js';
import { parseCached } from './model.js';
import { synonyms } from '../common/synonyms.js';
import * as F from './features.js';
import { val, num, text, grid2, lab, parseRef } from './dialogs.js';

const headers = (app, sheet, rg) => { const o = []; for (let c = rg.c1; c <= rg.c2; c++) { const d = app.wb.display(sheet, rg.r1, c); o.push([c, d ? d.text : 'Colonne ' + colName(c)]); } return o; };
const qn = (n) => (/^[A-Za-z_À-ÿ][\wÀ-ÿ.]*$/.test(n) ? n : `'${n.replace(/'/g, "''")}'`);

// ── Tableau croisé dynamique ──
export function pivotDialog(app) {
  const s = app.sheet;
  const existing = s.pivot;
  const src0 = existing ? { sheet: app.wb.sheetByName(existing.sheet) || s, rg: existing.range } : { sheet: s, rg: F.dataRange(app) };
  if (!existing && src0.rg.r2 <= src0.rg.r1) return toast('Placez-vous dans un tableau de données comportant une ligne d’en-têtes, puis relancez la commande.');
  const srcIn = text(`${qn(src0.sheet.name)}!${rangeStr(src0.rg.r1, src0.rg.c1, src0.rg.r2, src0.rg.c2)}`);
  const zone = h('div');
  let cur = null;
  const build = () => {
    const src = parseRef(app, srcIn.value);
    zone.innerHTML = '';
    if (!src) { zone.append(h('p.pl-hint', 'Plage source non valide.')); cur = null; return; }
    const hd = headers(app, src.sheet, src.rg);
    const none = [['', '(aucun)']];
    const cfg = existing || {};
    const numCol = hd.find(([c]) => typeof app.wb.value(src.sheet, src.rg.r1 + 1, c) === 'number');
    const r1 = select(hd, cfg.rows ? cfg.rows[0] : hd[0][0]), r2 = select([...none, ...hd], cfg.rows && cfg.rows[1] != null ? cfg.rows[1] : '');
    const c1 = select([...none, ...hd], cfg.cols && cfg.cols[0] != null ? cfg.cols[0] : '');
    const aggs = Object.entries(F.AGGS);
    const v1 = select(hd, cfg.values ? cfg.values[0].col : (numCol || hd[hd.length - 1])[0]), a1 = select(aggs, cfg.values ? cfg.values[0].agg : numCol ? 'sum' : 'count');
    const v2 = select([...none, ...hd], cfg.values && cfg.values[1] ? cfg.values[1].col : ''), a2 = select(aggs, cfg.values && cfg.values[1] ? cfg.values[1].agg : 'avg');
    const fc = select([...none, ...hd], cfg.filter && cfg.filter.col != null ? cfg.filter.col : ''), fv = text(cfg.filter && cfg.filter.values ? cfg.filter.values.join(';') : '', '100%', 'valeurs séparées par ;');
    zone.append(h('h4', 'Lignes'), grid2(lab('Champ 1 :'), r1, lab('Champ 2 :'), r2), h('h4', 'Colonnes'), grid2(lab('Champ :'), c1), h('h4', 'Valeurs'), grid2(lab('Champ 1 :'), h('span', { style: { display: 'flex', gap: '6px' } }, v1, a1), lab('Champ 2 :'), h('span', { style: { display: 'flex', gap: '6px' } }, v2, a2)), h('h4', 'Filtre'), grid2(lab('Champ :'), fc, lab('Conserver :'), fv));
    cur = () => ({ sheet: src.sheet.name, range: src.rg, rows: [r1.value, r2.value].filter((x) => x !== '').map(Number), cols: c1.value !== '' ? [+c1.value] : [], values: [{ col: +v1.value, agg: a1.value }, ...(v2.value !== '' ? [{ col: +v2.value, agg: a2.value }] : [])], filter: fc.value !== '' && fv.value.trim() ? { col: +fc.value, values: fv.value.split(';').map((x) => x.trim()) } : null });
  };
  srcIn.addEventListener('change', build);
  build();
  const dest = select([['new', 'Nouvelle feuille de calcul'], ['here', 'Feuille existante (à partir de la cellule active)']], existing ? 'here' : 'new');
  dialog({ title: existing ? 'Modifier le tableau croisé dynamique' : 'Créer un tableau croisé dynamique', width: 480, body: h('div', field('Tableau/Plage :', srcIn), zone, existing ? null : field('Emplacement :', dest)), buttons: [{ label: 'OK', primary: true, action: () => {
    if (!cur) return false;
    const cfg = cur();
    let target = s;
    if (existing) cfg.at = existing.at;
    else if (dest.value === 'new') { let n = 1; while (app.wb.sheetByName('TCD' + n)) n++; target = app.addSheet('TCD' + n); }
    else cfg.at = { r: app.sel.r, c: app.sel.c };
    F.writePivot(app, target, cfg);
    app.refresh();
  } }, ...(existing ? [{ label: 'Actualiser', action: () => { F.writePivot(app, s, existing); } }] : []), { label: 'Annuler' }] });
}

// ── Doublons, conversion, série ──
export function removeDupDialog(app) {
  const rg = F.dataRange(app), s = app.sheet;
  const hd = checkbox('Mes données ont des en-têtes', F.hasHeaderRow(app, rg));
  const boxes = headers(app, s, rg).map(([c, l]) => ({ c, el: checkbox(l, true) }));
  const all = (on) => boxes.forEach((b) => { b.el.querySelector('input').checked = on; });
  dialog({ title: 'Supprimer les doublons', width: 380, body: h('div', h('p', 'Sélectionnez les colonnes qui contiennent des doublons.'), h('div', { style: { display: 'flex', gap: '6px', marginBottom: '6px' } }, h('button.pl-btn.small', { type: 'button', on: { click: () => all(true) } }, 'Sélectionner tout'), h('button.pl-btn.small', { type: 'button', on: { click: () => all(false) } }, 'Désélectionner tout')), hd, h('div.pl-list', { style: { padding: '4px 8px', maxHeight: '180px' } }, ...boxes.map((b) => b.el)), h('p.pl-hint', 'Plage : ' + rangeStr(rg.r1, rg.c1, rg.r2, rg.c2))), buttons: [{ label: 'OK', primary: true, action: () => { const cols = boxes.filter((b) => val(b.el)).map((b) => b.c); if (!cols.length) { toast('Sélectionnez au moins une colonne.', 'error'); return false; } if (app.guard(rg)) F.removeDuplicates(app, rg, cols, val(hd)); } }, { label: 'Annuler' }] });
}
export function textToColumnsDialog(app) {
  const g = app.bounded(), s = app.sheet;
  const first = app.wb.display(s, g.r1, g.c1);
  const mode = select([['delim', 'Délimité (des caractères séparent chaque champ)'], ['fixed', 'Largeur fixe']], 'delim');
  const sep = select([[';', 'Point-virgule'], [',', 'Virgule'], ['\t', 'Tabulation'], [' ', 'Espace'], ['|', 'Barre verticale |'], ['other', 'Autre…']], first && /\t/.test(first.text) ? '\t' : first && first.text.includes(';') ? ';' : first && first.text.includes(',') ? ',' : ' ');
  const other = text('', '60px'), width = numberInput(5, { min: 1, max: 100, unit: 'caractères' });
  const prev = h('div.pc-sample', { style: { textAlign: 'left', fontSize: '12px' } });
  const upd = () => { const t = first ? first.text : ''; const sp = sep.value === 'other' ? other.value || ';' : sep.value; const parts = mode.value === 'fixed' ? t.match(new RegExp(`.{1,${num(width, 5)}}`, 'g')) || [] : sp === ' ' ? t.trim().split(/\s+/) : t.split(sp); prev.textContent = parts.join('  │  '); };
  [mode, sep, other, width].forEach((e) => e.addEventListener('input', upd)); upd();
  dialog({ title: 'Convertir le texte en colonnes', width: 420, body: h('div', field('Type de données d’origine :', mode), grid2(lab('Séparateur :'), sep, lab('Autre :'), other, lab('Largeur fixe :'), width), h('div.pc-lab', 'Aperçu de la première cellule'), prev, h('p.pl-hint', 'La première colonne de la sélection est convertie ; les colonnes situées à droite sont remplacées.')), buttons: [{ label: 'Terminer', primary: true, action: () => F.textToColumns(app, sep.value === 'other' ? other.value || ';' : sep.value, mode.value === 'fixed' ? num(width, 5) : 0) }, { label: 'Annuler' }] });
}
export function seriesDialog(app) {
  const g = app.bounded(), s = app.sheet;
  const dir = select([['col', 'Colonnes'], ['row', 'Lignes']], g.c2 > g.c1 && g.r1 === g.r2 ? 'row' : 'col');
  const type = select([['linear', 'Linéaire'], ['growth', 'Géométrique'], ['date', 'Chronologique']], 'linear');
  const unit = select([['day', 'Jour'], ['weekday', 'Jour ouvré'], ['month', 'Mois'], ['year', 'Année']], 'day');
  const step = text('1', '90px'), stop = text('', '90px');
  dialog({ title: 'Série de données', width: 360, body: h('div', grid2(lab('Série en :'), dir, lab('Type :'), type, lab('Unité de temps :'), unit, lab('Valeur du pas :'), step, lab('Dernière valeur :'), stop), h('p.pl-hint', 'La série part de la valeur de la première cellule sélectionnée et remplit la sélection (ou s’arrête à la dernière valeur).')), buttons: [{ label: 'OK', primary: true, action: () => {
    const v0 = app.wb.value(s, g.r1, g.c1);
    if (typeof v0 !== 'number') { toast('La première cellule doit contenir un nombre ou une date.', 'error'); return false; }
    const st = parseNumberText(step.value) ?? 1, lim = stop.value.trim() ? parseNumberText(stop.value) : null;
    const single = g.r1 === g.r2 && g.c1 === g.c2;
    if (single && lim == null) { toast('Sélectionnez la plage à remplir ou indiquez une dernière valeur.', 'error'); return false; }
    if (!app.guard()) return;
    const cell0 = s.get(g.r1, g.c1);
    app.tx('Série', (wb) => {
      const n = single ? 10000 : dir.value === 'col' ? g.r2 - g.r1 + 1 : g.c2 - g.c1 + 1;
      let v = v0;
      const next = (x, i) => { if (type.value === 'growth') return x * st; if (type.value === 'date') { const d = new Date(Math.round((v0 - 25569) * 864e5)); if (unit.value === 'month') { d.setUTCMonth(d.getUTCMonth() + st * i); return d.getTime() / 864e5 + 25569; } if (unit.value === 'year') { d.setUTCFullYear(d.getUTCFullYear() + st * i); return d.getTime() / 864e5 + 25569; } if (unit.value === 'weekday') { let y = x, k = Math.abs(st); while (k > 0) { y += Math.sign(st); const wd = new Date(Math.round((y - 25569) * 864e5)).getUTCDay(); if (wd !== 0 && wd !== 6) k--; } return y; } return x + st; } return v0 + st * i; };
      for (let i = 1; i < n; i++) { v = next(v, i); if (lim != null && (st >= 0 ? v > lim + 1e-9 : v < lim - 1e-9)) break; const r = dir.value === 'col' ? g.r1 + i : g.r1, c = dir.value === 'col' ? g.c1 : g.c1 + i; wb.rawSet(s, r, c, { v: parseFloat(v.toPrecision(15)), s: cell0 && cell0.s ? cell0.s : undefined }); }
    });
  } }, { label: 'Annuler' }] });
}

// ── Analyse de scénarios ──
export function goalSeekDialog(app) {
  const g = app.sel;
  const target = text(addr(g.r, g.c), '110px'), goal = text('', '110px'), changing = text('', '110px', 'ex. B2');
  dialog({ title: 'Valeur cible', width: 340, body: grid2(lab('Cellule à définir :'), target, lab('Valeur à atteindre :'), goal, lab('Cellule à modifier :'), changing), buttons: [{ label: 'OK', primary: true, action: () => {
    const t = parseRange(target.value.replace(/\$/g, '').toUpperCase()), c = parseRange(changing.value.replace(/\$/g, '').toUpperCase()), gv = parseNumberText(goal.value);
    if (!t || !c || gv == null) { toast('Renseignez les trois champs (références de cellule et valeur numérique).', 'error'); return false; }
    const res = F.goalSeek(app, { r: t.r1, c: t.c1 }, gv, { r: c.r1, c: c.c1 });
    if (!res.ok) { alertDlg('Valeur cible', res.msg); return; }
    app.tx('Valeur cible', (wb, s) => wb.rawSet(s, c.r1, c.c1, { v: res.value }));
    alertDlg('État de la recherche', `Recherche sur la cellule ${addr(t.r1, t.c1)} : une solution a été trouvée.\nValeur cible : ${F.editTextOf(gv)}\n${addr(c.r1, c.c1)} = ${F.editTextOf(res.value)}`);
  } }, { label: 'Annuler' }] });
}
export function scenarioDialog(app) {
  const wb = app.wb, s = app.sheet;
  const list = h('div.pl-list', { style: { height: '160px', maxHeight: '160px' } });
  let cur = -1;
  const scen = () => wb.props.scenarios || [];
  const render = () => { list.innerHTML = ''; scen().forEach((sc, i) => { const el = h('div.pl-list-item' + (i === cur ? '.sel' : ''), { on: { click: () => { cur = i; render(); } } }, h('b', { style: { width: '130px' } }, sc.name), h('span.pl-hint', `${sc.sheet}!${sc.cells} = ${sc.values.map((v) => F.editTextOf(v)).join(' ; ').slice(0, 60)}`)); list.appendChild(el); }); if (!scen().length) list.appendChild(h('div.pl-list-item.pl-hint', 'Aucun scénario défini. Sélectionnez les cellules variables puis cliquez sur Ajouter.')); };
  const cellsOf = (sc) => { const sh = wb.sheetByName(sc.sheet), rg = parseRange(sc.cells); const o = []; if (sh && rg) for (let r = rg.r1; r <= rg.r2; r++) for (let c = rg.c1; c <= rg.c2; c++) o.push({ sh, r, c }); return o; };
  const add = () => { const name = text('Scénario ' + (scen().length + 1)), cells = text(app.selAddress()); dialog({ title: 'Ajouter un scénario', width: 340, body: h('div', field('Nom du scénario :', name), field('Cellules variables :', cells, 'Les valeurs actuelles de ces cellules sont enregistrées dans le scénario.')), buttons: [{ label: 'OK', primary: true, action: () => { const rg = parseRange(cells.value.replace(/\$/g, '').toUpperCase()); if (!rg) { toast('Plage non valide.', 'error'); return false; } const values = []; for (let r = rg.r1; r <= rg.r2; r++) for (let c = rg.c1; c <= rg.c2; c++) values.push(wb.value(s, r, c) ?? null); wb.props = { ...wb.props, scenarios: [...scen(), { name: name.value || 'Scénario', sheet: s.name, cells: rangeStr(rg.r1, rg.c1, rg.r2, rg.c2), values }] }; app.markDirty(); render(); } }, { label: 'Annuler' }] }); };
  const show = () => { const sc = scen()[cur]; if (!sc) return; app.tx('Afficher le scénario', () => cellsOf(sc).forEach((x, i) => wb.rawSet(x.sh, x.r, x.c, { v: sc.values[i] }))); toast(`Scénario « ${sc.name} » appliqué`, 'success'); };
  const summary = () => { const all = scen(); if (!all.length) return; const base = all[0]; const res = app.selAddress(); const rgRes = parseRange(res.replace(/\$/g, '')); const sheetName = s.name; const orig = cellsOf(base).map((x) => wb.value(x.sh, x.r, x.c)); const rows = [['Synthèse de scénarios', ...all.map((x) => x.name)], ...cellsOf(base).map((x, i) => [`${addr(x.r, x.c)} (variable)`, ...all.map((sc) => sc.values[i])])]; const results = []; for (const sc of all) { cellsOf(sc).forEach((x, i) => { x.sh.cells.set(keyOf(x.r, x.c), { ...(x.sh.get(x.r, x.c) || {}), v: sc.values[i] }); }); wb.recalc(); const col = []; for (let r = rgRes.r1; r <= rgRes.r2; r++) for (let c = rgRes.c1; c <= rgRes.c2; c++) col.push(wb.value(wb.sheetByName(sheetName), r, c)); results.push(col); } cellsOf(base).forEach((x, i) => { x.sh.cells.set(keyOf(x.r, x.c), { ...(x.sh.get(x.r, x.c) || {}), v: orig[i] }); }); wb.recalc(); let k = 0; for (let r = rgRes.r1; r <= rgRes.r2; r++) for (let c = rgRes.c1; c <= rgRes.c2; c++) { rows.push([`${addr(r, c)} (résultat)`, ...results.map((col) => col[k])]); k++; } let n = 1; while (wb.sheetByName('Synthèse' + n)) n++; const sh = app.addSheet('Synthèse' + n); app.tx('Synthèse de scénarios', () => { rows.forEach((row, i) => row.forEach((v, j) => wb.rawSet(sh, i, j, { v: isErr(v) ? v : v ?? null, s: i === 0 || j === 0 ? { b: true, ...(i === 0 ? { fill: '#d9e1f2' } : {}) } : undefined }))); sh.colW.set(0, 170); }); };
  render();
  dialog({ title: 'Gestionnaire de scénarios', width: 480, body: h('div', list, h('div', { style: { display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' } }, h('button.pl-btn', { type: 'button', on: { click: add } }, 'Ajouter…'), h('button.pl-btn', { type: 'button', on: { click: show } }, 'Afficher'), h('button.pl-btn', { type: 'button', on: { click: () => { if (cur >= 0) { wb.props = { ...wb.props, scenarios: scen().filter((_, i) => i !== cur) }; cur = -1; app.markDirty(); render(); } } } }, 'Supprimer'), h('button.pl-btn', { type: 'button', title: 'Sélectionnez d’abord les cellules résultantes', on: { click: summary } }, 'Synthèse…')), h('p.pl-hint', 'Synthèse : les cellules sélectionnées dans la feuille sont utilisées comme cellules résultantes.')), buttons: [{ label: 'Fermer', primary: true }] });
}
export function dataTableDialog(app) {
  const rowIn = text('', '110px'), colIn = text('', '110px');
  dialog({ title: 'Table de données', width: 360, body: h('div', grid2(lab('Cellule d’entrée en ligne :'), rowIn, lab('Cellule d’entrée en colonne :'), colIn), h('p.pl-hint', 'Sélectionnez la table : valeurs d’entrée dans la première colonne (et/ou la première ligne), formule(s) dans la première ligne ou le coin supérieur gauche. Les résultats sont calculés et écrits sous forme de valeurs.')), buttons: [{ label: 'OK', primary: true, action: () => {
    const g = app.bounded(), s = app.sheet, wb = app.wb;
    const pr = rowIn.value.trim() ? parseRange(rowIn.value.replace(/\$/g, '').toUpperCase()) : null, pc = colIn.value.trim() ? parseRange(colIn.value.replace(/\$/g, '').toUpperCase()) : null;
    if ((!pr && !pc) || g.r2 <= g.r1 || g.c2 <= g.c1) { toast('Sélectionnez la table (au moins 2 × 2) et indiquez une cellule d’entrée.', 'error'); return false; }
    const setTmp = (p, v) => { const k = keyOf(p.r1, p.c1); const o = s.cells.get(k); s.cells.set(k, { ...(o && o.s ? { s: o.s } : {}), v }); return () => { if (o) s.cells.set(k, o); else s.cells.delete(k); }; };
    const out = [];
    for (let r = g.r1 + 1; r <= g.r2; r++) for (let c = g.c1 + 1; c <= g.c2; c++) {
      const undo = [];
      if (pr && pc) { undo.push(setTmp(pr, wb.value(s, g.r1, c)), setTmp(pc, wb.value(s, r, g.c1))); wb.recalc(); out.push({ r, c, v: wb.value(s, g.r1, g.c1) }); }
      else if (pc) { undo.push(setTmp(pc, wb.value(s, r, g.c1))); wb.recalc(); out.push({ r, c, v: wb.value(s, g.r1, c) }); }
      else { undo.push(setTmp(pr, wb.value(s, g.r1, c))); wb.recalc(); out.push({ r, c, v: wb.value(s, r, g.c1) }); }
      undo.reverse().forEach((u) => u());
    }
    wb.recalc();
    app.tx('Table de données', () => out.forEach((o) => wb.rawSet(s, o.r, o.c, { v: o.v })));
  } }, { label: 'Annuler' }] });
}
export function forecastDialog(app) {
  const rg = F.dataRange(app), s = app.sheet, wb = app.wb;
  if (rg.c2 - rg.c1 < 1 || rg.r2 - rg.r1 < 2) return toast('Sélectionnez deux colonnes : une chronologie (dates ou nombres) et les valeurs correspondantes.');
  const n = numberInput(5, { min: 1, max: 200, unit: 'périodes' });
  dialog({ title: 'Créer une feuille de prévision', width: 360, body: h('div', h('p', `Données : ${rangeStr(rg.r1, rg.c1, rg.r2, rg.c2)}. Une prévision linéaire est ajoutée sous les données, avec un graphique.`), field('Nombre de périodes à prévoir :', n)), buttons: [{ label: 'Créer', primary: true, action: () => {
    const hd = typeof wb.value(s, rg.r1, rg.c1 + 1) !== 'number' ? 1 : 0;
    const a = rg.r1 + hd, b = rg.r2, xc = rg.c1, yc = rg.c1 + 1;
    const x1 = wb.value(s, b, xc), x0 = wb.value(s, b - 1, xc);
    if (typeof x1 !== 'number' || typeof x0 !== 'number') { toast('La première colonne doit contenir des dates ou des nombres.', 'error'); return false; }
    const step = x1 - x0, k = num(n, 5), stx = (s.get(b, xc) || {}).s, sty = (s.get(b, yc) || {}).s;
    app.tx('Prévision', () => { for (let i = 1; i <= k; i++) { wb.rawSet(s, b + i, xc, { v: parseFloat((x1 + step * i).toPrecision(15)), s: stx }); wb.rawSet(s, b + i, yc, { f: `FORECAST(${addr(b + i, xc)},${addr(a, yc, true, true)}:${addr(b, yc, true, true)},${addr(a, xc, true, true)}:${addr(b, xc, true, true)})`, s: { ...(sty || {}), i: true, color: '#ed7d31' } }); } });
    F.addObject(app, { kind: 'chart', w: 520, h: 300, chart: { type: 'line', range: rangeStr(rg.r1, xc, b + k, yc), sheet: s.name, title: 'Prévision', legend: false } });
  } }, { label: 'Annuler' }] });
}
export function consolidateDialog(app) {
  const fn = select([['SUM', 'Somme'], ['AVERAGE', 'Moyenne'], ['COUNT', 'Nombre'], ['MAX', 'Max'], ['MIN', 'Min']], 'SUM');
  const refs = h('textarea.pl-input', { rows: 4, placeholder: 'Une plage par ligne, ex.\nFeuil1!B2:D8\nFeuil2!B2:D8' });
  dialog({ title: 'Consolider', width: 400, body: h('div', field('Fonction :', fn), field('Références (plages de même forme) :', refs), h('p.pl-hint', 'Le résultat est écrit à partir de la cellule active.')), buttons: [{ label: 'OK', primary: true, action: () => {
    const list = refs.value.split('\n').map((x) => parseRef(app, x)).filter(Boolean);
    if (list.length < 1) { toast('Indiquez au moins une plage valide.', 'error'); return false; }
    const hh = list[0].rg.r2 - list[0].rg.r1 + 1, ww = list[0].rg.c2 - list[0].rg.c1 + 1, g = app.sel, wb = app.wb;
    app.tx('Consolider', (w, s) => { for (let i = 0; i < hh; i++) for (let j = 0; j < ww; j++) { const vs = list.map((x) => wb.value(x.sheet, x.rg.r1 + i, x.rg.c1 + j)); const nums = vs.filter((v) => typeof v === 'number'); const txt = vs.find((v) => typeof v === 'string'); let v = null; if (nums.length) v = fn.value === 'SUM' ? nums.reduce((a, b) => a + b, 0) : fn.value === 'AVERAGE' ? nums.reduce((a, b) => a + b, 0) / nums.length : fn.value === 'COUNT' ? nums.length : fn.value === 'MAX' ? Math.max(...nums) : Math.min(...nums); else if (txt != null) v = txt; w.rawSet(s, g.r + i, g.c + j, { v }); } });
  } }, { label: 'Annuler' }] });
}
export function subtotalDialog(app) {
  const rg = F.dataRange(app), s = app.sheet;
  if (rg.r2 - rg.r1 < 2) return toast('Placez-vous dans une liste de données avec une ligne d’en-têtes.');
  const hd = headers(app, s, rg);
  const grp = select(hd, hd[0][0]), fn = select([['SUM', 'Somme'], ['AVERAGE', 'Moyenne'], ['COUNT', 'Nombre'], ['MAX', 'Max'], ['MIN', 'Min']], 'SUM');
  const boxes = hd.map(([c, l]) => ({ c, el: checkbox(l, typeof app.wb.value(s, rg.r1 + 1, c) === 'number' && c === hd[hd.length - 1][0]) }));
  dialog({ title: 'Sous-total', width: 360, body: h('div', field('À chaque changement de :', grp), field('Utiliser la fonction :', fn), h('div.pc-lab', 'Ajouter un sous-total à :'), h('div.pl-list', { style: { padding: '4px 8px', maxHeight: '140px' } }, ...boxes.map((b) => b.el)), h('p.pl-hint', 'La liste est d’abord triée selon la colonne de regroupement.')), buttons: [{ label: 'OK', primary: true, action: () => { const cols = boxes.filter((b) => val(b.el)).map((b) => b.c); if (!cols.length) { toast('Cochez au moins une colonne.', 'error'); return false; } if (app.guard(rg)) F.subtotals(app, rg, +grp.value, fn.value, cols); } }, { label: 'Annuler' }] });
}
export function groupRows(app, group) {
  const s = app.sheet, g = app.sel;
  const axis = app.isWholeCols(g) ? 'cols' : 'rows';
  const a = axis === 'rows' ? g.r1 : g.c1, b = axis === 'rows' ? g.r2 : g.c2;
  const setHidden = (gr, hide) => { const set = gr.axis === 'rows' ? s.hiddenRows : s.hiddenCols; for (let i = gr.a; i <= gr.b; i++) { if (hide) set.add(i); else set.delete(i); } };
  if (group) { if (b - a > 100000) return toast('Sélectionnez les lignes ou colonnes à grouper.'); app.tx('Grouper', (wb) => { wb.snapshot(s); s.groups = { ...s.groups, [axis]: [...(s.groups[axis] || []), { a, b }] }; }); }
  else app.tx('Dissocier', (wb) => { wb.snapshot(s); for (const gr of (s.groups[axis] || []).filter((x) => x.a <= b && x.b >= a)) setHidden({ ...gr, axis }, false); s.groups = { ...s.groups, [axis]: (s.groups[axis] || []).filter((x) => !(x.a <= b && x.b >= a)) }; });
  const all = () => [...(s.groups.rows || []).map((x) => ({ ...x, axis: 'rows' })), ...(s.groups.cols || []).map((x) => ({ ...x, axis: 'cols' }))];
  if (!all().length) return;
  const list = h('div.pl-list', { style: { maxHeight: '200px' } });
  const render = () => { list.innerHTML = ''; for (const gr of all()) { const set = gr.axis === 'rows' ? s.hiddenRows : s.hiddenCols; const collapsed = set.has(gr.a); list.appendChild(h('div.pl-list-item', icon(collapsed ? 'SquarePlus' : 'SquareMinus', 15), h('span', { style: { flex: 1 } }, gr.axis === 'rows' ? `Lignes ${gr.a + 1} à ${gr.b + 1}` : `Colonnes ${colName(gr.a)} à ${colName(gr.b)}`), h('button.pl-btn.small', { type: 'button', on: { click: () => { app.tx(collapsed ? 'Afficher le détail' : 'Masquer le détail', (wb) => { wb.snapshot(s); setHidden(gr, !collapsed); }); render(); } } }, collapsed ? 'Afficher le détail' : 'Masquer le détail'))); } };
  render();
  dialog({ title: 'Plan', width: 380, modeless: true, body: h('div', h('p.pl-hint', 'Groupes de la feuille : réduisez ou développez chaque groupe.'), list), buttons: [{ label: 'Fermer', primary: true }] });
}
export function advancedFilter(app) {
  const rg = F.dataRange(app), s = app.sheet;
  const listIn = text(rangeStr(rg.r1, rg.c1, rg.r2, rg.c2)), crit = text('', '100%', 'ex. H1:I3');
  dialog({ title: 'Filtre avancé', width: 400, body: h('div', field('Plages :', listIn), field('Zone de critères :', crit, 'Première ligne : les en-têtes ; lignes suivantes : les critères (>100, <>Paris, Par*). Même ligne = ET, lignes différentes = OU.')), buttons: [{ label: 'OK', primary: true, action: () => {
    const lr = parseRange(listIn.value.replace(/\$/g, '').toUpperCase()), cr = parseRange(crit.value.replace(/\$/g, '').toUpperCase());
    if (!lr || !cr) { toast('Plages non valides.', 'error'); return false; }
    const wb = app.wb, txt = (r, c) => { const d = wb.display(s, r, c); return d ? d.text : ''; };
    const colOf = (name) => { for (let c = lr.c1; c <= lr.c2; c++) if (txt(lr.r1, c).toLowerCase() === name.toLowerCase()) return c; return -1; };
    const test = (v, t, c) => { const m = /^(>=|<=|<>|>|<|=)?(.*)$/.exec(c); const op = m[1] || '', x = m[2]; const n = parseNumberText(x); if (n != null && typeof v === 'number') return op === '>' ? v > n : op === '<' ? v < n : op === '>=' ? v >= n : op === '<=' ? v <= n : op === '<>' ? v !== n : v === n; const re = new RegExp('^' + x.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + (op === '=' ? '$' : ''), 'i'); return op === '<>' ? !re.test(t) : re.test(t); };
    const keep = new Set();
    for (let r = lr.r1 + 1; r <= lr.r2; r++) { let any = false; for (let cr1 = cr.r1 + 1; cr1 <= cr.r2 && !any; cr1++) { let all = true, used = false; for (let c = cr.c1; c <= cr.c2; c++) { const cond = txt(cr1, c); if (!cond) continue; const col = colOf(txt(cr.r1, c)); if (col < 0) continue; used = true; if (!test(wb.value(s, r, col), txt(r, col), cond)) { all = false; break; } } if (all && used) any = true; } if (any) keep.add(r); }
    app.tx('Filtre avancé', (w) => { w.snapshot(s); s.filter = { ...lr, cols: { [lr.c1]: { top: keep } } }; w.applyFilter(s); });
    toast(`${keep.size} ligne(s) conservée(s) sur ${lr.r2 - lr.r1}`, 'success');
  } }, { label: 'Annuler' }] });
}

// ── Audit des formules ──
export function errorCheck(app) {
  const errs = F.findErrors(app);
  if (!errs.length) return toast('La vérification des erreurs est terminée : aucune erreur dans le classeur.', 'success');
  const why = { '#DIV/0!': 'Division par zéro.', '#N/A': 'Valeur non disponible (recherche sans résultat).', '#NOM?': 'Nom de fonction ou de plage non reconnu.', '#REF!': 'Référence de cellule non valide.', '#VALEUR!': 'Type d’argument incorrect.', '#NOMBRE!': 'Valeur numérique non valide.', '#NUL!': 'Intersection vide.', '#EPARS!': 'La zone de propagation n’est pas vide.', '#CALC!': 'Erreur de calcul (tableau vide).', '#CIRC!': 'Référence circulaire.' };
  const list = h('div.pl-list', { style: { maxHeight: '260px' } }, ...errs.slice(0, 300).map((e) => h('div.pl-list-item', { on: { click: () => { app.activateSheet(app.wb.sheets.indexOf(e.sheet)); app.select(e.r, e.c); } } }, h('b', { style: { width: '110px' } }, `${e.sheet.name}!${addr(e.r, e.c)}`), h('span', { style: { color: '#c00000', width: '80px' } }, e.err), h('span.pl-hint', why[e.err] || ''))));
  dialog({ title: `Vérification des erreurs (${errs.length})`, width: 480, modeless: true, body: list, buttons: [{ label: 'Fermer', primary: true }] });
}
export function evaluateFormula(app) {
  const s = app.sheet, g = app.sel, cell = s.get(g.r, g.c);
  if (!cell || cell.f == null) return toast('La cellule active ne contient pas de formule.');
  const ast = parseCached(cell.f);
  const rows = [];
  if (!ast.error) for (const x of refsOf(ast)) { const sh = x.sheet ? app.wb.sheetByName(x.sheet) : s; if (!sh) continue; const single = x.r1 === x.r2 && x.c1 === x.c2; const label = (x.sheet ? x.sheet + '!' : '') + rangeStr(x.r1, x.c1, Math.min(x.r2, sh.usedRange().r2), Math.min(x.c2, sh.usedRange().c2)); let v; if (single) v = F.editTextOf(app.wb.value(sh, x.r1, x.c1)); else { const vs = []; for (let r = x.r1; r <= Math.min(x.r2, sh.usedRange().r2, x.r1 + 50); r++) for (let c = x.c1; c <= Math.min(x.c2, sh.usedRange().c2, x.c1 + 20); c++) vs.push(F.editTextOf(app.wb.value(sh, r, c))); v = '{' + vs.slice(0, 12).join(' ; ') + (vs.length > 12 ? ' ; …' : '') + '}'; } rows.push(h('tr', h('td', h('b', label)), h('td', v))); }
  // sous-expressions : chaque appel de fonction évalué séparément
  const subs = [];
  const local = toLocal(cell.f);
  const re = /[A-ZÀ-Ÿ][A-ZÀ-Ÿ0-9_.]*\(/g; let m;
  while ((m = re.exec(local)) && subs.length < 12) { let depth = 0, i = m.index + m[0].length - 1, end = -1; for (; i < local.length; i++) { if (local[i] === '(') depth++; else if (local[i] === ')') { depth--; if (!depth) { end = i; break; } } } if (end < 0) continue; const sub = local.slice(m.index, end + 1); if (sub === local) continue; let v; try { v = app.wb.evalFormula(require_canon(sub), s, g.r, g.c); } catch { v = '?'; } subs.push(h('tr', h('td', h('code', sub)), h('td', Array.isArray(v) ? '{tableau}' : F.editTextOf(v)))); }
  dialog({ title: 'Évaluation de formule – ' + addr(g.r, g.c), width: 520, body: h('div', h('div.pc-lab', 'Formule :'), h('div.pc-sample', { style: { textAlign: 'left', fontFamily: 'Consolas, monospace', fontSize: '13px' } }, '=' + local), h('div.pc-lab', 'Résultat :'), h('div.pc-sample', { style: { textAlign: 'left' } }, F.editTextOf(app.wb.value(s, g.r, g.c))), rows.length ? h('div', h('div.pc-lab', 'Cellules utilisées :'), h('table.pc-keys', ...rows)) : null, subs.length ? h('div', h('div.pc-lab', 'Étapes intermédiaires :'), h('table.pc-keys', ...subs)) : null), buttons: [{ label: 'Fermer', primary: true }] });
}
function require_canon(local) { return toCanonical(local); }
export function watchWindow(app) {
  app.watches = app.watches || [];
  const body = h('div');
  const render = () => {
    body.innerHTML = '';
    const tbl = h('table.pc-keys', h('tr', h('th', 'Feuille'), h('th', 'Cellule'), h('th', 'Valeur'), h('th', 'Formule'), h('th', '')));
    app.watches = app.watches.filter((w) => app.wb.sheets.includes(w.sheet));
    app.watches.forEach((w, i) => { const cell = w.sheet.get(w.r, w.c); const d = app.wb.display(w.sheet, w.r, w.c); tbl.appendChild(h('tr', { style: { cursor: 'pointer' }, on: { click: () => { app.activateSheet(app.wb.sheets.indexOf(w.sheet)); app.select(w.r, w.c); } } }, h('td', w.sheet.name), h('td', addr(w.r, w.c)), h('td', d ? d.text : ''), h('td', cell && cell.f != null ? '=' + toLocal(cell.f) : ''), h('td', h('button.pl-btn.small', { type: 'button', on: { click: (e) => { e.stopPropagation(); app.watches.splice(i, 1); render(); } } }, '×')))); });
    body.append(tbl, app.watches.length ? '' : h('p.pl-hint', 'Aucun espion. Sélectionnez une cellule puis cliquez sur « Ajouter un espion ».'));
  };
  render();
  const timer = setInterval(render, 1500);
  dialog({ title: 'Fenêtre Espion', width: 520, modeless: true, onClose: () => clearInterval(timer), body: h('div', h('button.pl-btn', { type: 'button', style: { marginBottom: '8px' }, on: { click: () => { const g = app.bounded(); for (let r = g.r1; r <= Math.min(g.r2, g.r1 + 20); r++) for (let c = g.c1; c <= Math.min(g.c2, g.c1 + 20); c++) if (!app.watches.some((w) => w.sheet === app.sheet && w.r === r && w.c === c)) app.watches.push({ sheet: app.sheet, r, c }); render(); } } }, icon('Plus', 14), ' Ajouter un espion'), body), buttons: [{ label: 'Fermer', primary: true }] });
}

// ── Import de données ──
function importPreview(app, textData, name) {
  const sep = select([[';', 'Point-virgule'], [',', 'Virgule'], ['\t', 'Tabulation'], ['|', 'Barre verticale |'], [' ', 'Espace']], F.guessSeparator(textData));
  const dest = select([['new', 'Nouvelle feuille'], ['here', 'À partir de la cellule active']], 'new');
  const prev = h('div', { style: { maxHeight: '200px', overflow: 'auto', border: '1px solid var(--ui-border)' } });
  const upd = () => { const rows = F.parseDelimited(textData, sep.value).slice(0, 12); prev.innerHTML = ''; prev.appendChild(h('table.pc-keys', ...rows.map((r) => h('tr', ...r.slice(0, 12).map((c) => h('td', c.slice(0, 30))))))); };
  sep.addEventListener('change', upd); upd();
  dialog({ title: 'Importer des données – ' + name, width: 560, body: h('div', grid2(lab('Délimiteur :'), sep, lab('Placer les données dans :'), dest), h('div.pc-lab', 'Aperçu'), prev), buttons: [{ label: 'Charger', primary: true, action: () => {
    const rows = F.parseDelimited(textData.replace(/^﻿/, ''), sep.value);
    let s = app.sheet, r0 = app.sel.r, c0 = app.sel.c;
    if (dest.value === 'new') { s = app.addSheet(); r0 = 0; c0 = 0; let nm = name.replace(/\.[^.]+$/, '').replace(/[\\/?*[\]:]/g, '').slice(0, 28); if (nm && !app.wb.sheetByName(nm)) app.renameSheet(app.wb.active, nm); }
    app.tx('Importer des données', (wb) => rows.forEach((row, i) => row.forEach((t, j) => { if (t === '') return; if (sep.value === ',' && /^-?\d+\.\d+$/.test(t)) t = t.replace('.', ','); wb.setInput(s, r0 + i, c0 + j, t); })));
    toast(`${rows.length} ligne(s) importée(s)`, 'success');
  } }, { label: 'Annuler' }] });
}
export async function importCsvDialog(app) {
  const f = await pickFile('.csv,.tsv,.txt');
  if (!f) return;
  importPreview(app, await readAsText(f), f.name);
}
export function importWebDialog(app) {
  const url = text('', '100%', 'https://exemple.fr/donnees.csv');
  dialog({ title: 'À partir du web', width: 440, body: h('div', field('Adresse (URL) d’un fichier CSV ou d’une page contenant un tableau :', url), h('p.pl-hint', 'Le site doit autoriser la lecture depuis un navigateur (CORS) ; sinon, téléchargez le fichier puis utilisez « À partir d’un fichier texte/CSV ».')), buttons: [{ label: 'OK', primary: true, action: () => {
    const u = url.value.trim();
    if (!/^https?:\/\//i.test(u)) { toast('Entrez une adresse commençant par http:// ou https://', 'error'); return false; }
    fetch(u).then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); }).then((t) => {
      if (/<table/i.test(t)) { const doc = new DOMParser().parseFromString(t, 'text/html'); const tb = doc.querySelector('table'); const csv = [...tb.rows].map((tr) => [...tr.cells].map((td) => '"' + td.textContent.trim().replace(/\s+/g, ' ').replace(/"/g, '""') + '"').join(';')).join('\n'); importPreview(app, csv, 'Tableau web'); } else importPreview(app, t, u.split('/').pop() || 'Données web');
    }).catch((e) => alertDlg('À partir du web', 'Impossible de lire cette adresse depuis le navigateur (' + e.message + '). Téléchargez le fichier puis importez-le avec « À partir d’un fichier texte/CSV ».'));
  } }, { label: 'Annuler' }] });
}

// ── Vérification ──
export function spellDialog(app) {
  const on = prefs.get('calc.spell', false);
  const box = checkbox('Souligner les fautes pendant la saisie (correcteur du navigateur)', on);
  dialog({ title: 'Orthographe', width: 400, body: h('div', h('p', 'Plume Tableur utilise le correcteur orthographique de votre navigateur : les mots mal orthographiés sont soulignés pendant la saisie dans la cellule ou la barre de formule (clic droit pour les suggestions).'), box), buttons: [{ label: 'OK', primary: true, action: () => { const v = val(box); prefs.set('calc.spell', v); app.fx.spellcheck = v; app.grid.editor.spellcheck = v; } }, { label: 'Annuler' }] });
}
export function thesaurusDialog(app) {
  const v = app.wb.value(app.sheet, app.sel.r, app.sel.c);
  const word = text(typeof v === 'string' ? v.split(/\s+/)[0] : '');
  const list = h('div.pl-list', { style: { height: '160px', maxHeight: '160px' } });
  const look = () => { list.innerHTML = ''; const syn = synonyms(word.value.trim()); if (!syn.length) list.appendChild(h('div.pl-list-item.pl-hint', 'Aucun synonyme trouvé dans le dictionnaire intégré.')); for (const x of syn) list.appendChild(h('div.pl-list-item', { title: 'Remplacer le contenu de la cellule', on: { click: () => { if (typeof v === 'string' && app.guard()) { app.tx('Synonyme', (wb, s) => wb.setInput(s, app.sel.r, app.sel.c, v.replace(word.value.trim(), x))); toast('Mot remplacé', 'success'); } } } }, x)); };
  word.addEventListener('input', look); look();
  dialog({ title: 'Dictionnaire des synonymes', width: 340, body: h('div', field('Rechercher :', word), list), buttons: [{ label: 'Fermer', primary: true }] });
}
export function statsDialog(app) {
  const wb = app.wb;
  let cells = 0, formulas = 0, charts = 0, comments = 0, tables = 0, images = 0;
  for (const s of wb.sheets) { for (const c of s.cells.values()) { if (c.f != null) { formulas++; cells++; } else if (c.v != null) cells++; } charts += s.objects.filter((o) => o.kind === 'chart').length; images += s.objects.filter((o) => o.kind !== 'chart').length; comments += s.comments.size; tables += s.tables.length; }
  const u = app.sheet.usedRange();
  const show = prefs.get('calc.stats', { avg: true, count: true, sum: true, min: false, max: false, nums: false });
  const boxes = [['avg', 'Moyenne'], ['count', 'Nb (non vides)'], ['nums', 'Nb (nombres)'], ['min', 'Minimum'], ['max', 'Maximum'], ['sum', 'Somme']].map(([k, l]) => ({ k, el: checkbox(l, show[k]) }));
  dialog({ title: 'Statistiques du classeur', width: 400, body: h('div', h('h4', 'Feuille active'), grid2(lab('Fin de la feuille :'), h('span', addr(u.r2, u.c2)), lab('Cellules avec données :'), h('span', String([...app.sheet.cells.values()].filter((c) => c.f != null || c.v != null).length)), lab('Formules :'), h('span', String([...app.sheet.cells.values()].filter((c) => c.f != null).length))), h('h4', 'Classeur'), grid2(lab('Feuilles :'), h('span', String(wb.sheets.length)), lab('Cellules avec données :'), h('span', String(cells)), lab('Formules :'), h('span', String(formulas)), lab('Tableaux :'), h('span', String(tables)), lab('Graphiques :'), h('span', String(charts)), lab('Images et formes :'), h('span', String(images)), lab('Commentaires :'), h('span', String(comments)), lab('Noms définis :'), h('span', String(wb.names.size))), h('h4', 'Barre d’état : afficher'), ...boxes.map((b) => b.el)), buttons: [{ label: 'OK', primary: true, action: () => { prefs.set('calc.stats', Object.fromEntries(boxes.map((b) => [b.k, val(b.el)]))); app.updateStats(); } }, { label: 'Annuler' }] });
}
export function accessibilityDialog(app) {
  const issues = [];
  for (const s of app.wb.sheets) {
    if (/^Feuil\d+$/.test(s.name) && s.cells.size) issues.push([s, null, `La feuille « ${s.name} » porte un nom par défaut : donnez-lui un nom explicite.`]);
    for (const o of s.objects) if (!o.alt && o.kind !== 'text') issues.push([s, o, `${o.name || 'Objet'} : texte de remplacement manquant.`]);
    if (s.merges.length) issues.push([s, null, `« ${s.name} » contient ${s.merges.length} cellule(s) fusionnée(s), difficiles à parcourir avec un lecteur d’écran.`]);
    for (const [k, c] of s.cells) if (c.s && c.s.color && c.s.fill && contrast(c.s.color, c.s.fill) < 3) { issues.push([s, { r: Math.floor(k / MAX_COLS), c: k % MAX_COLS }, `${s.name}!${addr(Math.floor(k / MAX_COLS), k % MAX_COLS)} : contraste insuffisant entre le texte et le fond.`]); if (issues.length > 60) break; }
    for (const t of s.tables) if (t.header === false) issues.push([s, null, `Le tableau ${t.name} n’a pas de ligne d’en-tête.`]);
  }
  const list = h('div.pl-list', { style: { maxHeight: '260px' } }, ...(issues.length ? issues.map(([s, o, msg]) => h('div.pl-list-item', { on: { click: () => { app.activateSheet(app.wb.sheets.indexOf(s)); if (o && o.id) { app.selObject = o.id; app.refresh(); } else if (o) app.select(o.r, o.c); } } }, icon('TriangleAlert', 15), h('span', msg))) : [h('div.pl-list-item', icon('CircleCheck', 15), 'Aucun problème d’accessibilité détecté.')]));
  dialog({ title: 'Vérificateur d’accessibilité', width: 480, modeless: true, body: list, buttons: [{ label: 'Fermer', primary: true }] });
}
function contrast(a, b) { const lum = (hex) => { const n = parseInt(hex.slice(1), 16); const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f((n >> 16) & 255) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255); }; if (!/^#[0-9a-f]{6}$/i.test(a) || !/^#[0-9a-f]{6}$/i.test(b)) return 21; const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); }
export function macroDialog() { alertDlg('Macros', 'Les macros VBA ne sont pas prises en charge par Plume Tableur. Les fichiers .xlsm s’ouvrent normalement, mais leurs macros sont ignorées et ne sont pas réenregistrées.'); }
