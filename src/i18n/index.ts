import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import common from './locales/en/common.json';
import header from './locales/en/header.json';
import bills from './locales/en/bills.json';
import auth from './locales/en/auth.json';
import errors from './locales/en/errors.json';
import households from './locales/en/households.json';

void i18n.use(initReactI18next).init({
  resources: {
    en: { common, header, bills, auth, errors, households },
  },
  lng: 'en',
  fallbackLng: 'en',
  defaultNS: 'common',
  ns: ['common', 'header', 'bills', 'auth', 'errors', 'households'],
  interpolation: { escapeValue: false },
});

export default i18n;
