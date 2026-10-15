// Shared helpers for opening a print article's real PDF attachment — used by
// both the in-app preview modal (pdf-preview-modal.tsx) and its "Open in..."
// fallback button, so the resolve/share logic lives in one place rather than
// being duplicated across components.
import { Asset } from 'expo-asset';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';

// Resolves a require()'d PDF asset module to a usable URI — near instant since
// it's already bundled, not a network fetch. On native this is a file:// path
// (localUri); on web localUri is often null, so fall back to the served asset
// URL (uri), which an <iframe> can load directly.
export async function resolveLocalUri(assetModule: number): Promise<string> {
  const asset = await Asset.fromModule(assetModule).downloadAsync();
  const uri = asset.localUri ?? asset.uri;
  if (!uri) throw new Error('Asset has no URI');
  return uri;
}

// Fallback for when the in-app WebView preview isn't available or fails to
// render — hands off to the OS share/open sheet instead.
export async function shareBroadsheetPdf(article: { pdfAttachment?: number; title: string }) {
  if (!article.pdfAttachment) return;
  try {
    const localUri = await resolveLocalUri(article.pdfAttachment);
    if (!(await Sharing.isAvailableAsync())) {
      Alert.alert('Preview unavailable', "Sharing isn't supported on this device.");
      return;
    }
    await Sharing.shareAsync(localUri, { mimeType: 'application/pdf', dialogTitle: article.title });
  } catch {
    Alert.alert('Preview failed', "The broadsheet page couldn't be opened.");
  }
}
