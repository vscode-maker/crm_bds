import 'vuetify/styles';
import '@mdi/font/css/materialdesignicons.css';
import { createVuetify } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';

export const vuetify = createVuetify({
  components,
  directives,
  theme: {
    defaultTheme: localStorage.getItem('theme') || 'dark',
    themes: {
      dark: {
        dark: true,
        colors: {
          background: '#0F172A',
          surface: '#1E293B',
          'surface-variant': '#334155',
          'surface-light': '#475569',
          primary: '#0068FF',
          secondary: '#38BDF8',
          accent: '#0369A1',
          error: '#EF4444',
          warning: '#F59E0B',
          success: '#10B981',
          info: '#3B82F6',
          'on-background': '#F8FAFC',
          'on-surface': '#F8FAFC',
          'on-primary': '#FFFFFF',
        },
      },
      light: {
        dark: false,
        colors: {
          background: '#F8FAFC',
          surface: '#FFFFFF',
          'surface-variant': '#F1F5F9',
          primary: '#0068FF',
          secondary: '#E0F2FE',
          accent: '#0284C7',
          error: '#EF4444',
          warning: '#F59E0B',
          success: '#10B981',
          info: '#3B82F6',
        },
      },
    },
  },
  defaults: {
    VBtn: { variant: 'flat', rounded: 'xl' },
    VTextField: { variant: 'outlined', density: 'compact', rounded: 'xl' },
    VSelect: { variant: 'outlined', density: 'compact', rounded: 'xl' },
    VAutocomplete: { variant: 'outlined', density: 'compact', rounded: 'xl' },
    VTextarea: { variant: 'outlined', density: 'compact', rounded: 'xl' },
    VCard: { rounded: 'xl', variant: 'flat' },
    VChip: { rounded: 'lg', size: 'small' },
    VDialog: { maxWidth: 600 },
  },
});
