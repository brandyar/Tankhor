import { useState, useEffect, useCallback } from 'react';

export interface CameraDeviceInfo {
  deviceId: string;
  label: string;
}

interface CameraAvailabilityState {
  hasCamera: boolean;
  isChecking: boolean;
  cameras: CameraDeviceInfo[];
  refreshCameras: () => Promise<void>;
}

/**
 * Detects whether the user's system has at least one video input (webcam / camera).
 * Automatically reacts to USB webcam plug/unplug via `devicechange`.
 */
export function useCameraAvailability(): CameraAvailabilityState {
  const [hasCamera, setHasCamera] = useState<boolean>(false);
  const [isChecking, setIsChecking] = useState<boolean>(true);
  const [cameras, setCameras] = useState<CameraDeviceInfo[]>([]);

  const checkDevices = useCallback(async () => {
    if (
      typeof window === 'undefined' ||
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.enumerateDevices !== 'function'
    ) {
      setHasCamera(false);
      setCameras([]);
      setIsChecking(false);
      return;
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter((d) => d.kind === 'videoinput');
      setHasCamera(videoInputs.length > 0);
      setCameras(
        videoInputs.map((d, idx) => ({
          deviceId: d.deviceId,
          label: d.label || `Camera ${idx + 1}`,
        }))
      );
    } catch {
      setHasCamera(false);
      setCameras([]);
    } finally {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    checkDevices();

    const mediaDevices = typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined;
    if (mediaDevices && typeof mediaDevices.addEventListener === 'function') {
      mediaDevices.addEventListener('devicechange', checkDevices);
      return () => {
        mediaDevices.removeEventListener('devicechange', checkDevices);
      };
    }
  }, [checkDevices]);

  return {
    hasCamera,
    isChecking,
    cameras,
    refreshCameras: checkDevices,
  };
}
