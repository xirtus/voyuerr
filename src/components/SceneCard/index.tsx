import Spinner from '@app/assets/spinner.svg';
import Button from '@app/components/Common/Button';
import CachedImage from '@app/components/Common/CachedImage';
import StatusBadgeMini from '@app/components/Common/StatusBadgeMini';
import { useIsTouch } from '@app/hooks/useIsTouch';
import useToasts from '@app/hooks/useToasts';
import { Permission, UserType, useUser } from '@app/hooks/useUser';
import defineMessages from '@app/utils/defineMessages';
import { Transition } from '@headlessui/react';
import {
  ArrowDownTrayIcon,
  MinusCircleIcon,
  StarIcon,
} from '@heroicons/react/24/outline';
import { ContentCategory, ContentType, SceneStatus } from '@server/constants/content';
import axios from 'axios';
import Link from 'next/link';
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { useIntl } from 'react-intl';
import { mutate } from 'swr';

interface SceneCardProps {
  id: number;
  image?: string;
  summary?: string;
  year?: string;
  title: string;
  contentType?: ContentType;
  categories?: ContentCategory[];
  status?: SceneStatus;
  inProgress?: boolean;
  isAddedToWatchlist?: number | boolean;
  mutateParent?: () => void;
  nsfwBlur?: boolean;
}

const messages = defineMessages('components.SceneCard', {
  watchlistSuccess: '<strong>{title}</strong> added to watchlist successfully!',
  watchlistDeleted: '<strong>{title}</strong> Removed from watchlist successfully!',
  watchlistError: 'Something went wrong. Please try again.',
  requestScene: 'Request Scene',
});

const contentTypeLabels: Record<ContentType, string> = {
  [ContentType.SCENE]: 'Scene',
  [ContentType.MOVIE]: 'Movie',
  [ContentType.COMPILATION]: 'Compilation',
  [ContentType.CHANNEL_RELEASE]: 'Release',
  [ContentType.COLLECTION]: 'Collection',
};

const SceneCard = ({
  id,
  image,
  summary,
  year,
  title,
  contentType = ContentType.SCENE,
  categories = [],
  status,
  inProgress = false,
  isAddedToWatchlist = false,
  mutateParent,
  nsfwBlur = false,
}: SceneCardProps) => {
  const isTouch = useIsTouch();
  const intl = useIntl();
  const { user, hasPermission } = useUser();
  const [isUpdating, setIsUpdating] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(status);
  const [showDetail, setShowDetail] = useState(false);
  const { addToast } = useToasts();
  const [toggleWatchlist, setToggleWatchlist] = useState<boolean>(!isAddedToWatchlist);
  const cardRef = useRef<HTMLDivElement>(null);

  if (year) {
    year = year.slice(0, 4);
  }

  useEffect(() => {
    setCurrentStatus(status);
  }, [status]);

  const onClickWatchlistBtn = async (): Promise<void> => {
    setIsUpdating(true);
    try {
      const response = await axios.post('/api/v1/watchlist', {
        tmdbId: id,
        mediaType: 'movie',
        title,
      });
      mutate('/api/v1/discover/watchlist');
      if (response.data) {
        addToast(
          <span>
            {intl.formatMessage(messages.watchlistSuccess, {
              title,
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
    } finally {
      setIsUpdating(false);
      setToggleWatchlist((prevState) => !prevState);
    }
  };

  const onClickDeleteWatchlistBtn = async (): Promise<void> => {
    setIsUpdating(true);
    try {
      await axios.delete(`/api/v1/watchlist/${id}?mediaType=movie`);
      addToast(
        <span>
          {intl.formatMessage(messages.watchlistDeleted, {
            title,
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
      mutate('/api/v1/discover/watchlist');
      if (mutateParent) {
        mutateParent();
      }
      setToggleWatchlist((prevState) => !prevState);
    }
  };

  const showRequestButton = hasPermission(
    [Permission.REQUEST, Permission.REQUEST_MOVIE],
    { type: 'or' }
  );

  return (
    <div
      className="w-36 sm:w-36 md:w-44"
      data-testid="scene-card"
      ref={cardRef}
    >
      <div
        className={`group relative transform-gpu cursor-pointer overflow-hidden rounded-xl outline-none ring-1 transition duration-300 ${
          showDetail ? 'scale-105 shadow-lg' : 'scale-100 shadow'
        }`}
        style={{
          paddingBottom: '150%',
          backgroundColor: '#1e1228',
          borderColor: showDetail ? '#ff3366' : '#3a2048',
        }}
        onMouseEnter={() => {
          if (!isTouch) setShowDetail(true);
        }}
        onMouseLeave={() => setShowDetail(false)}
        onClick={() => setShowDetail(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') setShowDetail(true);
        }}
        role="link"
        tabIndex={0}
      >
        <div className={`absolute inset-0 h-full w-full overflow-hidden ${nsfwBlur ? 'nsfw-blur' : ''}`}>
          <CachedImage
            type="tmdb"
            className="absolute inset-0 h-full w-full nsfw-image"
            alt=""
            src={
              image
                ? image.startsWith('http')
                  ? image
                  : `https://image.tmdb.org/t/p/w300_and_h450_face${image}`
                : '/images/voyeurr_poster_not_found_logo_top.png'
            }
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            fill
          />
          <div className="absolute left-0 right-0 flex items-center justify-between p-2">
            <div className="pointer-events-none z-40 self-start rounded-full border shadow-md bg-[#ff3366]/80 border-[#ff3366]">
              <div className="flex h-4 items-center px-2 py-2 text-center text-xs font-medium uppercase tracking-wider text-white sm:h-5">
                {contentTypeLabels[contentType] || contentType}
              </div>
            </div>
            {showDetail && currentStatus !== SceneStatus.BLOCKLISTED && (
              <div className="flex flex-col gap-1">
                {user?.userType !== UserType.PLEX && (
                  toggleWatchlist ? (
                    <Button buttonType="ghost" className="z-40" buttonSize="sm" onClick={onClickWatchlistBtn}>
                      <StarIcon className="h-3 text-amber-300" />
                    </Button>
                  ) : (
                    <Button className="z-40" buttonSize="sm" onClick={onClickDeleteWatchlistBtn}>
                      <MinusCircleIcon className="h-3" />
                    </Button>
                  )
                )}
              </div>
            )}
            {currentStatus && currentStatus !== SceneStatus.UNKNOWN && (
              <div className="flex flex-col items-center gap-1">
                <div className="pointer-events-none z-40 flex">
                  <StatusBadgeMini status={currentStatus} inProgress={inProgress} shrink />
                </div>
              </div>
            )}
          </div>
          <Transition
            as={Fragment}
            show={isUpdating}
            enter="transition-opacity ease-in-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="transition-opacity ease-in-out duration-300"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="absolute inset-0 z-40 flex items-center justify-center rounded-xl bg-[#1e1228]/75 text-white">
              <Spinner className="h-10 w-10" />
            </div>
          </Transition>
          <Transition
            as={Fragment}
            show={!image || showDetail}
            enter="transition-opacity"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="transition-opacity"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="absolute inset-0 overflow-hidden rounded-xl">
              <Link
                href={`/scene/${id}`}
                className="absolute inset-0 h-full w-full cursor-pointer overflow-hidden text-left"
                style={{
                  background:
                    'linear-gradient(180deg, rgba(26, 10, 30, 0.35) 0%, rgba(26, 10, 30, 0.9) 100%)',
                }}
              >
                <div className="flex h-full w-full items-end">
                  <div
                    className={`px-2 text-white ${
                      !showRequestButton ||
                      (currentStatus &&
                        currentStatus !== SceneStatus.UNKNOWN &&
                        currentStatus !== SceneStatus.DELETED)
                        ? 'pb-2' : 'pb-11'
                    }`}
                  >
                    {categories.length > 0 && (
                      <div className="mb-1 flex flex-wrap gap-1">
                        {categories.slice(0, 2).map((cat) => (
                          <span key={cat} className="rounded-full bg-[#ff3366]/20 px-1.5 py-0.5 text-[10px] font-medium text-[#ff6690]">
                            {cat}
                          </span>
                        ))}
                      </div>
                    )}
                    {year && <div className="text-sm font-medium">{year}</div>}
                    <h1
                      className="whitespace-normal text-xl font-bold leading-tight"
                      style={{
                        WebkitLineClamp: 3,
                        display: '-webkit-box',
                        overflow: 'hidden',
                        WebkitBoxOrient: 'vertical',
                        wordBreak: 'break-word',
                      }}
                      data-testid="scene-card-title"
                    >
                      {title}
                    </h1>
                    <div
                      className="whitespace-normal text-xs"
                      style={{
                        WebkitLineClamp: !showRequestButton ||
                          (currentStatus && currentStatus !== SceneStatus.UNKNOWN && currentStatus !== SceneStatus.DELETED) ? 5 : 3,
                        display: '-webkit-box',
                        overflow: 'hidden',
                        WebkitBoxOrient: 'vertical',
                        wordBreak: 'break-word',
                      }}
                    >
                      {summary}
                    </div>
                  </div>
                </div>
              </Link>
              <div className="absolute bottom-0 left-0 right-0 flex justify-between px-2 py-2">
                {showRequestButton &&
                  (!currentStatus ||
                    currentStatus === SceneStatus.UNKNOWN ||
                    currentStatus === SceneStatus.DELETED) && (
                    <Button buttonType="primary" buttonSize="sm" className="h-7 w-full">
                      <ArrowDownTrayIcon />
                      <span>{intl.formatMessage(messages.requestScene)}</span>
                    </Button>
                  )}
              </div>
            </div>
          </Transition>
        </div>
      </div>
    </div>
  );
};

export default SceneCard;
