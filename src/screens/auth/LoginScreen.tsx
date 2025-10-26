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
import PasswordInput from '../../components/atoms/PasswordInput';
import Button from '../../components/atoms/Button';
import ThemeSelector from '../../components/organisms/ThemeSelector';
import {
  handleFirebaseError,
  logError,
  validateEmail,
  validatePassword,
  ensureNetworkConnection,
  isNetworkError,
} from '../../utils';

interface LoginScreenProps {
  onSwitchToSignUp: () => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onSwitchToSignUp }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const { colors } = useAppSelector(selectTheme);
  const { showErrorAlert, showToast } = useNotifications();

  const validateForm = (): boolean => {
    let isValid = true;

    // Validate email
    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
      setEmailError(emailValidation.error!);
      isValid = false;
    } else {
      setEmailError('');
    }

    // Validate password
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      setPasswordError(passwordValidation.error!);
      isValid = false;
    } else {
      setPasswordError('');
    }

    return isValid;
  };

  const handleLogin = async () => {
    // Clear previous errors
    setEmailError('');
    setPasswordError('');

    // Validate form
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      // Check network connection before attempting login
      await ensureNetworkConnection();

      await authService.signIn(email, password);
      setRetryCount(0);
    } catch (error: any) {
      const appError = handleFirebaseError(error);
      logError(appError, 'LoginScreen');

      // Handle specific error cases
      if (isNetworkError(error)) {
        showErrorAlert(appError, () => {
          setRetryCount(prev => prev + 1);
          handleLogin();
        });
      } else if (error.code === 'auth/user-not-found') {
        setEmailError('No account found with this email address');
        showToast('No account found with this email address', 'warning');
      } else if (error.code === 'auth/wrong-password') {
        setPasswordError('Incorrect password');
        showToast('Incorrect password', 'warning');
      } else if (error.code === 'auth/invalid-email') {
        setEmailError('Please enter a valid email address');
        showToast('Please enter a valid email address', 'warning');
      } else if (error.code === 'auth/too-many-requests') {
        showErrorAlert(appError);
        setRetryCount(prev => prev + 1);
      } else {
        showErrorAlert(appError, () => {
          if (retryCount < 3) {
            setRetryCount(prev => prev + 1);
            handleLogin();
          }
        });
      }
    } finally {
      setLoading(false);
    }
  };

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
          Welcome Back
        </Text>
        <Text style={[styles.subtitle, { color: colors.textColored }]}>
          Sign in to your account
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

        <PasswordInput
          placeholder="Password"
          value={password}
          onChangeText={text => {
            setPassword(text);
            if (passwordError) setPasswordError('');
          }}
          error={passwordError}
        />

        <Button
          title={loading ? 'Signing In...' : 'Sign In'}
          onPress={handleLogin}
          loading={loading}
          disabled={loading}
          style={styles.button}
        />

        <TouchableOpacity
          style={styles.forgotPasswordButton}
          onPress={onSwitchToSignUp}
        >
          <Text
            style={[
              styles.switchTextBold,
              { color: colors.textColoredSecondary },
            ]}
          >
            Forgot password?
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.switchButton}
          onPress={onSwitchToSignUp}
        >
          <Text style={[styles.switchText, { color: colors.textColored }]}>
            Don't have an account?{' '}
            <Text
              style={[
                styles.switchTextBold,
                { color: colors.textColoredSecondary },
              ]}
            >
              Sign Up
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
  },
  button: {
    marginBottom: 20,
  },
  switchButton: {
    alignItems: 'center',
  },
  switchText: {
    fontSize: 14,
    fontWeight: 'normal',
  },
  switchTextBold: {
    fontWeight: 'bold',
    textDecorationLine: 'underline',
  },
  forgotPasswordButton: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logo: {
    width: 150,
    height: 150,
  },
});

export default LoginScreen;
