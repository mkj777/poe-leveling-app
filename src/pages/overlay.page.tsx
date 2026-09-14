import { useEffect, useRef, useState } from 'react';

import InGameScreen from '@/components/in-game-screen';
import {
  OVERLAY_HEADER_HEIGHT,
  OVERLAY_MIN_HEIGHT
} from '@/utilities/constants';
import type { OverlaySettings } from '@/services/overlay-settings';
import type { OverlayView } from '@/utilities/overlay-view';
import {
  EMPTY_OVERLAY_VIEW,
  OVERLAY_READY_EVENT,
  OVERLAY_VIEW_EVENT
} from '@/utilities/overlay-view';
import { OVERLAY_SETTINGS_EVENT } from '@/services/overlay-settings';
import { emit, listen } from '@tauri-apps/api/event';
import { usePoeWindow } from '@/hooks/usePoeWindow';
import { useSettingsStore } from '@/store/settings.store';

/**
 * Its own window, so the main window can stay the main window.
 *
 * It displays and does nothing else (ADR-0012): no route, no game data, no
 * progress, no storage. The main window tells it what to show, fully
 * computed. What the user drags here it reports back there.
 */
export default function OverlayPage() {
  const [view, setView] = useState<OverlayView>(EMPTY_OVERLAY_VIEW);
  const [contentHeight, setContentHeight] = useState(OVERLAY_MIN_HEIGHT);
  const [editMode, setEditMode] = useState(false);

  const content = useRef<HTMLDivElement>(null);

  usePoeWindow(true, contentHeight, editMode);

  // The window is transparent, so the body must bring neither background nor
  // border. Only the card in the content makes the surface.
  useEffect(() => {
    document.body.classList.add('overlay-window');
    return () => document.body.classList.remove('overlay-window');
  }, []);

  useEffect(() => {
    let stop: (() => void) | undefined;
    let cancelled = false;

    void (async () => {
      const off = await listen<OverlayView>(OVERLAY_VIEW_EVENT, (event) => {
        setView(event.payload);
      });

      if (cancelled) {
        off();
        return;
      }
      stop = off;

      // Listen first, then report. The other way round the answer can arrive
      // before the listener, and the overlay would stay empty until the state
      // next changes on its own.
      await emit(OVERLAY_READY_EVENT);
    })();

    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

  useEffect(() => {
    const toggle = listen('overlay-edit-toggle', () => {
      setEditMode((value) => !value);
    });

    // Size, opacity and offset belong to the main window. Here they live in
    // memory only, so that drawing is possible.
    const settings = listen<OverlaySettings>(
      OVERLAY_SETTINGS_EVENT,
      (event) => {
        useSettingsStore.setState(event.payload);
      }
    );

    return () => {
      void toggle.then((off) => off());
      void settings.then((off) => off());
    };
  }, []);

  useEffect(() => {
    if (content.current === null) return;

    setContentHeight(
      Math.ceil(content.current.getBoundingClientRect().height) +
        24 +
        OVERLAY_HEADER_HEIGHT
    );
  }, [view]);

  return (
    <InGameScreen
      view={view}
      contentRef={content}
      editMode={editMode}
      onCloseEdit={() => setEditMode(false)}
    />
  );
}
