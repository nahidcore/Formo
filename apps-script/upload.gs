/**
 * FormCraft — Google Apps Script Backend
 * upload.gs — decodes base64 file payloads and stores them in Google Drive,
 * returning shareable view URLs to be written into the Sheet.
 */

const Upload = (() => {

  function getFolder() {
    const folderId = PropertiesService.getScriptProperties().getProperty('DRIVE_FOLDER_ID');
    if (folderId) {
      try { return DriveApp.getFolderById(folderId); } catch (e) { /* fall through to root */ }
    }
    // Fallback: create/reuse a "FormCraft Uploads" folder in My Drive
    const name = 'FormCraft Uploads';
    const existing = DriveApp.getFoldersByName(name);
    if (existing.hasNext()) return existing.next();
    return DriveApp.createFolder(name);
  }

  /**
   * files: [{ fieldId, name, mimeType, size, base64 }]
   * returns: [{ fieldId, name, url, mimeType, size }]
   */
  function saveFiles(files, submissionId) {
    const folder = getFolder();
    const out = [];
    files.forEach(f => {
      try {
        const safeName = `${submissionId}_${f.fieldId}_${sanitizeFileName(f.name)}`;
        const blob = Utilities.newBlob(Utilities.base64Decode(f.base64), f.mimeType || 'application/octet-stream', safeName);
        const file = folder.createFile(blob);
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        out.push({ fieldId: f.fieldId, name: f.name, url: file.getUrl(), mimeType: f.mimeType, size: f.size });
      } catch (err) {
        out.push({ fieldId: f.fieldId, name: f.name, url: '', error: err.message });
      }
    });
    return out;
  }

  /**
   * signatures: { [fieldId]: dataURL }
   * returns: [{ fieldId, name, url }]
   */
  function saveSignatures(signatures, submissionId) {
    const folder = getFolder();
    const out = [];
    Object.keys(signatures || {}).forEach(fieldId => {
      const dataUrl = signatures[fieldId];
      if (!dataUrl) return;
      try {
        const base64 = dataUrl.split(',')[1];
        const blob = Utilities.newBlob(Utilities.base64Decode(base64), 'image/png', `${submissionId}_${fieldId}_signature.png`);
        const file = folder.createFile(blob);
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        out.push({ fieldId, name: `${fieldId}_signature.png`, url: file.getUrl() });
      } catch (err) {
        out.push({ fieldId, name: 'signature.png', url: '', error: err.message });
      }
    });
    return out;
  }

  function sanitizeFileName(name) {
    return String(name || 'file').replace(/[^a-zA-Z0-9_.\-]/g, '_').slice(0, 120);
  }

  return { saveFiles, saveSignatures };
})();
