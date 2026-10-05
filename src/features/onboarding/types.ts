import { DriveStep, Config } from 'driver.js';

export type TourName = 'dashboard' | 'products' | 'inventory' | 'orders' | 'customers' | 'accounting' | (string & {});

export interface TourStepConfig {
  element?: string;
  popover: {
    title: string;
    description: string;
    side?: 'top' | 'right' | 'bottom' | 'left' | 'over';
    align?: 'start' | 'center' | 'end';
    showButtons?: ('next' | 'previous' | 'close')[];
    nextBtnText?: string;
    prevBtnText?: string;
  };
}

export interface TourDefinition {
  name: TourName;
  getSteps: (t: (key: string, ...args: any[]) => string, isRtl: boolean) => DriveStep[];
  options?: Partial<Config>;
}

export interface OnboardingState {
  completedTours: Record<string, boolean>;
  isTourActive: boolean;
  activeTourName: TourName | null;
}
