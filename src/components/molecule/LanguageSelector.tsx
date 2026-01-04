import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAppSelector, useAppDispatch } from '../../hooks';
import { selectTheme } from '../../store/selectors';
import { setLanguage } from '../../store/slices/ai.slice';
import type { Language } from '../../store/slices/ai.slice';

const LanguageSelector: React.FC = () => {
  const { colors } = useAppSelector(selectTheme);
  const { language } = useAppSelector(state => state.ai);
  const dispatch = useAppDispatch();

  const handleLanguageChange = (lang: Language) => {
    dispatch(setLanguage(lang));
  };

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.selectorContainer,
          {
            backgroundColor: colors.inputBackground,
            borderColor: colors.border,
          },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.languageButton,
            language === 'en' && [
              styles.languageButtonActive,
              { backgroundColor: colors.primary },
            ],
          ]}
          onPress={() => handleLanguageChange('en')}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.languageText,
              {
                color:
                  language === 'en' ? colors.textInverse : colors.textSecondary,
                fontWeight: language === 'en' ? '600' : '400',
              },
            ]}
          >
            English
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.languageButton,
            language === 'si' && [
              styles.languageButtonActive,
              { backgroundColor: colors.primary },
            ],
          ]}
          onPress={() => handleLanguageChange('si')}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.languageText,
              {
                color:
                  language === 'si' ? colors.textInverse : colors.textSecondary,
                fontWeight: language === 'si' ? '600' : '400',
              },
            ]}
          >
            සිංහල
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.languageButton,
            language === 'ta' && [
              styles.languageButtonActive,
              { backgroundColor: colors.primary },
            ],
          ]}
          onPress={() => handleLanguageChange('ta')}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.languageText,
              {
                color:
                  language === 'ta' ? colors.textInverse : colors.textSecondary,
                fontWeight: language === 'ta' ? '600' : '400',
              },
            ]}
          >
            தமிழ்
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  selectorContainer: {
    flexDirection: 'row',
    borderRadius: 20,
    borderWidth: 1,
    padding: 4,
    gap: 4,
  },
  languageButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  languageButtonActive: {
    // Active state styling handled inline
  },
  languageText: {
    fontSize: 14,
    lineHeight: 20,
    includeFontPadding: true,
    textAlign: 'center',
  },
});

export default LanguageSelector;

