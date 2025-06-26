export const m3Theme = {
  colors: {
    primary: {
      main: '#6750A4',
      light: '#D0BCFF',
      dark: '#4F378B',
      container: '#EADDFF',
      onContainer: '#21005D',
    },
    secondary: {
      main: '#625B71',
      light: '#CCC2DC',
      dark: '#4A4458',
      container: '#E8DEF8',
      onContainer: '#1D192B',
    },
    tertiary: {
      main: '#7D5260',
      light: '#EFB8C8',
      dark: '#633B48',
      container: '#FFD8E4',
      onContainer: '#31111D',
    },
    surface: {
      main: '#FEF7FF',
      variant: '#E7E0EC',
      container: '#F3EDF7',
      containerHigh: '#ECE6F0',
      containerHighest: '#E6E0E9',
    },
    outline: {
      main: '#79747E',
      variant: '#CAC4D0',
    },
    error: {
      main: '#BA1A1A',
      container: '#FFDAD6',
      onContainer: '#410002',
    },
  },
  
  typography: {
    displayLarge: {
      fontFamily: 'Roboto',
      fontSize: '57px',
      lineHeight: '64px',
      fontWeight: 400,
      letterSpacing: '-0.25px',
    },
    displayMedium: {
      fontFamily: 'Roboto',
      fontSize: '45px',
      lineHeight: '52px',
      fontWeight: 400,
      letterSpacing: '0px',
    },
    displaySmall: {
      fontFamily: 'Roboto',
      fontSize: '36px',
      lineHeight: '44px',
      fontWeight: 400,
      letterSpacing: '0px',
    },
    headlineLarge: {
      fontFamily: 'Roboto',
      fontSize: '32px',
      lineHeight: '40px',
      fontWeight: 400,
      letterSpacing: '0px',
    },
    headlineMedium: {
      fontFamily: 'Roboto',
      fontSize: '28px',
      lineHeight: '36px',
      fontWeight: 400,
      letterSpacing: '0px',
    },
    headlineSmall: {
      fontFamily: 'Roboto',
      fontSize: '24px',
      lineHeight: '32px',
      fontWeight: 400,
      letterSpacing: '0px',
    },
    titleLarge: {
      fontFamily: 'Roboto',
      fontSize: '22px',
      lineHeight: '28px',
      fontWeight: 400,
      letterSpacing: '0px',
    },
    titleMedium: {
      fontFamily: 'Roboto',
      fontSize: '16px',
      lineHeight: '24px',
      fontWeight: 500,
      letterSpacing: '0.15px',
    },
    titleSmall: {
      fontFamily: 'Roboto',
      fontSize: '14px',
      lineHeight: '20px',
      fontWeight: 500,
      letterSpacing: '0.1px',
    },
    bodyLarge: {
      fontFamily: 'Roboto',
      fontSize: '16px',
      lineHeight: '24px',
      fontWeight: 400,
      letterSpacing: '0.5px',
    },
    bodyMedium: {
      fontFamily: 'Roboto',
      fontSize: '14px',
      lineHeight: '20px',
      fontWeight: 400,
      letterSpacing: '0.25px',
    },
    bodySmall: {
      fontFamily: 'Roboto',
      fontSize: '12px',
      lineHeight: '16px',
      fontWeight: 400,
      letterSpacing: '0.4px',
    },
    labelLarge: {
      fontFamily: 'Roboto',
      fontSize: '14px',
      lineHeight: '20px',
      fontWeight: 500,
      letterSpacing: '0.1px',
    },
    labelMedium: {
      fontFamily: 'Roboto',
      fontSize: '12px',
      lineHeight: '16px',
      fontWeight: 500,
      letterSpacing: '0.5px',
    },
    labelSmall: {
      fontFamily: 'Roboto',
      fontSize: '11px',
      lineHeight: '16px',
      fontWeight: 500,
      letterSpacing: '0.5px',
    },
  },
  
  elevation: {
    level0: 'none',
    level1: '0px 1px 2px rgba(0, 0, 0, 0.3), 0px 1px 3px 1px rgba(0, 0, 0, 0.15)',
    level2: '0px 1px 2px rgba(0, 0, 0, 0.3), 0px 2px 6px 2px rgba(0, 0, 0, 0.15)',
    level3: '0px 1px 3px rgba(0, 0, 0, 0.3), 0px 4px 8px 3px rgba(0, 0, 0, 0.15)',
    level4: '0px 2px 3px rgba(0, 0, 0, 0.3), 0px 6px 10px 4px rgba(0, 0, 0, 0.15)',
    level5: '0px 4px 4px rgba(0, 0, 0, 0.3), 0px 8px 12px 6px rgba(0, 0, 0, 0.15)',
  },
  
  shape: {
    cornerNone: '0px',
    cornerExtraSmall: '4px',
    cornerSmall: '8px',
    cornerMedium: '12px',
    cornerLarge: '16px',
    cornerExtraLarge: '28px',
    cornerFull: '9999px',
  },
  
  motion: {
    easing: {
      standard: 'cubic-bezier(0.2, 0, 0, 1)',
      decelerated: 'cubic-bezier(0, 0, 0, 1)',
      accelerated: 'cubic-bezier(0.3, 0, 1, 1)',
    },
    duration: {
      short1: '50ms',
      short2: '100ms',
      medium1: '250ms',
      medium2: '300ms',
      long1: '400ms',
      long2: '500ms',
    },
  },
  
  components: {
    button: {
      borderRadius: '20px',
      padding: {
        small: '8px 16px',
        medium: '10px 24px',
        large: '12px 32px',
      },
    },
    card: {
      borderRadius: '12px',
      padding: '16px',
    },
    fab: {
      size: {
        small: '40px',
        medium: '56px',
        large: '96px',
      },
      borderRadius: '16px',
    },
  },
};

export const m3DarkTheme = {
  ...m3Theme,
  colors: {
    ...m3Theme.colors,
    primary: {
      main: '#D0BCFF',
      light: '#EADDFF',
      dark: '#381E72',
      container: '#4F378B',
      onContainer: '#EADDFF',
    },
    secondary: {
      main: '#CCC2DC',
      light: '#E8DEF8',
      dark: '#332D41',
      container: '#4A4458',
      onContainer: '#E8DEF8',
    },
    surface: {
      main: '#10131F',
      variant: '#49454F',
      container: '#1D1B20',
      containerHigh: '#272529',
      containerHighest: '#322F35',
    },
    outline: {
      main: '#938F99',
      variant: '#49454F',
    },
  },
};

export const getThemeValue = (path: string, theme = m3Theme) => {
  return path.split('.').reduce((obj: any, key) => obj?.[key], theme);
};

export const createM3Style = (styles: Record<string, any>) => {
  const processedStyles: Record<string, any> = {};
  
  Object.entries(styles).forEach(([key, value]) => {
    if (typeof value === 'string' && value.startsWith('var(--md-sys-')) {
      processedStyles[key] = `var(${value.slice(4, -1)})`;
    } else {
      processedStyles[key] = value;
    }
  });
  
  return processedStyles;
};

export default m3Theme;
