# 🎴 Panini FIFA WC — Tracker

Application web pour suivre votre collection d'autocollants Panini FIFA World Cup.

## Installation

Prérequis : **Node.js** (v16+)

```bash
# Installer les dépendances
npm install

# Lancer le serveur
npm start
```

Ouvrir dans le navigateur : **http://localhost:3000**

## Fonctionnalités

- **48 équipes** réparties en groupes A–L
- **Cartes spéciales FWC** (00–19)
- Chaque équipe : cartes `1–20` (20 cartes)
- **Clic / Tap** → ajouter un exemplaire
- **Clic long / Clic droit** → retirer un exemplaire
- Badge `x1`, `x2`... affiché sur les cartes en double
- Barre de progression par équipe + globale
- **Export** cartes manquantes (`.txt`)
- **Export** doublons avec quantité (`.txt`)
- Reset par équipe
- 100% responsive, fonctionne sur téléphone

## Données

Les données sont sauvegardées dans `data/collection.json`.  
Faites une copie de ce fichier pour sauvegarder votre collection.

## Format d'export

**Manquantes** : `MEX-5`, `FRA-00`, `FWC-3`, ...

**Doublons** : `MEX-5 x1` (2 exemplaires = 1 à échanger), `BEL-7 x2` (3 exemplaires = 2 à échanger)

## Changer le port

```bash
PORT=8080 npm start
```
