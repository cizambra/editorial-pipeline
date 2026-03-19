import { ReactNode, useEffect, useRef, useState } from 'react';
import { MobileSpinner } from '../feedback/MobileSpinner';

interface MobileListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  keyExtractor?: (item: T, index: number) => string;
  onRefresh?: () => Promise<void>;
  onLoadMore?: () => Promise<void>;
  loading?: boolean;
  refreshing?: boolean;
  hasMore?: boolean;
  emptyState?: ReactNode;
  skeleton?: ReactNode;
  className?: string;
}

/**
 * Optimized list with refresh/infinite scroll
 * 
 * @example
 * <MobileList
 *   items={campaigns}
 *   renderItem={(campaign) => (
 *     <CampaignCard campaign={campaign} onClick={() => handleSelect(campaign.id)} />
 *   )}
 *   onRefresh={handleRefresh}
 *   onLoadMore={handleLoadMore}
 *   hasMore={hasMore}
 *   emptyState={<MobileEmptyState icon={Inbox} title="No campaigns" />}
 * />
 */
export function MobileList<T>({
  items,
  renderItem,
  keyExtractor = (_, index) => index.toString(),
  onRefresh,
  onLoadMore,
  loading = false,
  refreshing = false,
  hasMore = false,
  emptyState,
  skeleton,
  className = '',
}: MobileListProps<T>) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Pull to refresh
  const handleRefresh = async () => {
    if (!onRefresh || isRefreshing) return;
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  // Infinite scroll
  useEffect(() => {
    if (!onLoadMore || !hasMore || isLoadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setIsLoadingMore(true);
          onLoadMore().finally(() => setIsLoadingMore(false));
        }
      },
      { threshold: 0.1 }
    );

    const currentRef = loadMoreRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [onLoadMore, hasMore, isLoadingMore]);

  // Show skeleton on initial load
  if (loading && items.length === 0) {
    if (skeleton) {
      return <div className={`lg:hidden ${className}`}>{skeleton}</div>;
    }
    return (
      <div className={`lg:hidden flex justify-center py-12 ${className}`}>
        <MobileSpinner size="large" />
      </div>
    );
  }

  // Show empty state
  if (!loading && items.length === 0 && emptyState) {
    return <div className={`lg:hidden ${className}`}>{emptyState}</div>;
  }

  return (
    <div className={`lg:hidden ${className}`}>
      {/* Pull to refresh indicator */}
      {(isRefreshing || refreshing) && (
        <div className="flex justify-center py-3">
          <MobileSpinner size="medium" />
        </div>
      )}

      {/* List items */}
      {items.map((item, index) => (
        <div key={keyExtractor(item, index)}>
          {renderItem(item, index)}
        </div>
      ))}

      {/* Load more trigger */}
      {hasMore && (
        <div ref={loadMoreRef} className="flex justify-center py-4">
          {isLoadingMore && <MobileSpinner size="medium" />}
        </div>
      )}
    </div>
  );
}
