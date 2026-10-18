import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]).filter((s) => s.trim());
assert.equal(scripts.length, 1, 'expected one inline application script');
assert.doesNotThrow(() => new Function(scripts[0]), 'application JavaScript must parse');

const start = html.indexOf('const DRAWING_LIBRARY_PER_STYLE=1250');
const end = html.indexOf('function makeDrawingQuestion(subject){return null}', start);
assert.ok(start >= 0 && end > start, 'drawing engine boundaries must exist');
const engine = html.slice(start, end);
const state = { worksheets: {} };
const api = new Function('state', engine + ';return {chooseDrawingSet,drawingSvg,DRAWING_LIBRARY_TOTAL,DRAWING_LIBRARY_PER_STYLE};')(state);

assert.equal(api.DRAWING_LIBRARY_TOTAL, 2500);
assert.equal(api.DRAWING_LIBRARY_PER_STYLE, 1250);

const seenIds = new Set();
for (let i = 0; i < 300; i++) {
  const drawings = api.chooseDrawingSet();
  assert.equal(drawings.length, 4, 'each worksheet version must reserve four drawings');
  const perSide = { front: { outline: 0, half: 0 }, back: { outline: 0, half: 0 } };
  for (const drawing of drawings) {
    assert.ok(!seenIds.has(drawing.id), 'drawing ID must never repeat');
    seenIds.add(drawing.id);
    perSide[drawing.side][drawing.style]++;
    const svg = api.drawingSvg(drawing);
    assert.match(svg, /^<svg[\s\S]*<\/svg>$/, 'drawing must render as SVG');
    if (drawing.style === 'half') assert.ok(svg.includes('clip-path="url(#half-' + drawing.id + ')"'), 'half-coloured drawing must use a half-image clip');
  }
  for (const side of ['front', 'back']) {
    assert.equal(perSide[side].outline, 1, side + ' must contain one outline drawing');
    assert.equal(perSide[side].half, 1, side + ' must contain one half-coloured drawing');
  }
  state.worksheets['test-' + i] = { versions: [{ drawings }] };
}
assert.equal(seenIds.size, 1200, '300 worksheets must use 1,200 unique drawing IDs');

const allSvg = new Set();
for (let id = 0; id < 2500; id++) {
  allSvg.add(api.drawingSvg({ id, style: id < 1250 ? 'outline' : 'half' }));
}
assert.equal(allSvg.size, 2500, 'all 2,500 generated SVG variants must be visually distinct');

const almostExhausted = { worksheets: { old: { versions: [{ drawings: Array.from({ length: 2498 }, (_, id) => ({ id })) }] } } };
const exhaustedApi = new Function('state', engine + ';return chooseDrawingSet();')(almostExhausted);
assert.equal(exhaustedApi, null, 'engine must refuse reuse when a complete set cannot be reserved');

assert.ok(html.includes('.paper.c1 .current{grid-column:1/-1!important;min-height:29mm!important;padding:4px!important}'), 'Class 1 Current Affairs must match the compact full-width layout');
assert.ok(html.includes('function withDrawingActivity(subject,questions){return questions}'), 'drawing engine must not replace worksheet questions');
assert.ok(html.includes('renderDrawingPanel(v.drawings,pi===0?\'front\':\'back\')'), 'both worksheet sides must render their assigned drawing panels');

console.log('PASS: application syntax');
console.log('PASS: 2,500 unique SVG variants');
console.log('PASS: 300 worksheet no-repeat regression (1,200 unique IDs)');
console.log('PASS: front/back each contain one outline and one half-coloured drawing');
console.log('PASS: exhaustion refuses reuse');
console.log('PASS: Class 1 Current Affairs sizing and question preservation');
