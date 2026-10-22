/* Lux Third-Party Patch Notice: repository-maintained patch file for a third-party dependency. Rights remain subject to the upstream dependency license. See LICENSE-NOTICE.md. */

package com.guichaguri.trackplayer.service;

import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.SystemClock;

import com.guichaguri.trackplayer.service.player.ExoPlayback;

import androidx.core.app.NotificationCompat;
import androidx.localbroadcastmanager.content.LocalBroadcastManager;
import androidx.media.session.MediaButtonReceiver;
import androidx.media3.common.util.UnstableApi;

import com.facebook.react.ReactInstanceManager;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.jstasks.HeadlessJsTaskConfig;

import javax.annotation.Nullable;

/**
 * @author Guichaguri
 */
@UnstableApi
public class MusicService extends HeadlessJsTaskService {

    public final com.guichaguri.trackplayer.service.player.NoiseMixer noiseMixer = new com.guichaguri.trackplayer.service.player.NoiseMixer();
    public final com.guichaguri.trackplayer.service.player.GainCoordinator gains = new com.guichaguri.trackplayer.service.player.GainCoordinator();
    public final com.guichaguri.trackplayer.service.player.SessionEqualizer equalizer = new com.guichaguri.trackplayer.service.player.SessionEqualizer(gains);
    public final com.guichaguri.trackplayer.service.player.SessionLoudness loudness = new com.guichaguri.trackplayer.service.player.SessionLoudness(gains);
    public boolean stopNoiseWithTimer = true;
    MusicManager manager;
    Handler handler;

    // All envelope state and player calls belong to the player's application looper.
    private Handler fadeHandler;
    private ExoPlayback fadePlayback;
    private long fadeDeadline;
    private long fadeDuration;
    private boolean fadeFinishSong;
    private boolean fadeWaitingForSong;
    private String fadeRequestId;
    private boolean fadeScheduled;
    private boolean fadeApplied;

    private final Runnable fadeTick = new Runnable() {
        @Override
        public void run() {
            if (!fadeScheduled || fadePlayback == null) return;
            double remaining = fadeDeadline - SystemClock.elapsedRealtime();
            if (fadeFinishSong && remaining <= 0 && !fadeWaitingForSong) {
                fadeWaitingForSong = fadePlayback.isPlayRequested();
            }
            if (fadeWaitingForSong) {
                long duration = fadePlayback.getDuration();
                remaining = duration > 0 && fadePlayback.isPlayRequested()
                        ? Math.max(0, duration - fadePlayback.getPosition()) / fadePlayback.getRate()
                        : Double.POSITIVE_INFINITY;
            }
            if (remaining <= 0) {
                finishFadeOut();
                return;
            }
            if ((!fadeFinishSong || fadeWaitingForSong) && remaining < fadeDuration) {
                if (!fadeApplied) {
                    fadeApplied = true;
                }
                fadePlayback.setSleepTimerGain((float) (remaining / fadeDuration));
                if (stopNoiseWithTimer) noiseMixer.setTimerGain((float) (remaining / fadeDuration));
            } else {
                restoreFadeVolume();
            }
            fadeHandler.postDelayed(this, (long) Math.min(100, Math.max(1, remaining)));
        }
    };

    public void startFadeOut(ExoPlayback playback, long durationMs, long endAtMs, boolean finishSong, String requestId) {
        cancelFadeOut();
        fadePlayback = playback;
        fadeHandler = new Handler(playback.getApplicationLooper());
        fadeDuration = Math.max(1, durationMs);
        fadeDeadline = SystemClock.elapsedRealtime() + Math.max(0, endAtMs - System.currentTimeMillis());
        fadeFinishSong = finishSong;
        fadeWaitingForSong = false;
        fadeRequestId = requestId;
        fadeScheduled = true;
        fadeTick.run();
    }

    private void finishFadeOut() {
        // Pause first: restoration must never produce a full-volume burst.
        if (stopNoiseWithTimer) noiseMixer.stopAll();
        fadePlayback.pause();
        cancelFadeOut();
        Bundle data = new Bundle();
        data.putString("requestId", fadeRequestId);
        emit("sleep-timer-ended", data);
    }

    public void onFadeTrackChanged() {
        if (fadeScheduled && fadeFinishSong && SystemClock.elapsedRealtime() >= fadeDeadline) {
            finishFadeOut();
        } else {
            restoreFadeVolume();
        }
    }

    // Track changes, seeks and user volume changes restore the envelope before restarting it.
    public void restoreFadeVolume() {
        noiseMixer.setTimerGain(1);
        if (fadeApplied && fadePlayback != null) {
            fadeApplied = false;
            fadePlayback.setSleepTimerGain(1);
        }
    }

    public void cancelFadeOut() {
        fadeScheduled = false;
        if (fadeHandler != null) fadeHandler.removeCallbacks(fadeTick);
        restoreFadeVolume();
    }

    @Nullable
    @Override
    protected HeadlessJsTaskConfig getTaskConfig(Intent intent) {
        return new HeadlessJsTaskConfig("TrackPlayer", Arguments.createMap(), 0, true);
    }

    @Override
    public void onHeadlessJsTaskFinish(int taskId) {
        // Overridden to prevent the service from being terminated
    }

    public void emit(String event, Bundle data) {
        Intent intent = new Intent(Utils.EVENT_INTENT);

        intent.putExtra("event", event);
        if(data != null) intent.putExtra("data", data);

        LocalBroadcastManager.getInstance(this).sendBroadcast(intent);
    }

    public void destroy() {
        if (fadeHandler != null && Looper.myLooper() != fadeHandler.getLooper()) {
            fadeHandler.post(this::destroy);
            return;
        }
        if (fadeApplied && fadePlayback != null) fadePlayback.pause();
        cancelFadeOut();
        fadePlayback = null;
        noiseMixer.release();
        equalizer.detach();
        loudness.detach();
        if(handler != null) {
            handler.removeMessages(0);
            handler = null;
        }

        if(manager != null) {
            manager.destroy();
            manager = null;
        }
    }

    private void onStartForeground() {
        boolean serviceForeground = false;

        if(manager != null) {
            // The session is only active when the service is on foreground
            serviceForeground = manager.getMetadata().getSession().isActive();
        }

        if(!serviceForeground) {
            ReactInstanceManager reactInstanceManager = getReactNativeHost().getReactInstanceManager();
            ReactContext reactContext = reactInstanceManager.getCurrentReactContext();

            // Checks whether there is a React activity
            if(reactContext == null || !reactContext.hasCurrentActivity()) {
                String channel = Utils.getNotificationChannel(this);

                // Sets the service to foreground with an empty notification
                startForeground(1, new NotificationCompat.Builder(this, channel).build());
                // Stops the service right after
                stopSelf();
            }
        }
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        if(Utils.CONNECT_INTENT.equals(intent.getAction())) {
            return new MusicBinder(this, manager);
        }

        return super.onBind(intent);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if(intent != null && (Utils.ACTION_LIKE.equals(intent.getAction())
                || Utils.ACTION_SLEEP_TIMER.equals(intent.getAction()))) {
            onStartForeground();

            if(manager != null) {
                emit(Utils.ACTION_LIKE.equals(intent.getAction()) ? "remote-like" : "remote-sleep-timer", null);
            }

            return START_NOT_STICKY;
        }

        if(intent != null && Intent.ACTION_MEDIA_BUTTON.equals(intent.getAction())) {
            // Check if the app is on background, then starts a foreground service and then ends it right after
            onStartForeground();

            if(manager != null) {
                MediaButtonReceiver.handleIntent(manager.getMetadata().getSession(), intent);
            }

            return START_NOT_STICKY;
        }

        if (manager == null) {
            manager = new MusicManager(this);
        }
        if (handler == null) handler = new Handler(Looper.getMainLooper());

        super.onStartCommand(intent, flags, startId);
        return START_NOT_STICKY;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        String channel = Utils.getNotificationChannel(this);
        startForeground(1, new NotificationCompat.Builder(this, channel).build());
    }

    @Override
    public void onDestroy() {
        super.onDestroy();

        destroy();
        stopForeground(true);
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        super.onTaskRemoved(rootIntent);

        if (manager == null || manager.shouldStopWithApp()) {
            if (manager != null && manager.getPlayback() != null) {
                manager.getPlayback().stop();
            }
            destroy();
            stopSelf();
        }
    }
}
