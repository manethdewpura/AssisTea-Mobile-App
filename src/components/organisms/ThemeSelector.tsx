import React, { useState } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  View,
  Modal,
  Dimensions,
} from 'react-native';
import { useAppSelector, useAppDispatch } from '../../hooks';
import { selectTheme } from '../../store/selectors';
import { setThemeMode } from '../../store/slices';
import type { ThemeMode } from '../../common/types';

const { width: screenWidth } = Dimensions.get('window');

interface ThemeSelectorProps {
  style?: any;
}

const ThemeSelector: React.FC<ThemeSelectorProps> = ({ style }) => {
  const dispatch = useAppDispatch();
  const { colors, mode } = useAppSelector(selectTheme);
  const [modalVisible, setModalVisible] = useState(false);

  const themeOptions: { mode: ThemeMode; label: string; icon: string }[] = [
    { mode: 'light', label: 'Light', icon: '☀️' },
    { mode: 'dark', label: 'Dark', icon: '🌙' },
    { mode: 'system', label: 'System', icon: '⚙️' },
  ];

  const handleThemeSelect = (selectedMode: ThemeMode) => {
    dispatch(setThemeMode(selectedMode));
    setModalVisible(false);
  };

  const getCurrentThemeIcon = () => {
    const current = themeOptions.find(option => option.mode === mode);
    return current?.icon || '⚙️';
  };

  const getCurrentThemeLabel = () => {
    const current = themeOptions.find(option => option.mode === mode);
    return current?.label || 'System';
  };

  return (
    <>
      <TouchableOpacity
        style={[
          styles.button,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
          style,
        ]}
        onPress={() => setModalVisible(true)}
      >
        <Text style={styles.icon}>{getCurrentThemeIcon()}</Text>
        <Text style={[styles.label, { color: colors.text }]}>
          {getCurrentThemeLabel()}
        </Text>
      </TouchableOpacity>

      <Modal
        transparent
        visible={modalVisible}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Choose Theme
            </Text>

            {themeOptions.map(option => (
              <TouchableOpacity
                key={option.mode}
                style={[
                  styles.option,
                  {
                    backgroundColor:
                      mode === option.mode ? colors.primary : 'transparent',
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => handleThemeSelect(option.mode)}
              >
                <Text style={styles.optionIcon}>{option.icon}</Text>
                <Text
                  style={[
                    styles.optionLabel,
                    {
                      color:
                        mode === option.mode ? colors.buttonText : colors.text,
                    },
                  ]}
                >
                  {option.label}
                </Text>
                {mode === option.mode && (
                  <Text
                    style={[styles.checkmark, { color: colors.buttonText }]}
                  >
                    ✓
                  </Text>
                )}
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={[styles.cancelButton, { borderColor: colors.border }]}
              onPress={() => setModalVisible(false)}
            >
              <Text
                style={[styles.cancelText, { color: colors.textSecondary }]}
              >
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 80,
  },
  icon: {
    fontSize: 16,
    marginRight: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: screenWidth - 40,
    borderRadius: 12,
    borderWidth: 1,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  optionIcon: {
    fontSize: 18,
    marginRight: 12,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },
  checkmark: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelButton: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '500',
  },
});

export default ThemeSelector;
