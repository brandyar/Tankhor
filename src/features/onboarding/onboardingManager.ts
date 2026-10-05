import { driver, Driver, Config } from 'driver.js';
import 'driver.js/dist/driver.css';
import { TourName } from './types';
import { getTour } from './tours';
import { toPersianDigits } from '../../utils/formatters';

const STORAGE_PREFIX = 'tankhor_tour_seen_';

export class OnboardingManager {
  private static activeDriverInstance: Driver | null = null;

  public static getStorageKey(tourName: TourName, orgId?: string | number): string {
    const orgSuffix = orgId ? `_${orgId}` : '_global';
    return `${STORAGE_PREFIX}${tourName}${orgSuffix}`;
  }

  public static isTourCompleted(tourName: TourName, orgId?: string | number): boolean {
    try {
      if (typeof window === 'undefined') return false;
      const key = this.getStorageKey(tourName, orgId);
      return localStorage.getItem(key) === 'true';
    } catch {
      return false;
    }
  }

  public static markTourCompleted(tourName: TourName, orgId?: string | number): void {
    try {
      if (typeof window === 'undefined') return;
      const key = this.getStorageKey(tourName, orgId);
      localStorage.setItem(key, 'true');
    } catch (e) {
      console.error('[Onboarding] Error saving tour state:', e);
    }
  }

  public static resetTour(tourName: TourName, orgId?: string | number): void {
    try {
      if (typeof window === 'undefined') return;
      const key = this.getStorageKey(tourName, orgId);
      localStorage.removeItem(key);
    } catch (e) {
      console.error('[Onboarding] Error resetting tour state:', e);
    }
  }

  public static startTour(
    tourName: TourName,
    t: (key: string, paramsOrFallback?: any, fallback?: string) => string,
    options: {
      orgId?: string | number;
      isRtl?: boolean;
      force?: boolean;
      onComplete?: () => void;
      onSkip?: () => void;
    } = {}
  ): boolean {
    const { orgId, isRtl = true, force = false, onComplete, onSkip } = options;

    if (!force && this.isTourCompleted(tourName, orgId)) {
      return false;
    }

    const tourDef = getTour(tourName);
    if (!tourDef) {
      console.warn(`[Onboarding] Tour '${tourName}' not found in registry.`);
      return false;
    }

    // Terminate existing driver instance if any
    if (this.activeDriverInstance) {
      this.activeDriverInstance.destroy();
      this.activeDriverInstance = null;
    }

    const rawSteps = tourDef.getSteps(t, isRtl);

    // Filter out steps whose element does not exist in the DOM
    const validSteps = rawSteps.filter((step) => {
      if (!step.element) return true;
      if (typeof step.element === 'string') {
        const el = document.querySelector(step.element);
        return Boolean(el);
      }
      return true;
    });

    if (validSteps.length === 0) {
      console.warn(`[Onboarding] No matching DOM elements found for tour '${tourName}'.`);
      return false;
    }

    const totalSteps = validSteps.length;

    // Enhance steps with localized step progress and button labels
    const localizedSteps = validSteps.map((step, index) => {
      const stepNumber = index + 1;
      const progressText = isRtl
        ? `مرحله ${toPersianDigits(stepNumber)} از ${toPersianDigits(totalSteps)}`
        : `Step ${stepNumber} of ${totalSteps}`;

      return {
        ...step,
        popover: {
          ...step.popover,
          nextBtnText: stepNumber === totalSteps ? t('onboarding.done', 'شروع کار') : t('onboarding.next', 'بعدی'),
          prevBtnText: t('onboarding.prev', 'قبلی'),
          description: `
            <div class="driver-popover-custom-content">
              <p class="driver-popover-text-body">${step.popover.description || ''}</p>
              <div class="driver-popover-step-indicator">${progressText}</div>
            </div>
          `,
        },
      };
    });

    let completedCleanly = false;

    const driverConfig: Config = {
      animate: true,
      overlayColor: 'rgba(5, 7, 12, 0.72)',
      stagePadding: 6,
      stageRadius: 10,
      allowClose: true,
      showProgress: false,
      showButtons: ['next', 'previous', 'close'],
      nextBtnText: t('onboarding.next', 'بعدی'),
      prevBtnText: t('onboarding.prev', 'قبلی'),
      popoverClass: `tankhor-driver-popover ${isRtl ? 'tankhor-driver-rtl' : 'tankhor-driver-ltr'}`,
      steps: localizedSteps,
      onDestroyStarted: () => {
        // Mark as completed whenever closed/finished so it won't prompt again automatically
        this.markTourCompleted(tourName, orgId);
        if (completedCleanly) {
          onComplete?.();
        } else {
          onSkip?.();
        }
        this.activeDriverInstance?.destroy();
        this.activeDriverInstance = null;
      },
      ...tourDef.options,
    };

    const driverInstance = driver(driverConfig);
    this.activeDriverInstance = driverInstance;

    // Start driving
    driverInstance.drive();
    return true;
  }

  public static stopActiveTour(): void {
    if (this.activeDriverInstance) {
      this.activeDriverInstance.destroy();
      this.activeDriverInstance = null;
    }
  }
}
