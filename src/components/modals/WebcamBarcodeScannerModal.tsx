import React, { useEffect, useRef, useState, useCallback } from 'react';
import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useTranslation } from '../../i18n';
import {
  Camera,
  RefreshCw,
  Volume2,
  VolumeX,
  Zap,
  ZapOff,
  CheckCircle2,
  AlertCircle,
  Repeat,
  Barcode,
} from 'lucide-react';

export interface WebcamScanResult {
  success: boolean;
  message?: string;
}

export interface WebcamBarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * Called when a barcode is decoded.
   * In continuous mode, returning { success, message } allows the scanner HUD
   * to display product/stock feedback immediately without closing.
   */
  onScan: (code: string) => void | WebcamScanResult | Promise<void | WebcamScanResult>;
  title?: string;
  allowContinuous?: boolean;
  defaultContinuous?: boolean;
}

const PREFERRED_CAMERA_KEY = 'tankhor_preferred_webcam_id';
const SOUND_PREF_KEY = 'tankhor_webcam_beep_enabled';
const SAME_CODE_COOLDOWN_MS = 1600;

function playScannerBeep(success = true) {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = success ? 'sine' : 'triangle';
    osc.frequency.setValueAtTime(success ? 1046.5 : 330, ctx.currentTime);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (success ? 0.11 : 0.18));
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + (success ? 0.12 : 0.19));
    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 250);
  } catch {
    // Ignore audio context restrictions
  }
}

export const WebcamBarcodeScannerModal: React.FC<WebcamBarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onScan,
  title,
  allowContinuous = false,
  defaultContinuous = false,
}) => {
  const { t, locale } = useTranslation();
  const isPersian = locale === 'fa';

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastScannedRef = useRef<{ code: string; time: number }>({ code: '', time: 0 });
  const isClosingRef = useRef(false);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  const [cameras, setCameras] = useState<{ deviceId: string; label: string }[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>(() => {
    try {
      return localStorage.getItem(PREFERRED_CAMERA_KEY) || '';
    } catch {
      return '';
    }
  });
  const [isStarting, setIsStarting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [continuousMode, setContinuousMode] = useState<boolean>(allowContinuous && defaultContinuous);
  const continuousModeRef = useRef(continuousMode);
  continuousModeRef.current = continuousMode;

  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(SOUND_PREF_KEY);
      return saved !== 'false';
    } catch {
      return true;
    }
  });
  const soundEnabledRef = useRef(soundEnabled);
  soundEnabledRef.current = soundEnabled;

  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [flashSuccess, setFlashSuccess] = useState(false);
  const [lastFeedback, setLastFeedback] = useState<{
    code: string;
    success: boolean;
    message?: string;
  } | null>(null);

  // Sync defaultContinuous when modal opens
  useEffect(() => {
    if (isOpen) {
      isClosingRef.current = false;
      setContinuousMode(allowContinuous && defaultContinuous);
      setLastFeedback(null);
      setErrorMsg(null);
      lastScannedRef.current = { code: '', time: 0 };
    }
  }, [isOpen, allowContinuous, defaultContinuous]);

  const stopScanner = useCallback(() => {
    try {
      controlsRef.current?.stop();
    } catch {
      // ignore
    }
    controlsRef.current = null;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      streamRef.current = null;
    }

    if (videoRef.current) {
      try {
        videoRef.current.srcObject = null;
      } catch {
        // ignore
      }
    }
    setTorchSupported(false);
    setTorchOn(false);
  }, []);

  const mapCameraError = useCallback(
    (err: unknown): string => {
      if (typeof window !== 'undefined' && !window.isSecureContext && window.location.hostname !== 'localhost') {
        return t('common.webcamErrorInsecure', 'دسترسی به وب‌کم در مرورگر نیازمند بستر امن (HTTPS) است.');
      }
      const name = (err as { name?: string })?.name || '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        return t(
          'common.webcamErrorPermission',
          'دسترسی به دوربین توسط کاربر یا مرورگر مسدود شده است. لطفاً مجوز دوربین را در تنظیمات مرورگر تایید کنید.'
        );
      }
      if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError') {
        return t('common.webcamErrorNotFound', 'هیچ وب‌کم یا دوربینی روی این سیستم شناسایی نشد.');
      }
      if (name === 'NotReadableError' || name === 'TrackStartError') {
        return t('common.webcamErrorInUse', 'دوربین در حال حاضر توسط برنامه دیگری در حال استفاده است.');
      }
      return t('common.webcamErrorGeneric', 'خطا در راه‌اندازی دوربین. لطفاً اتصال وب‌کم را بررسی کنید.');
    },
    [t]
  );

  const startScanner = useCallback(async () => {
    if (!isOpen) return;
    stopScanner();
    setErrorMsg(null);
    setIsStarting(true);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('MediaDevicesUnavailable');
      }

      const constraints: MediaStreamConstraints = {
        audio: false,
        video: selectedDeviceId
          ? {
              deviceId: { exact: selectedDeviceId },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            }
          : {
              facingMode: { ideal: 'environment' },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
      };

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (exactErr) {
        // Fallback if stored deviceId is no longer connected
        if (selectedDeviceId) {
          setSelectedDeviceId('');
          try {
            localStorage.removeItem(PREFERRED_CAMERA_KEY);
          } catch {
            // ignore
          }
          stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
              facingMode: { ideal: 'environment' },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          });
        } else {
          throw exactErr;
        }
      }

      if (isClosingRef.current || !isOpen) {
        stream.getTracks().forEach((tr) => tr.stop());
        return;
      }

      streamRef.current = stream;

      // Refresh camera list with labels now that permission is granted
      try {
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = allDevices
          .filter((d) => d.kind === 'videoinput')
          .map((d, idx) => ({
            deviceId: d.deviceId,
            label: d.label || `${t('common.webcamCameraDefault', 'دوربین')} ${idx + 1}`,
          }));
        setCameras(videoInputs);

        const activeTrack = stream.getVideoTracks()[0];
        const activeDeviceId = activeTrack?.getSettings?.().deviceId;
        if (activeDeviceId && !selectedDeviceId) {
          setSelectedDeviceId(activeDeviceId);
        }

        // Check torch capability
        const caps = activeTrack?.getCapabilities?.() as { torch?: boolean } | undefined;
        setTorchSupported(Boolean(caps && caps.torch));
      } catch {
        // ignore device enumeration warning
      }

      const videoEl = videoRef.current;
      if (!videoEl) {
        stream.getTracks().forEach((tr) => tr.stop());
        return;
      }

      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.CODE_128,
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.CODE_39,
        BarcodeFormat.CODE_93,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
        BarcodeFormat.ITF,
        BarcodeFormat.QR_CODE,
        BarcodeFormat.DATA_MATRIX,
      ]);
      hints.set(DecodeHintType.TRY_HARDER, true);

      const reader = new BrowserMultiFormatReader(hints, {
        delayBetweenScanAttempts: 180,
        delayBetweenScanSuccess: 400,
      });

      const controls = await reader.decodeFromStream(stream, videoEl, async (result) => {
        if (!result || isClosingRef.current) return;
        const code = result.getText()?.trim();
        if (!code) return;

        const now = Date.now();
        if (
          lastScannedRef.current.code === code &&
          now - lastScannedRef.current.time < SAME_CODE_COOLDOWN_MS
        ) {
          return;
        }
        lastScannedRef.current = { code, time: now };

        setFlashSuccess(true);
        setTimeout(() => setFlashSuccess(false), 380);

        if (continuousModeRef.current) {
          try {
            const res = await onScanRef.current(code);
            const resultObj = res && typeof res === 'object' ? res : undefined;
            const isSuccess = resultObj ? resultObj.success : true;
            if (soundEnabledRef.current) {
              playScannerBeep(isSuccess);
            }
            setLastFeedback({
              code,
              success: isSuccess,
              message: resultObj?.message,
            });
          } catch {
            if (soundEnabledRef.current) {
              playScannerBeep(false);
            }
            setLastFeedback({ code, success: false });
          }
        } else {
          if (soundEnabledRef.current) {
            playScannerBeep(true);
          }
          isClosingRef.current = true;
          stopScanner();
          await onScanRef.current(code);
          onClose();
        }
      });

      controlsRef.current = controls;
    } catch (err) {
      setErrorMsg(mapCameraError(err));
    } finally {
      setIsStarting(false);
    }
  }, [isOpen, selectedDeviceId, stopScanner, mapCameraError, onClose, t]);

  useEffect(() => {
    if (isOpen) {
      startScanner();
    } else {
      stopScanner();
    }
    return () => {
      stopScanner();
    };
  }, [isOpen, startScanner, stopScanner]);

  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    try {
      localStorage.setItem(SOUND_PREF_KEY, String(next));
    } catch {
      // ignore
    }
  };

  const handleCameraChange = (deviceId: string) => {
    setSelectedDeviceId(deviceId);
    try {
      localStorage.setItem(PREFERRED_CAMERA_KEY, deviceId);
    } catch {
      // ignore
    }
  };

  const handleToggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()?.[0];
    if (!track) return;
    try {
      const next = !torchOn;
      await track.applyConstraints({
        advanced: [{ torch: next } as MediaTrackConstraintSet],
      });
      setTorchOn(next);
    } catch {
      // ignore unsupported torch
    }
  };

  const handleClose = () => {
    isClosingRef.current = true;
    stopScanner();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      maxWidth="lg"
      title={
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 flex items-center justify-center shrink-0">
            <Camera className="w-4 h-4 text-emerald-400 dark:text-emerald-600" />
          </div>
          <div>
            <span className="block text-sm font-bold text-neutral-900 dark:text-neutral-100">
              {title || t('common.webcamScannerTitle', 'اسکنر بارکد با دوربین')}
            </span>
            <span className="block text-[11px] font-normal text-neutral-500 dark:text-neutral-400">
              {t('common.webcamScannerSubtitle', 'بارکد محصول یا کد QR را مقابل کادر دوربین قرار دهید')}
            </span>
          </div>
        </div>
      }
      footer={
        <div className="w-full flex items-center justify-between gap-2 flex-wrap">
          <span className="text-[11px] text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5">
            <Barcode className="w-3.5 h-3.5 text-neutral-400" />
            <span>{t('common.webcamFormatsHint', 'پشتیبانی از Code 128، EAN-13، EAN-8، Code 39 و QR')}</span>
          </span>
          <Button type="button" variant="outline" size="sm" onClick={handleClose}>
            {t('common.close', 'بستن')}
          </Button>
        </div>
      }
    >
      <div className="space-y-3.5" dir={isPersian ? 'rtl' : 'ltr'}>
        {/* Top Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Camera Selector */}
          {cameras.length > 1 ? (
            <select
              value={selectedDeviceId}
              onChange={(e) => handleCameraChange(e.target.value)}
              aria-label={t('common.webcamSelectCamera', 'انتخاب دوربین')}
              className="flex-1 min-w-[160px] max-w-xs bg-[#fafafa] dark:bg-[#181a20] border border-neutral-200 dark:border-neutral-700 rounded-lg px-2.5 py-1.5 text-xs font-medium text-neutral-800 dark:text-neutral-200 focus:outline-none focus:border-neutral-900 dark:focus:border-neutral-400"
            >
              {cameras.map((cam) => (
                <option key={cam.deviceId} value={cam.deviceId}>
                  {cam.label}
                </option>
              ))}
            </select>
          ) : (
            <div className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
              {cameras[0]?.label || t('common.webcamCameraDefault', 'دوربین')}
            </div>
          )}

          {/* Action Toggles */}
          <div className="flex items-center gap-1.5">
            {allowContinuous && (
              <button
                type="button"
                onClick={() => setContinuousMode((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                  continuousMode
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                    : 'bg-white dark:bg-[#181a20] border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300'
                }`}
              >
                <Repeat className="w-3.5 h-3.5" />
                <span>
                  {continuousMode
                    ? t('common.webcamContinuousMode', 'اسکن پیوسته (صندوق)')
                    : t('common.webcamSingleMode', 'اسکن تکی')}
                </span>
              </button>
            )}

            {torchSupported && (
              <button
                type="button"
                onClick={handleToggleTorch}
                title={t('common.webcamTorch', 'فلاش')}
                className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                  torchOn
                    ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-300'
                    : 'bg-white dark:bg-[#181a20] border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                }`}
              >
                {torchOn ? <Zap className="w-4 h-4" /> : <ZapOff className="w-4 h-4" />}
              </button>
            )}

            <button
              type="button"
              onClick={handleToggleSound}
              title={
                soundEnabled
                  ? t('common.webcamSoundOn', 'صدای بوق فعال')
                  : t('common.webcamSoundOff', 'صدای بوق خاموش')
              }
              className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-[#181a20] text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-neutral-400" />}
            </button>
          </div>
        </div>

        {/* Camera Viewport */}
        <div className="relative w-full aspect-[4/3] sm:aspect-video bg-neutral-950 rounded-xl overflow-hidden border border-neutral-200 dark:border-neutral-800 flex items-center justify-center">
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className="w-full h-full object-cover"
          />

          {/* Scan Reticle Overlay */}
          {!errorMsg && !isStarting && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              {/* Dimmed surround vignette */}
              <div
                className={`relative w-[78%] max-w-[340px] h-[46%] max-h-[170px] rounded-xl transition-all duration-200 shadow-[0_0_0_9999px_rgba(0,0,0,0.42)] ${
                  flashSuccess ? 'ring-2 ring-emerald-400 bg-emerald-400/10' : ''
                }`}
              >
                {/* 4 Corner Brackets */}
                <span className="absolute top-0 start-0 w-6 h-6 border-t-[3px] border-s-[3px] border-emerald-400 rounded-ss-lg" />
                <span className="absolute top-0 end-0 w-6 h-6 border-t-[3px] border-e-[3px] border-emerald-400 rounded-se-lg" />
                <span className="absolute bottom-0 start-0 w-6 h-6 border-b-[3px] border-s-[3px] border-emerald-400 rounded-bs-lg" />
                <span className="absolute bottom-0 end-0 w-6 h-6 border-b-[3px] border-e-[3px] border-emerald-400 rounded-be-lg" />

                {/* Center Guide Line */}
                <div className="absolute inset-x-3 top-1/2 -translate-y-1/2 h-[2px] bg-emerald-400/80 shadow-[0_0_8px_rgba(52,211,153,0.9)] animate-pulse" />
              </div>
            </div>
          )}

          {/* Starting Loading State */}
          {isStarting && (
            <div className="absolute inset-0 bg-neutral-950/85 flex flex-col items-center justify-center gap-2.5 text-white p-4">
              <div className="w-7 h-7 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-medium text-neutral-300">
                {t('common.webcamStarting', 'در حال فعال‌سازی دوربین...')}
              </span>
            </div>
          )}

          {/* Error State */}
          {errorMsg && !isStarting && (
            <div className="absolute inset-0 bg-neutral-950/95 flex flex-col items-center justify-center text-center p-6 gap-3">
              <div className="w-11 h-11 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 flex items-center justify-center">
                <AlertCircle className="w-5 h-5" />
              </div>
              <p className="text-xs sm:text-sm text-neutral-200 max-w-sm leading-relaxed">{errorMsg}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={startScanner}
                icon={<RefreshCw className="w-3.5 h-3.5" />}
                className="bg-neutral-900 border-neutral-700 text-white hover:bg-neutral-800"
              >
                {t('common.webcamRetry', 'تلاش مجدد')}
              </Button>
            </div>
          )}
        </div>

        {/* Continuous Scan Feedback Banner */}
        {lastFeedback && (
          <div
            className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 animate-fade-in ${
              lastFeedback.success
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              {lastFeedback.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
              )}
              <span className="truncate">
                {lastFeedback.message || `${t('common.webcamLastScanned', 'آخرین اسکن')}: ${lastFeedback.code}`}
              </span>
            </div>
            <span className="font-mono text-[11px] opacity-80 shrink-0">{lastFeedback.code}</span>
          </div>
        )}
      </div>
    </Modal>
  );
};
