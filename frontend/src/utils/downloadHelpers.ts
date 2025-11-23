/**
 * Download Helpers
 *
 * Utility functions for safe file downloads that avoid React DOM manipulation conflicts.
 * These helpers prevent the "Failed to execute 'removeChild' on 'Node'" error.
 */

/**
 * Triggers a browser download from a Blob or URL
 *
 * This function safely handles file downloads without causing React DOM conflicts.
 * It attempts to trigger downloads without DOM manipulation first, with a fallback
 * that properly cleans up any temporarily appended elements.
 *
 * @param content - Blob, File, or URL string to download
 * @param filename - Name for the downloaded file
 * @param options - Optional configuration
 */
export function triggerDownload(
  content: Blob | File | string,
  filename: string,
  options?: {
    mimeType?: string;
    onSuccess?: () => void;
    onError?: (error: Error) => void;
  }
): void {
  try {
    // Create URL from content if it's a Blob/File
    const url = typeof content === 'string'
      ? content
      : URL.createObjectURL(content);

    // Create anchor element
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.style.display = 'none';
    anchor.setAttribute('aria-hidden', 'true');

    // STRATEGY 1: Try to click without appending to DOM (safest, works in modern browsers)
    try {
      anchor.click();

      // Cleanup URL after download starts
      if (typeof content !== 'string') {
        setTimeout(() => {
          try {
            URL.revokeObjectURL(url);
          } catch (e) {
            console.debug('URL already revoked:', e);
          }
        }, 1000);
      }

      options?.onSuccess?.();
      return;
    } catch (clickError) {
      // STRATEGY 2: Fallback - append to body, click, then remove
      console.debug('Direct click failed, using fallback with DOM append');
    }

    // Append to body as fallback
    document.body.appendChild(anchor);

    // Click to trigger download
    anchor.click();

    // Clean up after a delay to ensure download starts
    setTimeout(() => {
      try {
        // Check if element still has a parent before removing
        if (anchor.parentNode) {
          anchor.parentNode.removeChild(anchor);
        }

        // Revoke object URL if we created one
        if (typeof content !== 'string') {
          URL.revokeObjectURL(url);
        }
      } catch (cleanupError) {
        // Silently ignore cleanup errors - download has already started
        console.debug('Cleanup completed or element already removed:', cleanupError);
      }
    }, 100);

    options?.onSuccess?.();

  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('Download failed:', err);
    options?.onError?.(err);
  }
}

/**
 * Downloads text content as a file
 *
 * @param content - Text content to download
 * @param filename - Name for the downloaded file
 * @param mimeType - MIME type (default: 'text/plain')
 */
export function downloadTextFile(
  content: string,
  filename: string,
  mimeType: string = 'text/plain'
): void {
  const blob = new Blob([content], { type: mimeType });
  triggerDownload(blob, filename);
}

/**
 * Downloads JSON data as a file
 *
 * @param data - Data to convert to JSON and download
 * @param filename - Name for the downloaded file
 */
export function downloadJsonFile(
  data: any,
  filename: string
): void {
  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  triggerDownload(blob, filename);
}

/**
 * Downloads a Blob with proper cleanup
 *
 * @param blob - Blob to download
 * @param filename - Name for the downloaded file
 */
export function downloadBlob(
  blob: Blob,
  filename: string
): void {
  triggerDownload(blob, filename);
}

/**
 * Downloads content from a response object (e.g., from fetch or axios)
 *
 * @param response - Response object containing data
 * @param filename - Name for the downloaded file
 * @param format - File format/extension
 */
export function downloadFromResponse(
  response: { data: any },
  filename: string,
  format: string
): void {
  const blob = new Blob([response.data]);
  triggerDownload(blob, filename);
}
