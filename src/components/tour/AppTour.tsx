import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Joyride, EVENTS, type EventData, type Step } from 'react-joyride';
import { useAuth } from '../auth';
import { buildTourSteps, TOUR_RESTART_EVENT, TOUR_STORAGE_KEY } from './tourSteps';

function readCompleted(): boolean {
  try {
    return localStorage.getItem(TOUR_STORAGE_KEY) === 'true';
  } catch {
    return true;
  }
}

function writeCompleted(value: boolean): void {
  try {
    if (value) localStorage.setItem(TOUR_STORAGE_KEY, 'true');
    else localStorage.removeItem(TOUR_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export default function AppTour() {
  const { t, i18n } = useTranslation('tour');
  const { user, hasCompletedOnboarding } = useAuth();
  const [run, setRun] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);
  const startedRef = useRef(false);

  const start = useCallback(() => {
    const computed = buildTourSteps(t);
    if (computed.length === 0) return;
    setSteps(computed);
    setRun(true);
    startedRef.current = true;
  }, [t]);

  // Auto-start on first eligible mount
  useEffect(() => {
    if (startedRef.current) return;
    if (!user || !hasCompletedOnboarding) return;
    if (readCompleted()) return;
    // Defer one tick so target DOM is mounted
    const id = window.setTimeout(start, 600);
    return () => window.clearTimeout(id);
  }, [user, hasCompletedOnboarding, start]);

  // Manual restart trigger
  useEffect(() => {
    const handler = () => {
      writeCompleted(false);
      startedRef.current = false;
      start();
    };
    window.addEventListener(TOUR_RESTART_EVENT, handler);
    return () => window.removeEventListener(TOUR_RESTART_EVENT, handler);
  }, [start]);

  // Re-build steps on language change while running
  useEffect(() => {
    if (!run) return;
    setSteps(buildTourSteps(t));
  }, [i18n.language, run, t]);

  const onEvent = useCallback((data: EventData) => {
    if (data.type === EVENTS.TOUR_END) {
      writeCompleted(true);
      setRun(false);
    }
  }, []);

  const locale = useMemo(
    () => ({
      back: t('controls.back'),
      close: t('controls.close'),
      last: t('controls.last'),
      next: t('controls.next'),
      skip: t('controls.skip'),
    }),
    [t],
  );

  if (!user || !hasCompletedOnboarding || steps.length === 0) return null;

  return (
    <Joyride
      run={run}
      steps={steps}
      continuous
      scrollToFirstStep
      onEvent={onEvent}
      locale={locale}
      options={{
        showProgress: true,
        buttons: ['back', 'skip', 'primary'],
        overlayClickAction: false,
        primaryColor: '#F5D000',
        zIndex: 10000,
      }}
    />
  );
}
