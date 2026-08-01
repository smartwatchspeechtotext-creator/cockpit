/* =====================================================================
   HINTERGRUNDDIENST
   =====================================================================
   Legt die Hülle auf dem Gerät ab - also diese Seite und die Symbole.
   Dadurch startet die App ohne Netzwerkweg.

   Das Cockpit selbst wird BEWUSST NICHT abgelegt. Es kommt jedes Mal
   frisch von Google. Zwei Gründe: Es enthält Patientendaten, und eine
   veraltete Fassung wäre schlimmer als eine Sekunde Wartezeit.

   Beim Ändern der Hülle die Zahl unten hochsetzen - dann holt sich
   jedes Gerät die neue Fassung.
   ===================================================================== */

const STAND = 'cockpit-huelle-v2';

const DATEIEN = [
  './',
  './index.html',
  './manifest.webmanifest',
  './symbol-192.png',
  './symbol-512.png',
  './symbol-maskierbar.png'
];

self.addEventListener('install', function (ereignis) {
  ereignis.waitUntil(
    caches.open(STAND)
      .then(function (speicher) { return speicher.addAll(DATEIEN); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (ereignis) {
  ereignis.waitUntil(
    caches.keys()
      .then(function (namen) {
        return Promise.all(namen.map(function (name) {
          if (name !== STAND) { return caches.delete(name); }
        }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (ereignis) {
  const adresse = new URL(ereignis.request.url);

  /* Alles, was nicht zu dieser Hülle gehört - vor allem Google -
     geht unberührt ins Netz. */
  if (adresse.origin !== self.location.origin) { return; }

  ereignis.respondWith(
    caches.match(ereignis.request).then(function (gefunden) {
      return gefunden || fetch(ereignis.request);
    })
  );
});
