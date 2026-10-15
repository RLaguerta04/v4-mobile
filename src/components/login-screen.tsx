import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MmiIcon } from '@/components/mmi-icon';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';

const palette = {
  background: '#F5F4F0',
  card: '#FFFFFF',
  text: '#1A1A1A',
  textSecondary: '#8A8580',
  border: '#E7DDCC',
  disabled: '#D8D2C4',
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginScreen() {
  const { signIn, accentColor } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const canSubmit = EMAIL_PATTERN.test(email.trim()) && password.length > 0;

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}>
            <View style={styles.header}>
              <MmiIcon size={56} color={accentColor} />
              <Text style={styles.title}>Welcome back</Text>
              <Text style={styles.subtitle}>Log in to continue to Media Meter</Text>
            </View>

            <View style={styles.form}>
              <View style={styles.field}>
                <Text style={styles.label}>Email</Text>
                <View style={styles.inputRow}>
                  <Ionicons name="mail-outline" size={18} color={palette.textSecondary} />
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder="Enter your email"
                    placeholderTextColor={palette.textSecondary}
                    style={styles.input}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    returnKeyType="next"
                  />
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Password</Text>
                <View style={styles.inputRow}>
                  <Ionicons name="lock-closed-outline" size={18} color={palette.textSecondary} />
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Enter your password"
                    placeholderTextColor={palette.textSecondary}
                    style={styles.input}
                    autoCapitalize="none"
                    autoCorrect={false}
                    secureTextEntry={!passwordVisible}
                    returnKeyType="done"
                  />
                  <Pressable
                    onPress={() => setPasswordVisible((v) => !v)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'}>
                    <Ionicons
                      name={passwordVisible ? 'eye-off-outline' : 'eye-outline'}
                      size={18}
                      color={palette.textSecondary}
                    />
                  </Pressable>
                </View>
              </View>

              <Pressable
                onPress={() => setRememberMe((v) => !v)}
                style={styles.rememberRow}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: rememberMe }}
                accessibilityLabel="Remember me">
                <Ionicons
                  name={rememberMe ? 'checkbox' : 'square-outline'}
                  size={20}
                  color={rememberMe ? accentColor : palette.textSecondary}
                />
                <Text style={styles.rememberText}>Remember me</Text>
              </Pressable>

              <Pressable
                onPress={signIn}
                disabled={!canSubmit}
                accessibilityRole="button"
                accessibilityLabel="Log in"
                style={({ pressed }) => [
                  styles.loginButton,
                  { backgroundColor: accentColor },
                  !canSubmit && styles.loginButtonDisabled,
                  pressed && canSubmit && styles.pressed,
                ]}>
                <Text style={[styles.loginButtonText, !canSubmit && styles.loginButtonTextDisabled]}>
                  Log In
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.background,
  },
  safeArea: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.five,
    paddingVertical: Spacing.six,
    gap: Spacing.six,
  },
  header: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: palette.text,
  },
  subtitle: {
    fontSize: 14,
    color: palette.textSecondary,
  },
  form: {
    gap: Spacing.four,
  },
  field: {
    gap: Spacing.one,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.text,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    height: 48,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.border,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: palette.text,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  rememberText: {
    fontSize: 14,
    color: palette.text,
  },
  loginButton: {
    height: 50,
    borderRadius: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginButtonDisabled: {
    backgroundColor: palette.disabled,
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  loginButtonTextDisabled: {
    color: palette.textSecondary,
  },
  pressed: {
    opacity: 0.85,
  },
});
