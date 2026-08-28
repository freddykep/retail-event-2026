export interface WorkshopImageInfo {
  title: string;
  description: string;
  speaker: string;
}

/**
 * Aus den fest hinterlegten Workshop-Postern (public/workshop-images/*.jpg) per OCR
 * erkannter Text (Titel, Beschreibung, Moderatoren), manuell gegengeprueft. Die Bilder
 * folgen alle demselben Layout (Titel oben links, Beschreibung unter "INHALT", Moderatoren-
 * Namensschilder unten), was die Zuordnung zuverlaessig macht. Dient beim Anlegen eines
 * Workshops im Admin-Formular ausschliesslich als Vorausfuell-Vorschlag - der Admin kann
 * jeden Wert danach frei aendern, bereits ausgefuellte Felder werden nie ueberschrieben.
 *
 * Neu erzeugen/aktualisieren mit: node scripts/ocr-workshop-images.mjs
 */
export const WORKSHOP_IMAGE_INFO: Record<string, WorkshopImageInfo> = {
  "okr-ki": {
    title: "KI beschleunigt. OKRs geben die Richtung vor.",
    description:
      "KI macht Teams schneller und produktiver. Doch Geschwindigkeit allein reicht nicht aus, wenn die Richtung fehlt. In diesem interaktiven Workshop lernst du die Grundlagen von Objectives & Key Results (OKRs) als Managementmethode für klare Ziele und messbare Ergebnisse kennen und entwickelst anhand einer praxisnahen Fallstudie dein erstes OKR-Set.",
    speaker: "Finn-Julian Schwarz",
  },
  "pet-pitch": {
    title: "PET in Aktion – Wie wir Pitches gemeinsam auf den Punkt bringen",
    description:
      "Interaktiver Workshop zur Einführung des Pitch Endorsement Team (PET)-Konzepts. Nach einem Impulsvortrag zu Konzept und Prinzipien arbeiten die Teilnehmenden in Kleingruppen an einer Beispielausschreibung und entwickeln daraus zwei Pitch-Formate – einen 60-Sekunden-Elevator-Pitch und einen 7-minütigen Pitch im adesso-Style. Ziel: PET-Prinzipien praktisch erproben und ein Gefühl für Fokussierung und Zeitmanagement in Pitch-Situationen entwickeln.",
    speaker: "Philipp Danne & Sven Bohlmann",
  },
  "freiraeume-handeln": {
    title: "Vom Zögern zum Handeln: Wie du Freiräume nutzt und bessere Ergebnisse erzielst",
    description:
      "Kennst du das Gefühl, auf Erlaubnis zu warten statt einfach loszulegen? Oder dass gute Ideen im Alltag stecken bleiben? In diesem interaktiven Workshop bekommst du konkrete Impulse, wie du deine Freiräume aktiver nutzt, mehr Verantwortung übernimmst und mit mehr Zuversicht, Selbstvertrauen und Widerstandskraft an Herausforderungen gehst. Wir verbinden praxisnahe Verhaltensmuster – etwa Ownership, Klartext, Empowerment – mit den psychologischen Ressourcen, die dich dabei tragen. In einer Gruppe entwickelst du an einem echten Fall aus deinem Alltag eine pragmatische Lösung und nimmst dir einen persönlichen Fokus für die nächsten Wochen mit.",
    speaker: "Katharina Bästlein & Eike Folkerts",
  },
  "context-engineering": {
    title: "Context Engineering 101",
    description:
      "Der Context Engineering Workshop versucht einen Teil der grundlegenden Konzepte des Context Engineerings zu vermitteln und mit hands-on Training zu festigen. Gemeinsam vergleichen wir bleeding-edge Technologien, mit denen LLMs Einblicke in eine bestehende Codebase generieren und diese letztendlich auch weiterentwickeln können.",
    speaker: "Daniel Oelert & Nico Britze",
  },
  "multi-agent": {
    title: "Wie viele Agenten braucht man wirklich? Multi-Agent-Architekturen zwischen Hype und Praxis",
    description:
      "Multi-Agent-Architekturen sind gerade der Hype – aber braucht jedes Problem wirklich fünf spezialisierte Agenten, die miteinander verhandeln? Oder reicht in der Praxis oft ein einzelner, gut orchestrierter Agent? Wir wollen mit Euch gemeinsam darüber diskutieren, wann Komplexität sich lohnt – und wann sie nur Kosten und Debugging-Aufwand produziert. Dazu habt ihr die Möglichkeit, an der Diskussion teilzunehmen und euer Wissen mit anderen zu teilen.",
    speaker: "Adriaan van der Bergh & Silvio Graboswki",
  },
  "ki-handel-lego": {
    title: "KI im Handel neu denken – Zukunftsideen mit LEGO®",
    description:
      "In diesem interaktiven Workshop erarbeiten die Teilnehmenden aus Sicht des Handels Einsatzmöglichkeiten für Künstliche Intelligenz entlang der gesamten Wertschöpfungskette. Mithilfe der Methode LEGO® entwickeln sie eigene Zukunftsbilder und konkrete Ideen – von Einkauf und Sortiment über Marketing und Kundenservice bis hin zu Logistik, Filiale und Backoffice. Leitgedanke ist dabei ein bewusst offener Denkraum ohne vorgegebene Grenzen.",
    speaker: "Sascha Arnautovic & Louise Weiser",
  },
  "adessogpt-tag": {
    title: "Ein Tag als Retail-Berater mit adessoGPT",
    description:
      "In dieser Live-Demo begleiten die Teilnehmenden einen Retail-Berater durch einen typischen Arbeitstag in einem fiktiven Kundenprojekt. Sie erleben, wie adessoGPT Termine, Nachrichten und Aufgaben strukturiert, Kundentermine vorbereitet und Informationen aus verschiedenen Unterlagen zu einem prägnanten Briefing zusammenführt. So entsteht ein praxisnahes Bild davon, wie adessoGPT Routineaufgaben beschleunigt, Medienbrüche reduziert und mehr Freiraum für fachliche Beratung und Kundeninteraktion schafft.",
    speaker: "Andreas Querndt",
  },
};
