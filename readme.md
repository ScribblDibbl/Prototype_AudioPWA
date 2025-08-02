# 🎵 Ideenschmiede - Audio Recording PWA

Eine professionelle Progressive Web App für Musikaufnahmen mit fortschrittlichen Features wie DAW-ähnlicher Wellenform-Anzeige, präzisem Metronom und persistentem Speicher.

## 📋 Inhaltsverzeichnis
- [Features](#-features)
- [Technische Architektur](#-technische-architektur)
- [Benutzeroberfläche](#-benutzeroberfläche)
- [Installation & Setup](#-installation--setup)
- [Funktionalitäten](#-funktionalitäten)
- [Externe Bibliotheken](#-externe-bibliotheken)
- [App.js Funktionen](#-appjs-funktionen)
- [Responsive Design](#-responsive-design)
- [PWA Features](#-pwa-features)
- [Browser-Kompatibilität](#-browser-kompatibilität)

## 🎯 Features

### 🎤 Audio-Aufnahme
- **High-Quality WAV Recording**: 48kHz Aufnahmen mit 16-bit PCM Encoding
- **Dual AudioContext**: Separate Kontexte für Aufnahme und Metronom
- **Echtzeitmonitoring**: Live-Waveform mit visueller Pegelanzeige
- **Geräteauswahl**: Unterstützung für professionelle USB Audio Interfaces
- **Gain Control**: Präzise Eingangslautstärke mit Clipping-Schutz

### 🎵 Metronom
- **Flexible Taktarten**: 1-19 Schläge pro Takt
- **Variable Notenwerte**: Halbe, Viertel, Achtel Noten
- **BPM Range**: 40-200 BPM mit präziser Zeitmessung
- **ADSR Hüllkurve**: Professioneller Klang ohne Knacken
- **Akzent-Beats**: Höhere Töne für erste Beats im Takt

### 💾 Persistente Speicherung
- **IndexedDB Integration**: Aufnahmen überleben Browser-Neustarts
- **Memory Fallback**: Funktioniert auch ohne IndexedDB-Unterstützung
- **Status-Indikator**: 💾 Symbol für persistent gespeicherte Aufnahmen
- **Automatische Wiederherstellung**: Aufnahmen werden beim Start automatisch geladen

### 📦 Export & Download
- **Bulk Export**: Alle Aufnahmen als ZIP-Datei exportieren
- **Einzeldownload**: WAV-Dateien einzeln herunterladen
- **Export-Info**: Detaillierte Metadaten in jeder ZIP-Datei
- **Chronologische Nummerierung**: Sortierte Dateibenennung

### 🎨 Professionelle UI
- **DAW-ähnliche Waveform**: Echtzeit-Visualisierung der Audiopegel
- **Responsive Design**: Funktioniert auf Desktop, Tablet und Mobile
- **Intuitive Bedienung**: Klare Trennung zwischen Monitoring und Aufnahme
- **Status-Feedback**: Umfassende Rückmeldungen über alle Aktionen

## 🏗 Technische Architektur

### Core Technologies
```
Web Audio API       → Audio-Verarbeitung & Analyse
Canvas 2D API       → Echtzeit-Waveform Rendering
IndexedDB API       → Persistente Datenspeicherung
MediaDevices API    → Geräte-Enumeration & Auswahl
FileReader API      → Blob-zu-ArrayBuffer Konvertierung
JSZip Library       → ZIP-Erstellung für Bulk-Export
```

### Dual AudioContext System
```javascript
// Aufnahme-Context: 48kHz für High-Quality Recording
audioContext = new AudioContext({ sampleRate: 48000 });

// Metronom-Context: Separater Context für unabhängige Wiedergabe
metronomeAudioContext = new AudioContext();
```

### Audio Pipeline
```
Mikrofon Input → MediaStreamSource → GainNode → Analyser → ScriptProcessor
                                              ↓
                                    Canvas Visualization
                                              ↓
                                    WAV Recording Buffer
```

## 🖥 Benutzeroberfläche

### Top-Controls Layout
```
┌─────────────────────────────────────────────────────────┐
│  Audio-Geräte (Links)        │    Metronom (Rechts)     │
│  • Audio Input Auswahl       │    • BPM Control         │
│  • Audio Output Auswahl      │    • Taktart (1-19/2,4,8)│
│  • Geräte Aktualisierung     │    • Start/Stop Toggle   │
│  • Status Anzeige            │    • Beat Counter        │
└─────────────────────────────────────────────────────────┘
```

### Recording Station
```
┌─────────────────────────────────────────────────────────┐
│  Aufnahme-Studio                                        │
│  ┌─────────────┐  ┌─────────────────────────────────────┐│
│  │ Buttons     │  │  Waveform Display                  ││
│  │ • Start     │  │  [Zeit] ████▓▓░░░░░░░░░ [Zeit]      ││
│  │ • Stop      │  │                                    ││
│  │ • Gain      │  │  Live Audio Visualization          ││
│  └─────────────┘  └─────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

### Recordings Container
```
┌─────────────────────────────────────────────────────────┐
│  Aufnahmen Liste              │  Audio Player            │
│  💾 Aufnahme_1.wav           │  ┌─────────────────────┐  │
│  [▶] [⬇] [🗑]              │  │ <Audio Controls>    │  │
│                              │  └─────────────────────┘  │
│  📦 [Alle exportieren]       │                          │
└─────────────────────────────────────────────────────────┘
```

## 🚀 Installation & Setup

### 1. Dateien herunterladen
```bash
git clone [repository-url]
cd Prototype_AudioPWA
```

### 2. Lokaler Server (erforderlich für PWA)
```bash
# Python 3
python -m http.server 8000

# Node.js (mit live-server)
npx live-server

# VS Code Live Server Extension
# Rechtsklick auf index.html → "Open with Live Server"
```

### 3. Browser öffnen
```
http://localhost:8000
```

### 4. PWA Installation (optional)
- Chrome: Adressleiste → Install Icon
- Safari: Share → Add to Home Screen
- Edge: App Menu → Install this site as an app

## 🛠 Funktionalitäten

### Audio-Geräte Management
```javascript
// Automatische Geräteerkennung mit Labels
await navigator.mediaDevices.getUserMedia({ audio: true });
const devices = await navigator.mediaDevices.enumerateDevices();

// USB Audio Interface Erkennung
if (deviceName.includes('usb') || deviceName.includes('scarlett')) {
    deviceName = '🎛️ ' + deviceName + ' (USB Interface)';
}
```

### Aufnahme-Workflow
1. **Phase 1 - Monitoring**: Audio-Stream aktivieren, Live-Waveform anzeigen
2. **Phase 2 - Recording**: ScriptProcessor sammelt Audio-Daten in Puffer
3. **Phase 3 - Processing**: WAV-Header generieren, Blob erstellen
4. **Phase 4 - Naming**: Benutzer gibt Dateinamen ein (zwingend erforderlich)
5. **Phase 5 - Storage**: IndexedDB Speicherung + Memory Array

### Metronom-Engine
```javascript
// ADSR Hüllkurve für professionellen Sound
const attackTime = 0.005;   // 5ms Attack
const decayTime = 0.02;     // 20ms Decay  
const sustainLevel = 0.1;   // 10% Sustain
const releaseTime = 0.03;   // 30ms Release

// Akzent-Frequenzen
const accentFreq = 1200;    // Erster Beat
const normalFreq = 800;     // Weitere Beats
```

### WAV-Datei Generierung
```javascript
// 44-Byte WAV Header + 16-bit PCM Audio Data
const buffer = new ArrayBuffer(44 + combinedBuffer.length * 2);
// RIFF/WAVE Format mit korrekten Chunk-Größen
writeString(0, 'RIFF');
view.setUint32(4, 36 + combinedBuffer.length * 2, true);
```

## 📚 Externe Bibliotheken

### JSZip (v3.10.1)
```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
```

**Verwendung**: 
- Erstellung von ZIP-Archiven für Bulk-Export
- Kompression: DEFLATE Level 6 für optimale Größe/Geschwindigkeit
- Automatische Metadaten-Datei (`Aufnahmen_Info.txt`)

**Integration**:
```javascript
const zip = new JSZip();
zip.file('001_Aufnahme_Name.wav', arrayBuffer);
const zipBlob = await zip.generateAsync({ type: 'blob' });
```

## 🔧 App.js Funktionen

### Initialisierung & Setup
| Funktion | Beschreibung |
|----------|-------------|
| `setupCanvas()` | Canvas für Waveform-Display konfigurieren |
| `resizeCanvas()` | Responsive Canvas-Größenanpassung |
| `initIndexedDB()` | IndexedDB Datenbank initialisieren |
| `loadSavedRecordings()` | Gespeicherte Aufnahmen beim Start laden |
| `loadAudioDevices()` | Audio Ein-/Ausgabegeräte enumerieren |

### Audio-Aufnahme Core
| Funktion | Beschreibung |
|----------|-------------|
| `startRecording()` | Phase 1: Monitoring aktivieren |
| `startActualRecording()` | Phase 2: Aufnahme starten |
| `stopRecording()` | Aufnahme beenden, WAV erstellen |
| `processAudioData()` | Echtzeit Audio-Analyse für Waveform |
| `animate()` | Animation Loop für Live-Visualisierung |

### Waveform & Visualisierung
| Funktion | Beschreibung |
|----------|-------------|
| `drawWaveform()` | Live-Waveform während Aufnahme/Monitor |
| `generatePlaybackWaveform()` | Waveform aus gespeicherter Audio-Datei |
| `drawPlaybackWaveform()` | Waveform für Playback mit Cursor |
| `playbackTimeUpdate()` | Playback-Cursor Animation |

### Datei-Management
| Funktion | Beschreibung |
|----------|-------------|
| `createWavFromChunks()` | WAV-Datei aus Audio-Puffern erstellen |
| `promptForRecordingName()` | Zwingend Dateinamen abfragen |
| `addRecordingToList()` | Aufnahme zu Liste und IndexedDB hinzufügen |
| `updateRecordingsList()` | UI-Liste aktualisieren |

### Metronom-System
| Funktion | Beschreibung |
|----------|-------------|
| `generateMetronomeClick()` | ADSR-Klick mit Frequenz-Modulation |
| `startMetronome()` | Metronom mit AudioContext-Management |
| `stopMetronome()` | Metronom stoppen, UI zurücksetzen |
| `updateBPM()` | BPM ändern, Metronom neu starten |
| `updateNoteValue()` | Notenwert ändern (Halbe/Viertel/Achtel) |
| `updateBeatLength()` | Taktlänge ändern (1-19 Schläge) |

### Export & Download
| Funktion | Beschreibung |
|----------|-------------|
| `exportAllRecordings()` | Alle Aufnahmen als ZIP exportieren |
| `createExportInfo()` | Metadaten-Datei für ZIP erstellen |
| `downloadRecording()` | Einzelne Aufnahme herunterladen |
| `deleteRecording()` | Aufnahme aus Memory und IndexedDB löschen |

### Utility Functions
| Funktion | Beschreibung |
|----------|-------------|
| `setAudioOutput()` | Audio-Ausgabegerät für Playback setzen |
| `updateExportButton()` | Export-Button Status aktualisieren |
| `getNoteSymbol()` | Notenwert zu Symbol konvertieren |

## 📱 Responsive Design

### Breakpoints
```css
/* Desktop: > 768px */
→ Zwei-Spalten Layout (Audio-Geräte | Metronom)

/* Tablet: 768px - 601px */
→ Ein-Spalten Layout, volle Breite

/* Mobile: 600px - 481px */
→ Kritischer Breakpoint, verhindert Layout-Sprünge

/* Small Mobile: ≤ 480px */
→ Kompakte Buttons, vertikale Layouts
```

### Canvas Responsivität
```javascript
// Dynamische Breite basierend auf Container
const availableWidth = containerWidth - 40 - 40 - 20; // Zeit-Displays + Gaps
const newWidth = Math.max(280, Math.min(availableWidth, 800));
```

## 📲 PWA Features

### Manifest.json
```json
{
  "name": "Ideenschmiede",
  "display": "standalone",
  "background_color": "#000000",
  "theme_color": "#ffffff"
}
```

### Service Worker
- **Cache Strategy**: Cache-First für App-Dateien
- **Offline Capability**: App funktioniert ohne Internet
- **Update Mechanism**: Automatische Cache-Aktualisierung

### Installierbarkeit
- **Desktop**: Install-Button in Browser-Adressleiste
- **Mobile**: "Add to Home Screen" Option
- **Standalone Mode**: Läuft wie native App ohne Browser-UI

## 🌐 Browser-Kompatibilität

### Vollständig Unterstützt
- **Chrome/Chromium**: 88+ (alle Features)
- **Firefox**: 85+ (setSinkId teilweise limitiert)
- **Edge**: 88+ (alle Features)
- **Safari**: 14+ (IndexedDB manchmal limitiert)

### Feature-Matrix
| Feature | Chrome | Firefox | Edge | Safari |
|---------|--------|---------|------|--------|
| Web Audio API | ✅ | ✅ | ✅ | ✅ |
| IndexedDB | ✅ | ✅ | ✅ | ⚠️ |
| setSinkId | ✅ | ⚠️ | ✅ | ❌ |
| PWA Install | ✅ | ⚠️ | ✅ | ✅ |

### Fallback-Strategien
- **IndexedDB Fehler**: Memory-only Modus
- **setSinkId Fehler**: Standard-Audio-Ausgang
- **MediaDevices Fehler**: Standard-Mikrofon

## 🔧 Entwicklung

### Lokale Entwicklung
```bash
# Live-Reload Development Server
npx live-server --port=8000 --open=/index.html

# Mit HTTPS für MediaDevices API
npx live-server --https=cert.pem --https-key=key.pem
```

### Debugging
```javascript
// IndexedDB Debug-Logs
console.log('📦 IndexedDB Status:', db ? 'Connected' : 'Not Available');

// Audio-Context Status
console.log('🎵 AudioContext State:', audioContext.state);

// Metronom Debug
console.log('🥁 Beat:', currentBeat, 'Takt:', beatLength, 'BPM:', currentBPM);
```

### Performance-Optimierung
- **Canvas**: Minimal-Redraws nur bei Änderungen
- **Audio**: ScriptProcessor 4096 Samples für niedrige Latenz
- **Memory**: Waveform-Daten auf 500 Samples begrenzt
- **IndexedDB**: Non-blocking Transaktionen

## 📝 Lizenz & Credits

**Ideenschmiede Audio PWA** - Entwickelt als Prototyp für moderne Web-Audio-Anwendungen.

### Technologie-Credits
- **Web Audio API**: W3C Standard für Audio-Verarbeitung
- **JSZip**: Stuk/JSZip für ZIP-Erstellung
- **Canvas 2D**: HTML5 Canvas für Visualisierung
- **IndexedDB**: W3C Standard für clientseitige Speicherung

---

*Für technischen Support oder Feature-Requests: Erstellen Sie ein Issue im Repository.*
