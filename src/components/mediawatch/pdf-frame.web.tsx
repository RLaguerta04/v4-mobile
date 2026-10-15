// Web PDF surface — renders the file in the browser's native PDF viewer via an
// <iframe>, exactly like the web reference app embeds it. This is the web
// override for pdf-frame.tsx (which uses react-native-webview on iOS/Android);
// react-native-webview has no web implementation, so it can't be used here.
import type { PdfFrameProps } from './pdf-frame';

export function PdfFrame({ uri, onLoadEnd, onError }: PdfFrameProps) {
  return (
    <iframe
      src={uri}
      title="PDF preview"
      onLoad={onLoadEnd}
      onError={onError}
      style={{ border: 'none', width: '100%', height: '100%' }}
    />
  );
}
