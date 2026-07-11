# Kalndar

Calendrier partagé pour la famille : chacun ajoute, modifie ou supprime des
événements, et tout le monde voit les changements en direct.

## Membres

La liste des membres (prénom + couleur) est dans [members.json](members.json).
Modifie ce fichier pour ajouter/renommer les membres de ta famille, puis
redémarre le serveur.

## Installation et lancement

```bash
npm install
npm start          # ou : pm2 start server.js --name kalndar (voir start.sh)
```

Le site écoute par défaut sur le port 3002 (variable d'environnement `PORT`
pour changer).

## Données

Les événements sont stockés dans `data/events.json`, créé automatiquement au
premier événement ajouté. Ce fichier n'est pas versionné (voir `.gitignore`) :
pense à le sauvegarder si tu veux garder l'historique.
