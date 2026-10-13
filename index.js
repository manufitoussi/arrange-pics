#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import Arrange from './arrange.js';

const FILE_RC_PATH = path.resolve('arrange-pics.json');
const config = fs.existsSync(FILE_RC_PATH)
  ? JSON.parse(fs.readFileSync(FILE_RC_PATH, 'utf8'))
  : {};

const argv = yargs(hideBin(process.argv))
  .scriptName('arrangePics')
  .usage('$0 [options]\n\nRange les fichiers dans des dossiers année/mois.')
  .options({
    inDir: { type: 'string', default: './', describe: 'Dossier source' },
    outDir: { type: 'string', default: './', describe: 'Dossier de destination' },
    archiveDirName: { type: 'string', default: '[Fichiers originaux]', describe: 'Sous-dossier des originaux' },
    exif: { type: 'boolean', default: true, describe: 'Lire la date EXIF si le nom n\'en contient pas (--no-exif pour désactiver)' },
    mtime: { type: 'boolean', default: false, describe: 'En dernier recours, utiliser la date de modification du fichier' },
    debug: { type: 'boolean', default: false, describe: 'Simulation : n\'écrit rien sur le disque' },
  })
  .config(config)
  .strict()
  .help()
  .parse();

if (fs.existsSync(FILE_RC_PATH)) console.log('Configuration :', FILE_RC_PATH);

const report = await new Arrange(argv).start();
process.exitCode = report.errors ? 1 : 0;
