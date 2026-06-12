import Button from '@app/components/Common/Button';
import SensitiveInput from '@app/components/Common/SensitiveInput';
import useSettings from '@app/hooks/useSettings';
import useToasts from '@app/hooks/useToasts';
import { Permission, useUser } from '@app/hooks/useUser';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { ArrowPathIcon } from '@heroicons/react/24/solid';
import axios from 'axios';
import { useState } from 'react';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.Settings.SettingsStash', {
  stashSettings: 'Stash Settings',
  stashDescription:
    'Configure the Stash integration to sync performer and scene metadata into Voyeurr.',
  enablesync: 'Enable Stash Sync',
  hostname: 'Hostname or IP',
  port: 'Port',
  useSsl: 'Use SSL',
  apiKey: 'API Key (optional)',
  testConnection: 'Test Connection',
  syncNow: 'Sync Now',
  syncInProgress: 'Sync in progress...',
  testSuccess: 'Successfully connected to Stash!',
  testFailed: 'Failed to connect to Stash. Check your settings.',
  syncSuccess: 'Stash sync completed successfully!',
  syncFailed: 'Stash sync failed. Please try again.',
  status: 'Status',
  enabled: 'Enabled',
  disabled: 'Disabled',
  lastSync: 'Last Sync',
  never: 'Never',
  performers: 'performers',
  studios: 'studios',
  scenes: 'scenes',
  syncResult: '{count} {type} synced',
});

const SettingsStash = () => {
  const intl = useIntl();
  const { settings, revalidate } = useSettings();
  const { addToast } = useToasts();
  const { hasPermission } = useUser();
  const [isTesting, setIsTesting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ performers: number; studios: number; scenes: number } | null>(null);

  const stashSettings = (settings.currentSettings as any).stash || {
    enabled: false,
    hostname: '',
    port: 9999,
    useSsl: false,
    apiKey: '',
  };

  const testConnection = async () => {
    setIsTesting(true);
    try {
      await axios.post('/api/v1/settings/stash/test');
      addToast(intl.formatMessage(messages.testSuccess), {
        appearance: 'success',
        autoDismiss: true,
      });
    } catch {
      addToast(intl.formatMessage(messages.testFailed), {
        appearance: 'error',
        autoDismiss: true,
      });
    } finally {
      setIsTesting(false);
    }
  };

  const triggerSync = async () => {
    setIsSyncing(true);
    setSyncResult(null);
    try {
      const response = await axios.post('/api/v1/settings/stash/sync');
      setSyncResult(response.data);
      addToast(intl.formatMessage(messages.syncSuccess), {
        appearance: 'success',
        autoDismiss: true,
      });
    } catch {
      addToast(intl.formatMessage(messages.syncFailed), {
        appearance: 'error',
        autoDismiss: true,
      });
    } finally {
      setIsSyncing(false);
    }
  };

  if (!hasPermission(Permission.ADMIN)) {
    return null;
  }

  return (
    <div className="section">
      <h3 className="heading">{intl.formatMessage(messages.stashSettings)}</h3>
      <p className="description">{intl.formatMessage(messages.stashDescription)}</p>

      <div className="form-row">
        <label className="text-label">{intl.formatMessage(messages.status)}</label>
        <div className="form-input-area">
          <span
            className="inline-flex items-center rounded-full px-3 py-1 text-sm font-medium"
            style={{
              backgroundColor: stashSettings.enabled ? 'rgba(255, 51, 102, 0.15)' : 'rgba(122, 106, 130, 0.15)',
              color: stashSettings.enabled ? '#ff3366' : '#7a6a82',
            }}
          >
            {stashSettings.enabled
              ? intl.formatMessage(messages.enabled)
              : intl.formatMessage(messages.disabled)}
          </span>
        </div>
      </div>

      {syncResult && (
        <div className="form-row">
          <label className="text-label">{intl.formatMessage(messages.syncNow)}</label>
          <div className="form-input-area">
            <div className="flex gap-3 text-sm" style={{ color: '#d4c8dc' }}>
              <span>{intl.formatMessage(messages.syncResult, { count: syncResult.performers, type: intl.formatMessage(messages.performers) })}</span>
              <span>{intl.formatMessage(messages.syncResult, { count: syncResult.studios, type: intl.formatMessage(messages.studios) })}</span>
              <span>{intl.formatMessage(messages.syncResult, { count: syncResult.scenes, type: intl.formatMessage(messages.scenes) })}</span>
            </div>
          </div>
        </div>
      )}

      <div className="actions">
        <Button buttonType="primary" onClick={triggerSync} disabled={isSyncing}>
          <ArrowPathIcon className={isSyncing ? 'animate-spin' : ''} />
          <span>
            {isSyncing
              ? intl.formatMessage(messages.syncInProgress)
              : intl.formatMessage(messages.syncNow)}
          </span>
        </Button>
      </div>
    </div>
  );
};

export default SettingsStash;
