const express = require("express");
const fs = require("fs");
const path = require("path");
const convert = require("heic-convert");
const sharp = require("sharp");
const NodeCache = require("node-cache");
const ffmpeg = require("fluent-ffmpeg");
const app = express();

const mediaFolder = "/media/rabin/Shared1/Bhedetar Tour 2082";
const thumbnailFolder = path.join(__dirname, "thumbnails");
const cache = new NodeCache({ stdTTL: 3600 }); // Cache for 1 hour

// Ensure thumbnail directory exists
if (!fs.existsSync(thumbnailFolder)) {
  fs.mkdirSync(thumbnailFolder, { recursive: true });
}

app.use(express.static("public"));

// Serve thumbnails
app.get("/thumbnail/:filename", async (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(mediaFolder, filename);
  const ext = path.extname(filename).toLowerCase();
  
  // Generate a safe thumbnail filename
  const thumbnailName = filename.replace(/[^a-zA-Z0-9.-]/g, '_') + '.jpg';
  const thumbnailPath = path.join(thumbnailFolder, thumbnailName);

  try {
    // Check if thumbnail already exists
    if (fs.existsSync(thumbnailPath)) {
      return res.sendFile(thumbnailPath);
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).send("File not found");
    }

    let imageBuffer;

    // Handle HEIC conversion
    if (ext === ".heic") {
      const inputBuffer = fs.readFileSync(filePath);
      imageBuffer = await convert({
        buffer: inputBuffer,
        format: "JPEG",
        quality: 0.8
      });
    } else if ([".jpg", ".jpeg", ".png", ".gif"].includes(ext)) {
      imageBuffer = fs.readFileSync(filePath);
    } else if ([".mp4", ".mov", ".webm"].includes(ext)) {
      // For videos, return a placeholder icon
      return res.redirect('/video-placeholder.svg');
    } else {
      return res.status(400).send("Unsupported file type");
    }

    // Generate thumbnail (300x300)
    const thumbnail = await sharp(imageBuffer)
      .resize(300, 300, { fit: 'cover', position: 'center' })
      .jpeg({ quality: 80 })
      .toBuffer();

    // Save thumbnail to disk
    fs.writeFileSync(thumbnailPath, thumbnail);

    res.set("Content-Type", "image/jpeg");
    res.send(thumbnail);
  } catch (error) {
    console.error("Error generating thumbnail:", error);
    res.status(500).send("Error generating thumbnail");
  }
});

// Serve HEIC images as JPEG
app.get("/media/:filename", async (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(mediaFolder, filename);
  const ext = path.extname(filename).toLowerCase();
  const quality = req.query.quality || 'auto'; // auto, 720p, 1080p, 4k

  if (!fs.existsSync(filePath)) {
    return res.status(404).send("File not found");
  }

  // Handle video streaming with adaptive quality
  if ([".mp4", ".mov", ".webm"].includes(ext)) {
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    
    // For transcoded quality, stream the transcoded version
    if (quality !== 'auto' && quality !== '4k') {
      return streamTranscodedVideo(filePath, quality, req, res);
    }

    // Otherwise, stream original with range support
    const range = req.headers.range;

    if (range) {
      // Parse Range header
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      // Send larger chunks (10MB) for better buffering
      const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB chunks
      const end = parts[1] ? parseInt(parts[1], 10) : Math.min(start + CHUNK_SIZE - 1, fileSize - 1);
      const chunksize = (end - start) + 1;
      const file = fs.createReadStream(filePath, { start, end, highWaterMark: 64 * 1024 }); // 64KB buffer
      
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': getContentType(ext),
        'Cache-Control': 'public, max-age=3600',
      };

      res.writeHead(206, head);
      file.pipe(res);
    } else {
      // No range requested, send entire file
      const head = {
        'Content-Length': fileSize,
        'Content-Type': getContentType(ext),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=3600',
      };
      res.writeHead(200, head);
      fs.createReadStream(filePath, { highWaterMark: 64 * 1024 }).pipe(res);
    }
    return;
  }

  // Convert HEIC to JPEG on-the-fly
  if (ext === ".heic") {
    try {
      const inputBuffer = fs.readFileSync(filePath);
      const outputBuffer = await convert({
        buffer: inputBuffer,
        format: "JPEG",
        quality: 0.9
      });

      // Use sharp to optimize the JPEG
      const optimized = await sharp(outputBuffer)
        .jpeg({ quality: 90 })
        .toBuffer();

      res.set("Content-Type", "image/jpeg");
      res.send(optimized);
    } catch (error) {
      console.error("Error converting HEIC:", error);
      res.status(500).send("Error converting image");
    }
  } else {
    // Serve other files normally
    res.sendFile(filePath);
  }
});

// Stream transcoded video with adaptive quality
function streamTranscodedVideo(filePath, quality, req, res) {
  const qualitySettings = {
    '720p': { width: 1280, height: 720, bitrate: '2500k' },
    '1080p': { width: 1920, height: 1080, bitrate: '5000k' },
  };

  const settings = qualitySettings[quality];
  if (!settings) {
    return res.status(400).send('Invalid quality setting');
  }

  res.writeHead(200, {
    'Content-Type': 'video/mp4',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  let ffmpegCommand = null;
  let streamStarted = false;

  // Cleanup on client disconnect (but wait a bit to avoid false positives)
  req.on('close', () => {
    setTimeout(() => {
      if (ffmpegCommand && !streamStarted) {
        console.log('Client disconnected before streaming started, killing process');
        ffmpegCommand.kill('SIGKILL');
      }
    }, 1000);
  });

  ffmpegCommand = ffmpeg(filePath)
    .videoCodec('libx264')
    .audioCodec('aac')
    .audioBitrate('128k')
    .audioChannels(2)
    .videoBitrate(settings.bitrate)
    .size(`${settings.width}x${settings.height}`)
    .autopad()
    .format('mp4')
    .outputOptions([
      '-movflags +frag_keyframe+empty_moov+default_base_moof',
      '-preset veryfast',
      '-profile:v baseline',
      '-level 3.0',
      '-pix_fmt yuv420p',
      '-g 48',
      '-keyint_min 48',
      '-sc_threshold 0'
    ])
    .on('start', (cmd) => {
      console.log(`Starting transcoding to ${quality}: ${path.basename(filePath)}`);
      streamStarted = false;
    })
    .on('progress', (progress) => {
      if (!streamStarted) {
        streamStarted = true;
        console.log(`Streaming ${quality} started`);
      }
    })
    .on('error', (err, stdout, stderr) => {
      if (!err.message.includes('Output stream closed')) {
        console.error('FFmpeg error:', err.message);
      }
      if (!res.headersSent) {
        res.status(500).end();
      } else if (!res.finished) {
        res.end();
      }
    })
    .on('end', () => {
      console.log(`Completed transcoding to ${quality}`);
      if (!res.finished) {
        res.end();
      }
    });

  try {
    ffmpegCommand.pipe(res, { end: true });
  } catch (error) {
    console.error('Pipe error:', error);
    if (!res.finished) {
      res.end();
    }
  }
}

// Helper function to get content type
function getContentType(ext) {
  const types = {
    '.mp4': 'video/mp4',
    '.mov': 'video/quicktime',
    '.webm': 'video/webm',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif'
  };
  return types[ext] || 'application/octet-stream';
}

// Get list of media files with pagination
app.get("/files", (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const filter = req.query.filter || 'all'; // 'all', 'image', 'video'
  
  // Check cache first
  const cacheKey = `files_${page}_${limit}_${filter}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  fs.readdir(mediaFolder, (err, files) => {
    if (err) return res.status(500).send("Error reading folder");
    
    let mediaFiles = files
      .filter(f => /\.(jpg|jpeg|png|heic|gif|mp4|mov|webm)$/i.test(f))
      .map(f => {
        const filePath = path.join(mediaFolder, f);
        const stats = fs.statSync(filePath);
        const ext = path.extname(f).toLowerCase();
        return {
          name: f,
          type: [".mp4", ".mov", ".webm"].includes(ext) ? "video" : "image",
          size: stats.size,
          modified: stats.mtime
        };
      })
      .sort((a, b) => b.modified - a.modified); // Sort by newest first

    // Apply filter
    if (filter === 'image') {
      mediaFiles = mediaFiles.filter(f => f.type === 'image');
    } else if (filter === 'video') {
      mediaFiles = mediaFiles.filter(f => f.type === 'video');
    }

    const total = mediaFiles.length;
    const totalPages = Math.ceil(total / limit);
    const start = (page - 1) * limit;
    const end = start + limit;
    const paginatedFiles = mediaFiles.slice(start, end);

    const result = {
      files: paginatedFiles,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages
      }
    };

    // Cache the result
    cache.set(cacheKey, result);
    
    res.json(result);
  });
});

app.listen(8000, () => console.log("Server running on http://localhost:8000"));
