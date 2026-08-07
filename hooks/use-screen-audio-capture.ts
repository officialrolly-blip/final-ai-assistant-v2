'use client';

import { useCallback, useRef, useState } from 'react';

interface CaptureResult {
  stream: MediaStream;
  videoTrack: MediaStreamTrack | null;
}

export function useScreenAudioCapture() {
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const start = useCallback(async (useMic: boolean): Promise<CaptureResult | null> => {
    setError(null);
    try {
      const displayMedia = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } as MediaTrackConstraints,
      });

      const audioTracks = displayMedia.getAudioTracks();
      if (audioTracks.length === 0) {
        displayMedia.getTracks().forEach((t) => t.stop());
        setError(
          'No system audio captured. When sharing, select "Entire Screen" or a "Browser Tab" and enable "Share audio".'
        );
        return null;
      }

      let combined = new MediaStream(audioTracks);

      if (useMic) {
        try {
          const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          micStream.getAudioTracks().forEach((t) => combined.addTrack(t));
        } catch {
          // mic denied — continue with system audio only
        }
      }

      const videoTrack = displayMedia.getVideoTracks()[0] ?? null;
      // Stop the video track — we only need audio. But keep a ref for cleanup.
      streamRef.current = displayMedia;
      setCapturing(true);
      return { stream: combined, videoTrack };
    } catch (err) {
      setError(
        err instanceof Error && err.name === 'NotAllowedError'
          ? 'Screen share was cancelled.'
          : `Capture failed: ${err instanceof Error ? err.message : String(err)}`
      );
      return null;
    }
  }, []);

  const stop = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCapturing(false);
  }, []);

  return { capturing, error, start, stop, streamRef };
}
