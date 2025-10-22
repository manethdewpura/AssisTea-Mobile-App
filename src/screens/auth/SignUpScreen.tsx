import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useAppSelector, useNotifications } from '../../hooks';
import { selectTheme } from '../../store/selectors';
import { authService } from '../../services';
import type { UserRole } from '../../common/types';
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

interface SignUpScreenProps {
  onSwitchToLogin: () => void;
}

const SignUpScreen: React.FC<SignUpScreenProps> = ({ onSwitchToLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [role] = useState<UserRole>('admin');
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [nameError, setNameError] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const { colors } = useAppSelector(selectTheme);
  const { showErrorAlert, showToast } = useNotifications();

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

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

    // Validate confirm password
    if (!confirmPassword) {
      setConfirmPasswordError('Please confirm your password');
      isValid = false;
    } else if (password !== confirmPassword) {
      setConfirmPasswordError('Passwords do not match');
      isValid = false;
    } else {
      setConfirmPasswordError('');
    }

    // Validate name
    if (!name.trim()) {
      setNameError('Please enter your name');
      isValid = false;
    } else {
      setNameError('');
    }

    return isValid;
  };

  const handleSignUp = async () => {
    // Clear previous errors
    setEmailError('');
    setPasswordError('');
    setConfirmPasswordError('');

    // Validate form
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      await ensureNetworkConnection();
      await authService.signUp(email, password, role, undefined, name.trim());
      setRetryCount(0);
      showToast('Account created successfully! Redirecting...', 'success');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setName('');
    } catch (error: any) {
      const appError = handleFirebaseError(error);
      logError(appError, 'SignUpScreen');

      // Handle specific error cases
      if (isNetworkError(error)) {
        showErrorAlert(appError, () => {
          setRetryCount(prev => prev + 1);
          handleSignUp();
        });
      } else if (error.code === 'auth/email-already-in-use') {
        setEmailError('An account with this email already exists');
        showToast('An account with this email already exists', 'warning');
      } else if (error.code === 'auth/weak-password') {
        setPasswordError('Password should be at least 6 characters long');
        showToast('Password should be at least 6 characters long', 'warning');
      } else if (error.code === 'auth/invalid-email') {
        setEmailError('Please enter a valid email address');
        showToast('Please enter a valid email address', 'warning');
      } else {
        showErrorAlert(appError, () => {
          if (retryCount < 3) {
            setRetryCount(prev => prev + 1);
            handleSignUp();
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

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.formContainer}>
          <Text style={[styles.title, { color: colors.text }]}>
            Create Admin Account
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Sign up as an administrator
          </Text>

          <Input
            placeholder="Name"
            value={name}
            onChangeText={text => {
              setName(text);
              if (nameError) setNameError('');
            }}
            autoCapitalize="words"
            autoCorrect={false}
            error={nameError}
          />

          <Input
            placeholder="Email"
            value={email}
            onChangeText={text => {
              setEmail(text);
              if (emailError) setEmailError(''); // Clear error when user starts typing
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
              if (passwordError) setPasswordError(''); // Clear error when user starts typing
            }}
            error={passwordError}
            showPassword={showPassword}
            onTogglePassword={togglePasswordVisibility}
          />

          <PasswordInput
            placeholder="Confirm Password"
            value={confirmPassword}
            onChangeText={text => {
              setConfirmPassword(text);
              if (confirmPasswordError) setConfirmPasswordError(''); // Clear error when user starts typing
            }}
            error={confirmPasswordError}
            showPassword={showPassword}
            onTogglePassword={togglePasswordVisibility}
          />

          <Button
            title={loading ? 'Creating Account...' : 'Sign Up'}
            onPress={handleSignUp}
            loading={loading}
            disabled={loading}
            style={styles.button}
          />

          <TouchableOpacity
            style={styles.switchButton}
            onPress={onSwitchToLogin}
          >
            <Text style={[styles.switchText, { color: colors.textSecondary }]}>
              Already have an account?{' '}
              <Text style={[styles.switchText, { color: colors.primary }]}>
                Sign In
              </Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  formContainer: {
    paddingHorizontal: 20,
    paddingVertical: 40,
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
});

export default SignUpScreen;
