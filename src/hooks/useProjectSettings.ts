import { useState, useEffect } from 'react';
import { directusClient } from '../api/directus';
import { ProjectSettings } from '../types';

export const useProjectSettings = () => {
  const [settings, setSettings] = useState<ProjectSettings>({
    windows_setup: null,
    macos_setup: null,
    adnroid_setup: null,
    android_setup: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchSettings = async () => {
      try {
        const data = await directusClient.getProjectSettings();
        if (isMounted && data) {
          setSettings(data);
        }
      } catch (err) {
        console.warn('Failed to load project settings:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchSettings();
    return () => {
      isMounted = false;
    };
  }, []);

  return { settings, loading };
};
