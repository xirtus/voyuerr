import Button from '@app/components/Common/Button';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import Modal from '@app/components/Common/Modal';
import SensitiveInput from '@app/components/Common/SensitiveInput';
import useLocale from '@app/hooks/useLocale';
import useToasts from '@app/hooks/useToasts';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { SceneStatus } from '@server/constants/content';
import type { MediaRequest } from '@server/entity/MediaRequest';
import { MediaRequestStatus } from '@server/constants/media';
import type { NonFunctionProperties } from '@server/interfaces/api/common';
import axios from 'axios';
import { useState } from 'react';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.RequestModal.SceneRequest', {
  requestscene: 'Request Scene',
  qualityprofile: 'Quality/Format',
  quality1080p: '1080p',
  quality4k: '4K',
  qualityVR: 'VR',
  quality60fps: '60fps',
  requestas: 'Request as',
  request: 'Request',
  cancel: 'Cancel',
  requestadmin: 'Request as Admin',
  requestSuccess: '<strong>{title}</strong> requested successfully!',
  requestCanceled: 'Request for <strong>{title}</strong> canceled.',
  requestFailed: 'Something went wrong. Please try again.',
});

const availableQualities = [
  { id: '1080p', name: '1080p' },
  { id: '4k', name: '4K UHD' },
  { id: 'vr', name: 'VR' },
  { id: '60fps', name: '60fps' },
];

interface SceneRequestModalProps {
  tmdbId: number;
  onCancel?: () => void;
  onComplete?: (newStatus: SceneStatus) => void;
  onUpdating?: (isUpdating: boolean) => void;
  is4k?: boolean;
  editRequest?: NonFunctionProperties<MediaRequest>;
}

const SceneRequestModal = ({
  tmdbId,
  onCancel,
  onComplete,
  onUpdating,
  is4k = false,
  editRequest,
}: SceneRequestModalProps) => {
  const intl = useIntl();
  const { addToast } = useToasts();
  const { locale } = useLocale();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedQuality, setSelectedQuality] = useState(is4k ? '4k' : '1080p');

  const submitRequest = async () => {
    setIsSubmitting(true);
    if (onUpdating) onUpdating(true);

    try {
      const response = await axios.post('/api/v1/request', {
        mediaType: 'movie',
        tmdbId,
        is4k: selectedQuality === '4k' || selectedQuality === 'vr',
        quality: selectedQuality,
      });

      if (response.data) {
        addToast(
          <span>
            {intl.formatMessage(messages.requestSuccess, {
              title: response.data.media?.title || tmdbId,
              strong: (msg: React.ReactNode) => <strong>{msg}</strong>,
            })}
          </span>,
          { appearance: 'success', autoDismiss: true }
        );
        if (onComplete) {
          onComplete(SceneStatus.PENDING);
        }
      }
    } catch {
      addToast(intl.formatMessage(messages.requestFailed), {
        appearance: 'error',
        autoDismiss: true,
      });
    } finally {
      setIsSubmitting(false);
      if (onUpdating) onUpdating(false);
    }
  };

  return (
    <Modal
      title={intl.formatMessage(messages.requestscene)}
      iconSvg={<span className="text-xl">🎬</span>}
      onCancel={onCancel}
      onOk={submitRequest}
      okText={isSubmitting ? intl.formatMessage(globalMessages.request) : intl.formatMessage(messages.request)}
      okDisabled={isSubmitting}
      backgroundClickable={false}
    >
      <div className="mt-4 space-y-4">
        <div>
          <label className="text-label">
            {intl.formatMessage(messages.qualityprofile)}
          </label>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {availableQualities.map((quality) => (
              <button
                key={quality.id}
                type="button"
                onClick={() => setSelectedQuality(quality.id)}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition-all ${
                  selectedQuality === quality.id
                    ? 'bg-[#ff3366]/20 border-[#ff3366] text-[#ff3366]'
                    : 'border-[#3a2048] text-[#7a6a82] hover:border-[#ff3366]/50'
                }`}
                style={{
                  backgroundColor: selectedQuality === quality.id ? 'rgba(255, 51, 102, 0.15)' : undefined,
                  borderColor: selectedQuality === quality.id ? '#ff3366' : undefined,
                }}
              >
                {quality.name}
              </button>
            ))}
          </div>
        </div>
        {isSubmitting && (
          <div className="flex justify-center py-4">
            <LoadingSpinner />
          </div>
        )}
      </div>
    </Modal>
  );
};

export default SceneRequestModal;
