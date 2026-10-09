/* Lux Third-Party Patch Notice: repository-maintained patch file for a third-party dependency. Rights remain subject to the upstream dependency license. See LICENSE-NOTICE.md. */

package com.guichaguri.trackplayer.service.player;

import android.content.Context;
import android.util.Log;

import androidx.annotation.Nullable;

import com.facebook.react.bridge.Promise;
import androidx.media3.common.C;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.database.DatabaseProvider;
import androidx.media3.database.StandaloneDatabaseProvider;
import androidx.media3.datasource.DataSource;
import androidx.media3.datasource.cache.CacheDataSource;
import androidx.media3.datasource.cache.CacheSpan;
import androidx.media3.datasource.cache.ContentMetadata;
import androidx.media3.datasource.cache.SimpleCache;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.source.MediaSource;

import com.guichaguri.trackplayer.service.MusicManager;
import com.guichaguri.trackplayer.service.Utils;
import com.guichaguri.trackplayer.service.models.Track;

import java.io.File;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.List;
import java.util.NavigableSet;

/**
 * @author Guichaguri
 */
@UnstableApi
public class LocalPlayback extends ExoPlayback<ExoPlayer> {

    private long cacheMaxSize;

    private SimpleCache cache;
    private AdjustableCacheEvictor cacheEvictor;
    private DatabaseProvider databaseProvider;
    private boolean prepared = false;
    public LocalPlayback(Context context, MusicManager manager, ExoPlayer player, long maxCacheSize,
                         boolean autoUpdateMetadata) {
        super(context, manager, player, autoUpdateMetadata);
        this.cacheMaxSize = maxCacheSize;
    }

    @Override
    public void initialize() {
        if(cacheMaxSize > 0) {
            openCache(cacheMaxSize);
        } else {
            cache = null;
        }

        super.initialize();

        resetQueue();
    }

    /**
     * {@code bytes} is the SimpleCache ceiling. Zero stops new writes and does not delete spans.
     */
    public void setCacheMaxSize(long bytes) {
        cacheMaxSize = bytes;
        if (bytes <= 0) {
            if (cacheEvictor != null) cacheEvictor.setMaxBytes(0);
            return;
        }
        if (cache == null) {
            openCache(bytes);
            return;
        }
        if (cacheEvictor != null) cacheEvictor.setMaxBytes(bytes);
    }

    private void openCache(long bytes) {
        File cacheDir = new File(context.getFilesDir(), "TrackPlayer");
        if (databaseProvider == null) databaseProvider = new StandaloneDatabaseProvider(context);
        if (cacheEvictor == null) cacheEvictor = new AdjustableCacheEvictor(bytes);
        else cacheEvictor.setMaxBytes(bytes);
        cache = new SimpleCache(cacheDir, cacheEvictor, databaseProvider);
    }

    public DataSource.Factory enableCaching(DataSource.Factory ds) {
        if(cache == null || cacheMaxSize <= 0) return ds;

        return new CacheDataSource.Factory()
                                .setCache(cache)
                                .setUpstreamDataSourceFactory(ds)
                                .setFlags(CacheDataSource.FLAG_IGNORE_CACHE_ON_ERROR);
    }

    public void isCached(String url, @Nullable String cacheKey, Promise promise) {
        if (cache == null) {
          promise.resolve(false);
          return;
        }
        String cacheLookupKey = cacheKey != null && !cacheKey.isEmpty() ? cacheKey : url;
        NavigableSet<CacheSpan> cachedSpans = cache.getCachedSpans(cacheLookupKey);
        promise.resolve(!cachedSpans.isEmpty());
    }

    public void getCacheSize(Promise promise) {
        if (cache != null) {
            promise.resolve((double) cache.getCacheSpace());
        } else {
          promise.resolve(0);
        }
    }

    public void clearCache(Promise promise) {
        if (cache != null) {
            for (String key: cache.getKeys()) {
                try {
                    cache.removeResource(key);
                } catch (Exception e) {
                    Log.e(Utils.LOG, e.getMessage());
                }
            }
        } else {
            Log.d(Utils.LOG, "Cache is not initialized.");
        }
        promise.resolve(null);
    }

    /**
     * Trailing unread bytes (ID3 / padding) often remain after a full listen.
     * Treat nearly-complete contiguous ranges as fully cached for the local page.
     */
    private static final long FULL_CACHE_TAIL_TOLERANCE_BYTES = 128L * 1024L;

    /**
     * Open SimpleCache for listing even when write ceiling is 0 or the player
     * has not enabled caching yet, so complete files already on disk are visible.
     */
    private void ensureCacheReadable() {
        if (cache != null) return;
        long openBytes = cacheMaxSize > 0 ? cacheMaxSize : Long.MAX_VALUE;
        openCache(openBytes);
        if (cacheMaxSize <= 0 && cacheEvictor != null) {
            cacheEvictor.setMaxBytes(0);
        }
    }

    private boolean isFullyCachedKey(String key, long cachedBytes, long contentLength) {
        if (contentLength == C.LENGTH_UNSET || contentLength <= 0) return false;
        if (cache.isCached(key, 0, contentLength)) return true;
        long covered = Math.max(0L, contentLength - FULL_CACHE_TAIL_TOLERANCE_BYTES);
        if (covered <= 0) return cachedBytes > 0;
        return cachedBytes + FULL_CACHE_TAIL_TOLERANCE_BYTES >= contentLength
            && cache.isCached(key, 0, covered);
    }

    public void listCachedEntries(Promise promise) {
        WritableArray result = Arguments.createArray();
        try {
            ensureCacheReadable();
        } catch (Exception e) {
            Log.e(Utils.LOG, "listCachedEntries openCache: " + e.getMessage());
            promise.resolve(result);
            return;
        }
        if (cache == null) {
            promise.resolve(result);
            return;
        }
        for (String key : cache.getKeys()) {
            long contentLength = ContentMetadata.getContentLength(cache.getContentMetadata(key));
            long cachedBytes = contentLength != C.LENGTH_UNSET && contentLength > 0
                ? cache.getCachedBytes(key, 0, contentLength)
                : cache.getCachedBytes(key, 0, C.LENGTH_UNSET);
            boolean fullyCached = isFullyCachedKey(key, cachedBytes, contentLength);
            WritableMap item = Arguments.createMap();
            item.putString("key", key);
            item.putDouble("cachedBytes", cachedBytes);
            item.putBoolean("fullyCached", fullyCached);
            result.pushMap(item);
        }
        promise.resolve(result);
    }

    public void removeCachedResource(String key, Promise promise) {
        if (cache != null && key != null && !key.isEmpty()) {
            try {
                cache.removeResource(key);
            } catch (Exception e) {
                Log.e(Utils.LOG, e.getMessage());
            }
        }
        promise.resolve(null);
    }

    private void prepare() {
        if(!prepared) {
            Log.d(Utils.LOG, "Preparing the media source...");
            player.prepare();
            prepared = true;
        }
    }

    @Override
    public void add(Track track, int index, Promise promise) {
        queue.add(index, track);
        MediaSource trackSource = track.toMediaSource(context, this);
        player.addMediaSource(index, trackSource);
        promise.resolve(index);
        prepare();
    }

    @Override
    public void add(Collection<Track> tracks, int index, Promise promise) {
        List<MediaSource> trackList = new ArrayList<>();

        for(Track track : tracks) {
            trackList.add(track.toMediaSource(context, this));
        }

        queue.addAll(index, tracks);
        player.addMediaSources(index, trackList);
        promise.resolve(index);

        prepare();
    }

    @Override
    public void remove(List<Integer> indexes, Promise promise) {
        int currentIndex = player.getCurrentMediaItemIndex();

        // Sort the list so we can loop through sequentially
        Collections.sort(indexes);

        for(int i = indexes.size() - 1; i >= 0; i--) {
            int index = indexes.get(i);

            // Skip indexes that are the current track or are out of bounds
            if(index == currentIndex || index < 0 || index >= queue.size()) {
                // Resolve the promise when the last index is invalid
                if(i == 0) promise.resolve(null);
                continue;
            }

            queue.remove(index);

            player.removeMediaItem(index);
            if(i == 0) {
              promise.resolve(index);
            }

            // Fix the window index
            if (index < lastKnownWindow) {
                lastKnownWindow--;
            }
        }
    }

    @Override
    public void removeUpcomingTracks() {
        int currentIndex = player.getCurrentMediaItemIndex();
        if (currentIndex == C.INDEX_UNSET) return;

        for (int i = queue.size() - 1; i > currentIndex; i--) {
            queue.remove(i);
            player.removeMediaItem(i);
        }
    }

    @Override
    public void setRepeatMode(int repeatMode) {
        player.setRepeatMode(repeatMode);
    }

    public int getRepeatMode() {
        return player.getRepeatMode();
    }

    private void resetQueue() {
        queue.clear();


        player.clearMediaItems();
        player.prepare();
        prepared = false; // We set it to false as the queue is now empty

        lastKnownWindow = C.INDEX_UNSET;
        lastKnownPosition = C.INDEX_UNSET;

        manager.onReset();
    }

    @Override
    public void play() {
        prepare();
        super.play();
    }

    @Override
    public void stop() {
        super.stop();
        prepared = false;
    }

    @Override
    public void seekTo(long time) {
        prepare();
        super.seekTo(time);
    }

    @Override
    public void reset() {
        Integer track = getCurrentTrackIndex();
        long position = player.getCurrentPosition();

        super.reset();
        resetQueue();

        manager.onTrackUpdate(track, position, null, null);
    }

    @Override
    public float getPlayerVolume() {
        return player.getVolume();
    }

    @Override
    public void setPlayerVolume(float volume) {
        player.setVolume(volume);
    }

    @Override
    public void onPlaybackStateChanged(int playbackState) {
        if(playbackState == Player.STATE_ENDED) {
            prepared = false;
        }

        super.onPlaybackStateChanged(playbackState);
    }

    @Override
    public void onPlayerError(PlaybackException error) {
        prepared = false;
        super.onPlayerError(error);
    }

    @Override
    public void destroy() {
        super.destroy();

        if(cache != null) {
            try {
                cache.release();
                cache = null;
            } catch(Exception ex) {
                Log.w(Utils.LOG, "Couldn't release the cache properly", ex);
            }
        }
    }
}
