import Spinner from '@app/assets/spinner.svg';
import Button from '@app/components/Common/Button';
import CachedImage from '@app/components/Common/CachedImage';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import PageTitle from '@app/components/Common/PageTitle';
import Tag from '@app/components/Common/Tag';
import Tooltip from '@app/components/Common/Tooltip';
import IssueModal from '@app/components/IssueModal';
import ManageSlideOver from '@app/components/ManageSlideOver';
import MediaSlider from '@app/components/MediaSlider';
import RequestButton from '@app/components/RequestButton';
import SceneCard from '@app/components/SceneCard';
import Slider from '@app/components/Slider';
import StatusBadge from '@app/components/StatusBadge';
import useDeepLinks from '@app/hooks/useDeepLinks';
import useSettings from '@app/hooks/useSettings';
import useToasts from '@app/hooks/useToasts';
import { Permission, UserType, useUser } from '@app/hooks/useUser';
import globalMessages from '@app/i18n/globalMessages';
import ErrorPage from '@app/pages/_error';
import defineMessages from '@app/utils/defineMessages';
import { refreshIntervalHelper } from '@app/utils/refreshIntervalHelper';
import {
  ArrowRightCircleIcon,
  CloudIcon,
  CogIcon,
  ExclamationTriangleIcon,
  EyeSlashIcon,
  FilmIcon,
  MinusCircleIcon,
  PlayIcon,
  StarIcon,
} from '@heroicons/react/24/outline';
import { IssueStatus } from '@server/constants/issue';
import { SceneStatus } from '@server/constants/content';
import { MediaServerType } from '@server/constants/server';
import type { SceneDetails as SceneDetailsType } from '@server/models/Scene';
import axios from 'axios';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

const messages = defineMessages('components.SceneDetails', {
  originaltitle: 'Original Title',
  releasedate: 'Release Date',
  overview: 'Overview',
  runtime: '{minutes} minutes',
  performers: 'Performers',
  studio: 'Studio',
  viewallscenes: 'View All Scenes',
  overviewunavailable: 'Overview unavailable.',
  downloadstatus: 'Download Status',
  play: 'Play on {mediaServerName}',
  play4k: 'Play 4K on {mediaServerName}',
  markavailable: 'Mark as Available',
  mark4kavailable: 'Mark as Available in 4K',
  showmore: 'Show More',
  showless: 'Show Less',
  reportissue: 'Report an Issue',
  managescene: 'Manage Scene',
  watchlistSuccess: '<strong>{title}</strong> added to watchlist successfully!',
  watchlistDeleted: '<strong>{title}</strong> Removed from watchlist successfully!',
  watchlistError: 'Something went wrong. Please try again.',
  removefromwatchlist: 'Remove From Watchlist',
  addtowatchlist: 'Add To Watchlist',
  recommendations: 'Similar Scenes',
  categories: 'Categories',
  watchtrailer: 'Watch Trailer',
  requestscene: 'Request Scene',
});

interface SceneDetailsProps {
  scene?: SceneDetailsType;
}

const SceneDetails = ({ scene }: SceneDetailsProps) => {
  const settings = useSettings();
  const { user, hasPermission } = useUser();
  const router = useRouter();
  const intl = useIntl();
  const [showManager, setShowManager] = useState(router.query.manage == '1');
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [toggleWatchlist, setToggleWatchlist] = useState<boolean>(true);
  const { addToast } = useToasts();

  const { data, error, mutate: revalidate } = useSWR<SceneDetailsType>(
    `/api/v1/scene/${router.query.sceneId}`,
    {
      fallbackData: scene,
      refreshInterval: refreshIntervalHelper(
        {
          downloadStatus: scene?.mediaInfo?.downloadStatus,
          downloadStatus4k: scene?.mediaInfo?.downloadStatus4k,
        },
        15000
      ),
    }
  );

  useEffect(() => {
    setShowManager(router.query.manage == '1');
  }, [router.query.manage]);

  const { mediaUrl: plexUrl, mediaUrl4k: plexUrl4k } = useDeepLinks({
    mediaUrl: data?.mediaUrl,
    mediaUrl4k: data?.mediaUrl4k,
    iOSPlexUrl: data?.mediaInfo?.iOSPlexUrl,
    iOSPlexUrl4k: data?.mediaInfo?.iOSPlexUrl4k,
  });

  if (!data && !error) {
    return <LoadingSpinner />;
  }

  if (!data) {
    return <ErrorPage statusCode={404} />;
  }

  const mediaLinks: { text: string; url: string; svg: React.ReactNode }[] = [];

  if (plexUrl && hasPermission([Permission.REQUEST, Permission.REQUEST_MOVIE], { type: 'or' })) {
    mediaLinks.push({
      text: intl.formatMessage(messages.play, { mediaServerName: 'Media Server' }),
      url: plexUrl,
      svg: <PlayIcon />,
    });
  }

  if (data.trailerUrl) {
    mediaLinks.push({
      text: intl.formatMessage(messages.watchtrailer),
      url: data.trailerUrl,
      svg: <FilmIcon />,
    });
  }

  const sceneAttributes: React.ReactNode[] = [];

  if (data.runtime) {
    sceneAttributes.push(
      intl.formatMessage(messages.runtime, { minutes: data.runtime })
    );
  }

  if (data.tags && data.tags.length) {
    sceneAttributes.push(
      data.tags.slice(0, 3).map((t, i) => (
        <span key={`tag-${i}`} className="capitalize">{t}</span>
      ))
    );
  }

  const onClickWatchlistBtn = async (): Promise<void> => {
    setIsUpdating(true);
    try {
      const response = await axios.post('/api/v1/watchlist', {
        tmdbId: data.id,
        mediaType: 'movie',
        title: data.title,
      });
      if (response.data) {
        addToast(
          <span>
            {intl.formatMessage(messages.watchlistSuccess, {
              title: data.title,
              strong: (msg: React.ReactNode) => <strong>{msg}</strong>,
            })}
          </span>,
          { appearance: 'success', autoDismiss: true }
        );
      }
    } catch {
      addToast(intl.formatMessage(messages.watchlistError), {
        appearance: 'error',
        autoDismiss: true,
      });
    }
    setIsUpdating(false);
    setToggleWatchlist((prevState) => !prevState);
  };

  const onClickDeleteWatchlistBtn = async (): Promise<void> => {
    setIsUpdating(true);
    try {
      await axios.delete(`/api/v1/watchlist/${data.id}?mediaType=movie`);
      addToast(
        <span>
          {intl.formatMessage(messages.watchlistDeleted, {
            title: data.title,
            strong: (msg: React.ReactNode) => <strong>{msg}</strong>,
          })}
        </span>,
        { appearance: 'info', autoDismiss: true }
      );
    } catch {
      addToast(intl.formatMessage(messages.watchlistError), {
        appearance: 'error',
        autoDismiss: true,
      });
    } finally {
      setIsUpdating(false);
      setToggleWatchlist((prevState) => !prevState);
    }
  };

  return (
    <div className="media-page" style={{ height: 493 }}>
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
      <PageTitle title={data.title} />
      <IssueModal
        onCancel={() => setShowIssueModal(false)}
        show={showIssueModal}
        mediaType="movie"
        tmdbId={data.id}
      />
      <ManageSlideOver
        data={data}
        mediaType="movie"
        onClose={() => {
          setShowManager(false);
          router.push({ pathname: router.pathname, query: { sceneId: router.query.sceneId } });
        }}
        revalidate={() => revalidate()}
        show={showManager}
      />
      <div className="media-header">
        <div className="media-poster">
          <CachedImage
            type="tmdb"
            src={data.posterUrl || '/images/voyeurr_poster_not_found.png'}
            alt=""
            sizes="100vw"
            style={{ width: '100%', height: 'auto' }}
            width={600}
            height={900}
            priority
          />
        </div>
        <div className="media-title">
          <div className="media-status">
            <StatusBadge
              status={data.status}
              downloadItem={data.mediaInfo?.downloadStatus}
              title={data.title}
              inProgress={(data.mediaInfo?.downloadStatus ?? []).length > 0}
              tmdbId={data.id}
              mediaType="movie"
              plexUrl={plexUrl}
              serviceUrl={data.serviceUrl}
            />
          </div>
          <h1 data-testid="media-title">
            {data.title}
            {data.releaseYear && (
              <span className="media-year">({data.releaseYear})</span>
            )}
          </h1>
          <span className="media-attributes">
            {sceneAttributes.length > 0 &&
              sceneAttributes
                .map((t, k) => <span key={k}>{t}</span>)
                .reduce((prev, curr) => (
                  <Fragment key={`${prev?.key}-${curr?.key}`}>
                    {prev}
                    <span>|</span>
                    {curr}
                  </Fragment>
                ))}
          </span>
        </div>
        <div className="media-actions">
          {data.status !== SceneStatus.BLOCKLISTED && user?.userType !== UserType.PLEX && (
            <>
              {toggleWatchlist ? (
                <Tooltip content={intl.formatMessage(messages.addtowatchlist)}>
                  <Button buttonType="ghost" className="z-40 mr-2" buttonSize="md" onClick={onClickWatchlistBtn}>
                    {isUpdating ? <Spinner /> : <StarIcon className="text-amber-300" />}
                  </Button>
                </Tooltip>
              ) : (
                <Tooltip content={intl.formatMessage(messages.removefromwatchlist)}>
                  <Button className="z-40 mr-2" buttonSize="md" onClick={onClickDeleteWatchlistBtn}>
                    {isUpdating ? <Spinner /> : <MinusCircleIcon />}
                  </Button>
                </Tooltip>
              )}
            </>
          )}
          <RequestButton
            mediaType="movie"
            media={data.mediaInfo}
            tmdbId={data.id}
            onUpdate={() => revalidate()}
          />
          {hasPermission(Permission.MANAGE_REQUESTS) && data.mediaInfo && (
            <Tooltip content={intl.formatMessage(messages.managescene)}>
              <Button buttonType="ghost" onClick={() => setShowManager(true)} className="relative ml-2 first:ml-0">
                <CogIcon className="!mr-0" />
              </Button>
            </Tooltip>
          )}
        </div>
      </div>

      <div className="media-overview">
        <div className="media-overview-left">
          <h2>{intl.formatMessage(messages.overview)}</h2>
          <p>
            {data.description
              ? data.description
              : intl.formatMessage(messages.overviewunavailable)}
          </p>

          {data.categories && data.categories.length > 0 && (
            <div className="mt-6">
              <span className="filter-section-title">{intl.formatMessage(messages.categories)}</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {data.categories.map((cat) => (
                  <span key={cat} className="category-badge">{cat}</span>
                ))}
              </div>
            </div>
          )}

          {data.tags && data.tags.length > 0 && (
            <div className="mt-6">
              {data.tags.map((tag) => (
                <span key={tag} className="mb-2 mr-2 inline-flex last:mr-0">
                  <Tag>{tag}</Tag>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="media-overview-right">
          <div className="media-facts">
            {data.originalTitle && (
              <div className="media-fact">
                <span>{intl.formatMessage(messages.originaltitle)}</span>
                <span className="media-fact-value">{data.originalTitle}</span>
              </div>
            )}
            {data.releaseDate && (
              <div className="media-fact">
                <span>{intl.formatMessage(messages.releasedate)}</span>
                <span className="media-fact-value">
                  {intl.formatDate(data.releaseDate, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    timeZone: 'UTC',
                  })}
                </span>
              </div>
            )}
            {data.runtime && (
              <div className="media-fact">
                <span>{intl.formatMessage(messages.runtime, { minutes: data.runtime })}</span>
                <span className="media-fact-value">{data.runtime} min</span>
              </div>
            )}
            {data.studio && (
              <div className="media-fact">
                <span>{intl.formatMessage(messages.studio)}</span>
                <span className="media-fact-value">
                  <Link href={`/studio/${data.studio.id}`}>
                    {data.studio.name}
                  </Link>
                </span>
              </div>
            )}
            {data.categories && data.categories.length > 0 && (
              <div className="media-fact">
                <span>{intl.formatMessage(messages.categories)}</span>
                <span className="media-fact-value">
                  {data.categories.join(', ')}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {data.performers.length > 0 && (
        <>
          <div className="slider-header">
            <div className="slider-title">
              <span>{intl.formatMessage(messages.performers)}</span>
            </div>
          </div>
          <Slider
            sliderKey="performers"
            isLoading={false}
            isEmpty={false}
            items={data.performers.slice(0, 20).map((performer) => (
              <Link
                key={`performer-${performer.id}`}
                href={`/performer/${performer.id}`}
                className="performer-card flex w-36 flex-col items-center rounded-lg p-3 sm:w-40"
              >
                <div className="relative mb-2 h-24 w-24 overflow-hidden rounded-full ring-1 ring-gray-700 sm:h-28 sm:w-28">
                  <CachedImage
                    type="tmdb"
                    src={performer.imageUrl || '/images/voyeurr_poster_not_found.png'}
                    alt={performer.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    fill
                  />
                </div>
                <span className="text-center text-sm font-medium text-gray-300 truncate w-full">
                  {performer.name}
                </span>
                {performer.characterName && (
                  <span className="text-xs text-gray-500 truncate w-full text-center">
                    {performer.characterName}
                  </span>
                )}
              </Link>
            ))}
          />
        </>
      )}

      <MediaSlider
        sliderKey="recommendations"
        title={intl.formatMessage(messages.recommendations)}
        url={`/api/v1/scene/${router.query.sceneId}/recommendations`}
        hideWhenEmpty
      />
      <div className="extra-bottom-space relative" />
    </div>
  );
};

export default SceneDetails;
