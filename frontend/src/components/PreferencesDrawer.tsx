import { Drawer, Segmented, Slider, Radio, Typography } from 'antd';
import type { SegmentedValue } from 'antd/es/segmented';
import './PreferencesDrawer.css';
import { usePreferencesStore } from '../store/preferencesStore';

interface PreferencesDrawerProps {
  open: boolean;
  onClose: () => void;
}

const fontMarks = {
  0.9: '90%',
  1: '100%',
  1.1: '110%',
  1.2: '120%',
};

export const PreferencesDrawer = ({ open, onClose }: PreferencesDrawerProps) => {
  const theme = usePreferencesStore((state) => state.theme);
  const fontScale = usePreferencesStore((state) => state.fontScale);
  const layoutDensity = usePreferencesStore((state) => state.layoutDensity);
  const setTheme = usePreferencesStore((state) => state.setTheme);
  const setFontScale = usePreferencesStore((state) => state.setFontScale);
  const setLayoutDensity = usePreferencesStore((state) => state.setLayoutDensity);

  const handleThemeChange = (value: SegmentedValue) => {
    setTheme(value as any);
  };

  return (
    <Drawer title="Workspace Preferences" open={open} onClose={onClose} width={420}>
      <section className="preferences-section">
        <Typography.Title level={5}>Appearance</Typography.Title>
        <Segmented
          options={[
            { label: 'Light', value: 'light' },
            { label: 'Dark', value: 'dark' },
            { label: 'System', value: 'system' },
          ]}
          value={theme}
          onChange={handleThemeChange}
        />
      </section>

      <section className="preferences-section">
        <Typography.Title level={5}>Font size</Typography.Title>
        <Slider
          marks={fontMarks}
          min={0.9}
          max={1.2}
          step={0.05}
          value={fontScale}
          onChange={(value) => setFontScale(value as number)}
        />
        <div className="font-preview" style={{ fontSize: `${fontScale}rem` }}>
          Preview text: ADAM datasets stay readable at any size.
        </div>
      </section>

      <section className="preferences-section">
        <Typography.Title level={5}>Layout density</Typography.Title>
        <Radio.Group
          value={layoutDensity}
          onChange={(e) => setLayoutDensity(e.target.value)}
        >
          <Radio.Button value="comfortable">Comfortable</Radio.Button>
          <Radio.Button value="compact">Compact</Radio.Button>
        </Radio.Group>
      </section>
    </Drawer>
  );
};

export default PreferencesDrawer;
