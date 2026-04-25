import type { Step } from 'react-joyride';
import type { TFunction } from 'i18next';

export const TOUR_RESTART_EVENT = 'bwlab:tour:restart';
export const TOUR_STORAGE_KEY = 'bwlab.tour.completed.v1';

export function triggerTourRestart(): void {
  window.dispatchEvent(new Event(TOUR_RESTART_EVENT));
}

export function buildTourSteps(t: TFunction<'tour'>): Step[] {
  const all: Step[] = [
    {
      target: 'body',
      placement: 'center',
      skipBeacon: true,
      title: t('welcome.title'),
      content: t('welcome.body'),
    },
    {
      target: '[data-tour="sidebar"]',
      placement: 'right',
      title: t('sidebar.title'),
      content: t('sidebar.body'),
    },
    {
      target: '[data-tour="presets"]',
      placement: 'right',
      title: t('presets.title'),
      content: t('presets.body'),
    },
    {
      target: '[data-tour="tabbar"]',
      placement: 'bottom',
      title: t('tabbar.title'),
      content: t('tabbar.body'),
    },
    {
      target: '[data-tour="breadcrumb"]',
      placement: 'bottom',
      title: t('breadcrumb.title'),
      content: t('breadcrumb.body'),
    },
    {
      target: '[data-tour="chat-composer"]',
      placement: 'top',
      title: t('composer.title'),
      content: t('composer.body'),
    },
    {
      target: '[data-tour="shell"]',
      placement: 'top',
      title: t('shell.title'),
      content: t('shell.body'),
    },
  ];

  return all.filter((step) => {
    if (typeof step.target !== 'string' || step.target === 'body') return true;
    return document.querySelector(step.target) !== null;
  });
}
