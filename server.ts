import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { google } from "googleapis";
import { Readable } from "stream";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase payload limit for file uploads
  app.use(express.json({ limit: '50mb' }));

  // API to Backup to Google Drive
  app.post("/api/backup-drive", async (req, res) => {
    try {
      const { fileName, fileType, fileContent, studentName } = req.body;
      
      const authEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
      const authKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
      const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

      if (!authEmail || !authKey) {
        return res.status(500).json({ error: "Google Drive credentials not configured" });
      }

      const auth = new google.auth.JWT({
        email: authEmail,
        key: authKey,
        scopes: ['https://www.googleapis.com/auth/drive']
      });

      const drive = google.drive({ version: 'v3', auth });

      // Clean base64 data
      const base64Data = fileContent.split(';base64,').pop();
      if (!base64Data) {
        return res.status(400).json({ error: "Invalid file content" });
      }
      
      const buffer = Buffer.from(base64Data, 'base64');
      const stream = new Readable();
      stream.push(buffer);
      stream.push(null);

      const fileMetadata = {
        name: `${studentName}_${fileName}`,
        parents: folderId ? [folderId] : []
      };

      const media = {
        mimeType: fileType,
        body: stream
      };

      const response = await drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id, webViewLink'
      });

      res.json({ success: true, fileId: response.data.id, link: response.data.webViewLink });
    } catch (error: any) {
      console.error("Backup error detail:", error.response?.data || error);
      
      const isNotFound = error.code === 404 || error.response?.status === 404;
      if (isNotFound) {
        return res.status(404).json({ 
          error: "Folder backup tidak ditemukan atau tidak dapat diakses. Pastikan folder tersebut telah dibagikan (Shared) dengan akses 'Editor' ke email Service Account berikut: " + process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
        });
      }

      res.status(500).json({ error: error.message || "Failed to backup to Google Drive" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    
    // Explicit SPA fallback for dev
    app.get('*', async (req, res, next) => {
      // Allow Vite to handle files (js, css, etc)
      if (req.originalUrl.includes('.')) return next();
      
      const url = req.originalUrl;
      try {
        const fs = await import('fs');
        let template = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        next(e);
      }
    });
  } else {
    // Serving static files in production
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
