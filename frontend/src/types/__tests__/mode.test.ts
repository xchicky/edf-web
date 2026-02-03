/**
 * Mode 类型定义测试
 * 验证类型系统的完整性和正确性
 */

import {
  BUILT_IN_MODES,
  MODE_CATEGORIES,
  VIEW_MODES,
  DEFAULT_BANDS,
  DEFAULT_MODE_CONFIG,
  type Mode,
  type ModeCategory,
  type ViewMode,
  type ModeConfig,
  type DisplayChannel,
  type BandConfig,
  type CompatibilityCheckResult,
  type ModeRecommendation,
  type ModeUsageStats,
  type ModeSignalConfig,
} from '../mode';

describe('Mode Types', () => {
  describe('Type Definitions', () => {
    it('should have correct ModeCategory type', () => {
      const categories: ModeCategory[] = ['clinical', 'research', 'education', 'custom'];
      expect(categories).toHaveLength(4);
      expect(categories).toContain('clinical');
      expect(categories).toContain('research');
      expect(categories).toContain('education');
      expect(categories).toContain('custom');
    });

    it('should have correct ViewMode type', () => {
      const viewModes: ViewMode[] = ['waveform', 'frequency', 'topography', '3d'];
      expect(viewModes).toHaveLength(4);
    });

    it('should accept valid ModeConfig structure', () => {
      const config: ModeConfig = {
        viewMode: 'waveform',
        timeWindow: 10,
        amplitudeScale: 1.0,
        showGrid: true,
        showAnnotations: true,
        displayChannels: [
          {
            channelName: 'Fp1',
            channelIndex: 0,
            visible: true,
          },
        ],
        enableFilter: true,
        filterHighPass: 0.5,
        filterLowPass: 70,
        bands: DEFAULT_BANDS,
        analysis: {
          enabled: true,
          type: 'stats',
          autoUpdate: false,
        },
        autoSave: true,
        maxBookmarks: 50,
      };

      expect(config.viewMode).toBe('waveform');
      expect(config.timeWindow).toBe(10);
      expect(config.displayChannels).toHaveLength(1);
    });

    it('should accept valid DisplayChannel structure', () => {
      const channel: DisplayChannel = {
        channelName: 'Fp1',
        channelIndex: 0,
        color: '#ff0000',
        scale: 1.5,
        visible: true,
      };

      expect(channel.channelName).toBe('Fp1');
      expect(channel.color).toBe('#ff0000');
      expect(channel.scale).toBe(1.5);
    });

    it('should accept valid BandConfig structure', () => {
      const band: BandConfig = {
        name: 'alpha',
        range: [8, 13],
        enabled: true,
        color: '#ec4899',
      };

      expect(band.name).toBe('alpha');
      expect(band.range).toEqual([8, 13]);
      expect(band.enabled).toBe(true);
    });
  });

  describe('BUILT_IN_MODES', () => {
    it('should have at least 3 built-in modes', () => {
      expect(BUILT_IN_MODES.length).toBeGreaterThanOrEqual(3);
    });

    it('should have valid mode structure for each built-in mode', () => {
      BUILT_IN_MODES.forEach((mode) => {
        expect(mode).toHaveProperty('id');
        expect(mode).toHaveProperty('name');
        expect(mode).toHaveProperty('category');
        expect(mode).toHaveProperty('config');
        expect(mode).toHaveProperty('createdAt');
        expect(mode).toHaveProperty('modifiedAt');
        expect(mode).toHaveProperty('isBuiltIn');
        expect(mode.isBuiltIn).toBe(true);
      });
    });

    it('should have unique mode IDs', () => {
      const ids = BUILT_IN_MODES.map((m) => m.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should have clinical mode with standard configuration', () => {
      const clinicalMode = BUILT_IN_MODES.find((m) => m.id === 'mode-clinical-standard');
      expect(clinicalMode).toBeDefined();
      expect(clinicalMode?.category).toBe('clinical');
      expect(clinicalMode?.config.displayChannels.length).toBeGreaterThan(0);
    });

    it('should have research mode with spectral analysis', () => {
      const researchMode = BUILT_IN_MODES.find((m) => m.id === 'mode-research-spectral');
      expect(researchMode).toBeDefined();
      expect(researchMode?.category).toBe('research');
      expect(researchMode?.config.viewMode).toBe('frequency');
    });

    it('should have education mode with simplified view', () => {
      const educationMode = BUILT_IN_MODES.find((m) => m.id === 'mode-education-basic');
      expect(educationMode).toBeDefined();
      expect(educationMode?.category).toBe('education');
      expect(educationMode?.config.analysis.enabled).toBe(false);
    });
  });

  describe('MODE_CATEGORIES', () => {
    it('should have all categories defined', () => {
      expect(Object.keys(MODE_CATEGORIES)).toHaveLength(4);
    });

    it('should have required properties for each category', () => {
      Object.entries(MODE_CATEGORIES).forEach(([key, value]) => {
        expect(value).toHaveProperty('label');
        expect(value).toHaveProperty('description');
        expect(value).toHaveProperty('icon');
        expect(typeof value.label).toBe('string');
        expect(typeof value.description).toBe('string');
        expect(typeof value.icon).toBe('string');
      });
    });

    it('should have clinical category with correct properties', () => {
      expect(MODE_CATEGORIES.clinical.label).toBe('临床诊断');
      expect(MODE_CATEGORIES.clinical.icon).toBe('🏥');
    });

    it('should have research category with correct properties', () => {
      expect(MODE_CATEGORIES.research.label).toBe('科学研究');
      expect(MODE_CATEGORIES.research.icon).toBe('🔬');
    });

    it('should have education category with correct properties', () => {
      expect(MODE_CATEGORIES.education.label).toBe('教学演示');
      expect(MODE_CATEGORIES.education.icon).toBe('📚');
    });

    it('should have custom category with correct properties', () => {
      expect(MODE_CATEGORIES.custom.label).toBe('自定义');
      expect(MODE_CATEGORIES.custom.icon).toBe('⚙️');
    });
  });

  describe('VIEW_MODES', () => {
    it('should have all view modes defined', () => {
      expect(Object.keys(VIEW_MODES)).toHaveLength(4);
    });

    it('should have required properties for each view mode', () => {
      Object.entries(VIEW_MODES).forEach(([key, value]) => {
        expect(value).toHaveProperty('label');
        expect(value).toHaveProperty('description');
        expect(typeof value.label).toBe('string');
        expect(typeof value.description).toBe('string');
      });
    });
  });

  describe('DEFAULT_BANDS', () => {
    it('should have 5 default bands', () => {
      expect(DEFAULT_BANDS).toHaveLength(5);
    });

    it('should have all required EEG bands', () => {
      const bandNames = DEFAULT_BANDS.map((b) => b.name);
      expect(bandNames).toContain('delta');
      expect(bandNames).toContain('theta');
      expect(bandNames).toContain('alpha');
      expect(bandNames).toContain('beta');
      expect(bandNames).toContain('gamma');
    });

    it('should have valid frequency ranges for each band', () => {
      DEFAULT_BANDS.forEach((band) => {
        expect(band.range).toHaveLength(2);
        expect(band.range[0]).toBeLessThan(band.range[1]);
        expect(band.range[0]).toBeGreaterThanOrEqual(0);
      });
    });

    it('should have enabled property for all bands', () => {
      DEFAULT_BANDS.forEach((band) => {
        expect(typeof band.enabled).toBe('boolean');
      });
    });

    it('should have delta band with correct range', () => {
      const delta = DEFAULT_BANDS.find((b) => b.name === 'delta');
      expect(delta?.range).toEqual([0.5, 4]);
    });

    it('should have theta band with correct range', () => {
      const theta = DEFAULT_BANDS.find((b) => b.name === 'theta');
      expect(theta?.range).toEqual([4, 8]);
    });

    it('should have alpha band with correct range', () => {
      const alpha = DEFAULT_BANDS.find((b) => b.name === 'alpha');
      expect(alpha?.range).toEqual([8, 13]);
    });

    it('should have beta band with correct range', () => {
      const beta = DEFAULT_BANDS.find((b) => b.name === 'beta');
      expect(beta?.range).toEqual([13, 30]);
    });

    it('should have gamma band with correct range', () => {
      const gamma = DEFAULT_BANDS.find((b) => b.name === 'gamma');
      expect(gamma?.range).toEqual([30, 50]);
    });
  });

  describe('DEFAULT_MODE_CONFIG', () => {
    it('should have all required properties', () => {
      expect(DEFAULT_MODE_CONFIG).toHaveProperty('viewMode');
      expect(DEFAULT_MODE_CONFIG).toHaveProperty('timeWindow');
      expect(DEFAULT_MODE_CONFIG).toHaveProperty('amplitudeScale');
      expect(DEFAULT_MODE_CONFIG).toHaveProperty('showGrid');
      expect(DEFAULT_MODE_CONFIG).toHaveProperty('showAnnotations');
      expect(DEFAULT_MODE_CONFIG).toHaveProperty('displayChannels');
      expect(DEFAULT_MODE_CONFIG).toHaveProperty('enableFilter');
      expect(DEFAULT_MODE_CONFIG).toHaveProperty('bands');
      expect(DEFAULT_MODE_CONFIG).toHaveProperty('analysis');
      expect(DEFAULT_MODE_CONFIG).toHaveProperty('autoSave');
      expect(DEFAULT_MODE_CONFIG).toHaveProperty('maxBookmarks');
      expect(DEFAULT_MODE_CONFIG).toHaveProperty('signals');
    });

    it('should have reasonable default values', () => {
      expect(DEFAULT_MODE_CONFIG.viewMode).toBe('waveform');
      expect(DEFAULT_MODE_CONFIG.timeWindow).toBe(10);
      expect(DEFAULT_MODE_CONFIG.amplitudeScale).toBe(1.0);
      expect(DEFAULT_MODE_CONFIG.showGrid).toBe(true);
      expect(DEFAULT_MODE_CONFIG.showAnnotations).toBe(true);
      expect(DEFAULT_MODE_CONFIG.autoSave).toBe(true);
      expect(DEFAULT_MODE_CONFIG.maxBookmarks).toBe(50);
    });

    it('should have empty display channels array', () => {
      expect(DEFAULT_MODE_CONFIG.displayChannels).toEqual([]);
    });

    it('should have default bands', () => {
      expect(DEFAULT_MODE_CONFIG.bands).toEqual(DEFAULT_BANDS);
    });

    it('should have analysis disabled by default', () => {
      expect(DEFAULT_MODE_CONFIG.analysis.enabled).toBe(false);
      expect(DEFAULT_MODE_CONFIG.analysis.type).toBe('stats');
      expect(DEFAULT_MODE_CONFIG.analysis.autoUpdate).toBe(false);
    });

    it('should have empty signals array by default', () => {
      expect(DEFAULT_MODE_CONFIG.signals).toEqual([]);
    });
  });

  describe('ModeSignalConfig', () => {
    it('should accept valid ModeSignalConfig structure', () => {
      const signalConfig: ModeSignalConfig = {
        id: 'sig-1',
        name: 'Fp1-F3 Difference',
        expression: 'Fp1 - F3',
        operands: [
          {
            id: 'op-1',
            channelName: 'Fp1',
            channelIndex: 0,
          },
          {
            id: 'op-2',
            channelName: 'F3',
            channelIndex: 2,
          },
        ],
        color: '#ff0000',
        enabled: true,
      };

      expect(signalConfig.id).toBe('sig-1');
      expect(signalConfig.name).toBe('Fp1-F3 Difference');
      expect(signalConfig.expression).toBe('Fp1 - F3');
      expect(signalConfig.operands).toHaveLength(2);
      expect(signalConfig.color).toBe('#ff0000');
      expect(signalConfig.enabled).toBe(true);
    });

    it('should accept ModeSignalConfig without optional color', () => {
      const signalConfig: ModeSignalConfig = {
        id: 'sig-2',
        name: 'Average Frontal',
        expression: '(Fp1 + Fp2 + F3 + F4) / 4',
        operands: [
          {
            id: 'op-1',
            channelName: 'Fp1',
            channelIndex: 0,
          },
          {
            id: 'op-2',
            channelName: 'Fp2',
            channelIndex: 1,
          },
          {
            id: 'op-3',
            channelName: 'F3',
            channelIndex: 2,
          },
          {
            id: 'op-4',
            channelName: 'F4',
            channelIndex: 3,
          },
        ],
        enabled: true,
      };

      expect(signalConfig.color).toBeUndefined();
    });

    it('should accept ModeSignalConfig with disabled state', () => {
      const signalConfig: ModeSignalConfig = {
        id: 'sig-3',
        name: 'Disabled Signal',
        expression: 'Fp1 - Fp2',
        operands: [
          {
            id: 'op-1',
            channelName: 'Fp1',
            channelIndex: 0,
          },
          {
            id: 'op-2',
            channelName: 'Fp2',
            channelIndex: 1,
          },
        ],
        enabled: false,
      };

      expect(signalConfig.enabled).toBe(false);
    });
  });

  describe('ModeConfig with signals', () => {
    it('should accept ModeConfig with signals array', () => {
      const config: ModeConfig = {
        viewMode: 'waveform',
        timeWindow: 10,
        amplitudeScale: 1.0,
        showGrid: true,
        showAnnotations: true,
        displayChannels: [
          {
            channelName: 'Fp1',
            channelIndex: 0,
            visible: true,
          },
        ],
        enableFilter: false,
        bands: DEFAULT_BANDS,
        analysis: {
          enabled: false,
          type: 'stats',
          autoUpdate: false,
        },
        autoSave: true,
        maxBookmarks: 50,
        signals: [
          {
            id: 'sig-1',
            name: 'Fp1-F3 Difference',
            expression: 'Fp1 - F3',
            operands: [
              {
                id: 'op-1',
                channelName: 'Fp1',
                channelIndex: 0,
              },
              {
                id: 'op-2',
                channelName: 'F3',
                channelIndex: 2,
              },
            ],
            enabled: true,
          },
        ],
      };

      expect(config.signals).toBeDefined();
      expect(config.signals).toHaveLength(1);
      expect(config.signals?.[0].name).toBe('Fp1-F3 Difference');
    });

    it('should accept ModeConfig without signals array', () => {
      const config: ModeConfig = {
        viewMode: 'waveform',
        timeWindow: 10,
        amplitudeScale: 1.0,
        showGrid: true,
        showAnnotations: true,
        displayChannels: [],
        enableFilter: false,
        bands: DEFAULT_BANDS,
        analysis: {
          enabled: false,
          type: 'stats',
          autoUpdate: false,
        },
        autoSave: true,
        maxBookmarks: 50,
      };

      expect(config.signals).toBeUndefined();
    });
  });

  describe('BUILT_IN_MODES with signals', () => {
    it('should support modes with derived signals', () => {
      const modeWithSignals: Mode = {
        id: 'mode-custom-signals',
        name: 'Custom Signals Mode',
        category: 'custom',
        description: 'Mode with derived signals',
        config: {
          viewMode: 'waveform',
          timeWindow: 10,
          amplitudeScale: 1.0,
          showGrid: true,
          showAnnotations: true,
          displayChannels: [
            { channelName: 'Fp1', channelIndex: 0, visible: true },
            { channelName: 'F3', channelIndex: 2, visible: true },
          ],
          enableFilter: false,
          bands: DEFAULT_BANDS,
          analysis: {
            enabled: false,
            type: 'stats',
            autoUpdate: false,
          },
          autoSave: true,
          maxBookmarks: 50,
          signals: [
            {
              id: 'sig-diff-1',
              name: 'Fp1-F3 Difference',
              expression: 'Fp1 - F3',
              operands: [
                { id: 'op-1', channelName: 'Fp1', channelIndex: 0 },
                { id: 'op-2', channelName: 'F3', channelIndex: 2 },
              ],
              color: '#ff0000',
              enabled: true,
            },
            {
              id: 'sig-avg-1',
              name: 'Average Frontal',
              expression: '(Fp1 + F3) / 2',
              operands: [
                { id: 'op-1', channelName: 'Fp1', channelIndex: 0 },
                { id: 'op-2', channelName: 'F3', channelIndex: 2 },
              ],
              color: '#00ff00',
              enabled: true,
            },
          ],
        },
        createdAt: Date.now(),
        modifiedAt: Date.now(),
        isBuiltIn: false,
        isFavorite: false,
        usageCount: 0,
        tags: ['custom', 'signals'],
      };

      expect(modeWithSignals.config.signals).toBeDefined();
      expect(modeWithSignals.config.signals).toHaveLength(2);
      expect(modeWithSignals.config.signals?.[0].name).toBe('Fp1-F3 Difference');
      expect(modeWithSignals.config.signals?.[1].name).toBe('Average Frontal');
    });
  });
});
