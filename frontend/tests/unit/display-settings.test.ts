import { describe, it, expect } from 'vitest';
import {
  builtInPalettes,
  getAllPalettes,
  lookupPaletteColors,
  computeColorsFromTheme,
  extractThemeFromSettings,
  DEFAULT_FALLBACK_COLOR,
  appThemeOptions,
  type GoalTheme,
  type DisplaySettings,
} from '../../src/context/DisplaySettingsContext';

describe('DisplaySettingsContext utilities', () => {
  describe('builtInPalettes', () => {
    it('contains classic, rainbow, pastel, and mono palettes', () => {
      expect(builtInPalettes).toHaveProperty('classic');
      expect(builtInPalettes).toHaveProperty('rainbow');
      expect(builtInPalettes).toHaveProperty('pastel');
      expect(builtInPalettes).toHaveProperty('mono');
    });

    it('each built-in palette has 8 colors', () => {
      for (const [, palette] of Object.entries(builtInPalettes)) {
        expect(palette.colors).toHaveLength(8);
        expect(palette.builtIn).toBe(true);
      }
    });

    it('classic palette alternates between two greens', () => {
      const colors = builtInPalettes.classic.colors;
      const uniqueColors = [...new Set(colors)];
      expect(uniqueColors).toHaveLength(2);
    });

    it('mono palette alternates between two greys', () => {
      const colors = builtInPalettes.mono.colors;
      const uniqueColors = [...new Set(colors)];
      expect(uniqueColors).toHaveLength(2);
    });
  });

  describe('DEFAULT_FALLBACK_COLOR', () => {
    it('is a valid hex color', () => {
      expect(DEFAULT_FALLBACK_COLOR).toMatch(/^#[0-9a-fA-F]{6}$/);
    });

    it('matches the first classic palette color', () => {
      expect(DEFAULT_FALLBACK_COLOR).toBe(builtInPalettes.classic.colors[0]);
    });
  });

  describe('appThemeOptions', () => {
    it('has default and academia themes', () => {
      expect(appThemeOptions).toHaveProperty('default');
      expect(appThemeOptions).toHaveProperty('academia');
    });

    it('default theme uses classic palette', () => {
      expect(appThemeOptions.default.defaultPalette).toBe('classic');
    });

    it('academia theme uses mono palette', () => {
      expect(appThemeOptions.academia.defaultPalette).toBe('mono');
    });
  });

  describe('getAllPalettes', () => {
    it('returns all built-in palettes when no custom palettes provided', () => {
      const all = getAllPalettes();
      expect(all).toHaveProperty('classic');
      expect(all).toHaveProperty('rainbow');
      expect(all).toHaveProperty('pastel');
      expect(all).toHaveProperty('mono');
      expect(Object.keys(all)).toHaveLength(4);
    });

    it('merges custom palettes with built-in ones', () => {
      const custom = {
        'custom-test': { label: 'My Palette', colors: ['#ff0000', '#00ff00', '#0000ff', '#ff0000', '#00ff00', '#0000ff', '#ff0000', '#00ff00'] },
      };
      const all = getAllPalettes(custom);
      expect(Object.keys(all)).toHaveLength(5);
      expect(all['custom-test'].label).toBe('My Palette');
      expect(all['custom-test'].builtIn).toBe(false);
    });

    it('custom palettes are marked as not built-in', () => {
      const custom = {
        'my-pal': { label: 'Test', colors: ['#000'] },
      };
      const all = getAllPalettes(custom);
      expect(all['my-pal'].builtIn).toBe(false);
    });

    it('custom palette does not overwrite a built-in key', () => {
      // If someone somehow creates a custom palette with a built-in key,
      // the custom one wins (last spread)
      const custom = {
        classic: { label: 'Override', colors: ['#111111'] },
      };
      const all = getAllPalettes(custom);
      expect(all.classic.label).toBe('Override');
      expect(all.classic.builtIn).toBe(false);
    });
  });

  describe('lookupPaletteColors', () => {
    it('returns built-in palette colors by name', () => {
      expect(lookupPaletteColors('classic')).toEqual(builtInPalettes.classic.colors);
      expect(lookupPaletteColors('rainbow')).toEqual(builtInPalettes.rainbow.colors);
    });

    it('returns custom palette colors when provided', () => {
      const custom = {
        'my-custom': { label: 'Test', colors: ['#aaa', '#bbb'] },
      };
      expect(lookupPaletteColors('my-custom', custom)).toEqual(['#aaa', '#bbb']);
    });

    it('falls back to classic when palette not found', () => {
      expect(lookupPaletteColors('nonexistent')).toEqual(builtInPalettes.classic.colors);
    });

    it('falls back to classic when custom palettes do not contain the key', () => {
      const custom = {
        'other': { label: 'Other', colors: ['#123'] },
      };
      expect(lookupPaletteColors('missing', custom)).toEqual(builtInPalettes.classic.colors);
    });
  });

  describe('computeColorsFromTheme', () => {
    const baseTheme: GoalTheme = {
      palette: 'classic',
      customSubGoalColors: {},
      inheritActionColors: true,
      actionShadePercent: 60,
      centerLayout: 'single',
      centerBackdrop: 'card',
    };

    it('returns 8 color entries for positions 1-8', () => {
      const colors = computeColorsFromTheme(baseTheme);
      expect(Object.keys(colors)).toHaveLength(8);
      for (let i = 1; i <= 8; i++) {
        expect(colors[i]).toBeDefined();
      }
    });

    it('uses palette colors when no custom overrides', () => {
      const colors = computeColorsFromTheme(baseTheme);
      const palette = builtInPalettes.classic.colors;
      for (let i = 1; i <= 8; i++) {
        expect(colors[i]).toBe(palette[i - 1]);
      }
    });

    it('uses custom sub-goal colors as overrides', () => {
      const theme: GoalTheme = {
        ...baseTheme,
        customSubGoalColors: { 3: '#ff0000', 7: '#00ff00' },
      };
      const colors = computeColorsFromTheme(theme);
      expect(colors[3]).toBe('#ff0000');
      expect(colors[7]).toBe('#00ff00');
      // Others still from palette
      expect(colors[1]).toBe(builtInPalettes.classic.colors[0]);
    });

    it('uses custom palettes when provided', () => {
      const custom = {
        'my-pal': { label: 'Mine', colors: ['#a', '#b', '#c', '#d', '#e', '#f', '#g', '#h'] },
      };
      const theme: GoalTheme = { ...baseTheme, palette: 'my-pal' };
      const colors = computeColorsFromTheme(theme, custom);
      expect(colors[1]).toBe('#a');
      expect(colors[8]).toBe('#h');
    });

    it('falls back to first palette color if palette has fewer than 8 entries', () => {
      const custom = {
        short: { label: 'Short', colors: ['#only1'] },
      };
      const theme: GoalTheme = { ...baseTheme, palette: 'short' };
      const colors = computeColorsFromTheme(theme, custom);
      expect(colors[1]).toBe('#only1');
      // Positions 2-8 fallback to palette[0]
      for (let i = 2; i <= 8; i++) {
        expect(colors[i]).toBe('#only1');
      }
    });
  });

  describe('extractThemeFromSettings', () => {
    const mockSettings: DisplaySettings = {
      defaultView: 'compact',
      appTheme: 'default',
      palette: 'rainbow',
      customPalettes: {},
      customSubGoalColors: { 2: '#abc' },
      inheritActionColors: false,
      actionShadePercent: 80,
      centerLayout: 'radial',
      centerBackdrop: 'page',
      goalsPerPage: 5,
      guestbookPerPage: 5,
      language: 'en-US',
      darkMode: false,
    };

    it('extracts only theme-related fields', () => {
      const theme = extractThemeFromSettings(mockSettings);
      expect(theme).toEqual({
        palette: 'rainbow',
        customSubGoalColors: { 2: '#abc' },
        inheritActionColors: false,
        actionShadePercent: 80,
        centerLayout: 'radial',
        centerBackdrop: 'page',
      });
    });

    it('does not include non-theme fields', () => {
      const theme = extractThemeFromSettings(mockSettings);
      expect(theme).not.toHaveProperty('defaultView');
      expect(theme).not.toHaveProperty('appTheme');
      expect(theme).not.toHaveProperty('goalsPerPage');
      expect(theme).not.toHaveProperty('language');
      expect(theme).not.toHaveProperty('darkMode');
      expect(theme).not.toHaveProperty('customPalettes');
    });
  });
});
