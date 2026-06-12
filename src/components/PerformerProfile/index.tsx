import CachedImage from '@app/components/Common/CachedImage';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import PageTitle from '@app/components/Common/PageTitle';
import SceneCard from '@app/components/SceneCard';
import ErrorPage from '@app/pages/_error';
import defineMessages from '@app/utils/defineMessages';
import { ContentCategory, ContentType, PerformerGender, SceneStatus } from '@server/constants/content';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

const messages = defineMessages('components.PerformerProfile', {
  appearances: 'Filmography',
  bio: 'Biography',
  stats: 'Statistics',
  scenes: 'Scenes',
  birthdate: 'Born {birthdate}',
  country: 'Country',
  height: 'Height',
  weight: 'Weight',
  measurements: 'Measurements',
  aliases: 'Also Known As',
  active: 'Active',
  inactive: 'Retired',
  nobio: 'No biography available.',
  noscenes: 'No scenes found for this performer.',
  cm: '{value} cm',
  kg: '{value} kg',
  sceneCount: '{count} scenes',
  categories: 'Categories',
  perfomerDetails: 'Performer Details',
});

interface PerformerData {
  id: number;
  name: string;
  aliases: string[];
  birthDate?: string;
  bio?: string;
  gender: PerformerGender;
  imageUrl?: string;
  country?: string;
  height?: number;
  weight?: number;
  measurements?: string;
  sceneCount: number;
  active: boolean;
  adult: boolean;
  popularity: number;
}

interface PerformerScene {
  id: number;
  title: string;
  contentType: ContentType;
  releaseDate?: string;
  posterUrl?: string;
  description?: string;
  status: SceneStatus;
  performerRole?: string;
  characterName?: string;
  categories?: string[];
}

const genderLabels: Record<PerformerGender, string> = {
  [PerformerGender.FEMALE]: 'Female',
  [PerformerGender.MALE]: 'Male',
  [PerformerGender.TRANSGENDER]: 'Transgender',
  [PerformerGender.NON_BINARY]: 'Non-binary',
  [PerformerGender.INTERSEX]: 'Intersex',
};

const PerformerProfile = () => {
  const intl = useIntl();
  const router = useRouter();

  const { data, error } = useSWR<PerformerData>(
    `/api/v1/performer/${router.query.performerId}`
  );

  const { data: scenesData, error: scenesError } = useSWR<PerformerScene[]>(
    `/api/v1/performer/${router.query.performerId}/scenes`
  );

  if (!data && !error) {
    return <LoadingSpinner />;
  }

  if (!data) {
    return <ErrorPage statusCode={404} />;
  }

  const isLoading = !scenesData && !scenesError;

  return (
    <div className="media-page" style={{ height: 493 }}>
      <PageTitle title={data.name} />

      {(scenesData && scenesData.length > 0) && (
        <div className="absolute left-0 right-0 top-0 z-0 h-96">
          <div className="absolute inset-0">
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: scenesData
                  .filter((s) => s.posterUrl)
                  .slice(0, 4)
                  .map((s) => `url(${s.posterUrl})`)
                  .join(', '),
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                opacity: 0.15,
                filter: 'blur(40px)',
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#1a0a1e]" />
          </div>
        </div>
      )}

      <div className="relative z-10 mb-8 mt-4 flex flex-col items-center lg:flex-row lg:items-start">
        {data.imageUrl && (
          <div className="relative mb-6 mr-0 h-36 w-36 flex-shrink-0 overflow-hidden rounded-full ring-1 lg:mb-0 lg:mr-6 lg:h-44 lg:w-44"
            style={{ borderColor: '#3a2048' }}>
            <CachedImage
              type="tmdb"
              src={data.imageUrl}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              fill
            />
          </div>
        )}
        <div className="w-full text-center lg:text-left">
          <h1 className="text-3xl text-white lg:text-4xl">{data.name}</h1>

          <div className="mb-2 mt-1 space-y-1 text-xs sm:text-sm lg:text-base" style={{ color: '#7a6a82' }}>
            <div>
              {data.birthDate &&
                intl.formatMessage(messages.birthdate, {
                  birthdate: intl.formatDate(data.birthDate, {
                    year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
                  }),
                })}
              {' · '}
              {genderLabels[data.gender]}
              {' · '}
              <span style={{ color: data.active ? '#ff6690' : '#7a6a82' }}>
                {data.active ? intl.formatMessage(messages.active) : intl.formatMessage(messages.inactive)}
              </span>
            </div>
            {(data.aliases ?? []).length > 0 && (
              <div>
                {intl.formatMessage(messages.aliases)}: {(data.aliases ?? []).join(', ')}
              </div>
            )}
          </div>

          {data.bio && (
            <div className="mt-4 text-left">
              <h2 className="text-lg font-bold" style={{ color: '#d4c8dc' }}>
                {intl.formatMessage(messages.bio)}
              </h2>
              <p className="pt-2 text-sm lg:text-base" style={{ color: '#7a6a82' }}>
                {data.bio}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border p-3 text-center" style={{ borderColor: '#3a2048', backgroundColor: '#1e1228' }}>
          <div className="text-2xl font-bold" style={{ color: '#ff3366' }}>{data.sceneCount}</div>
          <div className="text-xs" style={{ color: '#7a6a82' }}>{intl.formatMessage(messages.sceneCount, { count: data.sceneCount })}</div>
        </div>
        {data.country && (
          <div className="rounded-lg border p-3 text-center" style={{ borderColor: '#3a2048', backgroundColor: '#1e1228' }}>
            <div className="text-2xl font-bold" style={{ color: '#d4c8dc' }}>{data.country}</div>
            <div className="text-xs" style={{ color: '#7a6a82' }}>{intl.formatMessage(messages.country)}</div>
          </div>
        )}
        {data.height && (
          <div className="rounded-lg border p-3 text-center" style={{ borderColor: '#3a2048', backgroundColor: '#1e1228' }}>
            <div className="text-2xl font-bold" style={{ color: '#d4c8dc' }}>
              {intl.formatMessage(messages.cm, { value: data.height })}
            </div>
            <div className="text-xs" style={{ color: '#7a6a82' }}>{intl.formatMessage(messages.height)}</div>
          </div>
        )}
        {data.measurements && (
          <div className="rounded-lg border p-3 text-center" style={{ borderColor: '#3a2048', backgroundColor: '#1e1228' }}>
            <div className="text-2xl font-bold" style={{ color: '#d4c8dc' }}>{data.measurements}</div>
            <div className="text-xs" style={{ color: '#7a6a82' }}>{intl.formatMessage(messages.measurements)}</div>
          </div>
        )}
      </div>

      {/* Filmography */}
      <div className="slider-header">
        <div className="slider-title">
          <span>{intl.formatMessage(messages.appearances)}</span>
        </div>
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : scenesData && scenesData.length > 0 ? (
        <ul className="cards-vertical">
          {scenesData.map((scene) => (
            <li key={`scene-${scene.id}`}>
              <SceneCard
                id={scene.id}
                title={scene.title}
                image={scene.posterUrl}
                summary={scene.description}
                year={scene.releaseDate}
                contentType={scene.contentType}
                categories={(scene.categories || []) as ContentCategory[]}
                status={scene.status}
              />
              {scene.characterName && (
                <div className="mt-2 w-full truncate text-center text-xs text-gray-300">
                  as {scene.characterName}
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <div className="py-8 text-center" style={{ color: '#7a6a82' }}>
          {intl.formatMessage(messages.noscenes)}
        </div>
      )}

      <div className="extra-bottom-space relative" />
    </div>
  );
};

export default PerformerProfile;
