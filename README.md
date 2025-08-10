# Real-Time Translation Chat MVP 🌍💬

A real-time, two-user translation chat application that enables seamless conversations between people speaking different languages.

## ✨ Features

- **Real-time voice translation** between two users
- **Text chat with instant translation**
- **Live status indicators** (listening, processing, speaking)
- **WebSocket-based real-time communication**
- **Beautiful, responsive UI** with glassmorphism design
- **13+ language support** including English, Spanish, French, German, Chinese, Arabic, Bengali, and more
- **Voice recognition and synthesis** using browser APIs
- **Room-based system** with unique codes for easy sharing
- **Cross-browser compatibility**

## 🚀 Quick Start

### Prerequisites

- Node.js 16+ installed
- Modern web browser with microphone access
- Internet connection for translation APIs

### Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the backend server:**
   ```bash
   npm run server
   ```
   The server will start on `http://localhost:3001`

3. **Start the frontend development server:**
   ```bash
   npm run dev
   ```
   The app will be available at `http://localhost:5173`

### Usage

1. **Open the app** in your browser
2. **Enter your name** and select your language
3. **Create a new room** or **join an existing room** with a code
4. **Share the room code** with someone else
5. **Start talking!** Click the microphone button to record voice messages
6. **Type messages** in the text input for text-based translation
7. **Watch real-time status** indicators to see when the other person is listening/speaking

## 🏗️ Architecture

### Frontend (Vue.js)
- **Vue 3** with Composition API
- **TailwindCSS** for styling
- **Socket.io-client** for real-time communication
- **Web Speech API** for voice recognition and synthesis
- **Fetch API** for translation services

### Backend (Node.js)
- **Express.js** server
- **Socket.io** for WebSocket communication
- **Room management** system
- **User session** handling
- **Message routing** and broadcasting

### Translation Services
- **MyMemory API** (free tier: 10,000 words/day)
- **Fallback phrase dictionary** for common expressions
- **Multiple API support** ready for expansion

## 🎯 How It Works

### Real-Time Communication Flow

1. **User A speaks** → Speech recognition converts to text
2. **Text is translated** using translation API
3. **Translation is sent** to User B via WebSocket
4. **User B receives translation** → Text-to-speech plays audio
5. **Status updates** are broadcast in real-time
6. **Process repeats** for bidirectional conversation

## 🔧 Supported Languages

- 🇺🇸 English (en-US)
- 🇪🇸 Spanish (es-ES)
- 🇫🇷 French (fr-FR)
- 🇩🇪 German (de-DE)
- 🇮🇹 Italian (it-IT)
- 🇵🇹 Portuguese (pt-PT)
- 🇷🇺 Russian (ru-RU)
- 🇯🇵 Japanese (ja-JP)
- 🇰🇷 Korean (ko-KR)
- 🇨🇳 Chinese (zh-CN)
- 🇸🇦 Arabic (ar-SA)
- 🇮🇳 Hindi (hi-IN)
- 🇧🇩 Bengali (bn-BD)

## 📱 Browser Compatibility

- ✅ Chrome 60+
- ✅ Firefox 55+
- ✅ Safari 14+
- ✅ Edge 79+
- ⚠️ Mobile browsers (limited voice recognition support)

## 🐛 Troubleshooting

### Common Issues

**Microphone not working:**
- Ensure browser has microphone permissions
- Check if HTTPS is enabled (required for production)
- Try refreshing the page

**Translation not working:**
- Check internet connection
- Verify translation API limits
- Try common phrases from fallback dictionary

**Connection issues:**
- Ensure backend server is running
- Check firewall settings
- Verify WebSocket connection in browser dev tools

---

**Built with ❤️ for breaking down language barriers and connecting people worldwide** 🌍