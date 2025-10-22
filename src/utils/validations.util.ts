// Validation utilities
export function validateEmail(email: string): {
  isValid: boolean;
  error?: string;
} {
  if (!email.trim()) {
    return { isValid: false, error: 'Email is required' };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { isValid: false, error: 'Please enter a valid email address' };
  }

  return { isValid: true };
}

export function validatePassword(password: string): {
  isValid: boolean;
  error?: string;
} {
  if (!password) {
    return { isValid: false, error: 'Password is required' };
  }

  if (password.length < 6) {
    return {
      isValid: false,
      error: 'Password must be at least 6 characters long',
    };
  }

  return { isValid: true };
}

export function validateRequired(
  value: string,
  fieldName: string,
): { isValid: boolean; error?: string } {
  if (!value.trim()) {
    return { isValid: false, error: `${fieldName} is required` };
  }

  return { isValid: true };
}

export function validateNumeric(
  value: string,
  fieldName: string,
): { isValid: boolean; error?: string } {
  if (!value.trim()) {
    return { isValid: false, error: `${fieldName} is required` };
  }

  const numValue = parseFloat(value);
  if (isNaN(numValue) || numValue <= 0) {
    return {
      isValid: false,
      error: `${fieldName} must be a valid positive number`,
    };
  }

  return { isValid: true };
}
