# 📸 Media Gallery App

A high-performance media gallery application with support for photos (including HEIC format) and videos. Features adaptive video streaming, thumbnail generation, and an Instagram/TikTok-style reel viewer.

## ✨ Features

- **Photo Support**: HEIC, JPEG, PNG, GIF, WebP
- **Video Support**: MP4, MOV, AVI, MKV with adaptive quality streaming (720p, 1080p, 4K)
- **Performance Optimized**: 
  - Automatic thumbnail generation and caching
  - Lazy loading with infinite scroll
  - HTTP Range requests for video streaming
- **User-Friendly Interface**:
  - Grid gallery view
  - Full-screen reel/modal viewer
  - Keyboard navigation (←/→ arrows, Escape)
  - Mouse wheel and swipe support
  - Quality selector for videos

## 🚀 Quick Start

### Prerequisites

- **Node.js** (v14 or higher)
- **FFmpeg** (required for video transcoding)

Install FFmpeg:
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install ffmpeg

# macOS
brew install ffmpeg

# Windows (using Chocolatey)
choco install ffmpeg
```

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/Rabin-Sharma/share-your-galary.git
cd share-your-galary
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure media directory**

Edit `server.js` and update the `MEDIA_DIR` path to your media folder:
```javascript
const MEDIA_DIR = '/path/to/your/media/folder';
```

4. **Run the server**
```bash
node server.js
```

The server will start on `http://localhost:8000`

## 🌐 Share Your Gallery Using ngrok

To share your locally hosted gallery with others over the internet:

### 1. Install ngrok

**Linux/macOS:**
```bash
# Download ngrok
wget https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.tgz
tar -xvzf ngrok-v3-stable-linux-amd64.tgz
sudo mv ngrok /usr/local/bin/
```

**Or install via package manager:**
```bash
# Ubuntu/Debian
sudo snap install ngrok

# macOS
brew install ngrok/ngrok/ngrok
```

**Windows:**
- Download from [ngrok.com/download](https://ngrok.com/download)
- Extract and add to PATH

### 2. Sign up and authenticate

1. Create a free account at [ngrok.com](https://ngrok.com)
2. Get your auth token from the dashboard
3. Authenticate ngrok:

```bash
ngrok authtoken YOUR_AUTH_TOKEN
```

### 3. Start ngrok tunnel

**Make sure your app is running first:**
```bash
node server.js
```

**In a new terminal, start ngrok:**
```bash
ngrok http 8000
```

You'll see output like:
```
Session Status                online
Account                       Your Name (Plan: Free)
Forwarding                    https://abcd-1234-5678.ngrok-free.app -> http://localhost:8000
```

### 4. Share the URL

Copy the `https://` URL (e.g., `https://abcd-1234-5678.ngrok-free.app`) and share it with anyone! They can access your gallery from anywhere.

**⚠️ Security Note:**
- The ngrok URL is public - anyone with the link can access your gallery
- Free ngrok URLs change each time you restart ngrok
- For permanent URLs, consider ngrok's paid plans or deploy to a cloud service

## 📂 Project Structure

```
galary-app/
├── server.js           # Express server with streaming endpoints
├── package.json        # Dependencies and project info
├── public/
│   └── index.html     # Frontend gallery interface
└── thumbnails/        # Auto-generated thumbnail cache
```

## 🎮 Usage

### Keyboard Shortcuts
- `←` Left Arrow: Previous item
- `→` Right Arrow: Next item
- `Esc`: Close reel viewer
- `Mouse Wheel`: Navigate between items

### Video Quality Selection
- Click the quality dropdown (720p/1080p/4K) while watching videos
- Videos automatically start at 720p for faster loading
- Switch to higher quality as needed

## 🛠️ Configuration

### Change Port
Edit `server.js`:
```javascript
const PORT = 8000; // Change to your preferred port
```

### Adjust Thumbnail Size
Edit `server.js`:
```javascript
.resize(300, 300, { fit: 'cover' }) // Adjust dimensions
```

### Items Per Page
Edit `server.js`:
```javascript
const limit = parseInt(req.query.limit) || 20; // Change default
```

## 📦 Dependencies

- **express**: Web server framework
- **sharp**: Image processing and thumbnail generation
- **heic-convert**: HEIC to JPEG conversion
- **fluent-ffmpeg**: Video transcoding wrapper for FFmpeg
- **node-cache**: In-memory caching

## 🐛 Troubleshooting

**FFmpeg errors:**
- Ensure FFmpeg is installed: `ffmpeg -version`
- Check FFmpeg is in PATH

**HEIC images not showing:**
- Install `libheif` on Linux: `sudo apt install libheif-dev`

**Videos not playing:**
- Check browser console for errors
- Try switching video quality
- Ensure FFmpeg supports your video format

## 📄 License

ISC

## 👤 Author

Rabin Sharma

---

**Enjoy sharing your memories! 📸🎥**
