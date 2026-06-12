import MediaSlider from '@app/components/MediaSlider';
import PageTitle from '@app/components/Common/PageTitle';
import defineMessages from '@app/utils/defineMessages';
import { useIntl } from 'react-intl';

const messages = defineMessages('pages.DiscoverPerformers', {
  discoverPerformers: 'Browse Performers',
  popularPerformers: 'Popular Performers',
});

const DiscoverPerformers = () => {
  const intl = useIntl();
  return (
    <>
      <PageTitle title={intl.formatMessage(messages.discoverPerformers)} />
      <MediaSlider
        sliderKey="discover-performers"
        title={intl.formatMessage(messages.popularPerformers)}
        url="/api/v1/discover/adult/performers"
      />
      <div className="extra-bottom-space relative" />
    </>
  );
};

export default DiscoverPerformers;
