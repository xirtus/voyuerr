import MediaSlider from '@app/components/MediaSlider';
import FilterSidebar from '@app/components/FilterSidebar';
import PageTitle from '@app/components/Common/PageTitle';
import Button from '@app/components/Common/Button';
import Tooltip from '@app/components/Common/Tooltip';
import defineMessages from '@app/utils/defineMessages';
import { ContentCategory } from '@server/constants/content';
import { FunnelIcon } from '@heroicons/react/24/solid';
import { useState } from 'react';
import { useIntl } from 'react-intl';

const messages = defineMessages('pages.DiscoverScenes', {
  discoverScenes: 'Browse Scenes',
  trendingScenes: 'Trending Scenes',
  newScenes: 'New Releases',
  popularScenes: 'Popular Scenes',
  filtertoggle: 'Filters',
});

const DiscoverScenes = () => {
  const intl = useIntl();
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<ContentCategory[]>([]);
  const [selectedQuality, setSelectedQuality] = useState('');
  const [selectedYear, setSelectedYear] = useState('');

  return (
    <>
      <PageTitle title={intl.formatMessage(messages.discoverScenes)} />
      <div className="mb-4 flex items-center gap-3">
        <Tooltip content={intl.formatMessage(messages.filtertoggle)}>
          <Button
            buttonType={showFilters ? 'primary' : 'default'}
            onClick={() => setShowFilters(!showFilters)}
          >
            <FunnelIcon className="h-4 w-4" />
          </Button>
        </Tooltip>
      </div>
      {showFilters && (
        <FilterSidebar
          selectedCategories={selectedCategories}
          onCategoryToggle={(cat) =>
            setSelectedCategories((prev) =>
              prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
            )
          }
          onClearCategories={() => setSelectedCategories([])}
          selectedQuality={selectedQuality}
          onQualityChange={setSelectedQuality}
          selectedYear={selectedYear}
          onYearChange={setSelectedYear}
          className="mb-6"
        />
      )}
      <MediaSlider
        sliderKey="discover-scenes-trending"
        title={intl.formatMessage(messages.trendingScenes)}
        url="/api/v1/discover/adult/trending"
      />
      <MediaSlider
        sliderKey="discover-scenes-new"
        title={intl.formatMessage(messages.newScenes)}
        url="/api/v1/discover/adult/new"
      />
      <MediaSlider
        sliderKey="discover-scenes-popular"
        title={intl.formatMessage(messages.popularScenes)}
        url="/api/v1/discover/adult/trending"
        extraParams="sort_by=popularity"
      />
      <div className="extra-bottom-space relative" />
    </>
  );
};

export default DiscoverScenes;
