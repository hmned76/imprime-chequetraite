# AssistantAI 🇹🇳🤖

**Assistant personnel intelligent** qui comprend le **Tunisien** (mélange français‑arabe), prend des
rendez‑vous, envoie des messages WhatsApp, programme des rappels, et garde l'historique de
toutes les conversations.

## Fonctionnalités (état actuel)

- ✅ **Compréhension du Tunisien** : pars le message tel quel, détecte l'intention
  (salutation, RDV, WhatsApp, rappel, planning, email, **investissement Binance**, etc.).
- ✅ **Serveur web local** (Flask) sur `http://127.0.0.1:5000`.
- ✅ **Accès internet 5G** : lance `remote_start.bat` → URL publique Cloudflare à ouvrir
  dans le navigateur du téléphone (n'importe où, sans Wi‑Fi partagé).
- ✅ **Interface de chat mobile‑first** (bulles, entrée Tunisien, badges d'intention).
- ✅ **Persistance SQLite** : conversations, contacts, rendez‑vous, rappels.
- ✅ **Trading Binance** : prix en direct, analyse RSI/SMA, **paper‑trading simulé**
  (pas de vrai argent tant que `BINANCE_PAPER=False` + clés configurées).
- ✅ **Mode `reel`** : les intégrations dont les clés sont présentes sont activées ;
  celles dont les clés manquent sont signalées « clé manquante » (aucun envoi réel).

## Démarrage rapide

```powershell
# 1. Installer les dépendances
python -m pip install -r requirements.txt

# 2. Lancer le serveur
python app.py
# ou double‑clic sur start.bat
```

## Accès depuis le téléphone (5G, dans la rue)

1. Double‑clique sur **`remote_start.bat`** (il télécharge `cloudflared` au premier lancement).
2. Une URL publique s'affiche, exemple : `https://machin.trycloudflare.com` — **copie‑la.**
3. Ouvre cette URL dans le navigateur de TA TELEPHONE (5G ou n'importe quel réseau).
4. Tu peux maintenant parler à AssistantAI depuis n'importe où, sans Wi‑Fi partagé.

> L'URL change à chaque lancement (gratuit et sans compte). Pour une adresse fixe,
> passe par Cloudflare Tunnel avec ton propre domaine.

## Investissement / Binance

Parle en Tunisien au chat, par exemple :
- « binance, cherche-moi la meilleure opportunite »
- « achete du bitcoin maintenant » (paper‑trading par défaut)
- « montre mon portefeuille »

Par défaut c'est du **trading simulé** (`BINANCE_PAPER=True`) : aucun argent réel en jeu.
Pour passer au réel (⚠️ risque de perte) il faut mettre `BINANCE_PAPER=False` ET tes clés
Binance dans `config.py`. Utilise seulement de l'argent que tu peux te permettre de perdre.

## Compiler en .exe

```powershell
# double‑clic sur build_exe.bat  (ou lancer ci‑dessous)
python -m PyInstaller --onefile --windowed --name AssistantAI --add-data "templates;templates" app.py
```

Résultat : `dist\AssistantAI.exe`

## Structure

```
assistant-AI/
├─ app.py                    # Serveur Flask (chat + API + page)
├─ config.py                 # Clés API (Twilio, SMTP, Google) — MODE simu/reel
├─ requirements.txt          # Dépendances Python
├─ start.bat                 # Lance le serveur (Windows)
├─ build_exe.bat             # Compile l'executable (Windows)
├─ templates/
│   └─ index.html            # Interface de chat (mobile-first)
├─ assistant/
│   ├─ engine.py             # Moteur IA : analyse Tunisien + reponses
│   ├─ storage.py            # Persistance SQLite
│   ├─ integrations.py       # WhatsApp (Twilio) + Email (SMTP), simu/reel
│   └─ __init__.py
├─ prompts/
│   ├─ tunisian_system.md    # Regles d'ecoute du Tunisian (pour un futur LLM)
│   └─ general_tasks.md      # Modeles de tâches
├─ transform/
│   └─ whatsapp_prompt.py    # Extraction d'intention (legacy / reference)
├─ db/
│   ├─ assistant.db          # Base locale (creee au premier lancement)
│   └─ migrations/           # Schema SQL de reference (Postgres)
└─ README.md
```

## API

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/` | GET | Page de chat |
| `/api/chat` | POST | `{"message": "..."}` → réponse + intention + actions |
| `/api/conversations` | GET | Historique des conversations |
| `/api/events` | GET | Rendez‑vous enregistrés |
| `/api/contacts` | GET | Contacts |
| `/api/prix?symbol=BTCUSDT` | GET | Prix Binance en direct |
| `/api/analyse?symbol=BTCUSDT` | GET | Analyse RSI/SMA |
| `/api/portfolio` | GET | Valeur du portefeuille (paper) |
| `/api/trade` | POST | `{"symbol","side","amount"}` → ordre paper/réel |

## Exemples Tunisien

| Tu dis | AssistantAI fait |
|--------|------------------|
| « prends rendez‑vous avec mon frère Mohamed demain à 10h » | Note le RDV (event) + invite (si mode réel) |
| « whatsapp mon frère dis‑lui qu'on se voit demain » | Envoie le message WhatsApp (si mode réel) |
| « rappelle‑moi le médecin à 16h » | Programme le rappel |
| « montre mon planning » | Affiche le résumé du jour/mois |

## Étapes suivantes possibles

1. Remplir `config.py` avec tes clés **Twilio** (WhatsApp), **SMTP/SendGrid** (email),
   **Binance** (trading réel, optionnel) → le mode `reel` les active automatiquement.
2. Brancher un vrai **LLM** (OpenAI / Claude) dans `assistant/engine.py` pour un dialogue libre.
3. Générer l'**APK Android** (le dossier `android/` est prévu pour les autorisations).
4. Ajouter la **vérification par PIN / chiffrement** pour la vue privée du planning.