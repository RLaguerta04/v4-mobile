// MediaWatch AI News Writer — a two-step Configure → Preview flow (the web's
// two-column layout folded for phone). The generator is a deterministic offline
// engine (utils/article-writer); copy/share use RN Share. Image generation is
// omitted for v1 (the reference's image side is an offline placeholder).
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PageHeading } from '@/components/page-heading';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import {
  articleToPlainText,
  generateArticle,
  GeneratedArticle,
  WRITER_EXAMPLES,
  WRITER_FORMATS,
  WRITER_LANGUAGES,
  WRITER_LENGTHS,
  WRITER_SECTION_NAMES,
  WRITER_SECTIONS,
  WRITER_TONES,
  WriterFormat,
  WriterLanguage,
  WriterLength,
  WriterTone,
} from '@/utils/article-writer';

const palette = { background: '#F5F4F0', card: '#FFFFFF', text: '#1A1A1A', textSecondary: '#6B7280', border: '#E4E6EA', pillBg: '#F0EEEA' };

export function AiWriterScreen() {
  const { accentColor } = useAuth();
  const [step, setStep] = useState<'configure' | 'preview'>('configure');
  const [section, setSection] = useState('News');
  const [topic, setTopic] = useState('');
  const [reference, setReference] = useState('');
  const [language, setLanguage] = useState<WriterLanguage>('English');
  const [tone, setTone] = useState<WriterTone>('Professional');
  const [format, setFormat] = useState<WriterFormat>('News Article');
  const [length, setLength] = useState<WriterLength>('medium');
  const [article, setArticle] = useState<GeneratedArticle | null>(null);

  function loadExample() {
    const ex = WRITER_EXAMPLES[format];
    setTopic(ex.topic);
    setReference(ex.reference ?? '');
  }

  function generate() {
    const a = generateArticle({ section, topic, reference, language, tone, format, length });
    setArticle(a);
    setStep('preview');
  }

  function clearAll() {
    setTopic('');
    setReference('');
    setArticle(null);
  }

  const canGenerate = topic.trim().length > 0;

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <PageHeading title="AI News Writer" description={step === 'configure' ? 'Draft a story' : 'Preview'} />
          {step === 'preview' && (
            <Pressable onPress={() => setStep('configure')} accessibilityRole="button" style={({ pressed }) => [styles.backChip, pressed && styles.pressed]}>
              <Ionicons name="chevron-back" size={16} color={palette.text} />
              <Text style={styles.backChipText}>Edit</Text>
            </Pressable>
          )}
        </View>

        {step === 'configure' ? (
          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Field label="1 · Newspaper Section" hint={WRITER_SECTIONS[section]?.structure}>
              <PillRow options={WRITER_SECTION_NAMES} value={section} onChange={setSection} accent={accentColor} />
            </Field>

            <Field label="2 · Topic / Key Message">
              <TextInput
                value={topic}
                onChangeText={setTopic}
                placeholder="Paste or write the key facts of the story…"
                placeholderTextColor={palette.textSecondary}
                style={styles.textArea}
                multiline
              />
              <View style={styles.topicFoot}>
                <Text style={styles.charCount}>{topic.trim().length} chars</Text>
                <Pressable onPress={loadExample} accessibilityRole="button" style={({ pressed }) => [styles.exampleBtn, pressed && styles.pressed]}>
                  <Ionicons name="sparkles-outline" size={13} color={accentColor} />
                  <Text style={[styles.exampleText, { color: accentColor }]}>Load example</Text>
                </Pressable>
              </View>
            </Field>

            <Field label="Article Reference (optional)">
              <TextInput
                value={reference}
                onChangeText={setReference}
                placeholder="https://…"
                placeholderTextColor={palette.textSecondary}
                style={styles.input}
                autoCapitalize="none"
                keyboardType="url"
              />
            </Field>

            <Field label="Language">
              <PillRow options={WRITER_LANGUAGES} value={language} onChange={(v) => setLanguage(v as WriterLanguage)} accent={accentColor} />
            </Field>
            <Field label="Tone">
              <PillRow options={WRITER_TONES} value={tone} onChange={(v) => setTone(v as WriterTone)} accent={accentColor} />
            </Field>
            <Field label="Format">
              <PillRow options={WRITER_FORMATS} value={format} onChange={(v) => setFormat(v as WriterFormat)} accent={accentColor} />
            </Field>
            <Field label="Length">
              <View style={styles.lengthRow}>
                {(Object.keys(WRITER_LENGTHS) as WriterLength[]).map((l) => {
                  const on = l === length;
                  const info = WRITER_LENGTHS[l];
                  return (
                    <Pressable
                      key={l}
                      onPress={() => setLength(l)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      style={[styles.lengthCard, on && { borderColor: accentColor, backgroundColor: `${accentColor}0F` }]}>
                      <Text style={[styles.lengthTitle, on && { color: accentColor }]}>{info.label}</Text>
                      <Text style={styles.lengthWords}>{info.words} words</Text>
                    </Pressable>
                  );
                })}
              </View>
            </Field>

            <View style={styles.actions}>
              <Pressable
                onPress={generate}
                disabled={!canGenerate}
                accessibilityRole="button"
                style={[styles.generateBtn, { backgroundColor: accentColor }, !canGenerate && styles.disabled]}>
                <Ionicons name="sparkles" size={16} color="#FFFFFF" />
                <Text style={styles.generateText}>Generate Article</Text>
              </Pressable>
              <Pressable onPress={clearAll} accessibilityRole="button" style={({ pressed }) => [styles.clearBtn, pressed && styles.pressed]}>
                <Text style={styles.clearText}>Clear</Text>
              </Pressable>
            </View>
          </ScrollView>
        ) : (
          article && (
            <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
              <View style={styles.previewActions}>
                <Pressable onPress={() => Share.share({ message: articleToPlainText(article) })} accessibilityRole="button" style={({ pressed }) => [styles.pvAction, pressed && styles.pressed]}>
                  <Ionicons name="share-social-outline" size={15} color={palette.text} />
                  <Text style={styles.pvActionText}>Share / Copy</Text>
                </Pressable>
                <Pressable onPress={generate} accessibilityRole="button" style={({ pressed }) => [styles.pvAction, pressed && styles.pressed]}>
                  <Ionicons name="refresh" size={15} color={palette.text} />
                  <Text style={styles.pvActionText}>Regenerate</Text>
                </Pressable>
              </View>

              <View style={styles.article}>
                <Text style={styles.artKicker}>{article.kicker.toUpperCase()}</Text>
                <Text style={styles.artHeadline}>{article.headline}</Text>
                <Text style={styles.artByline}>{article.byline}</Text>
                {article.body.map((para, i) => (
                  <Text key={i} style={styles.artPara}>
                    {i === 0 ? <Text style={styles.artDateline}>{article.dateline} — </Text> : null}
                    {para}
                  </Text>
                ))}
                {article.pullQuote && <Text style={styles.artQuote}>“{article.pullQuote}”</Text>}
              </View>

              <View style={styles.metaFoot}>
                <Text style={styles.metaFootText}>~{article.wordCount} words · {article.structure}</Text>
              </View>
              <View style={styles.disclaimer}>
                <Ionicons name="alert-circle-outline" size={13} color={palette.textSecondary} />
                <Text style={styles.disclaimerText}>Generated by AI from your inputs — verify facts before publishing.</Text>
              </View>
            </ScrollView>
          )
        )}
      </SafeAreaView>
    </View>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
    </View>
  );
}

function PillRow({ options, value, onChange, accent }: { options: string[]; value: string; onChange: (v: string) => void; accent: string }) {
  return (
    <View style={styles.pillRow}>
      {options.map((o) => {
        const on = o === value;
        return (
          <Pressable
            key={o}
            onPress={() => onChange(o)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={[styles.pill, on && { backgroundColor: accent }]}>
            <Text style={[styles.pillText, on && styles.pillTextOn]}>{o}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  safeArea: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.three, paddingTop: Spacing.three, paddingBottom: Spacing.two },
  backChip: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: palette.pillBg, borderRadius: 999, paddingHorizontal: Spacing.two + 2, paddingVertical: Spacing.one + 2 },
  backChipText: { fontSize: 13, fontWeight: '600', color: palette.text },
  body: { paddingHorizontal: Spacing.three, paddingBottom: BottomTabInset + Spacing.four, gap: Spacing.three },
  field: { gap: Spacing.one + 2 },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: palette.text },
  fieldHint: { fontSize: 11, color: palette.textSecondary, fontStyle: 'italic' },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one },
  pill: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.one + 2, borderRadius: 999, backgroundColor: palette.pillBg },
  pillText: { fontSize: 13, fontWeight: '600', color: palette.text },
  pillTextOn: { color: '#FFFFFF' },
  textArea: {
    minHeight: 110,
    textAlignVertical: 'top',
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    padding: Spacing.three,
    fontSize: 15,
    lineHeight: 21,
    color: palette.text,
  },
  topicFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  charCount: { fontSize: 11, color: palette.textSecondary },
  exampleBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  exampleText: { fontSize: 13, fontWeight: '600' },
  input: { backgroundColor: palette.card, borderWidth: 1, borderColor: palette.border, borderRadius: 10, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two + 2, fontSize: 14, color: palette.text },
  lengthRow: { flexDirection: 'row', gap: Spacing.two },
  lengthCard: { flex: 1, borderWidth: 1, borderColor: palette.border, borderRadius: 12, padding: Spacing.two + 2, gap: 2, alignItems: 'center', backgroundColor: palette.card },
  lengthTitle: { fontSize: 14, fontWeight: '700', color: palette.text },
  lengthWords: { fontSize: 11, color: palette.textSecondary },
  actions: { gap: Spacing.two, marginTop: Spacing.two },
  generateBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, paddingVertical: Spacing.three },
  generateText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  disabled: { opacity: 0.4 },
  clearBtn: { alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.two + 2, borderRadius: 12, backgroundColor: palette.pillBg },
  clearText: { fontSize: 14, fontWeight: '700', color: palette.text },
  pressed: { opacity: 0.6 },

  previewActions: { flexDirection: 'row', gap: Spacing.two },
  pvAction: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.card, borderRadius: 999, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  pvActionText: { fontSize: 13, fontWeight: '600', color: palette.text },
  article: { backgroundColor: palette.card, borderWidth: 1, borderColor: palette.border, borderRadius: 14, padding: Spacing.four, gap: Spacing.two },
  artKicker: { fontSize: 11, fontWeight: '800', letterSpacing: 1, color: '#E94F37' },
  artHeadline: { fontSize: 24, fontWeight: '800', lineHeight: 30, color: palette.text },
  artByline: { fontSize: 12, color: palette.textSecondary, marginBottom: Spacing.one },
  artDateline: { fontSize: 15, fontWeight: '700', color: palette.text },
  artPara: { fontSize: 15, lineHeight: 23, color: palette.text },
  artQuote: { fontSize: 18, fontWeight: '600', fontStyle: 'italic', lineHeight: 26, color: '#6B4DE8', borderLeftWidth: 3, borderLeftColor: '#B9A4F7', paddingLeft: Spacing.three, marginTop: Spacing.two },
  metaFoot: { alignItems: 'center' },
  metaFootText: { fontSize: 11, color: palette.textSecondary },
  disclaimer: { flexDirection: 'row', alignItems: 'center', gap: 5, justifyContent: 'center' },
  disclaimerText: { fontSize: 11, color: palette.textSecondary, flexShrink: 1 },
});
