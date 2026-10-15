// Native (iOS/Android) PDF surface. Android's system WebView can't render a
// file:// PDF at all, and iOS WKWebView's file:// rendering is inconsistent — so
// rather than point the WebView at the file, we read the PDF's bytes and render
// each page to a <canvas> with pdf.js inside the WebView (see pdf-viewer-html).
// That path renders identically on both platforms. The `.web.tsx` sibling keeps
// the browser <iframe>, which has a native PDF engine and needs none of this.
import { File } from 'expo-file-system';
import { useEffect, useState } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';

import { buildPdfViewerHtml } from '@/utils/pdf-viewer-html';

export type PdfFrameProps = {
  uri: string;
  style?: StyleProp<ViewStyle>;
  // Native only — the inline preview disables scroll (and renders just the first
  // page); the full-screen modal enables scroll + pinch-zoom and renders every
  // page. Ignored on web.
  scrollEnabled?: boolean;
  onLoadEnd?: () => void;
  onError?: () => void;
};

export function PdfFrame({ uri, style, scrollEnabled = true, onLoadEnd, onError }: PdfFrameProps) {
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const base64 = await new File(uri).base64();
        if (active) setHtml(buildPdfViewerHtml(base64, { allPages: scrollEnabled }));
      } catch {
        if (active) onError?.();
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uri, scrollEnabled]);

  // Parent shows its own spinner until onLoadEnd fires, so render nothing yet.
  if (!html) return null;

  return (
    <WebView
      source={{ html }}
      originWhitelist={['*']}
      scrollEnabled={scrollEnabled}
      // Let our viewport meta control sizing instead of Android's auto-fit.
      scalesPageToFit={false}
      onMessage={(e) => {
        try {
          const msg = JSON.parse(e.nativeEvent.data);
          if (msg.type === 'loaded') onLoadEnd?.();
          else if (msg.type === 'error') onError?.();
        } catch {
          // Ignore non-JSON messages.
        }
      }}
      onError={onError}
      onHttpError={onError}
      style={style}
    />
  );
}
