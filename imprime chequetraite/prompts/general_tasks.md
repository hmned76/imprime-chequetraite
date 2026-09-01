# Tâches générales – modèles à utiliser dans le prompt

## 1. Prendre un rendez‑vous (RDV)
**Entrée utilisateur (exemple) :** "prends rendez‑vous avec mon frère Mohamed demain à 10 h"
**Ce que l'IA doit faire :**
1. Identifier le contact (ici "Mohamed" de relation "frère").
2. Vérifier la disponibilité dans le calendrier (Google Calendar / Outlook).
3. Créer l'événement RDV à la date/heure demandée.
4. Envoyer un message WhatsApp au contact avec les détails du rendez‑vous.
5. Répondre à l'utilisateur en confirmant la création.

---

## 2. Envoyer un message WhatsApp
**Entrée utilisateur (exemple) :** "envoie un msg à mon frère dis‑lui on se voit demain"
**Ce que l'IA doit faire :**
1. Trouver le numéro de téléphone du contact "frère" dans la base de données.
2. Construire le texte du message (ici "On se voit demain").
3. Utiliser l'API Twilio (ou équivalent) pour envoyer le message via WhatsApp.
4. Informer l'utilisateur que le message a été envoyé.

---

## 3. Programmer un rappel
**Entrée utilisateur (exemple) :** "rappelle le médecin à 16 h"
**Ce que l'IA doit faire :**
1. Identifier le contact "médecin" et son numéro.
2. Planifier une notification (via Cron, Firebase Cloud Messaging, etc.) pour l'heure spécifiée.
3. Optionnel : envoyer un SMS ou un WhatsApp de rappel à l'heure prévue.

---

## 4. Voir le planning quotidien/mensuel
**Entrée utilisateur (exemple) :** "montre mon planning de demain" ou "plan du mois"
**Ce que l'IA doit faire :**
1. Interroger la base de données des événements (rendez‑vous, tâches) de l'utilisateur.
2. Filtrer par date (jour courant ou mois entier).
3. Retourner un résumé formaté (liste horodatée) à l'utilisateur.

--- 
*Note : Les modèles ci‑dessus sont des squelettes. Le backend peut les adapter selon le stockage (SQL, NoSQL) et les APIs utilisées.*