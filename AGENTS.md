# AGENTS.md

## Projet

Application locale Panini Tracker en Node.js / Express avec frontend vanilla JS.

Fichiers importants :
- `server.js` : routes API, lecture/écriture collection
- `public/js/app.js` : logique frontend
- `public/css/style.css` : styles
- `public/index.html` : structure HTML
- `data/collection.json` : état de la collection

## Règles importantes

- Ne jamais supprimer ou écraser `data/collection.json` sans créer une sauvegarde.
- Avant toute modification de logique d'échange/import/export, créer une sauvegarde automatique ou vérifier que Git permet de revenir en arrière.
- Ne pas ajouter de dépendance npm sauf nécessité claire.
- Préférer du JavaScript simple, lisible, sans framework.
- L’app doit rester utilisable sur PC et téléphone.
- Ne pas exposer l’app publiquement sur Internet sans authentification.
- Ne jamais utiliser `eval`, `Function`, ou exécuter du contenu venant de l’utilisateur.
- Valider/sanitizer les codes cartes côté serveur.
- Les routes qui modifient la collection doivent retourner du JSON propre, jamais du HTML.
- Après chaque story fonctionnelle, mettre à jour `tests/regression.test.js` avec les tests de non-régression de cette story.
- Avant tout commit de story, lancer `npm test` ou `npm run test:regression` en plus des checks syntaxe.

## Commandes utiles

- Installer : `npm install`
- Lancer : `PORT=5013 npm start`
- Vérifier syntaxe JS serveur : `node --check server.js`
- Vérifier syntaxe JS front : `node --check public/js/app.js`
- Tests de régression : `npm test`
- Tester API locale après lancement :
  - `curl http://127.0.0.1:5013/api/collection`
  - `curl http://127.0.0.1:5013/api/export/missing`
  - `curl http://127.0.0.1:5013/api/export/doubles`

## Définition de terminé

Pour chaque story :
1. Expliquer les fichiers modifiés.
2. Afficher le diff avec `git diff`.
3. Lancer au minimum :
   - `node --check server.js`
   - `node --check public/js/app.js`
   - `npm test`
4. Tester les routes API concernées avec `curl` si le serveur est lancé.
5. Ne pas faire de commit automatiquement sans demander.
