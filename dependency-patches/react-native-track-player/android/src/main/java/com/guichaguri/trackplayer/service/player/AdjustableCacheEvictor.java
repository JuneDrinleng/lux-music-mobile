/* Lux Third-Party Patch Notice: repository-maintained patch file for a third-party dependency. Rights remain subject to the upstream dependency license. See LICENSE-NOTICE.md. */

package com.guichaguri.trackplayer.service.player;

import androidx.media3.common.C;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.datasource.cache.Cache;
import androidx.media3.datasource.cache.CacheEvictor;
import androidx.media3.datasource.cache.CacheSpan;

import java.util.TreeSet;

/**
 * Least-recently-used evictor whose byte cap can change after the player starts.
 * A cap of zero stops eviction here; callers also stop new cache writes.
 */
@UnstableApi
public class AdjustableCacheEvictor implements CacheEvictor {

    private final TreeSet<CacheSpan> leastRecentlyUsed;
    private long maxBytes;
    private long currentSize;
    private Cache cache;

    public AdjustableCacheEvictor(long maxBytes) {
        this.maxBytes = Math.max(0L, maxBytes);
        this.leastRecentlyUsed = new TreeSet<>(AdjustableCacheEvictor::compare);
    }

    public void setMaxBytes(long maxBytes) {
        Cache current;
        synchronized (this) {
            this.maxBytes = Math.max(0L, maxBytes);
            current = this.cache;
        }
        if (current != null && maxBytes > 0) evictCache(current, 0);
    }

    @Override
    public boolean requiresCacheSpanTouches() {
        return true;
    }

    @Override
    public void onCacheInitialized() {
    }

    @Override
    public void onStartFile(Cache cache, String key, long position, long length) {
        if (length != C.LENGTH_UNSET) evictCache(cache, length);
    }

    @Override
    public void onSpanAdded(Cache cache, CacheSpan span) {
        synchronized (this) {
            this.cache = cache;
            leastRecentlyUsed.add(span);
            currentSize += span.length;
        }
        evictCache(cache, 0);
    }

    @Override
    public void onSpanRemoved(Cache cache, CacheSpan span) {
        synchronized (this) {
            leastRecentlyUsed.remove(span);
            currentSize -= span.length;
        }
    }

    @Override
    public void onSpanTouched(Cache cache, CacheSpan oldSpan, CacheSpan newSpan) {
        onSpanRemoved(cache, oldSpan);
        onSpanAdded(cache, newSpan);
    }

    private void evictCache(Cache cache, long requiredSpace) {
        while (true) {
            CacheSpan span;
            long sizeBefore;
            synchronized (this) {
                if (maxBytes <= 0) return;
                if (currentSize + requiredSpace <= maxBytes || leastRecentlyUsed.isEmpty()) return;
                span = leastRecentlyUsed.first();
                sizeBefore = currentSize;
            }
            cache.removeSpan(span);
            synchronized (this) {
                if (currentSize >= sizeBefore) return;
            }
        }
    }

    private static int compare(CacheSpan lhs, CacheSpan rhs) {
        long delta = lhs.lastTouchTimestamp - rhs.lastTouchTimestamp;
        if (delta == 0) return lhs.compareTo(rhs);
        return lhs.lastTouchTimestamp < rhs.lastTouchTimestamp ? -1 : 1;
    }
}
