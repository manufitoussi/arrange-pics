# arrange-pics

Range des photos et vidéos dans des dossiers `année/mois`.

```
2018-07-14 12.34.56.jpg      →  2018/07/2018-07-14 12.34.56.jpg
IMG_0001.jpg (EXIF 2019-03)  →  2019/03/IMG_0001.jpg
```

Pensé pour le dossier Dropbox « Chargements appareil photo », il fonctionne avec n'importe quel dossier de fichiers datés.

## Installation

Nécessite Node.js 20.19+ ou 22.12+.

```bash
git clone https://github.com/manufitoussi/arrange-pics.git
cd arrange-pics
npm install
npm link        # optionnel : rend la commande `arrangePics` disponible partout
```

## Utilisation

```bash
# Simulation : affiche ce qui serait fait, sans rien toucher
arrangePics --inDir ~/Photos/import --outDir ~/Photos --debug

# Rangement réel
arrangePics --inDir ~/Photos/import --outDir ~/Photos
```

Sans `npm link`, remplacez `arrangePics` par `node /chemin/vers/arrange-pics/index.js`.

Commencez toujours par `--debug` : les fichiers sont **déplacés**, pas copiés.

### Options

| Option             | Défaut                   | Description                                                        |
| ------------------ | ------------------------ | ------------------------------------------------------------------ |
| `--inDir`          | `./`                     | Dossier source                                                     |
| `--outDir`         | `./`                     | Dossier de destination                                             |
| `--archiveDirName` | `[Fichiers originaux]`   | Sous-dossier des originaux (voir plus bas)                         |
| `--exif`           | `true`                   | Lire la date EXIF si le nom n'en contient pas (`--no-exif` pour désactiver) |
| `--mtime`          | `false`                  | En dernier recours, utiliser la date de modification du fichier    |
| `--debug`          | `false`                  | Simulation : n'écrit rien sur le disque                            |
| `--help`           |                          | Affiche l'aide                                                     |

### Fichier de configuration

Les options peuvent être placées dans un fichier `arrange-pics.json` situé dans le dossier **depuis lequel la commande est lancée** :

```json
{
  "inDir": "./",
  "outDir": "./",
  "debug": true
}
```

Les options passées en ligne de commande priment sur ce fichier. Il n'est jamais déplacé lui-même.

## Fonctionnement

### Détermination de la date

Pour chaque fichier, la date est cherchée dans cet ordre :

1. **Le nom du fichier**, s'il commence par `AAAA-MM-` (ex. `2018-07-14 12.34.56.jpg`).
2. **Les métadonnées EXIF** (`DateTimeOriginal`, sinon `CreateDate`) : JPEG, HEIC, TIFF…
3. **La date de modification**, uniquement avec `--mtime`. Désactivé par défaut car elle change souvent lors d'une copie.

Les fichiers sans date trouvée restent en place. Le journal indique la source retenue pour chaque fichier : `(nom)`, `(exif)` ou `(mtime)`.

### Originaux

Si `inDir` contient un sous-dossier `[Fichiers originaux]`, ses fichiers sont rangés dans `outDir/AAAA/MM/[Fichiers originaux]/`.

### Sécurité

- Un fichier déjà présent à destination n'est **jamais écrasé** : il est ignoré et laissé dans le dossier source.
- Seuls les fichiers du premier niveau de `inDir` sont traités ; les sous-dossiers sont ignorés.
- Le déplacement fonctionne aussi entre deux disques.

### Rapport

En fin d'exécution :

```
Terminé : 42 déplacé(s), 3 déjà présent(s), 1 sans date, 0 erreur(s).
```

La commande se termine avec le code `1` si au moins une erreur s'est produite.

## Développement

```bash
npm test
```

Les tests (`node:test`) s'exécutent sur des dossiers temporaires, voir [test/arrange.test.js](test/arrange.test.js).
Le dossier [test/](test/) contient aussi un `arrange-pics.json` en mode simulation pour essayer la commande à la main depuis ce dossier.

## Licence

MIT — Emmanuel Fitoussi
