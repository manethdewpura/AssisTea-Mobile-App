import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { selectTheme } from '../../store/selectors';
import { authService } from '../../services';
import { useNotifications, useAppSelector } from '../../hooks';
import Input from '../../components/atoms/Input';
import Button from '../../components/atoms/Button';
import ThemeSelector from '../../components/organisms/ThemeSelector';
import {
  handleFirebaseError,
  logError,
  validateEmail,
  ensureNetworkConnection,
  isNetworkError,
} from '../../utils';

interface ForgotPasswordScreenProps {
  onSwitchToLogin: () => void;
}

const ForgotPasswordScreen: React.FC<ForgotPasswordScreenProps> = ({ onSwitchToLogin }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const { colors } = useAppSelector(selectTheme);
  const { showErrorAlert, showToast } = useNotifications();

  const validateForm = (): boolean => {
    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
      setEmailError(emailValidation.error!);
      return false;
    } else {
      setEmailError('');
      return true;
    }
  };

  const handleResetPassword = async () => {
    // Clear previous errors
    setEmailError('');

    // Validate form
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      // Check network connection before attempting reset
      await ensureNetworkConnection();

      await authService.resetPassword(email);
      setEmailSent(true);
      showToast('Password reset email sent! Check your inbox.', 'success');
    } catch (error: any) {
      const appError = handleFirebaseError(error);
      logError(appError, 'ForgotPasswordScreen');

      // Handle specific error cases
      if (isNetworkError(error)) {
        showErrorAlert(appError, () => {
          handleResetPassword();
        });
      } else if (error.code === 'auth/user-not-found') {
        setEmailError('No account found with this email address');
        showToast('No account found with this email address', 'warning');
      } else if (error.code === 'auth/invalid-email') {
        setEmailError('Please enter a valid email address');
        showToast('Please enter a valid email address', 'warning');
      } else if (error.code === 'auth/too-many-requests') {
        showErrorAlert(appError);
      } else {
        showErrorAlert(appError);
      }
    } finally {
      setLoading(false);
    }
  };

  if (emailSent) {
    return (
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <ThemeSelector style={styles.themeSelector} />
        </View>

        <View style={styles.formContainer}>
          <View style={styles.logoContainer}>
            <Image
              source={require('../../common/assets/images/LogoRound.png')}
              style={styles.logo}
            />
          </View>
          <Text style={[styles.title, { color: colors.textColoredSecondary }]}>
            Check Your Email
          </Text>
          <Text style={[styles.subtitle, { color: colors.textColored }]}>
            We've sent a password reset link to{'\n'}
            <Text style={[styles.emailText, { color: colors.primary }]}>{email}</Text>
          </Text>

          <Button
            title="Back to Login"
            onPress={onSwitchToLogin}
            style={styles.button}
          />

          <TouchableOpacity
            style={styles.resendButton}
            onPress={() => {
              setEmailSent(false);
              handleResetPassword();
            }}
          >
            <Text style={[styles.resendText, { color: colors.textColoredSecondary }]}>
              Didn't receive the email? Resend
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <ThemeSelector style={styles.themeSelector} />
      </View>

      <View style={styles.formContainer}>
        <View style={styles.logoContainer}>
          <Image
            source={require('../../common/assets/images/LogoRound.png')}
            style={styles.logo}
          />
        </View>
        <Text style={[styles.title, { color: colors.textColoredSecondary }]}>
          Forgot Password?
        </Text>
        <Text style={[styles.subtitle, { color: colors.textColored }]}>
          Enter your email address and we'll send you a link to reset your password
        </Text>

        <Input
          placeholder="Email"
          value={email}
          onChangeText={text => {
            setEmail(text);
            if (emailError) setEmailError('');
          }}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          error={emailError}
        />

        <Button
          title={loading ? 'Sending...' : 'Send Reset Link'}
          onPress={handleResetPassword}
          loading={loading}
          disabled={loading}
          style={styles.button}
        />

        <TouchableOpacity
          style={styles.backButton}
          onPress={onSwitchToLogin}
        >
          <Text style={[styles.backText, { color: colors.textColored }]}>
            Remember your password?{' '}
            <Text style={[styles.backTextBold, { color: colors.textColoredSecondary }]}>
              Sign In
            </Text>
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 10,
  },
  themeSelector: {
    alignSelf: 'flex-end',
  },
  formContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logo: {
    width: 150,
    height: 150,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 24,
  },
  emailText: {
    fontWeight: 'bold',
  },
  button: {
    marginBottom: 20,
  },
  backButton: {
    alignItems: 'center',
  },
  backText: {
    fontSize: 14,
    fontWeight: 'normal',
  },
  backTextBold: {
    fontWeight: 'bold',
    textDecorationLine: 'underline',
  },
  resendButton: {
    alignItems: 'center',
    marginTop: 20,
  },
  resendText: {
    fontSize: 14,
    fontWeight: 'bold',
    textDecorationLine: 'underline',
  },
});

export default ForgotPasswordScreen;
