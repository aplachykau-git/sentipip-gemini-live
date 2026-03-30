const COLOR_MAP = {
    'Anger': '#FF0000',           // Pure Red
    'Joy': '#FFD700',             // Gold
    'Joyful': '#F0E68C',          // Khaki
    'Sarcasm': '#8A2BE2',         // BlueViolet
    'Excitement': '#FF4500',      // OrangeRed
    'Whispering': '#00CED1',      // DarkTurquoise
    'Shouting': '#FF1493',        // DeepPink
    'Breathless': '#20B2AA',      // LightSeaGreen
    'Fast-paced': '#FF8C00',      // DarkOrange
    'Slang': '#32CD32',           // LimeGreen
    'Technical': '#4682B4',       // SteelBlue
    'Laughter': '#FF69B4',        // HotPink
    'Joke': '#FFA500',            // Orange
    'Self-correction': '#8B4513', // SaddleBrown
    'Calmist': '#ADD8E6',         // LightBlue
    'Calm': '#87CEEB',            // SkyBlue
    'Curiosity': '#9370DB',       // MediumPurple
    'Query': '#00BFFF',           // DeepSkyBlue
    'Uncertainty': '#BDB76B',     // DarkKhaki
    'Distress': '#8B0000',        // DarkRed
    'Hesitation': '#D8BFD8',      // Thistle
    'Emphasis': '#DC143C',        // Crimson
    'Relief': '#2E8B57',          // SeaGreen
    'Disappointed': '#708090',    // SlateGray
    'Relaxed': '#98FB98',         // PaleGreen
    'Sadness': '#00008B',         // DarkBlue
    'Anxiety': '#FF7F50',         // Coral
    'Fear': '#4B0082',            // Indigo
    'Concern': '#D2691E',         // Chocolate
    'Confusion': '#BA55D3',       // MediumOrchid
    'Thoughtful': '#483D8B',      // DarkSlateBlue
    'Information': '#1E90FF',     // DodgerBlue
    'Observation': '#5F9EA0',     // CadetBlue
    'Realization': '#FFDAB9',     // PeachPuff
    'Analysis': '#40E0D0',        // Turquoise
    'Politeness': '#FFB6C1',      // LightPink
    'Direct': '#00FA9A',          // MediumSpringGreen
    'Determination': '#B22222',   // FireBrick
    'Default': '#808080',         // Gray
    'Neutral': '#A9A9A9'          // DarkGray
};

const startBtn = document.getElementById('start-btn');
const pipBtn = document.getElementById('pip-btn');
const statusEl = document.getElementById('status');
const displayEl = document.getElementById('subtitles-display');
const tagEl = document.getElementById('emotion-tag');
const themeSelect = document.getElementById('pip-theme');

// Initialize UI theme based on dropdown
if (themeSelect) {
    document.body.setAttribute('data-theme', themeSelect.value);
    themeSelect.addEventListener('change', () => {
        document.body.setAttribute('data-theme', themeSelect.value);
    });
}

const canvas = document.getElementById('canvas-source');
const ctx = canvas.getContext('2d');
const video = document.getElementById('pip-video');

let currentText = "";
let currentTagColor = '#007AFF';
let displayTimeout = null;
let lastNotifiedText = "";
let socket = null;
let audioContext = null;
let isStarted = false;

// ─── FIFO Sentence Queue for PiP ─────────────────────────────────────────────
// Each item: { plChunks: string[], enChunks: string[] }
let sentenceQueue = [];
let isDisplayingSentence = false;
const CHUNK_DURATION_MS = 3000; // ms per visual chunk
const BETWEEN_SENTENCE_PAUSE_MS = 600; // pause between sentences

// Currently displayed in PiP
let pipPlText = "";
let pipEnText = "";

/**
 * Split a long text string into an array of chunks that each fit within maxPx pixels.
 * ctx.font must already be set before calling.
 */
function splitIntoChunks(text, maxPx) {
    if (!text || !text.trim()) return [''];
    const safe = text.replace(/[\r\n]+/g, ' ').trim();
    const words = safe.split(/\s+/);
    const chunks = [];
    let current = "";
    for (const w of words) {
        const test = current ? current + " " + w : w;
        if (ctx.measureText(test).width > maxPx) {
            if (current) chunks.push(current);
            current = w;
        } else {
            current = test;
        }
    }
    if (current) chunks.push(current);
    return chunks;
}

/**
 * Add a completed sentence to the FIFO queue and kick off the display loop.
 */
function enqueueSentence(plFull, enFull) {
    if (!plFull && !enFull) return;

    const fontSize = 48;
    ctx.font = `bold ${fontSize}px sans-serif`;
    const maxPx = canvas.width - 80; // 40px padding each side

    const plChunks = splitIntoChunks(plFull || '', maxPx);
    const enChunks = splitIntoChunks(enFull || '', maxPx);

    // Pair up chunks so pl[i] displays with en[i]
    const len = Math.max(plChunks.length, enChunks.length);
    while (plChunks.length < len) plChunks.push('');
    while (enChunks.length < len) enChunks.push('');

    sentenceQueue.push({ plChunks, enChunks });
    processSentenceQueue();
}

/**
 * Pick the next sentence from the queue and display its chunks sequentially.
 * Calls itself after each sentence is done (with a short pause).
 * Safe to call multiple times — guards with isDisplayingSentence.
 */
function processSentenceQueue() {
    if (isDisplayingSentence || sentenceQueue.length === 0) return;

    isDisplayingSentence = true;
    const { plChunks, enChunks } = sentenceQueue.shift();
    let chunkIndex = 0;

    function showChunk(index) {
        pipPlText = plChunks[index] || '';
        pipEnText = enChunks[index] || '';

        if (index < plChunks.length - 1) {
            // More chunks in this sentence — advance after CHUNK_DURATION_MS
            setTimeout(() => showChunk(index + 1), CHUNK_DURATION_MS);
        } else {
            // Last chunk of this sentence — hold, then move to next sentence
            setTimeout(() => {
                // Clear screen briefly between sentences only if next sentence is waiting
                if (sentenceQueue.length > 0) {
                    pipPlText = '';
                    pipEnText = '';
                }
                isDisplayingSentence = false;
                if (sentenceQueue.length > 0) {
                    setTimeout(processSentenceQueue, BETWEEN_SENTENCE_PAUSE_MS);
                } else {
                    // Nothing queued — hold last chunk visible, clear after 3s of silence
                    setTimeout(() => {
                        if (!isDisplayingSentence) {
                            pipPlText = '';
                            pipEnText = '';
                        }
                    }, 3000);
                }
            }, CHUNK_DURATION_MS);
        }
    }

    showChunk(0);
}

/**
 * Sends data to the local Ulzani TC 0001 device
 */
async function notifyDevice(text, tag = 'Default') {
    const color = COLOR_MAP[tag] || COLOR_MAP['Default'];
    try {
        await fetch(`http://${CONFIG.DEVICE_IP}/api/notify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: text.trim(),
                color: color,
                duration: 4
            })
        });
    } catch (e) {
        console.warn("Device notification failed:", e);
    }
}

/**
 * Renders the subtitles onto the canvas for the PiP stream.
 * Features a white background with a black "pill" box behind the text.
 */
function drawCanvas() {
    if (!isStarted) return;

    const isBlackTheme = themeSelect && themeSelect.value === 'black';

    // 1. Fill the entire canvas with the selected background
    ctx.fillStyle = isBlackTheme ? "black" : "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (!pipPlText && !pipEnText) {
        requestAnimationFrame(drawCanvas);
        return;
    }

    // 2. Text styling
    const fontSize = 48;
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const paddingH = 40;
    const paddingV = 20;
    const lineSpacing = 10;

    const showPl = pipPlText || " ";
    const showEn = pipEnText || " ";

    const textStartY = (canvas.height - (fontSize * 2) - lineSpacing) / 2;

    try {
        // Polish — dark red on white theme, bright red on black theme
        ctx.fillStyle = isBlackTheme ? "#FF2020" : "#8B0000";
        ctx.fillText(showPl, canvas.width / 2, textStartY + (fontSize / 2));

        // English — black (light theme) / white (dark theme)
        ctx.fillStyle = isBlackTheme ? "#ffffff" : "#000000";
        ctx.fillText(showEn, canvas.width / 2, textStartY + fontSize + lineSpacing + (fontSize / 2));
    } catch (e) {
        console.error("Canvas draw error:", e);
    }

    requestAnimationFrame(drawCanvas);
}

startBtn.onclick = async () => {
    if (isStarted) { location.reload(); return; }

    try {
        // Request microphone access
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        isStarted = true;
        startBtn.innerText = "Stop Session";

        // Route canvas stream to hidden video element for PiP
        video.srcObject = canvas.captureStream();
        drawCanvas();
        video.play();

        // Initialize Gemini Live WebSocket
        const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${CONFIG.API_KEY}`;
        socket = new WebSocket(url);

        socket.onopen = () => {
            statusEl.innerText = "CONNECTED";
            pipBtn.disabled = false;

            // Send initial model configuration
            socket.send(JSON.stringify({
                setup: {
                    model: CONFIG.MODEL_NAME,
                    system_instruction: {
                        parts: [{
                            text: [
                                    "You are an expert AI interpreter for a live subtitle feed.",
                                    "",
                                    "TASK:",
                                    "1. Translate audio to Polish and English: [Polish | English].",
                                    "2. Detect Emotional Tone (e.g., [Anger], [Joy], [Joyful] etc.).",
                                    "3. Detect Physical Characteristics (e.g., [Whispering], [Shouting], [Fast-paced] etc.).",
                                    "4. Detect Cognitive & Linguistic Nuances (e.g., [Slang], [Technical], [Self-correction], etc.).",
                                    "",
                                    "RULES:",
                                    "- Output Format: [Tag] Polish | English.",
                                    "- ALWAYS start with a [Tag] if it is not neutral.",
                                    "- Use ONLY ONE most relevant tag.",
                                    "- Keep translations very concise.",
                                    "- Tags must be in English for the parser."
                                ].join('\n')
                        }]
                    },
                    generation_config: { response_modalities: ["AUDIO"] },
                    input_audio_transcription: {},
                    output_audio_transcription: {}
                }
            }));
            startAudioStreaming(stream);
        };

        socket.onmessage = async (event) => {
            const data = JSON.parse(event.data instanceof Blob ? await event.data.text() : event.data);
            const outputTranscript = data.serverContent?.outputTranscription || data.server_content?.output_transcription;

            if (outputTranscript?.text) {
                currentText += outputTranscript.text;

                // Update main UI display with PiP-matching colors
                // Wrapped in ONE outer span so the flex container keeps its original single-child layout
                const rawClean = currentText.replace(/\[.*?\]/g, '').trim();
                const rawParts = rawClean.split(/\||\n/);
                const plText = rawParts[0]?.trim() || '';
                const enText = rawParts.slice(1).join(' ').trim();
                const isBlack = themeSelect && themeSelect.value === 'black';
                const plColor = isBlack ? '#FF2020' : '#8B0000';
                const inner = plText && enText
                    ? `<span style="color:${plColor}">${plText}</span>\n${enText}`
                    : plText
                        ? `<span style="color:${plColor}">${plText}</span>`
                        : enText;
                displayEl.innerHTML = inner ? `<span>${inner}</span>` : '';

                const tagMatch = currentText.match(/\[(.*?)\]/);
                const cleanText = currentText.replace(/\[.*?\]/g, '').trim();

                // ── Determine if a sentence is ready to be enqueued ──────────
                const hasPipe = cleanText.includes('|');
                const isSentenceComplete = /[.!?]\s*$/.test(cleanText);
                // New tag arrived while buffer had content → previous phrase ended
                const newTagArrived = (currentText.match(/\[.*?\]/g) || []).length > 1;
                // Safety fallback for very long uninterrupted speech
                const isTooLong = cleanText.length > 400;

                const shouldEnqueue = hasPipe && (isSentenceComplete || newTagArrived || isTooLong);

                if (shouldEnqueue) {
                    const parts = cleanText.split(/\||\n/);
                    const plFull = parts[0] ? parts[0].trim() : '';
                    const enFull = parts.slice(1).join(' ').trim();

                    enqueueSentence(plFull, enFull);

                    // Reset the accumulation buffer
                    currentText = "";
                    lastNotifiedText = "";
                }

                // ── Emotion tag & device notification ───────────────────────
                if (cleanText !== lastNotifiedText && (isSentenceComplete || (cleanText.length > 20 && cleanText.length % 40 === 0))) {
                    const currentTag = tagMatch ? tagMatch[1] : 'Neutral';
                    const matchingKey = Object.keys(COLOR_MAP).find(k => k.toLowerCase() === currentTag.toLowerCase());
                    currentTagColor = matchingKey ? COLOR_MAP[matchingKey] : COLOR_MAP['Default'];

                    tagEl.innerText = `${currentTag}`;
                    tagEl.style.color = currentTagColor;
                    tagEl.style.borderColor = currentTagColor;
                    tagEl.style.boxShadow = `0 0 25px ${currentTagColor}50`;
                    tagEl.classList.add('visible');

                    notifyDevice(currentTag, currentTag);
                    lastNotifiedText = cleanText;
                }

                // ── Clear main UI display after 4s of silence ────────────────
                if (displayTimeout) clearTimeout(displayTimeout);
                displayTimeout = setTimeout(() => {
                    // If buffer still has something partial with a pipe, enqueue before clearing
                    const partial = currentText.replace(/\[.*?\]/g, '').trim();
                    if (partial.includes('|')) {
                        const parts = partial.split(/\||\n/);
                        enqueueSentence(parts[0]?.trim() || '', parts.slice(1).join(' ').trim());
                    }
                    currentText = "";
                    displayEl.innerHTML = '';
                    tagEl.classList.remove('visible');
                    currentTagColor = '#007AFF';
                    lastNotifiedText = "";
                }, 4000);
            }
        };
    } catch (e) {
        console.error(e);
        statusEl.innerText = "ERROR: CHECK CONSOLE";
    }
};

/**
 * Captures audio from mic and sends PCM chunks to the WebSocket
 */
function startAudioStreaming(stream) {
    audioContext = new AudioContext({ sampleRate: 16000 });
    const source = audioContext.createMediaStreamSource(stream);
    const processor = audioContext.createScriptProcessor(2048, 1, 1);

    source.connect(processor);
    processor.connect(audioContext.destination);

    processor.onaudioprocess = (e) => {
        if (!socket || socket.readyState !== 1) return;

        const inputData = e.inputBuffer.getChannelData(0);
        const pcm16 = new Int16Array(inputData.length);

        // Convert Float32 to Int16 for Gemini
        for (let i = 0; i < inputData.length; i++) {
            const s = Math.max(-1, Math.min(1, inputData[i]));
            pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        // Send as Base64 JSON
        socket.send(JSON.stringify({
            realtime_input: {
                audio: {
                    mime_type: "audio/pcm;rate=16000",
                    data: btoa(String.fromCharCode(...new Uint8Array(pcm16.buffer)))
                }
            }
        }));
    };
}

// Trigger the browser's Picture-in-Picture mode
pipBtn.onclick = () => video.requestPictureInPicture();
