// Vereinfachte Audio PWA - Fokus auf Echtzeit-Waveform
let mediaRecorder;
let recordedChunks = [];
let recordings = [];
let recordingCounter = 0;
let audioContext;
let analyser;
let processor;
let isRecording = false;
let isMonitoring = false;
let waveformData = [];
let audioTrackCanvas, audioTrackContext;
let animationId;
let recordingStartTime = 0;
let currentStream = null;
let audioChunks = []; // Für WAV-Aufnahme
let gainNode = null; // Für Gain-Kontrolle
let inputGain = 1.0; // Standard-Gain (100%)
let selectedDeviceId = null; // Ausgewähltes Audio-Eingabegerät
let selectedOutputId = null; // Ausgewähltes Audio-Ausgabegerät
let availableDevices = []; // Liste verfügbarer Audio-Eingabegeräte
let availableOutputs = []; // Liste verfügbarer Audio-Ausgabegeräte

// Metronom-Variablen
let metronomeActive = false;
let metronomeInterval = null;
let currentBPM = 120;
let currentBeat = 1;
let metronomeAudioContext = null;
let noteValue = 4; // 2=halbe, 4=viertel, 8=achtel
let beatLength = 4; // Anzahl Schläge pro Takt (1-19)

// IndexedDB Variablen (nur hinzugefügt, keine bestehenden Funktionen geändert)
let db = null;
const DB_NAME = 'AudioPWA';
const DB_VERSION = 1;
const STORE_NAME = 'recordings';

// Canvas Setup
function setupCanvas() {
  audioTrackCanvas = document.getElementById('audioTrackCanvas');
  audioTrackContext = audioTrackCanvas.getContext('2d');
  
  // Responsive Canvas-Größe
  resizeCanvas();
  
  // Dunkler Hintergrund
  audioTrackContext.fillStyle = '#2c3e50';
  audioTrackContext.fillRect(0, 0, audioTrackCanvas.width, audioTrackCanvas.height);
}

// Canvas an Container-Breite anpassen
function resizeCanvas() {
  const canvas = document.getElementById('audioTrackCanvas');
  const container = canvas.parentElement;
  const containerWidth = container.offsetWidth;
  
  // Platz für Zeit-Anzeigen (je 40px) und Gaps (je 10px)
  const availableWidth = containerWidth - 40 - 40 - 20;
  
  // Mindestens 280px, maximal verfügbare Breite
  const newWidth = Math.max(280, Math.min(availableWidth, 800));
  
  // Nur ändern wenn sich die Breite signifikant ändert
  if (Math.abs(canvas.width - newWidth) > 10) {
    canvas.width = newWidth;
    // Höhe bleibt konstant
    canvas.height = 80;
    
    // Canvas muss neu gezeichnet werden
    if (audioTrackContext) {
      audioTrackContext.fillStyle = '#2c3e50';
      audioTrackContext.fillRect(0, 0, canvas.width, canvas.height);
    }
  }
}

// ===== Export-Funktionen (NEU) =====
async function exportAllRecordings() {
  const exportBtn = document.getElementById('exportAllBtn');
  
  if (recordings.length === 0) {
    alert('Keine Aufnahmen zum Exportieren vorhanden!');
    return;
  }
  
  // Button während Export deaktivieren
  exportBtn.disabled = true;
  exportBtn.textContent = '📦 Exportiere...';
  
  try {
    console.log(`📦 Starte Export von ${recordings.length} Aufnahmen...`);
    
    // JSZip-Instanz erstellen
    if (typeof JSZip === 'undefined') {
      throw new Error('JSZip Bibliothek nicht geladen');
    }
    
    const zip = new JSZip();
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    
    // Alle Aufnahmen zum ZIP hinzufügen
    for (let i = 0; i < recordings.length; i++) {
      const recording = recordings[i];
      const paddedIndex = String(i + 1).padStart(3, '0');
      const fileName = `${paddedIndex}_${recording.name}.wav`;
      
      console.log(`📄 Füge hinzu: ${fileName}`);
      
      // Blob als ArrayBuffer lesen
      const arrayBuffer = await recording.blob.arrayBuffer();
      zip.file(fileName, arrayBuffer);
    }
    
    // Info-Datei mit Aufnahmedetails hinzufügen
    const infoText = createExportInfo();
    zip.file('Aufnahmen_Info.txt', infoText);
    
    console.log('🗜️ Erstelle ZIP-Datei...');
    
    // ZIP generieren
    const zipBlob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });
    
    // Download starten
    const zipUrl = URL.createObjectURL(zipBlob);
    const downloadLink = document.createElement('a');
    downloadLink.href = zipUrl;
    downloadLink.download = `Ideenschmiede_Export_${timestamp}.zip`;
    
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    
    // URL freigeben
    setTimeout(() => URL.revokeObjectURL(zipUrl), 1000);
    
    console.log('✅ Export erfolgreich abgeschlossen!');
    
  } catch (error) {
    console.error('❌ Export-Fehler:', error);
    alert(`Export fehlgeschlagen: ${error.message}`);
  } finally {
    // Button wieder aktivieren
    exportBtn.disabled = false;
    exportBtn.textContent = '📦 Alle exportieren';
  }
}

function createExportInfo() {
  const timestamp = new Date().toLocaleString('de-DE');
  const totalSize = recordings.reduce((sum, rec) => sum + rec.blob.size, 0);
  const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2);
  
  let info = `Ideenschmiede - Audio Export\n`;
  info += `============================\n\n`;
  info += `Export-Datum: ${timestamp}\n`;
  info += `Anzahl Aufnahmen: ${recordings.length}\n`;
  info += `Gesamtgröße: ${totalSizeMB} MB\n\n`;
  info += `Aufnahmen-Details:\n`;
  info += `-----------------\n`;
  
  recordings.forEach((recording, index) => {
    const paddedIndex = String(index + 1).padStart(3, '0');
    const sizeMB = (recording.blob.size / (1024 * 1024)).toFixed(2);
    info += `${paddedIndex}. ${recording.name}\n`;
    info += `     Aufgenommen: ${recording.timestamp}\n`;
    info += `     Größe: ${sizeMB} MB\n`;
    info += `     Format: ${recording.mimeType}\n\n`;
  });
  
  info += `\nHinweise:\n`;
  info += `- Alle Dateien sind im WAV-Format\n`;
  info += `- Dateien sind chronologisch nummeriert\n`;
  info += `- Kompatibel mit allen gängigen Audio-Editoren\n`;
  
  return info;
}

function updateExportButton() {
  const exportBtn = document.getElementById('exportAllBtn');
  const hasRecordings = recordings.length > 0;
  
  exportBtn.disabled = !hasRecordings;
  exportBtn.textContent = hasRecordings 
    ? `📦 Alle exportieren (${recordings.length})` 
    : '📦 Alle exportieren';
}

// ===== IndexedDB Hilfsfunktionen (NEU - keine bestehenden Funktionen geändert) =====
async function initIndexedDB() {
  try {
    if (!window.indexedDB) {
      console.warn('❌ IndexedDB nicht verfügbar - Memory-Modus');
      return false;
    }

    console.log(`🔄 IndexedDB wird initialisiert: ${DB_NAME}`);
    
    return new Promise((resolve) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      
      request.onerror = (event) => {
        console.error('❌ IndexedDB Fehler:', event);
        resolve(false);
      };
      
      request.onsuccess = (event) => {
        db = request.result;
        console.log(`✅ IndexedDB erfolgreich geöffnet: ${DB_NAME}`);
        console.log('📊 Verfügbare Object Stores:', [...db.objectStoreNames]);
        resolve(true);
      };
      
      request.onupgradeneeded = (event) => {
        console.log('🔧 IndexedDB Upgrade/Ersteinrichtung...');
        const database = event.target.result;
        
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          const store = database.createObjectStore(STORE_NAME, { 
            keyPath: 'id',
            autoIncrement: true 
          });
          store.createIndex('name', 'name', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          console.log(`✅ Object Store '${STORE_NAME}' erstellt`);
        }
      };
    });
  } catch (error) {
    console.error('❌ IndexedDB Init-Fehler:', error);
    return false;
  }
}

async function loadSavedRecordings() {
  if (!db) return;
  
  try {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    
    return new Promise((resolve) => {
      request.onsuccess = () => {
        const dbRecordings = request.result || [];
        console.log(`📦 ${dbRecordings.length} Aufnahmen aus IndexedDB geladen`);
        
        const convertedRecordings = dbRecordings.map(dbRec => {
          const blob = new Blob([dbRec.audioData], { type: dbRec.mimeType });
          const url = URL.createObjectURL(blob);
          
          return {
            id: dbRec.id,
            url: url,
            blob: blob,
            timestamp: dbRec.timestamp,
            name: dbRec.name,
            mimeType: dbRec.mimeType,
            waveformData: dbRec.waveformData || [],
            isPersistent: true,
            dbId: dbRec.id
          };
        });
        
        if (convertedRecordings.length > 0) {
          // RecordingCounter basierend auf geladenen IDs setzen
          const maxId = Math.max(...convertedRecordings.map(r => r.id));
          recordingCounter = maxId;
          
          // Geladene Aufnahmen zum Array hinzufügen
          recordings.push(...convertedRecordings);
          updateRecordingsList();
          updateExportButton(); // Export-Button aktualisieren
          
          console.log(`✅ ${convertedRecordings.length} Aufnahmen wiederhergestellt`);
        }
        
        resolve(convertedRecordings.length);
      };
      
      request.onerror = () => {
        console.log('Fehler beim Laden aus IndexedDB');
        resolve(0);
      };
    });
  } catch (error) {
    console.log('Fehler beim Laden der Aufnahmen:', error);
    return 0;
  }
}

// Audio-Geräte laden und anzeigen  
async function loadAudioDevices() {
  try {
    // Berechtigungen anfordern, um Geräte-Labels zu erhalten
    await navigator.mediaDevices.getUserMedia({ audio: true });
    
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioInputs = devices.filter(device => device.kind === 'audioinput');
    const audioOutputs = devices.filter(device => device.kind === 'audiooutput');
    
    // Audio-Eingänge verwalten
    availableDevices = audioInputs;
    const selectElement = document.getElementById('audioInputSelect');
    selectElement.innerHTML = '';
    
    if (audioInputs.length === 0) {
      selectElement.innerHTML = '<option value="">Keine Audio-Eingänge gefunden</option>';
    } else {
      // Standard-Gerät hinzufügen
      const defaultOption = document.createElement('option');
      defaultOption.value = '';
      defaultOption.textContent = 'Standard-Mikrofon';
      selectElement.appendChild(defaultOption);
      
      // Alle verfügbaren Eingänge hinzufügen
      audioInputs.forEach((device, index) => {
        const option = document.createElement('option');
        option.value = device.deviceId;
        
        // Gerätename oder Fallback
        let deviceName = device.label || `Audio-Gerät ${index + 1}`;
        
        // USB Audio Interface erkennen und hervorheben
        if (deviceName.toLowerCase().includes('usb') || 
            deviceName.toLowerCase().includes('interface') ||
            deviceName.toLowerCase().includes('scarlett') ||
            deviceName.toLowerCase().includes('focusrite') ||
            deviceName.toLowerCase().includes('presonus') ||
            deviceName.toLowerCase().includes('behringer')) {
          deviceName = '🎛️ ' + deviceName + ' (USB Interface)';
        }
        
        option.textContent = deviceName;
        selectElement.appendChild(option);
      });
    }
    
    // Audio-Ausgänge verwalten
    availableOutputs = audioOutputs;
    const outputSelectElement = document.getElementById('audioOutputSelect');
    outputSelectElement.innerHTML = '';
    
    if (audioOutputs.length === 0) {
      outputSelectElement.innerHTML = '<option value="">Keine Audio-Ausgänge gefunden</option>';
    } else {
      // Standard-Ausgang hinzufügen
      const defaultOutputOption = document.createElement('option');
      defaultOutputOption.value = '';
      defaultOutputOption.textContent = 'Standard-Lautsprecher';
      outputSelectElement.appendChild(defaultOutputOption);
      
      // Alle verfügbaren Ausgänge hinzufügen
      audioOutputs.forEach((device, index) => {
        const option = document.createElement('option');
        option.value = device.deviceId;
        
        // Gerätename oder Fallback
        let deviceName = device.label || `Audio-Ausgang ${index + 1}`;
        
        // USB Audio Interface, Kopfhörer, etc. erkennen
        if (deviceName.toLowerCase().includes('usb') || 
            deviceName.toLowerCase().includes('interface') ||
            deviceName.toLowerCase().includes('scarlett') ||
            deviceName.toLowerCase().includes('focusrite') ||
            deviceName.toLowerCase().includes('presonus') ||
            deviceName.toLowerCase().includes('behringer')) {
          deviceName = '🎛️ ' + deviceName + ' (USB Interface)';
        } else if (deviceName.toLowerCase().includes('headphone') ||
                   deviceName.toLowerCase().includes('kopfhörer')) {
          deviceName = '🎧 ' + deviceName;
        } else if (deviceName.toLowerCase().includes('speaker') ||
                   deviceName.toLowerCase().includes('lautsprecher')) {
          deviceName = '🔊 ' + deviceName;
        }
        
        option.textContent = deviceName;
        outputSelectElement.appendChild(option);
      });
    }
    
    console.log(`${audioInputs.length} Audio-Eingänge und ${audioOutputs.length} Audio-Ausgänge gefunden`);
    
    // Status zurücksetzen nach erfolgreichem Laden
    document.getElementById('recordingStatus').textContent = 'Bereit für Aufnahme';
    document.getElementById('recordingStatus').style.color = '#27ae60';
    
  } catch (error) {
    console.error('Fehler beim Laden der Audio-Geräte:', error);
    const selectElement = document.getElementById('audioInputSelect');
    const outputSelectElement = document.getElementById('audioOutputSelect');
    selectElement.innerHTML = '<option value="">Fehler beim Laden der Geräte</option>';
    outputSelectElement.innerHTML = '<option value="">Fehler beim Laden der Geräte</option>';
    
    // Fehler-Status anzeigen
    document.getElementById('recordingStatus').textContent = 'Fehler beim Laden der Audio-Geräte';
    document.getElementById('recordingStatus').style.color = '#e74c3c';
  }
}

// Audio-Ausgang für Playback setzen
async function setAudioOutput(audioElement, deviceId) {
  if (!audioElement.setSinkId) {
    console.warn('setSinkId wird von diesem Browser nicht unterstützt');
    return false;
  }
  
  try {
    await audioElement.setSinkId(deviceId || '');
    console.log(`Audio-Ausgang gesetzt: ${deviceId || 'Standard'}`);
    return true;
  } catch (error) {
    console.error('Fehler beim Setzen des Audio-Ausgangs:', error);
    return false;
  }
}
function drawWaveform() {
  const canvas = audioTrackCanvas;
  const ctx = audioTrackContext;
  const width = canvas.width;
  const height = canvas.height;
  const centerY = height / 2;
  
  // Canvas löschen
  ctx.fillStyle = '#2c3e50';
  ctx.fillRect(0, 0, width, height);
  
  // Mittellinie
  ctx.strokeStyle = '#34495e';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, centerY);
  ctx.lineTo(width, centerY);
  ctx.stroke();
  
  if (waveformData.length === 0) return;
  
  // Waveform zeichnen
  ctx.strokeStyle = isRecording ? '#e74c3c' : (isMonitoring ? '#27ae60' : '#3498db');
  ctx.lineWidth = 2;
  ctx.beginPath();
  
  const step = width / waveformData.length;
  
  for (let i = 0; i < waveformData.length; i++) {
    const x = i * step;
    const amplitude = waveformData[i] * centerY * 0.9; // 90% der verfügbaren Höhe für mehr Sichtbarkeit
    const y = centerY - amplitude;
    
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();
  
  // Negative Waveform (gespiegelt)
  ctx.beginPath();
  for (let i = 0; i < waveformData.length; i++) {
    const x = i * step;
    const amplitude = waveformData[i] * centerY * 0.9; // 90% der verfügbaren Höhe
    const y = centerY + amplitude;
    
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();
  
  // Zeit anzeigen
  if (isRecording) {
    const currentTime = (Date.now() - recordingStartTime) / 1000;
    document.getElementById('timeDisplay').textContent = currentTime.toFixed(1) + 's';
  } else if (isMonitoring) {
    document.getElementById('timeDisplay').textContent = 'Live Monitor';
  }
}

// Audio-Daten sammeln und verarbeiten
function processAudioData() {
  if (!analyser) return;
  
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  analyser.getByteTimeDomainData(dataArray);
  
  // RMS berechnen mit verbesserter Sensitivität
  let rms = 0;
  let peak = 0;
  for (let i = 0; i < bufferLength; i++) {
    const sample = (dataArray[i] - 128) / 128;
    rms += sample * sample;
    peak = Math.max(peak, Math.abs(sample));
  }
  rms = Math.sqrt(rms / bufferLength);
  
  // Kombiniere RMS und Peak für bessere Sichtbarkeit
  const combinedValue = Math.max(rms * 10, peak * 5); // Noch höhere Verstärkung
  
  // Zu Waveform-Daten hinzufügen
  waveformData.push(Math.min(combinedValue, 2.0)); // Maximum bei 2.0 statt 1.0
  
  // Speicher-Management - nur letzte 500 Samples behalten
  if (waveformData.length > 500) {
    waveformData = waveformData.slice(-400);
  }
  
  // Gain-Meter mit extra Verstärkung für bessere Sichtbarkeit (nach Gain-Anpassung)
  const adjustedRms = rms * inputGain;
  const adjustedPeak = peak * inputGain;
  const adjustedCombined = combinedValue * inputGain;
  
  const gainForMeter = Math.max(adjustedRms * 800, adjustedPeak * 400, adjustedCombined * 80);
  const gainLevel = Math.min(gainForMeter, 100);
  document.getElementById('gainBar').style.width = gainLevel + '%';
  
  // Clipping-Warnung bei zu hohem Gain
  if (gainLevel > 95) {
    document.getElementById('gainBar').style.background = '#e74c3c'; // Rot bei Clipping
  } else if (gainLevel > 80) {
    document.getElementById('gainBar').style.background = 'linear-gradient(to right, #f1c40f, #e74c3c)'; // Gelb-Rot
  } else {
    document.getElementById('gainBar').style.background = 'linear-gradient(to right, #27ae60, #f1c40f, #e74c3c)'; // Normal
  }
}

// Animation Loop
function animate() {
  if ((isRecording || isMonitoring) && analyser) {
    processAudioData();
    drawWaveform();
    animationId = requestAnimationFrame(animate);
  }
}

// Aufnahme starten - Phase 1: Monitoring
async function startRecording() {
  if (!isMonitoring) {
    // Phase 1: Monitoring aktivieren
    try {
      // Audio-Constraints basierend auf ausgewähltem Gerät
      const audioConstraints = {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        sampleRate: 44100
      };
      
      // Gerät-ID hinzufügen, falls ein spezifisches Gerät ausgewählt wurde
      if (selectedDeviceId) {
        audioConstraints.deviceId = { exact: selectedDeviceId };
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints
      });
      
      currentStream = stream;
      
      // Audio Context für Echtzeit-Analyse und WAV-Aufnahme
      audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 44100
      });
      const source = audioContext.createMediaStreamSource(stream);
      
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.3;
      
      // Gain-Node für Lautstärke-Kontrolle hinzufügen
      gainNode = audioContext.createGain();
      gainNode.gain.value = inputGain;
      
      // ScriptProcessorNode für WAV-Aufnahme
      processor = audioContext.createScriptProcessor(4096, 1, 1);
      audioChunks = [];
      
      processor.onaudioprocess = function(e) {
        const inputBuffer = e.inputBuffer.getChannelData(0);
        
        // Audio-Daten nur während Aufnahme sammeln
        if (isRecording) {
          const int16Buffer = new Int16Array(inputBuffer.length);
          for (let i = 0; i < inputBuffer.length; i++) {
            const sample = Math.max(-1, Math.min(1, inputBuffer[i]));
            int16Buffer[i] = sample * 0x7FFF;
          }
          audioChunks.push(new Int16Array(int16Buffer));
        }
      };
      
      source.connect(gainNode);
      gainNode.connect(analyser);
      gainNode.connect(processor);
      // WICHTIG: Processor muss mit destination verbunden werden, damit onaudioprocess aufgerufen wird
      processor.connect(audioContext.destination);
      
      // Monitoring starten
      isMonitoring = true;
      waveformData = [];
      
      // Animation starten
      animate();
      
      // UI für Phase 2 vorbereiten
      document.getElementById("startBtn").textContent = 'Aufnahme starten';
      document.getElementById("startBtn").style.backgroundColor = '#e74c3c';
      document.getElementById('recordingStatus').textContent = 'Bereit für Aufnahme - Klicken Sie "Aufnahme starten"';
      document.getElementById('recordingStatus').style.color = '#27ae60';
      
    } catch (error) {
      console.error('Fehler beim Starten des Monitorings:', error);
      document.getElementById('recordingStatus').textContent = 'Fehler: ' + error.message;
      document.getElementById('recordingStatus').style.color = '#e74c3c';
    }
  } else {
    // Phase 2: Aufnahme starten
    startActualRecording();
  }
}

// Phase 2: Eigentliche Aufnahme
function startActualRecording() {
  isRecording = true;
  recordingStartTime = Date.now();
  
  // UI aktualisieren
  document.getElementById("startBtn").disabled = true;
  document.getElementById("stopBtn").disabled = false;
  document.getElementById('recordingStatus').textContent = '● AUFNAHME LÄUFT';
  document.getElementById('recordingStatus').style.color = '#e74c3c';
}

// Aufnahme stoppen
function stopRecording() {
  isRecording = false;
  isMonitoring = false;
  
  // Metronom automatisch stoppen beim Beenden der Aufnahme
  if (metronomeActive) {
    stopMetronome();
  }
  
  // Animation stoppen
  if (animationId) {
    cancelAnimationFrame(animationId);
  }
  
  // WAV-Datei aus den aufgenommenen Chunks erstellen
  if (audioChunks.length > 0) {
    const wavBlob = createWavFromChunks(audioChunks, audioContext.sampleRate);
    
    // Zwingend nach Dateinamen fragen
    promptForRecordingName(wavBlob);
  }
  
  // Cleanup
  if (processor) {
    processor.disconnect();
  }
  if (gainNode) {
    gainNode.disconnect();
  }
  if (analyser) {
    analyser.disconnect();
  }
  if (currentStream) {
    currentStream.getTracks().forEach(track => track.stop());
  }
  if (audioContext) {
    audioContext.close();
  }
  
  processor = null;
  gainNode = null;
  analyser = null;
  currentStream = null;
  audioChunks = [];
  
  // UI komplett zurücksetzen
  document.getElementById("startBtn").disabled = false;
  document.getElementById("stopBtn").disabled = true;
  document.getElementById("startBtn").textContent = 'Neue Aufnahme';
  document.getElementById("startBtn").style.backgroundColor = '';
  document.getElementById('recordingStatus').textContent = 'Bereit für Aufnahme';
  document.getElementById('recordingStatus').style.color = '#27ae60';
  document.getElementById('gainBar').style.width = '0%';
  document.getElementById('timeDisplay').textContent = '0s';
}

// Funktion zur Erstellung einer WAV-Datei aus aufgenommenen Chunks
function createWavFromChunks(audioChunks, sampleRate) {
  // Alle Chunks zusammenfügen
  let totalLength = 0;
  audioChunks.forEach(chunk => totalLength += chunk.length);
  
  const combinedBuffer = new Int16Array(totalLength);
  let offset = 0;
  audioChunks.forEach(chunk => {
    combinedBuffer.set(chunk, offset);
    offset += chunk.length;
  });
  
  // WAV Header erstellen
  const buffer = new ArrayBuffer(44 + combinedBuffer.length * 2);
  const view = new DataView(buffer);
  
  const writeString = (offset, string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + combinedBuffer.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, combinedBuffer.length * 2, true);
  
  // Audio-Daten schreiben
  let dataOffset = 44;
  for (let i = 0; i < combinedBuffer.length; i++) {
    view.setInt16(dataOffset, combinedBuffer[i], true);
    dataOffset += 2;
  }
  
  return new Blob([buffer], { type: 'audio/wav' });
}

// Nach Aufnahme-Namen fragen
function promptForRecordingName(blob) {
  let recordingName = '';
  
  // Schleife bis ein gültiger Name eingegeben wird
  while (!recordingName || recordingName.trim() === '') {
    recordingName = prompt('Bitte geben Sie einen Namen für die Aufnahme ein:', `Aufnahme_${new Date().toLocaleDateString('de-DE').replace(/\./g, '-')}`);
    
    // Wenn Benutzer abbricht, Standard-Namen verwenden
    if (recordingName === null) {
      recordingName = `Aufnahme_${Date.now()}`;
      break;
    }
    
    // Prüfen ob Name leer ist
    if (!recordingName || recordingName.trim() === '') {
      alert('Der Name darf nicht leer sein! Bitte geben Sie einen gültigen Namen ein.');
    }
  }
  
  // Name bereinigen (gefährliche Zeichen entfernen)
  recordingName = recordingName.trim().replace(/[<>:"/\\|?*]/g, '_');
  
  // Aufnahme mit benutzerdefiniertem Namen hinzufügen
  addRecordingToList(blob, recordingName);
}

// Aufnahme zur Liste hinzufügen
function addRecordingToList(blob, customName = null) {
  recordingCounter++;
  const timestamp = new Date().toLocaleString('de-DE');
  const url = URL.createObjectURL(blob);
  
  const recording = {
    id: recordingCounter,
    url: url,
    blob: blob,
    timestamp: timestamp,
    name: customName || `Aufnahme ${recordingCounter}`,
    mimeType: 'audio/wav',
    waveformData: [...waveformData]
  };
  
  // IndexedDB Speicherung (optional, non-blocking)
  if (db) {
    console.log(`💾 Versuche Aufnahme "${recording.name}" in IndexedDB zu speichern...`);
    try {
      // FileReader ERST verwenden, dann Transaction
      const reader = new FileReader();
      reader.onload = function() {
        // JETZT erst die Transaction erstellen
        try {
          const transaction = db.transaction([STORE_NAME], 'readwrite');
          const store = transaction.objectStore(STORE_NAME);
          
          const dataToStore = {
            name: recording.name,
            timestamp: recording.timestamp,
            mimeType: recording.mimeType,
            waveformData: recording.waveformData,
            audioData: reader.result,
            size: recording.blob.size
          };
          
          console.log('📤 Daten für IndexedDB vorbereitet:', {
            name: dataToStore.name,
            size: dataToStore.size,
            audioDataSize: dataToStore.audioData.byteLength
          });
          
          const request = store.add(dataToStore);
          
          request.onsuccess = () => {
            console.log(`✅ Aufnahme "${recording.name}" erfolgreich in IndexedDB gespeichert (ID: ${request.result})`);
            recording.isPersistent = true;
            recording.dbId = request.result;
            updateRecordingsList(); // UI aktualisieren mit Icon
          };
          
          request.onerror = (event) => {
            console.error('❌ IndexedDB Speicherung fehlgeschlagen:', event);
            recording.isPersistent = false;
          };
          
        } catch (transactionError) {
          console.error('❌ Transaction-Fehler:', transactionError);
        }
      };
      
      reader.onerror = (event) => {
        console.error('❌ Fehler beim Lesen der Blob-Daten:', event);
      };
      
      reader.readAsArrayBuffer(blob);
      
    } catch (error) {
      console.error('❌ IndexedDB Fehler beim Speichern:', error);
    }
  } else {
    console.warn('⚠️ IndexedDB nicht verfügbar - Aufnahme nur im Memory');
  }
  
  recordings.push(recording);
  updateRecordingsList();
  updateExportButton(); // Export-Button aktualisieren
  
  // Aktueller Player
  document.getElementById("audioPlayback").src = url;
}

// Aufnahmen-Liste aktualisieren
function updateRecordingsList() {
  const list = document.getElementById('recordingsList');
  list.innerHTML = '';
  
  recordings.forEach(recording => {
    const listItem = document.createElement('li');
    
    // Einfaches Icon für persistente Aufnahmen
    const icon = recording.isPersistent ? '💾 ' : '';
    
    listItem.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px; margin: 5px 0;">
        <span>${icon}<strong>${recording.name}</strong> - ${recording.timestamp}</span>
        <button onclick="playRecording(${recording.id})" style="padding: 5px 10px;">Abspielen</button>
        <button onclick="downloadRecording(${recording.id})" style="padding: 5px 10px;">Download</button>
        <button onclick="deleteRecording(${recording.id})" style="padding: 5px 10px; background-color: #ff4444; color: white;">Löschen</button>
      </div>
    `;
    list.appendChild(listItem);
  });
}

// Aufnahme abspielen
function playRecording(id) {
  const recording = recordings.find(r => r.id === id);
  if (recording) {
    const audioPlayer = document.getElementById("audioPlayback");
    
    // Alte Event-Listener entfernen
    audioPlayer.removeEventListener('timeupdate', playbackTimeUpdate);
    audioPlayer.removeEventListener('ended', playbackEnded);
    
    // Audio-Ausgang setzen
    setAudioOutput(audioPlayer, selectedOutputId);
    
    // Audio-Waveform für Playback generieren
    generatePlaybackWaveform(recording.url).then(playbackWaveformData => {
      // Globale Playback-Waveform speichern
      window.currentPlaybackWaveform = playbackWaveformData;
      
      // Waveform anzeigen
      drawPlaybackWaveform(playbackWaveformData);
      
      audioPlayer.src = recording.url;
      audioPlayer.play();
      
      // Event-Listener hinzufügen
      audioPlayer.addEventListener('timeupdate', playbackTimeUpdate);
      audioPlayer.addEventListener('ended', playbackEnded);
    }).catch(error => {
      console.error('Fehler beim Generieren der Playback-Waveform:', error);
      // Fallback: Ursprüngliche Waveform verwenden
      waveformData = recording.waveformData || [];
      drawWaveform();
      
      audioPlayer.src = recording.url;
      audioPlayer.play();
      audioPlayer.addEventListener('timeupdate', playbackTimeUpdate);
      audioPlayer.addEventListener('ended', playbackEnded);
    });
  }
}

// Waveform für Playback generieren
async function generatePlaybackWaveform(audioUrl) {
  return new Promise((resolve, reject) => {
    const audio = new Audio(audioUrl);
    audio.crossOrigin = 'anonymous';
    
    audio.addEventListener('canplaythrough', async () => {
      try {
        // Temporären AudioContext für Analyse erstellen
        const tempAudioContext = new (window.AudioContext || window.webkitAudioContext)();
        const response = await fetch(audioUrl);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await tempAudioContext.decodeAudioData(arrayBuffer);
        
        // Audio-Daten extrahieren
        const channelData = audioBuffer.getChannelData(0);
        const samples = 700; // Canvas-Breite entsprechend
        const blockSize = Math.floor(channelData.length / samples);
        const waveformData = [];
        
        for (let i = 0; i < samples; i++) {
          let sum = 0;
          let max = 0;
          
          for (let j = 0; j < blockSize; j++) {
            const sample = Math.abs(channelData[i * blockSize + j] || 0);
            sum += sample * sample;
            max = Math.max(max, sample);
          }
          
          const rms = Math.sqrt(sum / blockSize);
          const combined = Math.max(rms * 10, max * 5); // Gleiche Verstärkung wie bei Live-Aufnahme
          waveformData.push(Math.min(combined, 2.0)); // Gleiche Maximalwerte wie bei Live-Aufnahme
        }
        
        tempAudioContext.close();
        resolve(waveformData);
        
      } catch (error) {
        reject(error);
      }
    });
    
    audio.addEventListener('error', reject);
    audio.load();
  });
}

// Playback-Waveform zeichnen
function drawPlaybackWaveform(waveformData) {
  const canvas = audioTrackCanvas;
  const ctx = audioTrackContext;
  const width = canvas.width;
  const height = canvas.height;
  const centerY = height / 2;
  
  // Canvas löschen
  ctx.fillStyle = '#2c3e50';
  ctx.fillRect(0, 0, width, height);
  
  // Mittellinie
  ctx.strokeStyle = '#34495e';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, centerY);
  ctx.lineTo(width, centerY);
  ctx.stroke();
  
  if (waveformData.length === 0) return;
  
  // Waveform zeichnen (blau für Playback)
  ctx.strokeStyle = '#3498db';
  ctx.lineWidth = 2;
  ctx.beginPath();
  
  const step = width / waveformData.length;
  
  for (let i = 0; i < waveformData.length; i++) {
    const x = i * step;
    const amplitude = waveformData[i] * centerY * 0.9; // Gleiche Skalierung wie bei Aufnahme
    const y = centerY - amplitude;
    
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();
  
  // Negative Waveform (gespiegelt)
  ctx.beginPath();
  for (let i = 0; i < waveformData.length; i++) {
    const x = i * step;
    const amplitude = waveformData[i] * centerY * 0.9; // Gleiche Skalierung wie bei Aufnahme
    const y = centerY + amplitude;
    
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();
}

// Playback beendet
function playbackEnded() {
  // Canvas zurücksetzen
  setupCanvas();
  document.getElementById('timeDisplay').textContent = '0s';
}

// Separate Funktion für Playback-Updates
function playbackTimeUpdate() {
  const audioPlayer = document.getElementById("audioPlayback");
  
  if (!audioPlayer.paused && audioPlayer.duration) {
    const progress = audioPlayer.currentTime / audioPlayer.duration;
    
    // Playback-Waveform neu zeichnen (falls vorhanden)
    if (window.currentPlaybackWaveform) {
      drawPlaybackWaveform(window.currentPlaybackWaveform);
    }
    
    const canvas = audioTrackCanvas;
    const ctx = audioTrackContext;
    
    // Cursor-Position basierend auf echtem Audio-Fortschritt
    const cursorX = progress * canvas.width;
    
    // Playback-Cursor (orange) - vertikale Linie
    ctx.strokeStyle = '#f39c12';
    ctx.lineWidth = 3;
    ctx.setLineDash([]);  // Durchgezogene Linie
    ctx.beginPath();
    ctx.moveTo(cursorX, 0);
    ctx.lineTo(cursorX, canvas.height);
    ctx.stroke();
    
    // Optional: Cursor mit Glow-Effekt
    ctx.strokeStyle = 'rgba(243, 156, 18, 0.3)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(cursorX, 0);
    ctx.lineTo(cursorX, canvas.height);
    ctx.stroke();
    
    // Zeit anzeigen - korrekte Audio-Zeit
    document.getElementById('timeDisplay').textContent = 
      audioPlayer.currentTime.toFixed(1) + 's / ' + audioPlayer.duration.toFixed(1) + 's';
  }
}

// Download-Funktion
function downloadRecording(id) {
  const recording = recordings.find(r => r.id === id);
  if (recording) {
    const a = document.createElement("a");
    a.href = recording.url;
    a.download = `${recording.name}.wav`;
    a.click();
  }
}

// Löschen-Funktion
function deleteRecording(id) {
  const index = recordings.findIndex(r => r.id === id);
  if (index > -1) {
    const recording = recordings[index];
    
    // Aus IndexedDB löschen falls persistent
    if (recording.isPersistent && recording.dbId && db) {
      try {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(recording.dbId);
        
        request.onsuccess = () => {
          console.log(`✅ Aufnahme "${recording.name}" aus IndexedDB gelöscht`);
        };
        
        request.onerror = () => {
          console.log('Fehler beim Löschen aus IndexedDB');
        };
      } catch (error) {
        console.log('IndexedDB Löschung fehlgeschlagen:', error);
      }
    }
    
    // Blob URL freigeben und aus Memory-Array entfernen
    URL.revokeObjectURL(recording.url);
    recordings.splice(index, 1);
    updateRecordingsList();
    updateExportButton(); // Export-Button aktualisieren
  }
}

// Metronom-Funktionen
function generateMetronomeClick(frequency = 800, duration = 0.1, isAccent = false) {
  // AudioContext überprüfen und ggf. neu erstellen
  if (!metronomeAudioContext || metronomeAudioContext.state === 'closed') {
    metronomeAudioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  
  // AudioContext reaktivieren falls suspended
  if (metronomeAudioContext.state === 'suspended') {
    metronomeAudioContext.resume().then(() => {
      console.log('Metronom AudioContext reaktiviert');
    }).catch(error => {
      console.error('Fehler beim Reaktivieren des Metronom AudioContext:', error);
      // Bei Fehler neuen Context erstellen
      metronomeAudioContext = new (window.AudioContext || window.webkitAudioContext)();
    });
  }
  
  try {
    const oscillator = metronomeAudioContext.createOscillator();
    const gainNode = metronomeAudioContext.createGain();
    
    // Akzent-Ton (erster Beat) ist höher und lauter
    oscillator.frequency.setValueAtTime(isAccent ? 1200 : frequency, metronomeAudioContext.currentTime);
    oscillator.type = 'sine';
    
    // Sanfte ADSR-Hüllkurve für knackfreien Sound
    const now = metronomeAudioContext.currentTime;
    const attackTime = 0.005;  // 5ms Attack
    const decayTime = 0.02;    // 20ms Decay
    const sustainLevel = isAccent ? 0.15 : 0.1;  // Sustain Level
    const releaseTime = 0.03;  // 30ms Release
    
    // Attack: Sanft von 0 auf Peak
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(isAccent ? 0.25 : 0.18, now + attackTime);
    
    // Decay: Von Peak auf Sustain Level
    gainNode.gain.linearRampToValueAtTime(sustainLevel, now + attackTime + decayTime);
    
    // Sustain: Konstant bis Release beginnt
    const releaseStart = now + duration - releaseTime;
    gainNode.gain.setValueAtTime(sustainLevel, releaseStart);
    
    // Release: Sanft auf 0
    gainNode.gain.linearRampToValueAtTime(0.001, releaseStart + releaseTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);
    
    oscillator.connect(gainNode);
    gainNode.connect(metronomeAudioContext.destination);
    
    oscillator.start(now);
    oscillator.stop(now + duration);
  } catch (error) {
    console.error('Fehler beim Generieren des Metronom-Clicks:', error);
    // Bei Fehler AudioContext neu erstellen und nochmal versuchen
    metronomeAudioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
}

function startMetronome() {
  if (metronomeActive) return;
  
  // AudioContext überprüfen und ggf. neu erstellen vor dem Start
  if (!metronomeAudioContext || metronomeAudioContext.state === 'closed') {
    metronomeAudioContext = new (window.AudioContext || window.webkitAudioContext)();
    console.log('Neuer Metronom AudioContext erstellt');
  }
  
  // AudioContext reaktivieren falls suspended
  if (metronomeAudioContext.state === 'suspended') {
    metronomeAudioContext.resume().then(() => {
      console.log('Metronom AudioContext reaktiviert für Start');
      // Metronom nach Reaktivierung starten
      proceedWithMetronomeStart();
    }).catch(error => {
      console.error('Fehler beim Reaktivieren des Metronom AudioContext:', error);
      // Bei Fehler neuen Context erstellen
      metronomeAudioContext = new (window.AudioContext || window.webkitAudioContext)();
      proceedWithMetronomeStart();
    });
  } else {
    proceedWithMetronomeStart();
  }
}

function proceedWithMetronomeStart() {
  metronomeActive = true;
  currentBeat = 1;
  
  // Intervall basierend auf Notenwert berechnen
  // noteValue: 2=halbe, 4=viertel, 8=achtel
  const noteMultiplier = 4 / noteValue; // viertel=1, halbe=2, achtel=0.5
  const intervalMs = (60 / currentBPM) * 1000 * noteMultiplier;
  
  // Sofortiger erster Beat
  metronomeClick();
  
  metronomeInterval = setInterval(() => {
    metronomeClick();
  }, intervalMs);
  
  // UI aktualisieren
  document.getElementById('metronomeToggle').textContent = '⏸ Stop';
  document.getElementById('metronomeToggle').style.background = '#e74c3c';
}

function stopMetronome() {
  if (!metronomeActive) return;
  
  metronomeActive = false;
  
  if (metronomeInterval) {
    clearInterval(metronomeInterval);
    metronomeInterval = null;
  }
  
  currentBeat = 1;
  
  // UI zurücksetzen
  document.getElementById('metronomeToggle').textContent = '▶ Start';
  document.getElementById('metronomeToggle').style.background = '#27ae60';
  document.getElementById('metronomeIndicator').style.background = '#ccc';
  document.getElementById('beatCounter').textContent = `${beatLength}/${noteValue}`;
}

function metronomeClick() {
  const isAccent = currentBeat === 1;
  generateMetronomeClick(800, 0.1, isAccent);
  
  // Visueller Indikator
  const indicator = document.getElementById('metronomeIndicator');
  indicator.style.background = isAccent ? '#e74c3c' : '#f39c12';
  indicator.style.transform = 'scale(1.2)';
  
  setTimeout(() => {
    indicator.style.background = '#ccc';
    indicator.style.transform = 'scale(1)';
  }, 100);
  
  // Beat-Counter aktualisieren - zeigt statische Taktart an
  document.getElementById('beatCounter').textContent = `${beatLength}/${noteValue}`;
  
  currentBeat = currentBeat >= beatLength ? 1 : currentBeat + 1;
}

function updateBPM(newBPM) {
  currentBPM = Math.max(40, Math.min(200, newBPM));
  document.getElementById('bpmInput').value = currentBPM;
  
  // Metronom neu starten falls aktiv
  if (metronomeActive) {
    stopMetronome();
    setTimeout(() => startMetronome(), 50);
  }
}

function updateNoteValue(newNoteValue) {
  noteValue = parseInt(newNoteValue);
  console.log(`Notenwert geändert: ${getNoteSymbol(noteValue)}`);
  
  // Taktart-Anzeige aktualisieren
  document.getElementById('beatCounter').textContent = `${beatLength}/${noteValue}`;
  
  // Metronom neu starten falls aktiv
  if (metronomeActive) {
    stopMetronome();
    setTimeout(() => startMetronome(), 50);
  }
}

function updateBeatLength(newBeatLength) {
  beatLength = Math.max(1, Math.min(19, parseInt(newBeatLength)));
  document.getElementById('beatLengthInput').value = beatLength;
  
  // Taktart-Anzeige aktualisieren
  document.getElementById('beatCounter').textContent = `${beatLength}/${noteValue}`;
  
  console.log(`Taktlänge geändert: ${beatLength} Schläge`);
  
  // Metronom neu starten falls aktiv
  if (metronomeActive) {
    stopMetronome();
    setTimeout(() => startMetronome(), 50);
  }
}

function getNoteSymbol(noteValue) {
  switch(noteValue) {
    case 2: return '♩ Halbe';
    case 4: return '♪ Viertel';
    case 8: return '♫ Achtel';
    default: return '♪ Viertel';
  }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  setupCanvas();
  
  // IndexedDB initialisieren und gespeicherte Aufnahmen laden
  initIndexedDB().then(async (dbReady) => {
    if (dbReady) {
      console.log('IndexedDB bereit für persistente Speicherung');
      
      // Gespeicherte Aufnahmen laden
      const loadedCount = await loadSavedRecordings();
      
      if (loadedCount > 0) {
        // Status-Meldung für 3 Sekunden anzeigen
        const statusElement = document.getElementById('recordingStatus');
        const originalText = statusElement.textContent;
        const originalColor = statusElement.style.color;
        
        statusElement.textContent = `📦 ${loadedCount} Aufnahmen wiederhergestellt`;
        statusElement.style.color = '#3498db';
        
        setTimeout(() => {
          statusElement.textContent = originalText;
          statusElement.style.color = originalColor;
        }, 3000);
      }
    }
  }).catch(() => {
    console.log('IndexedDB nicht verfügbar - Memory-Modus');
  });
  
  loadAudioDevices(); // Audio-Geräte beim Start laden
  
  document.getElementById("startBtn").addEventListener("click", startRecording);
  document.getElementById("stopBtn").addEventListener("click", stopRecording);
  
  // Audio Input Device Selection Event Listener
  document.getElementById("audioInputSelect").addEventListener("change", (e) => {
    selectedDeviceId = e.target.value || null;
    console.log("Ausgewähltes Audio-Gerät:", selectedDeviceId);
    
    // Falls Monitoring aktiv ist, stoppe es bei Gerätewechsel
    if (isMonitoring && !isRecording) {
      console.log("Monitoring gestoppt aufgrund Gerätewechsel");
      
      // Monitoring stoppen
      isMonitoring = false;
      
      // Animation stoppen
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
      
      // Audio-Ressourcen freigeben
      if (processor) {
        processor.disconnect();
      }
      if (gainNode) {
        gainNode.disconnect();
      }
      if (analyser) {
        analyser.disconnect();
      }
      if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
      }
      if (audioContext) {
        audioContext.close();
      }
      
      processor = null;
      gainNode = null;
      analyser = null;
      currentStream = null;
      
      // UI zurücksetzen
      document.getElementById("startBtn").textContent = 'Aufnahme starten';
      document.getElementById("startBtn").style.backgroundColor = '';
      document.getElementById('gainBar').style.width = '0%';
      document.getElementById('timeDisplay').textContent = '0s';
      
      // Canvas zurücksetzen
      setupCanvas();
      waveformData = [];
    }
    
    // Zeige Geräte-Info an
    if (selectedDeviceId) {
      const selectedDevice = availableDevices.find(d => d.deviceId === selectedDeviceId);
      if (selectedDevice) {
        document.getElementById('recordingStatus').textContent = 
          `Bereit für Aufnahme mit: ${selectedDevice.label}`;
        document.getElementById('recordingStatus').style.color = '#3498db';
      }
    } else {
      document.getElementById('recordingStatus').textContent = 'Bereit für Aufnahme mit Standard-Mikrofon';
      document.getElementById('recordingStatus').style.color = '#27ae60';
    }
  });
  
  // Refresh Devices Button Event Listener (für Input und Output)
  document.getElementById("refreshDevices").addEventListener("click", () => {
    document.getElementById('recordingStatus').textContent = 'Lade Audio-Geräte...';
    document.getElementById('recordingStatus').style.color = '#f39c12';
    loadAudioDevices();
  });
  
  // Audio Output Device Selection Event Listener
  document.getElementById("audioOutputSelect").addEventListener("change", (e) => {
    selectedOutputId = e.target.value || null;
    console.log("Ausgewähltes Audio-Ausgabegerät:", selectedOutputId);
    
    // Audio-Player sofort auf neuen Ausgang umstellen
    const audioPlayer = document.getElementById("audioPlayback");
    setAudioOutput(audioPlayer, selectedOutputId);
    
    // Zeige Ausgang-Info an
    if (selectedOutputId) {
      const selectedOutput = availableOutputs.find(d => d.deviceId === selectedOutputId);
      if (selectedOutput) {
        console.log(`Audio-Ausgang gewechselt zu: ${selectedOutput.label}`);
      }
    } else {
      console.log('Audio-Ausgang gewechselt zu: Standard-Lautsprecher');
    }
  });
  
  // Gain Slider Event Listener
  document.getElementById("gainSlider").addEventListener("input", (e) => {
    const gainPercent = parseInt(e.target.value);
    inputGain = gainPercent / 100; // Konvertiere zu 0.0 - 2.0 Range
    
    // Update Gain-Node falls aktiv
    if (gainNode) {
      gainNode.gain.value = inputGain;
    }
    
    // Update Anzeige
    document.getElementById("gainValue").textContent = gainPercent + '%';
    
    // Farbkodierung der Anzeige
    const gainValueElement = document.getElementById("gainValue");
    if (gainPercent > 90) {
      gainValueElement.style.color = '#e74c3c'; // Rot bei sehr hohem Gain
    } else if (gainPercent > 80) {
      gainValueElement.style.color = '#f39c12'; // Orange bei hohem Gain
    } else {
      gainValueElement.style.color = '#27ae60'; // Grün bei normalem Gain
    }
  });
  
  // Metronom Event Listeners
  document.getElementById("metronomeToggle").addEventListener("click", () => {
    if (metronomeActive) {
      stopMetronome();
    } else {
      startMetronome();
    }
  });
  
  document.getElementById("bpmInput").addEventListener("input", (e) => {
    const newBPM = parseInt(e.target.value);
    if (newBPM && newBPM >= 40 && newBPM <= 200) {
      updateBPM(newBPM);
    }
  });
  
  // Notenwert Auswahl Event Listener
  document.getElementById("noteValueSelect").addEventListener("change", (e) => {
    updateNoteValue(e.target.value);
  });
  
  // Taktlänge Eingabe Event Listener
  document.getElementById("beatLengthInput").addEventListener("input", (e) => {
    const newBeatLength = parseInt(e.target.value);
    if (newBeatLength && newBeatLength >= 1 && newBeatLength <= 19) {
      updateBeatLength(newBeatLength);
    }
  });
  
  // BPM mit +/- Buttons (falls gewünscht)
  document.getElementById("bpmInput").addEventListener("keydown", (e) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      updateBPM(currentBPM + 1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      updateBPM(currentBPM - 1);
    }
  });
  
  // Export-Button Event Listener
  document.getElementById("exportAllBtn").addEventListener("click", exportAllRecordings);
  
  // Window Resize Event für responsive Canvas
  window.addEventListener('resize', () => {
    resizeCanvas();
  });
  
  // Initial Canvas-Größe nach DOM-Load
  setTimeout(() => {
    resizeCanvas();
  }, 100);
  
  document.getElementById('recordingStatus').textContent = 'Bereit für Aufnahme';
  document.getElementById('recordingStatus').style.color = '#27ae60';
});
