/**
 * Display zoom shared by every image tool.
 *
 * Zoom is presentational only. It changes the CSS box the image occupies and
 * never the pixel data behind it, so switching levels costs no quality and the
 * exported file is identical at any setting.
 *
 * 'fit' scales the image down until it fits the stage. A number is a literal
 * factor where 1 means one image pixel per CSS pixel, which is what users
 * expect "100%" to mean. Note this differs from a `width: 100%` style rule,
 * which fills the container instead and is really a fit.
 */
export type ZoomLevel = 'fit' | number;

export const ZOOM_LEVELS: ReadonlyArray<{ value: ZoomLevel; label: string }> = [
  { value: 'fit', label: 'Fit' },
  { value: 0.5, label: '50%' },
  { value: 1, label: '100%' },
  { value: 2, label: '200%' },
];

export interface ZoomStyles {
  width: string | null;
  height: string | null;
  maxWidth: string;
  maxHeight: string;
}

/**
 * How tall a fitted image may get: the whole stage, no more. A percentage
 * resolves here because `tool-shell` gives the canvas column a definite
 * height to measure against.
 */
export const FIT_MAX_HEIGHT = '100%';

/**
 * CSS box for the displayed element at `zoom`.
 *
 * In 'fit' the size is left to the max-width/height rules, which preserves the
 * aspect ratio of a replaced element without needing the natural size at all.
 */
export function zoomStyles(
  zoom: ZoomLevel,
  naturalWidth: number | null,
  naturalHeight: number | null,
): ZoomStyles {
  if (zoom === 'fit' || !naturalWidth || !naturalHeight) {
    return {
      width: null,
      height: null,
      maxWidth: '100%',
      maxHeight: FIT_MAX_HEIGHT,
    };
  }
  return {
    width: naturalWidth * zoom + 'px',
    height: naturalHeight * zoom + 'px',
    maxWidth: 'none',
    maxHeight: 'none',
  };
}

/**
 * Fitted CSS box in explicit pixels, for media that is not a direct child of
 * the stage frame.
 *
 * `zoomStyles` fits with `max-height: 100%`, which needs the frame to be the
 * media's containing block. Pixel Sort wraps its image in a hugging element so
 * the mask overlay can sit on it with `inset: 0`, and that wrapper's auto
 * height leaves the percentage unresolved, so the browser drops the constraint
 * and the image renders at full size.
 *
 * The fit is computed from the frame's measured box instead, and applied to
 * the WRAPPER so the overlay stays aligned. It only ever scales down.
 */
export function zoomStylesInStage(
  zoom: ZoomLevel,
  naturalWidth: number | null,
  naturalHeight: number | null,
  stage: { width: number; height: number } | null,
): ZoomStyles {
  if (!naturalWidth || !naturalHeight) {
    return zoomStyles(zoom, naturalWidth, naturalHeight);
  }

  if (zoom !== 'fit') {
    return {
      width: naturalWidth * zoom + 'px',
      height: naturalHeight * zoom + 'px',
      maxWidth: 'none',
      maxHeight: 'none',
    };
  }

  // Before the frame has been measured, fall back to the percentage form so
  // the first paint is bounded rather than full size.
  if (!stage || stage.width <= 0 || stage.height <= 0) {
    return zoomStyles(zoom, naturalWidth, naturalHeight);
  }

  const scale = Math.min(
    1,
    stage.width / naturalWidth,
    stage.height / naturalHeight,
  );
  return {
    width: Math.floor(naturalWidth * scale) + 'px',
    height: Math.floor(naturalHeight * scale) + 'px',
    maxWidth: '100%',
    maxHeight: '100%',
  };
}

/** Formats the scale actually on screen, for a toolbar readout. */
export function formatScale(scale: number): string {
  return Math.round(scale * 100) + '%';
}
