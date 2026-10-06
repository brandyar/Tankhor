import { useCallback, useEffect } from 'react';
import { useTranslation } from '../../i18n';
import { useOrganization } from '../../context/OrganizationContext';
import { OnboardingManager } from './onboardingManager';
import { TourName } from './types';

interface UseOnboardingTourOptions {
  autoStartTour?: TourName;
  autoStartDelayMs?: number;
  autoStartCondition?: boolean;
}

export function useOnboardingTour(options: UseOnboardingTourOptions = {}) {
  const { t, isRtl } = useTranslation();
  const { activeOrganization } = useOrganization();
  const orgId = activeOrganization?.id;

  const isTourCompleted = useCallback(
    (tourName: TourName): boolean => {
      return OnboardingManager.isTourCompleted(tourName, orgId);
    },
    [orgId]
  );

  const startTour = useCallback(
    (
      tourName: TourName,
      tourOptions: {
        force?: boolean;
        onComplete?: () => void;
        onSkip?: () => void;
      } = {}
    ): boolean => {
      // Do not run interactive tour on mobile/tablets (< 1024px) where sidebar is in a closed drawer
      if (typeof window !== 'undefined' && window.innerWidth < 1024) {
        return false;
      }

      return OnboardingManager.startTour(tourName, t, {
        orgId,
        isRtl,
        force: tourOptions.force,
        onComplete: tourOptions.onComplete,
        onSkip: tourOptions.onSkip,
      });
    },
    [t, isRtl, orgId]
  );

  const resetTour = useCallback(
    (tourName: TourName) => {
      OnboardingManager.resetTour(tourName, orgId);
    },
    [orgId]
  );

  const stopTour = useCallback(() => {
    OnboardingManager.stopActiveTour();
  }, []);

  // Handle auto-start on mount if specified
  useEffect(() => {
    if (!options.autoStartTour) return;
    if (options.autoStartCondition === false) return;
    if (!orgId) return;

    // Do NOT auto-start on mobile or tablet viewports (< 1024px).
    // On mobile screens, automatically popping up guide tours targeting sidebars disrupts the experience.
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      return;
    }

    if (!isTourCompleted(options.autoStartTour)) {
      const timer = setTimeout(() => {
        startTour(options.autoStartTour!, { force: false });
      }, options.autoStartDelayMs ?? 800);

      return () => clearTimeout(timer);
    }
  }, [
    options.autoStartTour,
    options.autoStartDelayMs,
    options.autoStartCondition,
    orgId,
    isTourCompleted,
    startTour,
  ]);

  return {
    startTour,
    resetTour,
    stopTour,
    isTourCompleted,
  };
}
