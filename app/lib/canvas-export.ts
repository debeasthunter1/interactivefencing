export function downloadDataUrl(dataUrl: string, fileName: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export function createExportFileName(prefix: string, extension = "png") {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${prefix}-${timestamp}.${extension}`;
}
