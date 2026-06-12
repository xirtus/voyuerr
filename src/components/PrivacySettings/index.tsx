import Button from '@app/components/Common/Button';
import useSettings from '@app/hooks/useSettings';
import useToasts from '@app/hooks/useToasts';
import { useUser } from '@app/hooks/useUser';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { ContentCategory } from '@server/constants/content';
import axios from 'axios';
import { useState } from 'react';
import { useIntl } from 'react-intl';
import { mutate } from 'swr';

const messages = defineMessages('components.PrivacySettings', {
  contentFilters: 'Content Filters',
  contentFiltersDesc: 'Choose which content categories you want to see or hide.',
  allowList: 'Allow List',
  blockList: 'Block List',
  allowListDesc: 'Only show content from selected categories. Leave empty to allow all.',
  blockListDesc: 'Hide content from selected categories. Block list takes priority over allow list.',
  nsfwBlur: 'NSFW Image Blur',
  nsfwBlurDesc: 'Blur all thumbnails and images until you hover over them.',
  privacyMode: 'Privacy Mode',
  privacyModeDesc: 'Your requests will not be logged with your username. Request history will be anonymous.',
  notificationPrivacy: 'Notification Privacy',
  notificationPrivacyDesc: 'Replace scene titles with generic text in push notifications and emails.',
  save: 'Save Privacy Settings',
  saved: 'Privacy settings saved!',
  saveError: 'Failed to save privacy settings.',
});

const allCategories: { value: ContentCategory; label: string; emoji: string }[] = [
  { value: ContentCategory.WESTERN, label: 'Western', emoji: '🎬' },
  { value: ContentCategory.JAV, label: 'JAV', emoji: '🇯🇵' },
  { value: ContentCategory.HENTAI, label: 'Hentai', emoji: '🌸' },
  { value: ContentCategory.AMATEUR, label: 'Amateur', emoji: '📱' },
  { value: ContentCategory.VR, label: 'VR', emoji: '🥽' },
  { value: ContentCategory.GAY, label: 'Gay', emoji: '🌈' },
  { value: ContentCategory.TRANS, label: 'Trans', emoji: '⚧️' },
  { value: ContentCategory.QUEER, label: 'Queer', emoji: '💜' },
  { value: ContentCategory.UHD, label: '4K', emoji: '✨' },
  { value: ContentCategory.UNCENSORED, label: 'Uncensored', emoji: '🔓' },
  { value: ContentCategory.LEAKED, label: 'Leaked', emoji: '💧' },
  { value: ContentCategory.HIGH_FPS, label: '60fps', emoji: '🎮' },
];

const PrivacySettings = () => {
  const intl = useIntl();
  const { user } = useUser();
  const { addToast } = useToasts();
  const [allowList, setAllowList] = useState<ContentCategory[]>(
    (user?.settings as any)?.categoryAllowList || []
  );
  const [blockList, setBlockList] = useState<ContentCategory[]>(
    (user?.settings as any)?.categoryBlockList || []
  );
  const [nsfwBlur, setNsfwBlur] = useState(
    (user?.settings as any)?.nsfwBlur ?? true
  );
  const [privacyMode, setPrivacyMode] = useState(
    (user?.settings as any)?.privacyMode ?? false
  );
  const [notificationPrivacy, setNotificationPrivacy] = useState(
    (user?.settings as any)?.notificationPrivacy ?? false
  );
  const [isSaving, setIsSaving] = useState(false);

  const save = async () => {
    setIsSaving(true);
    try {
      await axios.post('/api/v1/user/settings/privacy', {
        categoryAllowList: allowList,
        categoryBlockList: blockList,
        nsfwBlur,
        privacyMode,
        notificationPrivacy,
      });
      mutate('/api/v1/user');
      addToast(intl.formatMessage(messages.saved), {
        appearance: 'success',
        autoDismiss: true,
      });
    } catch {
      addToast(intl.formatMessage(messages.saveError), {
        appearance: 'error',
        autoDismiss: true,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const toggleCategory = (
    list: ContentCategory[],
    setList: (cats: ContentCategory[]) => void,
    cat: ContentCategory
  ) => {
    if (list.includes(cat)) {
      setList(list.filter((c) => c !== cat));
    } else {
      setList([...list, cat]);
    }
  };

  return (
    <div className="space-y-8">
      {/* Content Filters */}
      <div>
        <h3 className="heading">{intl.formatMessage(messages.contentFilters)}</h3>
        <p className="description">{intl.formatMessage(messages.contentFiltersDesc)}</p>

        <div className="mt-4">
          <h4 className="mb-2 text-sm font-medium" style={{ color: '#d4c8dc' }}>
            {intl.formatMessage(messages.allowList)}
          </h4>
          <p className="mb-2 text-xs" style={{ color: '#7a6a82' }}>
            {intl.formatMessage(messages.allowListDesc)}
          </p>
          <div className="flex flex-wrap gap-2">
            {allCategories.map((cat) => (
              <button
                key={`allow-${cat.value}`}
                onClick={() => toggleCategory(allowList, setAllowList, cat.value)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                  allowList.length === 0 || allowList.includes(cat.value)
                    ? 'bg-[#ff3366]/20 text-[#ff3366] border border-[#ff3366]/30'
                    : 'bg-gray-800/30 text-gray-500 border border-gray-700/30'
                }`}
                style={{
                  backgroundColor: allowList.length === 0 || allowList.includes(cat.value)
                    ? 'rgba(255, 51, 102, 0.15)' : undefined,
                  borderColor: allowList.length === 0 || allowList.includes(cat.value)
                    ? 'rgba(255, 51, 102, 0.3)' : '#3a2048',
                }}
              >
                <span className="mr-1">{cat.emoji}</span>{cat.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <h4 className="mb-2 text-sm font-medium" style={{ color: '#d4c8dc' }}>
            {intl.formatMessage(messages.blockList)}
          </h4>
          <p className="mb-2 text-xs" style={{ color: '#7a6a82' }}>
            {intl.formatMessage(messages.blockListDesc)}
          </p>
          <div className="flex flex-wrap gap-2">
            {allCategories.map((cat) => (
              <button
                key={`block-${cat.value}`}
                onClick={() => toggleCategory(blockList, setBlockList, cat.value)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                  blockList.includes(cat.value)
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                    : 'bg-gray-800/30 text-gray-500 border border-gray-700/30'
                }`}
                style={{
                  backgroundColor: blockList.includes(cat.value)
                    ? 'rgba(239, 68, 68, 0.15)' : undefined,
                  borderColor: blockList.includes(cat.value)
                    ? 'rgba(239, 68, 68, 0.3)' : '#3a2048',
                }}
              >
                <span className="mr-1">{cat.emoji}</span>{cat.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* NSFW Blur */}
      <div className="form-row">
        <label className="text-label">{intl.formatMessage(messages.nsfwBlur)}</label>
        <div className="form-input-area">
          <p className="mb-2 text-sm" style={{ color: '#7a6a82' }}>
            {intl.formatMessage(messages.nsfwBlurDesc)}
          </p>
          <input
            type="checkbox"
            checked={nsfwBlur}
            onChange={(e) => setNsfwBlur(e.target.checked)}
            className="h-5 w-5"
          />
        </div>
      </div>

      {/* Privacy Mode */}
      <div className="form-row">
        <label className="text-label">{intl.formatMessage(messages.privacyMode)}</label>
        <div className="form-input-area">
          <p className="mb-2 text-sm" style={{ color: '#7a6a82' }}>
            {intl.formatMessage(messages.privacyModeDesc)}
          </p>
          <input
            type="checkbox"
            checked={privacyMode}
            onChange={(e) => setPrivacyMode(e.target.checked)}
            className="h-5 w-5"
          />
        </div>
      </div>

      {/* Notification Privacy */}
      <div className="form-row">
        <label className="text-label">{intl.formatMessage(messages.notificationPrivacy)}</label>
        <div className="form-input-area">
          <p className="mb-2 text-sm" style={{ color: '#7a6a82' }}>
            {intl.formatMessage(messages.notificationPrivacyDesc)}
          </p>
          <input
            type="checkbox"
            checked={notificationPrivacy}
            onChange={(e) => setNotificationPrivacy(e.target.checked)}
            className="h-5 w-5"
          />
        </div>
      </div>

      <div className="actions">
        <Button buttonType="primary" onClick={save} disabled={isSaving}>
          {isSaving ? '...' : intl.formatMessage(messages.save)}
        </Button>
      </div>
    </div>
  );
};

export default PrivacySettings;
