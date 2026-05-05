
export const GOOGLE_DRIVE_SCOPES = 'https://www.googleapis.com/auth/drive.file';

export async function uploadToGoogleDrive(fileBase64: string, fileName: string, mimeType: string, accessToken: string) {
  // Menghapus prefix data:...;base64,
  const base64Data = fileBase64.split(',')[1];
  const blob = await (await fetch(`data:${mimeType};base64,${base64Data}`)).blob();

  const metadata = {
    name: fileName,
    mimeType: mimeType,
    parents: ['root'], // Bisa disesuaikan ke folder spesifik nantinya
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', blob);

  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink', {
    method: 'POST',
    headers: new Headers({ 'Authorization': 'Bearer ' + accessToken }),
    body: form,
  });

  if (!response.ok) {
    throw new Error('Gagal unggah ke Google Drive');
  }

  return await response.json();
}

export async function backupToSystemDrive(fileContent: string, fileName: string, fileType: string, studentName: string) {
  const response = await fetch('/api/backup-drive', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fileContent,
      fileName,
      fileType,
      studentName
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Gagal backup ke Google Drive');
  }

  return await response.json();
}
