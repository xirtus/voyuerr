import SettingsLayout from '@app/components/Settings/SettingsLayout';
import SettingsStash from '@app/components/Settings/SettingsStash';
import type { NextPage } from 'next';

const StashSettingsPage: NextPage = () => {
  return (
    <SettingsLayout>
      <SettingsStash />
    </SettingsLayout>
  );
};

export default StashSettingsPage;
