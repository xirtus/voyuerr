import { ContentCategory } from '@server/constants/content';
import defineMessages from '@app/utils/defineMessages';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.FilterSidebar', {
  filters: 'Filters',
  contentCategory: 'Content Category',
  all: 'All',
  western: 'Western',
  jav: 'JAV',
  hentai: 'Hentai',
  amateur: 'Amateur',
  vr: 'VR',
  gay: 'Gay',
  trans: 'Trans',
  queer: 'Queer',
  uhd: '4K UHD',
  uncensored: 'Uncensored',
  leaked: 'Leaked',
  highfps: '60fps',
  quality: 'Quality',
  allQualities: 'All',
  sd: 'SD',
  hd1080: '1080p',
  uhd4k: '4K',
  vrOnly: 'VR Only',
  year: 'Year',
  allYears: 'All Years',
  thisYear: 'This Year',
  lastYear: 'Last Year',
  older: 'Older',
  studio: 'Studio',
});

interface FilterSidebarProps {
  selectedCategories: ContentCategory[];
  onCategoryToggle: (category: ContentCategory) => void;
  onClearCategories: () => void;
  selectedQuality: string;
  onQualityChange: (quality: string) => void;
  selectedYear: string;
  onYearChange: (year: string) => void;
  className?: string;
}

const categoryOptions: { value: ContentCategory; label: string; emoji: string }[] = [
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

const qualityOptions = [
  { value: '', label: 'All' },
  { value: 'sd', label: 'SD' },
  { value: '1080p', label: '1080p' },
  { value: '4k', label: '4K' },
  { value: 'vr', label: 'VR Only' },
];

const yearOptions = [
  { value: '', label: 'All Years' },
  { value: 'thisYear', label: 'This Year' },
  { value: 'lastYear', label: 'Last Year' },
  { value: 'older', label: 'Older' },
];

const FilterSidebar = ({
  selectedCategories,
  onCategoryToggle,
  onClearCategories,
  selectedQuality,
  onQualityChange,
  selectedYear,
  onYearChange,
  className = '',
}: FilterSidebarProps) => {
  const intl = useIntl();

  return (
    <div className={`filter-sidebar rounded-lg p-4 ${className}`}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-bold tracking-wide uppercase" style={{ color: '#d4c8dc' }}>
          {intl.formatMessage(messages.filters)}
        </h3>
        {selectedCategories.length > 0 && (
          <button
            onClick={onClearCategories}
            className="text-xs hover:underline"
            style={{ color: '#ff3366' }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Content Categories */}
      <div className="mb-6">
        <h4 className="filter-section-title mb-2">{intl.formatMessage(messages.contentCategory)}</h4>
        <div className="flex flex-wrap gap-1.5">
          {categoryOptions.map((cat) => {
            const isActive = selectedCategories.includes(cat.value);
            return (
              <button
                key={cat.value}
                onClick={() => onCategoryToggle(cat.value)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-[#ff3366]/30 text-[#ff3366] border border-[#ff3366]/40'
                    : 'bg-gray-800/50 text-gray-400 border border-gray-700/50 hover:text-gray-300 hover:border-gray-600'
                }`}
                style={{
                  backgroundColor: isActive ? 'rgba(255, 51, 102, 0.2)' : undefined,
                  borderColor: isActive ? 'rgba(255, 51, 102, 0.4)' : '#3a2048',
                }}
              >
                <span className="mr-1">{cat.emoji}</span>
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Quality */}
      <div className="mb-6">
        <h4 className="filter-section-title mb-2">{intl.formatMessage(messages.quality)}</h4>
        <div className="flex flex-wrap gap-1.5">
          {qualityOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onQualityChange(opt.value)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                selectedQuality === opt.value
                  ? 'bg-[#ff3366]/30 text-[#ff3366] border border-[#ff3366]/40'
                  : 'bg-gray-800/50 text-gray-400 border border-gray-700/50 hover:text-gray-300'
              }`}
              style={{
                backgroundColor: selectedQuality === opt.value ? 'rgba(255, 51, 102, 0.2)' : undefined,
                borderColor: selectedQuality === opt.value ? 'rgba(255, 51, 102, 0.4)' : '#3a2048',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Year */}
      <div className="mb-6">
        <h4 className="filter-section-title mb-2">{intl.formatMessage(messages.year)}</h4>
        <div className="flex flex-wrap gap-1.5">
          {yearOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onYearChange(opt.value)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                selectedYear === opt.value
                  ? 'bg-[#ff3366]/30 text-[#ff3366] border border-[#ff3366]/40'
                  : 'bg-gray-800/50 text-gray-400 border border-gray-700/50 hover:text-gray-300'
              }`}
              style={{
                backgroundColor: selectedYear === opt.value ? 'rgba(255, 51, 102, 0.2)' : undefined,
                borderColor: selectedYear === opt.value ? 'rgba(255, 51, 102, 0.4)' : '#3a2048',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FilterSidebar;
