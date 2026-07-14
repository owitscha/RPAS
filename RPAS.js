async function clickAllCommentChildrenSequentiell(optionen = {}) {
  const {
    scrollDelay = 400,        // Wartezeit nach dem Scrollen (ms)
    ladeDelay = 1000,         // Wartezeit nach normalem Button-Klick, damit Inhalte nachladen (ms)
    viewMoreLadeDelay = 3000, // Längere Wartezeit nach Klick auf "view_more_comments" (ms)
    finalWartezeit = 10000,   // Wartezeit vor jeder finalen Kontrollprüfung (ms)
    maxDurchlaeufe = 50       // Sicherheitslimit gegen Endlosschleifen (normale Durchläufe)
  } = optionen;

  const markiert = 'data-cc-geklickt';
  let durchlauf = 0;
  let finaleKontrollen = 0;

  // Startzeitpunkt merken
  const startZeit = performance.now();

  // --- Abbruch-Mechanismus ---
  window.STOP_CC_SCRIPT = false;
  window.stopScript = () => {
    window.STOP_CC_SCRIPT = true;
    console.log('⏹️ Abbruch angefordert – Skript stoppt nach dem aktuellen Schritt...');
  };
  console.log('ℹ️ Zum Abbrechen jederzeit "stopScript()" in die Konsole eingeben.');

  function warte(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function pruefeAbbruch() {
    if (window.STOP_CC_SCRIPT) {
      throw new Error('STOPPED_BY_USER');
    }
  }

  // Formatiert eine Millisekunden-Dauer als lesbaren String (Minuten/Sekunden)
  function formatiereDauer(ms) {
    const gesamtSekunden = Math.round(ms / 1000);
    const minuten = Math.floor(gesamtSekunden / 60);
    const sekunden = gesamtSekunden % 60;

    if (minuten > 0) {
      return `${minuten} Minute${minuten !== 1 ? 'n' : ''} und ${sekunden} Sekunde${sekunden !== 1 ? 'n' : ''}`;
    }
    return `${sekunden} Sekunde${sekunden !== 1 ? 'n' : ''}`;
  }

  // Gibt die aktuelle Anzahl geladener Kommentare aus, inkl. verstrichener Zeit
  function meldeKommentarAnzahl(prefix = '') {
    const anzahl = document.querySelectorAll('[slot="comment"]').length;
    const dauer = formatiereDauer(performance.now() - startZeit);
    console.log(`${prefix}${anzahl} Kommentare geöffnet in ${dauer}.`);
    return anzahl;
  }

  // Entfernt den "Skip to main content"-Link am Ende des Skripts
  function entferneSkipLink() {
    const skipLink = document.getElementById('shreddit-skip-link');
    if (skipLink) {
      skipLink.remove();
      console.log('🗑️ "shreddit-skip-link"-Element wurde entfernt.');
    }
  }

  // Entfernt alle <header>-Elemente am Ende des Skripts
  function entferneHeaderElemente() {
    const headerElemente = document.querySelectorAll('header');
    headerElemente.forEach(header => header.remove());
    console.log(`🗑️ ${headerElemente.length} <header>-Element(e) wurden entfernt.`);
  }

  // --- Gezielte Suche nach dem "Load more"-Button innerhalb eines Elements ---
  function findeLoadMoreButton(el) {
    const buttons = Array.from(el.querySelectorAll('button'));

    const positivMuster = [
      /\d*\s*more repl(y|ies)/i,     // "1 more reply", "5 more replies", "more replies"
      /\d*\s*more comments?/i,       // "3 more comments"
      /weitere\s*\d*\s*antworten/i,  // "weitere 3 Antworten"
      /\d*\s*weitere/i,              // "3 weitere"
      /load more/i,
      /mehr laden/i,
      /kommentare anzeigen/i,
      /continue this thread/i,
      /view more comments/i
    ];

    return buttons.find(btn => {
      const text = btn.textContent.trim().toLowerCase();
      const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
      const kombiniert = `${text} ${ariaLabel}`;
      return positivMuster.some(regex => regex.test(kombiniert));
    });
  }

  // --- Verarbeitet alle "more reply/replies"-Buttons in #comment-children Elementen ---
  async function verarbeiteEinenDurchlauf() {
    durchlauf++;
    if (durchlauf > maxDurchlaeufe) {
      console.warn('Sicherheitslimit (normale Durchläufe) erreicht.');
      return 0;
    }

    const elemente = Array.from(document.querySelectorAll('[id="comment-children"]'))
      .filter(el => {
        const button = findeLoadMoreButton(el);
        return button && !button.hasAttribute(markiert);
      });

    console.log(`Durchlauf ${durchlauf}: ${elemente.length} unbearbeitete "comment-children"-Elemente gefunden.`);

    let anzahlGeklickt = 0;

    for (const el of elemente) {
      pruefeAbbruch();

      const button = findeLoadMoreButton(el);
      if (!button || button.hasAttribute(markiert)) continue;

      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await warte(scrollDelay);

      pruefeAbbruch();

      button.setAttribute(markiert, 'true');
      button.click();
      anzahlGeklickt++;

      console.log(`Button ${anzahlGeklickt}/${elemente.length} geklickt ("${button.textContent.trim()}"), warte auf Nachladen...`);

      await warte(ladeDelay);
    }

    return anzahlGeklickt;
  }

  // --- Prüft auf "view_more_comments"-Elemente und klickt deren Button ---
  async function verarbeiteViewMoreComments() {
    pruefeAbbruch();

    const container = document.querySelector('[noun="view_more_comments"]');
    if (!container) {
      return 0;
    }

    const button = container.querySelector('button');
    if (!button || button.hasAttribute(markiert)) {
      return 0;
    }

    console.log('🔎 "view_more_comments"-Element gefunden, klicke Button...');

    container.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await warte(scrollDelay);

    pruefeAbbruch();

    button.setAttribute(markiert, 'true');
    button.click();

    console.log(`Button in "view_more_comments" geklickt ("${button.textContent.trim()}"), warte ${viewMoreLadeDelay / 1000}s auf Nachladen...`);

    await warte(viewMoreLadeDelay);

    return 1;
  }

  // --- Ein kompletter Zyklus: comment-children + view_more_comments ---
  async function verarbeiteZyklus() {
    const geklicktCommentChildren = await verarbeiteEinenDurchlauf();
    pruefeAbbruch();
    const geklicktViewMore = await verarbeiteViewMoreComments();
    return geklicktCommentChildren + geklicktViewMore;
  }

  try {
    // --- Äußere Schleife: normaler Betrieb + finale Kontrollphase ---
    let alleFertig = false;

    while (!alleFertig) {
      pruefeAbbruch();

      // 1. Normale Schleife: so lange klicken, bis nichts mehr gefunden wird
      let geklickt;
      do {
        pruefeAbbruch();
        geklickt = await verarbeiteZyklus();
      } while (geklickt > 0 && durchlauf <= maxDurchlaeufe);

      // 2. "Vermeintlich fertig" -> finale Kontrollprüfung (läuft, bis wirklich nichts mehr gefunden wird)
      finaleKontrollen++;
      console.log(`⏳ Scheinbar fertig. Warte ${finalWartezeit / 1000} Sekunden und prüfe dann erneut (Kontrolle ${finaleKontrollen})...`);

      await warte(finalWartezeit);
      pruefeAbbruch();

      const geklicktNachWarten = await verarbeiteZyklus();

      if (geklicktNachWarten > 0) {
        console.log('🔄 Doch noch Buttons gefunden – Skript läuft weiter.');
        // alleFertig bleibt false -> äußere Schleife läuft erneut von vorne
      } else {
        console.log(`✅ Auch nach der Wartezeit keine weiteren Buttons gefunden (nach ${finaleKontrollen} finalen Kontrollen). Skript ist fertig.`);
        alleFertig = true;
      }
    }

    // Abschlussmeldung mit Gesamtanzahl geladener Kommentare + benötigter Zeit
    meldeKommentarAnzahl('🏁 Skript abgeschlossen: ');

  } catch (e) {
    if (e.message === 'STOPPED_BY_USER') {
      console.log('🛑 Skript wurde manuell gestoppt.');
      // Auch bei manuellem Abbruch Anzahl + Zeit anzeigen
      meldeKommentarAnzahl('📊 Stand beim Abbruch: ');
    } else {
      console.error('Unerwarteter Fehler:', e);
    }
  } finally {
    delete window.stopScript;
    delete window.STOP_CC_SCRIPT;

    // Aufräumen: Skip-Link und alle <header>-Elemente entfernen
    entferneSkipLink();
    entferneHeaderElemente();

    // NEU: Ganz zum Schluss den Druckdialog des Browsers öffnen
    console.log('🖨️ Öffne Druckdialog...');
    window.print();
  }
}

// Start
clickAllCommentChildrenSequentiell();
