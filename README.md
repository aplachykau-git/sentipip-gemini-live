# SentiPiP 
**(Sentiment Captions in picture in picture mode)**

📊 [Slide Deck](https://docs.google.com/presentation/d/1oWTQgHHrihAcC9z6wssfV0UNLsILl5PivRBes3aJJaM/edit?usp=sharing) · 🎬 [Demo Video](https://www.youtube.com/watch?v=Ejed2EYRLs4)

A browser-based live subtitle application that streams audio via microphone to the Gemini Multimodal Live API for real-time translation and emotional tagging, it provides bilingual [PL+EN] Picture-in-Picture (PiP) subtitles and forwards emotional tone data to a local hardware companion device.

## Features
- **Bilingual Subtitles:** Detects and translates audio to Polish and English simultaneously.
- **Multilingual Speech Detection:** You can speak in any language or switch between multiple languages on the fly, and the system will automatically detect and translate them without requiring manual configuration.
- **Dynamic PiP Display:** Shows subtitles in a floating Picture-in-Picture window, broken down into readable chunks for long sentences.
- **Emotion & Tone Tagging:** The model attaches emotional metadata to the speech (e.g., `[Anger]`, `[Amussed]`, `[Joyful]`).
- **Lightning-Fast Response:** Leverages the Gemini Multimodal Live API via WebSocket to provide ultra-low latency, real-time feedback.
- **Hardware Integration:** Forwards emotional tags to a local hardware device (like Ulzani TC 0001) for ambient LED color syncing.

## Architecture
- `index.html`: The core Javascript app. Manages the Gemini WebSocket connection, audio recording, Canvas drawing, PiP text chunking and cycling, and sends API calls to the hardware device.

## Installation & Setup

1. **Serve the Local Application:**
   Start a local HTTP server in the project root:
   \`\`\`bash
   python3 -m http.server 8001
   \`\`\`
   Access the app at `http://localhost:8001`.

2. **Browser Requirements:**
   To use the PiP feature effectively, make sure you install a **Picture-in-Picture extension** in Google Chrome (or use the built-in browser PiP functionality).

3. **External Hardware Setup (Optional):**
   To sync emotions with an external LED metric display/clock (Ulanzi TC001):
   - Flash the device with the [AWTRIX 3 firmware](https://blueforcer.github.io/awtrix3/#/).
   - Ensure the UI device (your laptop) and the hardware display are connected to the **same local area network** (e.g., a mobile hotspot).
   - Update `DEVICE_IP` in `index.html` to match your hardware's local IP address.

## Usage
1. Open the app at `http://localhost:8001` (ensure you allow microphone access if prompted).
2. Click **Start Session**.
3. (Optional) Click **Enter Picture-in-Picture** to pop out the subtitle UI.
4. Speak clearly. The app will record your voice, ping Gemini, and render the text in chunks while sending emotional color pulses to your display.
