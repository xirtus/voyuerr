import MediaSlider from '@app/components/MediaSlider';
import PageTitle from '@app/components/Common/PageTitle';
import defineMessages from '@app/utils/defineMessages';
import { useIntl } from 'react-intl';

const messages = defineMessages('pages.DiscoverStudios', {
  discoverStudios: 'Browse Studios',
  topStudios: 'Top Studios',
});

const DiscoverStudios = () => {
  const intl = useIntl();
  return (
    <>
      <PageTitle title={intl.formatMessage(messages.discoverStudios)} />
      <MediaSlider
        sliderKey="discover-studios"
        title={intl.formatMessage(messages.topStudios)}
        url="/api/v1/discover/adult/studios"
      />
      <div className="extra-bottom-space relative" />
    </>
  );
};

export default DiscoverStudios;
