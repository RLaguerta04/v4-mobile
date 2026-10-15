// Full-screen in-app preview for a print article's real PDF attachment.
// react-native-webview renders local PDFs natively on both platforms in most
// cases (WKWebView on iOS, Chromium's PDFium on modern Android), but local
// file:// rendering is known to be inconsistent on some devices — so this
// always offers the "Open in..." share-sheet fallback, both in the header and
// inline if the WebView itself reports an error.
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { cardPalette } from '@/components/detail-primitives';
import { MEDIA_TYPE_META } from '@/components/mediawatch/article-ui';
import { PdfFrame } from '@/components/mediawatch/pdf-frame';
import { Spacing } from '@/constants/theme';
import type { NewsArticle } from '@/data/mediawatch-types';
import { resolveLocalUri, shareBroadsheetPdf } from '@/utils/broadsheet-pdf';

export function PdfPreviewModal({
  visible,
  article,
  onClose,
}: {
  visible: boolean;
  article: Pick<NewsArticle, 'pdfAttachment' | 'title'>;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [webviewLoading, setWebviewLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!visible || !article.pdfAttachment) return;
    setLocalUri(null);
    setWebviewLoading(true);
    setFailed(false);
    resolveLocalUri(article.pdfAttachment)
      .then(setLocalUri)
      .catch(() => setFailed(true));
  }, [visible, article.pdfAttachment]);

  const showSpinner = !failed && (!localUri || webviewLoading);

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={1}>
            {article.title}
          </Text>
          <View style={styles.headerActions}>
            <Pressable
              onPress={() => shareBroadsheetPdf(article)}
              accessibilityRole="button"
              accessibilityLabel="Open in another app"
              hitSlop={8}
              style={styles.headerButton}>
              <Ionicons name="open-outline" size={20} color={cardPalette.text} />
            </Pressable>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close preview"
              hitSlop={8}
              style={styles.headerButton}>
              <Ionicons name="close" size={22} color={cardPalette.text} />
            </Pressable>
          </View>
        </View>

        <View style={styles.body}>
          {failed ? (
            <View style={styles.centered}>
              <Ionicons name="document-text-outline" size={40} color={cardPalette.textSecondary} />
              <Text style={styles.failedText}>Couldn't preview this file in-app.</Text>
              <Pressable
                onPress={() => shareBroadsheetPdf(article)}
                accessibilityRole="button"
                style={styles.openExternalButton}>
                <Text style={styles.openExternalButtonText}>Open in…</Text>
              </Pressable>
            </View>
          ) : (
            localUri && (
              <PdfFrame
                uri={localUri}
                onError={() => setFailed(true)}
                onLoadEnd={() => setWebviewLoading(false)}
                style={styles.webview}
              />
            )
          )}
          {showSpinner && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={cardPalette.text} />
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

// Inline, in-place broadsheet preview — the article-detail analogue of the web
// app's embedded PDF viewer. Renders the real file's first page right in the
// detail scroll with internal scrolling disabled (so it never fights the parent
// ScrollView); a transparent overlay means a tap anywhere — or the expand
// button — hands off to the full-screen PdfPreviewModal, where the page can
// actually be panned and zoomed. Falls back to a tap-to-open card if the
// WebView can't render the file (e.g. some Android devices).
export function InlinePdfPreview({
  article,
  onExpand,
}: {
  article: Pick<NewsArticle, 'pdfAttachment' | 'title' | 'page' | 'mediaType'>;
  onExpand: () => void;
}) {
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const meta = MEDIA_TYPE_META[article.mediaType];

  useEffect(() => {
    let active = true;
    setLocalUri(null);
    setLoading(true);
    setFailed(false);
    if (!article.pdfAttachment) {
      setFailed(true);
      return;
    }
    resolveLocalUri(article.pdfAttachment)
      .then((uri) => active && setLocalUri(uri))
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [article.pdfAttachment]);

  return (
    <View style={styles.inlineCard}>
      <View style={styles.inlineToolbar}>
        <Ionicons name="document-text" size={14} color={meta.color} />
        <Text style={styles.inlineToolbarLabel} numberOfLines={1}>
          {article.page ? `Page ${article.page}` : 'Broadsheet'}
        </Text>
        <Pressable
          onPress={() => shareBroadsheetPdf(article)}
          accessibilityRole="button"
          accessibilityLabel="Open in another app"
          hitSlop={8}
          style={styles.inlineToolbarButton}>
          <Ionicons name="open-outline" size={16} color={cardPalette.textSecondary} />
        </Pressable>
        <Pressable
          onPress={onExpand}
          accessibilityRole="button"
          accessibilityLabel="Expand to full screen"
          hitSlop={8}
          style={styles.inlineToolbarButton}>
          <Ionicons name="expand-outline" size={16} color={cardPalette.textSecondary} />
        </Pressable>
      </View>

      <View style={styles.inlineViewport}>
        {failed ? (
          <Pressable
            style={styles.inlineFallback}
            onPress={() => shareBroadsheetPdf(article)}
            accessibilityRole="button"
            accessibilityLabel="Open the broadsheet page">
            <Ionicons name="document-text-outline" size={34} color={cardPalette.textSecondary} />
            <Text style={styles.inlineFallbackText}>Tap to open the broadsheet page</Text>
          </Pressable>
        ) : (
          <>
            {localUri && (
              <PdfFrame
                uri={localUri}
                scrollEnabled={false}
                onError={() => setFailed(true)}
                onLoadEnd={() => setLoading(false)}
                style={styles.inlineWebview}
              />
            )}
            {/* The embed is a preview, not an interactive viewer: capture taps
                so they expand to full screen instead of scrolling in place. */}
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={onExpand}
              accessibilityRole="button"
              accessibilityLabel="Expand broadsheet to full screen"
            />
            {loading && (
              <View style={styles.inlineLoading}>
                <ActivityIndicator color={cardPalette.text} />
              </View>
            )}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: cardPalette.card },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: 1,
    borderBottomColor: cardPalette.border,
  },
  title: { flex: 1, fontSize: 15, fontWeight: '700', color: cardPalette.text, marginRight: Spacing.two },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  headerButton: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1 },
  webview: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two, padding: Spacing.four },
  failedText: { fontSize: 14, color: cardPalette.textSecondary, textAlign: 'center' },
  openExternalButton: {
    marginTop: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: 999,
    backgroundColor: cardPalette.text,
  },
  openExternalButtonText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: cardPalette.card,
  },

  // Inline embed (article detail)
  inlineCard: {
    borderWidth: 1,
    borderColor: cardPalette.border,
    borderRadius: Spacing.three,
    overflow: 'hidden',
    backgroundColor: cardPalette.card,
  },
  inlineToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: 1,
    borderBottomColor: cardPalette.border,
  },
  inlineToolbarLabel: { flex: 1, fontSize: 12.5, fontWeight: '700', color: cardPalette.text },
  inlineToolbarButton: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
  inlineViewport: { height: 440, backgroundColor: cardPalette.track },
  inlineWebview: { flex: 1, backgroundColor: 'transparent' },
  inlineLoading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two, padding: Spacing.four },
  inlineFallbackText: { fontSize: 13, color: cardPalette.textSecondary, textAlign: 'center' },
});
