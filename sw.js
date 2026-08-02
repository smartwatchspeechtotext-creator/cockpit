/* =====================================================================
   HINTERGRUNDDIENST
   =====================================================================
   Legt die Hülle auf dem Gerät ab - also diese Seite und die Symbole.
   Dadurch startet die App ohne Netzwerkweg.

   Das Cockpit selbst wird BEWUSST NICHT abgelegt. Es kommt jedes Mal
   frisch von Google. Zwei Gründe: Es enthält Patientendaten, und eine
   veraltete Fassung wäre schlimmer als eine Sekunde Wartezeit.

   =====================================================================
   WARUM DIESE FASSUNG ANDERS IST
   =====================================================================
   Drei Dinge haben dafür gesorgt, dass das Telefon in einer alten
   Ansicht steckenblieb. Alle drei sind hier behoben:

   1. `addAll` ist ALLES ODER NICHTS. Fehlt eine einzige der
      aufgezählten Dateien - etwa `faellig-512.png` -, scheitert der
      ganze Einbau. Der neue Dienst wird dann nie aktiv, der alte
      bedient weiter aus seinem Speicher. Und weil das lautlos
      passiert, hilft auch das Hochsetzen der Zahl nichts: Der neue
      Einbau scheitert genauso.
      → Jetzt wird jede Datei einzeln abgelegt. Eine fehlende kostet
        diese eine Datei, nicht die ganze Installation.

   2. Der Speicher wurde über den normalen Browser-Zwischenspeicher
      gefüllt. Lag dort noch die alte Datei, wanderte genau die in
      den neuen Speicher - die Zahl war hochgesetzt, der Inhalt
      trotzdem alt.
      → `cache: 'reload'` holt beim Ablegen immer frisch.

   3. Seiten kamen zuerst aus dem Speicher. Eine geänderte
      `index.html` erreichte das Telefon damit erst, wenn die Zahl
      unten hochgesetzt wurde - was man leicht vergisst.
      → Seiten kommen jetzt zuerst aus dem Netz und nur dann aus dem
        Speicher, wenn das Netz nicht antwortet. Offline funktioniert
        also weiter, aktuell ist es trotzdem.

   Beim Ändern der Hülle die Zahl unten weiter hochsetzen - sie räumt
   alte Speicher ab. Zum Aktualisieren zwingend nötig ist sie nicht
   mehr.
   ===================================================================== */

const STAND = 'cockpit-huelle-v15';

/*
 * Zwei Listen statt einer.
 *
 * Ohne die Pflichtdateien startet die Hülle nicht. Alles Weitere ist
 * Kür - fehlt es, fehlt eben ein Symbol.
 */
const PFLICHT = [
  './',
  './index.html',
  './manifest.webmanifest',
  './symbol-192.png'
];

const KUER = [
  './symbol-512.png',
  './symbol-maskierbar.png',
  './faellig.html',
  './faellig.webmanifest',
  './faellig-192.png',
  './faellig-512.png',
  './faellig-maskierbar.png'
];

function legeAb(speicher, pfad) {
  /* `reload` umgeht den Browser-Zwischenspeicher - sonst landet die
     alte Datei im neuen Speicher. */
  return speicher.add(new Request(pfad, { cache: 'reload' }))
    .catch(function () { /* fehlt eben - kein Grund zu scheitern */ });
}

self.addEventListener('install', function (ereignis) {
  ereignis.waitUntil(
    caches.open(STAND)
      .then(function (speicher) {
        return Promise.all(
          PFLICHT.concat(KUER).map(function (pfad) {
            return legeAb(speicher, pfad);
          })
        );
      })
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
  const anfrage = ereignis.request;

  if (anfrage.method !== 'GET') { return; }

  const adresse = new URL(anfrage.url);

  /* Alles, was nicht zu dieser Hülle gehört - vor allem Google -
     geht unberührt ins Netz. */
  if (adresse.origin !== self.location.origin) { return; }

  const istSeite =
    anfrage.mode === 'navigate' ||
    String(anfrage.headers.get('accept') || '').indexOf('text/html') !== -1;

  function ablegen(antwort) {
    /* Nur brauchbare Antworten behalten. Eine 404 im Speicher wäre
       schlimmer als gar keine. */
    if (antwort && antwort.ok && antwort.type === 'basic') {
      const kopie = antwort.clone();
      caches.open(STAND)
        .then(function (speicher) { return speicher.put(anfrage, kopie); })
        .catch(function () {});
    }
    return antwort;
  }

  /*
   * Seiten: erst das Netz. So kommt eine geänderte Hülle sofort an.
   *
   * Eine 404 gilt dabei als Ausfall, nicht als Antwort. Das ist der
   * Unterschied, der beim Abschalten von GitHub Pages zählt: Der
   * Server antwortet ja - nur mit einer Fehlerseite. Ohne diese
   * Prüfung würde die brav durchgereicht, und die App wäre weg,
   * obwohl die Hülle vollständig auf dem Gerät liegt.
   *
   * Jetzt springt in dem Fall der Speicher ein. Ist GitHub aus,
   * fehlerhaft oder gerade beim Neubauen, läuft die App weiter.
   */
  if (istSeite) {
    ereignis.respondWith(
      fetch(anfrage)
        .then(function (antwort) {
          if (!antwort || !antwort.ok) {
            return caches.match(anfrage).then(function (gefunden) {
              return gefunden || caches.match('./index.html') || antwort;
            });
          }

          return ablegen(antwort);
        })
        .catch(function () {
          return caches.match(anfrage).then(function (gefunden) {
            return gefunden || caches.match('./index.html');
          });
        })
    );
    return;
  }

  /* Symbole und Manifeste: erst der Speicher, im Hintergrund
     nachziehen. Sie ändern sich selten, sollen aber nicht ewig
     festkleben. */
  ereignis.respondWith(
    caches.match(anfrage).then(function (gefunden) {
      const ausDemNetz = fetch(anfrage)
        .then(ablegen)
        .catch(function () { return gefunden; });

      return gefunden || ausDemNetz;
    })
  );
});

/*
 * Notausgang.
 *
 * Die Hülle kann von sich aus alles wegräumen lassen - für den Fall,
 * dass doch einmal etwas festhängt. Ausgelöst wird das über den
 * Knopf in den Einstellungen.
 */
self.addEventListener('message', function (ereignis) {
  const d = ereignis.data;
  if (!d || d.typ !== 'zwischenspeicher-leeren') { return; }

  ereignis.waitUntil(
    caches.keys().then(function (namen) {
      return Promise.all(namen.map(function (name) {
        return caches.delete(name);
      }));
    })
  );
});
