import Button from '@app/components/Common/Button';
import CachedImage from '@app/components/Common/CachedImage';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import PageTitle from '@app/components/Common/PageTitle';
import SceneCard from '@app/components/SceneCard';
import ErrorPage from '@app/pages/_error';
import defineMessages from '@app/utils/defineMessages';
import { ContentCategory, ContentType, SceneStatus, StudioNetworkType } from '@server/constants/content';
import { GlobeAltIcon, BuildingOffice2Icon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

const messages = defineMessages('components.StudioDetails', {
  releases: 'All Releases',
  about: 'About',
  networkType: 'Network Type',
  parentStudio: 'Parent Network',
  childStudios: 'Subsidiaries',
  country: 'Country',
  founded: 'Founded',
  scenes: '{count} scenes',
  website: 'Visit Website',
  noreleases: 'No releases found for this studio.',
  independent: 'Independent',
  partner: 'Partner',
  subsidiary: 'Subsidiary',
});

interface StudioData {
  id: number;
  name: string;
  slug: string;
  description?: string;
  logoUrl?: string;
  backdropUrl?: string;
  websiteUrl?: string;
  networkType: StudioNetworkType;
  country?: string;
  foundedYear?: number;
  sceneCount: number;
  popularity: number;
  parentStudio: { id: number; name: string; slug: string; logoUrl?: string } | null;
  childStudios: { id: number; name: string; slug: string; logoUrl?: string }[];
}

interface StudioScene {
  id: number;
  title: string;
  contentType: ContentType;
  releaseDate?: string;
  posterUrl?: string;
  description?: string;
  status: SceneStatus;
  categories: ContentCategory[];
}

const StudioDetails = () => {
  const intl = useIntl();
  const router = useRouter();

  const { data, error } = useSWR<StudioData>(
    `/api/v1/studio/${router.query.studioId}`
  );

  const { data: scenesData, error: scenesError } = useSWR<StudioScene[]>(
    `/api/v1/studio/${router.query.studioId}/scenes`
  );

  if (!data && !error) {
    return <LoadingSpinner />;
  }

  if (!data) {
    return <ErrorPage statusCode={404} />;
  }

  const isLoading = !scenesData && !scenesError;

  const networkTypeLabel = {
    [StudioNetworkType.PARENT]: 'Parent',
    [StudioNetworkType.SUBSIDIARY]: intl.formatMessage(messages.subsidiary),
    [StudioNetworkType.PARTNER]: intl.formatMessage(messages.partner),
    [StudioNetworkType.INDEPENDENT]: intl.formatMessage(messages.independent),
  };

  return (
    <div className="media-page" style={{ height: 493 }}>
      <PageTitle title={data.name} />

      {data.backdropUrl && (
        <div className="media-page-bg-image">
          <CachedImage
            type="tmdb"
            alt=""
            src={data.backdropUrl}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            fill
            priority
          />
        </div>
      )}

      <div className="media-header">
        <div className="media-poster">
          {data.logoUrl ? (
            <CachedImage
              type="tmdb"
              src={data.logoUrl}
              alt={data.name}
              sizes="100vw"
              style={{ width: '100%', height: 'auto' }}
              width={400}
              height={225}
              priority
            />
          ) : (
            <div className="flex h-32 w-32 items-center justify-center rounded md:h-44 md:w-44" style={{ backgroundColor: '#1e1228', borderColor: '#3a2048', borderWidth: 1 }}>
              <BuildingOffice2Icon className="h-12 w-12" style={{ color: '#7a6a82' }} />
            </div>
          )}
        </div>
        <div className="media-title">
          <h1 data-testid="studio-title" className="text-2xl font-bold lg:text-4xl">{data.name}</h1>
          <div className="mb-2 mt-1 flex flex-wrap items-center justify-center gap-3 text-sm lg:justify-start" style={{ color: '#7a6a82' }}>
            <span className="flex items-center gap-1">
              <span>{intl.formatMessage(messages.networkType)}:</span>
              <span className="font-medium" style={{ color: '#d4c8dc' }}>{networkTypeLabel[data.networkType]}</span>
            </span>
            {data.country && (
              <span>{data.country}</span>
            )}
            {data.foundedYear && (
              <span>{intl.formatMessage(messages.founded)}: {data.foundedYear}</span>
            )}
            <span style={{ color: '#ff3366' }}>{intl.formatMessage(messages.scenes, { count: data.sceneCount })}</span>
          </div>
        </div>
        <div className="media-actions">
          {data.websiteUrl && (
            <a href={data.websiteUrl} target="_blank" rel="noreferrer">
              <Button buttonType="primary">
                <GlobeAltIcon />
                <span>{intl.formatMessage(messages.website)}</span>
              </Button>
            </a>
          )}
        </div>
      </div>

      <div className="media-overview">
        <div className="media-overview-left">
          {data.description && (
            <>
              <h2>{intl.formatMessage(messages.about)}</h2>
              <p>{data.description}</p>
            </>
          )}
          {data.childStudios && data.childStudios.length > 0 && (
            <div className="mt-6">
              <h2>{intl.formatMessage(messages.childStudios)}</h2>
              <div className="mt-2 flex flex-wrap gap-3">
                {data.childStudios.map((child) => (
                  <Link
                    key={child.id}
                    href={`/studio/${child.id}`}
                    className="flex items-center gap-2 rounded-lg border px-3 py-2 transition duration-300 hover:border-[#ff3366]"
                    style={{ borderColor: '#3a2048', backgroundColor: '#1e1228' }}
                  >
                    {child.logoUrl ? (
                      <CachedImage type="tmdb" src={child.logoUrl} alt={child.name} width={24} height={24} className="rounded" />
                    ) : null}
                    <span className="text-sm font-medium" style={{ color: '#d4c8dc' }}>{child.name}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
          {data.parentStudio && (
            <div className="mt-4">
              <span className="text-sm" style={{ color: '#7a6a82' }}>{intl.formatMessage(messages.parentStudio)}: </span>
              <Link href={`/studio/${data.parentStudio.id}`} className="text-sm font-medium hover:underline" style={{ color: '#ff6690' }}>
                {data.parentStudio.name}
              </Link>
            </div>
          )}
        </div>
        <div className="media-overview-right">
          <div className="media-facts">
            <div className="media-fact">
              <span>{intl.formatMessage(messages.networkType)}</span>
              <span className="media-fact-value">{networkTypeLabel[data.networkType]}</span>
            </div>
            {data.country && (
              <div className="media-fact">
                <span>{intl.formatMessage(messages.country)}</span>
                <span className="media-fact-value">{data.country}</span>
              </div>
            )}
            {data.foundedYear && (
              <div className="media-fact">
                <span>{intl.formatMessage(messages.founded)}</span>
                <span className="media-fact-value">{data.foundedYear}</span>
              </div>
            )}
            <div className="media-fact">
              <span>{intl.formatMessage(messages.scenes, { count: data.sceneCount })}</span>
              <span className="media-fact-value" style={{ color: '#ff3366' }}>{data.sceneCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Releases */}
      <div className="slider-header mt-10">
        <div className="slider-title">
          <span>{intl.formatMessage(messages.releases)}</span>
        </div>
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : scenesData && scenesData.length > 0 ? (
        <ul className="cards-vertical">
          {scenesData.map((scene) => (
            <li key={`studio-scene-${scene.id}`}>
              <SceneCard
                id={scene.id}
                title={scene.title}
                image={scene.posterUrl}
                summary={scene.description}
                year={scene.releaseDate}
                contentType={scene.contentType}
                categories={scene.categories || []}
                status={scene.status}
              />
            </li>
          ))}
        </ul>
      ) : (
        <div className="py-8 text-center" style={{ color: '#7a6a82' }}>
          {intl.formatMessage(messages.noreleases)}
        </div>
      )}

      <div className="extra-bottom-space relative" />
    </div>
  );
};

export default StudioDetails;
