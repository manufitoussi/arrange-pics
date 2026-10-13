import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import Arrange from '../arrange.js';

let inDir, outDir;

beforeEach(async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'arrange-pics-'));
  inDir = path.join(root, 'in');
  outDir = path.join(root, 'out');
  await fs.mkdir(inDir);
});

afterEach(async () => {
  await fs.rm(path.dirname(inDir), { recursive: true, force: true });
});

const run = config => new Arrange({ inDir, outDir, log: () => {}, ...config }).start();
const write = (p, content = 'x') => fs.writeFile(path.join(inDir, p), content);
const exists = p => fs.access(p).then(() => true, () => false);

// JPEG minimal (SOI + APP1 Exif + EOI) contenant DateTimeOriginal.
function jpegWithExif(date) {
  const tiff = Buffer.alloc(64);
  tiff.write('II', 0);
  tiff.writeUInt16LE(42, 2);
  tiff.writeUInt32LE(8, 4);
  // IFD0 : pointeur vers l'IFD Exif
  tiff.writeUInt16LE(1, 8);
  tiff.writeUInt16LE(0x8769, 10);
  tiff.writeUInt16LE(4, 12);
  tiff.writeUInt32LE(1, 14);
  tiff.writeUInt32LE(26, 18);
  tiff.writeUInt32LE(0, 22);
  // IFD Exif : DateTimeOriginal
  tiff.writeUInt16LE(1, 26);
  tiff.writeUInt16LE(0x9003, 28);
  tiff.writeUInt16LE(2, 30);
  tiff.writeUInt32LE(20, 32);
  tiff.writeUInt32LE(44, 36);
  tiff.writeUInt32LE(0, 40);
  tiff.write(`${date}\0`, 44, 'ascii');

  const payload = Buffer.concat([Buffer.from('Exif\0\0', 'binary'), tiff]);
  const header = Buffer.from([0xff, 0xe1, 0, 0]);
  header.writeUInt16BE(payload.length + 2, 2);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), header, payload, Buffer.from([0xff, 0xd9])]);
}

test('range les fichiers datés par leur nom dans année/mois', async () => {
  await write('2018-07-14 12.34.56.jpg');
  await write('2019-01-02 08.00.00.mp4');

  const report = await run();

  assert.ok(await exists(path.join(outDir, '2018', '07', '2018-07-14 12.34.56.jpg')));
  assert.ok(await exists(path.join(outDir, '2019', '01', '2019-01-02 08.00.00.mp4')));
  assert.ok(!(await exists(path.join(inDir, '2018-07-14 12.34.56.jpg'))));
  assert.deepEqual(report, { moved: 2, skipped: 0, unmatched: 0, errors: 0 });
});

test('la date doit être en début de nom et le mois valide', async () => {
  await write('IMG_2018-07-14.jpg');
  await write('2018-13-01 mois invalide.jpg');

  const report = await run({ exif: false });

  assert.equal(report.moved, 0);
  assert.equal(report.unmatched, 2);
  assert.ok(await exists(path.join(inDir, 'IMG_2018-07-14.jpg')));
});

test('ignore les dossiers', async () => {
  await fs.mkdir(path.join(inDir, '2018-07-vacances'));

  const report = await run();

  assert.ok(await exists(path.join(inDir, '2018-07-vacances')));
  assert.equal(report.moved, 0);
});

test('range les originaux dans un sous-dossier dédié', async () => {
  await fs.mkdir(path.join(inDir, '[Fichiers originaux]'));
  await write('[Fichiers originaux]/2020-05-01 10.00.00.heic');

  await run();

  assert.ok(await exists(path.join(outDir, '2020', '05', '[Fichiers originaux]', '2020-05-01 10.00.00.heic')));
});

test("n'écrase pas un fichier existant", async () => {
  await fs.mkdir(path.join(outDir, '2018', '07'), { recursive: true });
  await fs.writeFile(path.join(outDir, '2018', '07', '2018-07-14 a.jpg'), 'ancien');
  await write('2018-07-14 a.jpg', 'nouveau');

  const report = await run();

  assert.equal(await fs.readFile(path.join(outDir, '2018', '07', '2018-07-14 a.jpg'), 'utf8'), 'ancien');
  assert.ok(await exists(path.join(inDir, '2018-07-14 a.jpg')));
  assert.deepEqual(report, { moved: 0, skipped: 1, unmatched: 0, errors: 0 });
});

test("le mode debug n'écrit rien", async () => {
  await write('2018-07-14 a.jpg');

  const report = await run({ debug: true });

  assert.ok(await exists(path.join(inDir, '2018-07-14 a.jpg')));
  assert.ok(!(await exists(outDir)));
  assert.equal(report.moved, 1);
});

test('utilise la date EXIF si le nom ne contient pas de date', async () => {
  await write('IMG_0001.jpg', jpegWithExif('2019:03:15 10:20:30'));

  const report = await run();

  assert.ok(await exists(path.join(outDir, '2019', '03', 'IMG_0001.jpg')));
  assert.equal(report.moved, 1);
});

test('--no-exif désactive la lecture EXIF', async () => {
  await write('IMG_0001.jpg', jpegWithExif('2019:03:15 10:20:30'));

  const report = await run({ exif: false });

  assert.equal(report.unmatched, 1);
});

test('utilise la date de modification en dernier recours avec mtime', async () => {
  await write('notes.txt');
  const date = new Date(2017, 10, 20);
  await fs.utimes(path.join(inDir, 'notes.txt'), date, date);

  assert.equal((await run()).unmatched, 1);
  assert.equal((await run({ mtime: true })).moved, 1);
  assert.ok(await exists(path.join(outDir, '2017', '11', 'notes.txt')));
});

test('ne déplace jamais arrange-pics.json', async () => {
  await write('arrange-pics.json', '{}');

  await run({ mtime: true });

  assert.ok(await exists(path.join(inDir, 'arrange-pics.json')));
});

test('in place : inDir = outDir', async () => {
  await write('2018-07-14 a.jpg');

  await run({ outDir: inDir });
  const report = await run({ outDir: inDir });

  assert.ok(await exists(path.join(inDir, '2018', '07', '2018-07-14 a.jpg')));
  assert.equal(report.moved, 0);
});
