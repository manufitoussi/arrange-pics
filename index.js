#!/usr/bin/env node

const shell = require('shelljs');
const path = require('path');

let config = {};
const FILE_RC = 'arrange-pics.json';
const FILE_RC_PATH =  path.resolve('./', FILE_RC);
console.log('FILE_RC_PATH:', FILE_RC_PATH);
if(shell.test('-f', FILE_RC_PATH)) {
  const fs = require('fs');
  config = JSON.parse(fs.readFileSync(FILE_RC_PATH));
}

const argv = require('yargs')
  .default({
    outDir: './',
    inDir: './',
    archiveDirName: '[Fichiers originaux]',
    // outDir: 'E:\\Dropbox\\Chargements appareil photo',
    // inDir: 'E:\\Dropbox\\Chargements appareil photo',
    // inDir: 'E:\\Dropbox\\Chargements appareil photo\\[Fichiers originaux]',
    debug: false
  })
  .config(config)
  .argv;

const Arrange = require('./arrange');

console.log('Arrange starts.');

console.log('argv:', argv);

var arrange = new Arrange(argv);
arrange.start();

