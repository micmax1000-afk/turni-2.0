/* Turni & Accessorio PS — Service Worker V233 (v3.8.0 — un tocco mostra il giorno, straordinario chiuso, netti spiegati) */
'use strict';
const CACHE='turni-ps-v233';
const APP_SHELL=[
 './','./index.html','./manifest.json','./style.css','./script.js',
 './js/config.js','./js/state.js','./js/storage.js','./js/utils.js','./js/shifts.js','./js/absences.js','./js/calendar.js','./js/sequence.js','./js/payroll.js','./js/tables.js','./js/profile.js','./js/backup.js','./js/ui.js','./js/dashboard.js','./js/statistics.js','./js/offline.js','./js/migrations.js','./js/data-guard.js','./js/data/tabelle-2026.js',
 './icons/icon-48.png','./icons/icon-72.png','./icons/icon-96.png','./icons/icon-128.png','./icons/icon-144.png','./icons/icon-152.png','./icons/icon-192.png','./icons/icon-384.png','./icons/icon-512.png'
];
// v2.99: nell'app Android (https://localhost, senza porta) i file sono già dentro l'app, quindi il
// service worker non serve: si attiva subito, cancella la copia vecchia, si toglie di mezzo e
// ricarica la pagina. Così, installata una versione nuova, parte subito senza "Aggiorna ora".
const APP_ANDROID = self.location.hostname === 'localhost' && !self.location.port;
self.addEventListener('install', event => {
  if(APP_ANDROID){ self.skipWaiting(); return; }
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(APP_SHELL))
    // Niente più skii a sorpresa chi sta scrivendo qualcosa, es. un turno non ancora salvato.
  );
});
self.addEventListener('message', event => {
  if(event.data && event.data.tipo === 'skipWaiting') self.skipWaiting();
});
self.addEventListener('activate', event => {
  if(APP_ANDROID){
    event.waitUntil(
      caches.keys()
        .then(keys => Promise.all(keys.map(key => caches.delete(key))))
        .then(() => self.registration.unregister())
        .then(() => self.clients.matchAll({ type: 'window' }))
        .then(clients => Promise.all(clients.map(c => c.navigate(c.url).catch(() => {}))))
    );
    return;
  }
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', event => {
  if(APP_ANDROID) return;
  const request = event.request;
  if(request.method !== 'GET') return;
  if(new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request).then(cached => {
      if(cached) return cached;
      return fetch(request).then(response => {
        if(response.ok){
          caches.open(CACHE).then(cache => cache.put(request, response.clone())).catch(() => {});
        }
        return response;
      }).catch(() => caches.match('./index.html'));
    })
  );
});

// Supporto tecnico per le notifiche push: l'app non ha un server proprio che le invii
// (è pensata per funzionare offline, senza backend), quindi questo listener non riceverà mai
// eventi reali finché non si aggiunge un'infrastruttura di invio (chiavi VAPID + server).
// È comunque utile dichiararlo: se in futuro servisse, la parte lato Service Worker è già pronta.
self.addEventListener('push', event => {
  const dati = event.data ? (() => { try { return event.data.json(); } catch { return {}; } })() : {};
  const titolo = dati.title || 'Turni & Accessorio PS';
  const opzioni = {
    body: dati.body || 'Hai una nuova notifica.',
    icon: './icons/icon-192.png',
    badge: './icons/icon-96.png'
  };
  event.waitUntil(self.registration.showNotification(titolo, opzioni));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow('./index.html'));
});

// Supporto tecnico per la sincronizzazione in background: stessa premessa del push, nessuna
// sincronizzazione server-side è attiva oggi (il backup Drive avviene solo su richiesta esplicita
// dell'utente, non in automatico in background).
self.addEventListener('sync', event => {
  // Placeholder pronto per un futuro utilizzo reale (es. ritentare un backup Drive fallito
  // quando torna la connessione), non ancora collegato a nessuna azione.
});
