import fs from 'node:fs/promises';
import path from 'node:path';
import exifr from 'exifr';

// Nom commençant par une date : "2018-07-14 12.34.56.jpg"
const REG = /^(\d{4})-(\d{2})-/;

// Fichier de configuration, à ne jamais déplacer.
const FILE_RC = 'arrange-pics.json';

const pad = n => String(n).padStart(2, '0');

export default class Arrange {
  constructor(config = {}) {
    this.inDir = config.inDir ?? './';
    this.outDir = config.outDir ?? './';
    this.archiveDirName = config.archiveDirName ?? '[Fichiers originaux]';
    this.debug = config.debug ?? false;
    this.exif = config.exif ?? true;
    this.mtime = config.mtime ?? false;
    this.log = config.log ?? console.log;
    this.report = { moved: 0, skipped: 0, unmatched: 0, errors: 0 };
  }

  // Détermine année/mois : nom de fichier, puis EXIF, puis date de modification.
  async getDate(filePath, name) {
    const match = REG.exec(name);
    if (match) {
      const month = Number(match[2]);
      if (month >= 1 && month <= 12) return { year: match[1], month: match[2], source: 'nom' };
    }

    if (this.exif) {
      try {
        const tags = await exifr.parse(filePath, ['DateTimeOriginal', 'CreateDate']);
        const date = tags?.DateTimeOriginal ?? tags?.CreateDate;
        if (date instanceof Date && !isNaN(date)) {
          return { year: String(date.getFullYear()), month: pad(date.getMonth() + 1), source: 'exif' };
        }
      } catch {
        // format non supporté ou pas d'EXIF
      }
    }

    if (this.mtime) {
      const { mtime } = await fs.stat(filePath);
      return { year: String(mtime.getFullYear()), month: pad(mtime.getMonth() + 1), source: 'mtime' };
    }

    return null;
  }

  async listFiles(dir) {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      this.log('dossier introuvable :', dir);
      return [];
    }

    const files = [];
    for (const entry of entries) {
      if (!entry.isFile() || entry.name === FILE_RC) continue;
      const filePath = path.resolve(dir, entry.name);
      const date = await this.getDate(filePath, entry.name);
      if (!date) {
        this.log('ignoré (pas de date) :', filePath);
        this.report.unmatched++;
        continue;
      }
      files.push({ path: filePath, name: entry.name, ...date });
    }
    return files;
  }

  async moveFiles(files, withArchive = false) {
    for (const [index, file] of files.entries()) {
      let dir = path.resolve(this.outDir, file.year, file.month);
      if (withArchive) dir = path.join(dir, this.archiveDirName);
      const target = path.join(dir, file.name);
      const prefix = `${index + 1}/${files.length}`;

      if (target === file.path) {
        this.report.skipped++;
        continue;
      }

      if (await exists(target)) {
        this.log(`${prefix} existe déjà, ignoré :`, file.path, '=>', dir);
        this.report.skipped++;
        continue;
      }

      this.log(`${prefix} ${this.debug ? '[simulation] ' : ''}déplace (${file.source}) :`, file.path, '=>', dir);
      if (this.debug) {
        this.report.moved++;
        continue;
      }

      try {
        await fs.mkdir(dir, { recursive: true });
        await move(file.path, target);
        this.report.moved++;
      } catch (error) {
        this.log('erreur :', file.path, error.message);
        this.report.errors++;
      }
    }
  }

  async start() {
    const files = await this.listFiles(this.inDir);
    const archiveDir = path.resolve(this.inDir, this.archiveDirName);
    const archives = await isDir(archiveDir) ? await this.listFiles(archiveDir) : [];

    await this.moveFiles(files);
    await this.moveFiles(archives, true);

    const { moved, skipped, unmatched, errors } = this.report;
    this.log(`Terminé${this.debug ? ' (simulation)' : ''} : ${moved} déplacé(s), ${skipped} déjà présent(s), ${unmatched} sans date, ${errors} erreur(s).`);
    return this.report;
  }
}

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function isDir(p) {
  try {
    return (await fs.stat(p)).isDirectory();
  } catch {
    return false;
  }
}

// rename échoue entre deux disques (EXDEV) : on copie puis on supprime.
async function move(from, to) {
  try {
    await fs.rename(from, to);
  } catch (error) {
    if (error.code !== 'EXDEV') throw error;
    await fs.copyFile(from, to, fs.constants.COPYFILE_EXCL);
    await fs.unlink(from);
  }
}
