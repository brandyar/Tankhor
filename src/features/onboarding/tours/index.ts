import { TourDefinition, TourName } from '../types';
import { dashboardTour } from './dashboardTour';

export const tourRegistry: Record<string, TourDefinition> = {
  dashboard: dashboardTour,
};

export const registerTour = (tour: TourDefinition) => {
  tourRegistry[tour.name] = tour;
};

export const getTour = (name: TourName): TourDefinition | undefined => {
  return tourRegistry[name];
};
