"use strict"

const shell = require('shelljs');
const path = require('path');

const REG = /(\d{4})-(\d{2})-.+/;

class Arrange {
  constructor(config) {
    this.files = [];
    this.archives = [];
    this._config = config;
    this.inDir = config.inDir;
    this.outDir = config.outDir;
    this.archiveDirName = config.archiveDirName;
    this.debug = config.debug || false;
  }

  _setupFiles(dir) {

    var files = [];
    try {
      files = shell.ls(dir);
    } catch (error) {
      console.log('no files in ', dir);
    }

    return files
      .map(file => {
        let match = REG.exec(file);
        console.log('match', file, !!match);
        if (!match) return null;
        return {
          path: path.resolve(dir, file),
          name: file,
          year: match[1],
          month: match[2]
        };
      })
      .filter(file => file);
  }

  setupFiles() {
    this.files = this._setupFiles(this.inDir);

    const archiveDir = path.resolve(this.inDir, this.archiveDirName);
    console.log('archive dir:', archiveDir);
    if (!shell.test('-d', archiveDir)) return;
    this.archives = this._setupFiles(archiveDir);
  }

  _moveFiles(files, withArchive) {
    files.forEach((file, index) => {
      let dir = path.join(file.year, file.month);
      if(withArchive) {
        dir = path.join(dir, this.archiveDirName);
      }

      const newPath = path.resolve(this.outDir, dir);
      console.log(`move ${index + 1}/${files.length}:`, file.path);
      if (!shell.test('-d', newPath)) {
        console.log('create', newPath);
        if (!this.debug) {
          shell.mkdir('-p', newPath);
        }
      }

      if (shell.test('-f', path.resolve(newPath, file.name))) {
        console.log('!file already exist.', file.path, '=>', newPath);
        return;
      }

      try {
        if (!this.debug) {
          shell.mv(file.path, newPath);
        }
      } catch (error) {
        console.log(error);
      }
    });
  }

  moveFiles() {
    this._moveFiles(this.files);
    this._moveFiles(this.archives, true);
  }

  start() {
    this.setupFiles();
    this.moveFiles();
  }

}

module.exports = Arrange;