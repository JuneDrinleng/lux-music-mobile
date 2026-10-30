/* Lux Third-Party Patch Notice: repository-maintained patch file for a third-party dependency. Rights remain subject to the upstream dependency license. See LICENSE-NOTICE.md. */

package com.guichaguri.trackplayer.service.player;

import android.content.Context;
import android.media.AudioManager;
import android.media.audiofx.AudioEffect;
import android.media.audiofx.LoudnessEnhancer;
import android.util.Log;

import androidx.media3.common.util.UnstableApi;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.analytics.AnalyticsListener;

import com.guichaguri.trackplayer.service.Utils;

/** Service-owned configuration; all methods and analytics callbacks run on the player looper. */
@UnstableApi
public final class SessionLoudness implements AnalyticsListener {
    private ExoPlayer player;
    private LoudnessEnhancer effect;
    private int sessionId;
    private boolean enabled;
    private int target = -14;
    private boolean preventClipping = true;
    private final GainCoordinator coordinator;

    public SessionLoudness(GainCoordinator coordinator) {
        this.coordinator = coordinator;
        coordinator.connect(this);
    }

    public void refreshGain() {
        if (enabled && effect != null) {
            effect.setTargetGain(coordinator.loudnessGain(target, preventClipping));
        }
    }

    public void attach(ExoPlayer next) {
        detach();
        player = next;
        player.addAnalyticsListener(this);
        reapply();
    }

    public void detach() {
        if (player != null) player.removeAnalyticsListener(this);
        player = null;
        releaseEffect();
    }

    private void releaseEffect() {
        if (effect != null) {
            try {
                effect.release();
            } catch (RuntimeException error) {
                Log.w(Utils.LOG, "LoudnessEnhancer release failed", error);
            }
            effect = null;
        }
        sessionId = 0;
    }

    private void ensureBound(Context context) {
        if (player == null) throw new IllegalStateException("Player is not initialized");
        int id = player.getAudioSessionId();
        // Before the first track, reserve a real session so creation failures reject the UI call
        // now, rather than accepting/persisting a config that cannot be applied later.
        if (id <= 0) {
            AudioManager audio = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
            id = audio == null ? 0 : audio.generateAudioSessionId();
            if (id <= 0) throw new IllegalStateException("No audio session available");
            player.setAudioSessionId(id);
        }
        bind(id);
    }

    private void bind(int id) {
        if (effect != null && sessionId == id) return;
        releaseEffect();
        if (id <= 0) throw new IllegalStateException("No audio session available");
        effect = new LoudnessEnhancer(id);
        sessionId = id;
    }

    public void set(Context context, boolean nextEnabled, int nextTarget, boolean nextPreventClipping) {
        try {
            ensureBound(context);
            apply(nextEnabled, nextTarget, nextPreventClipping);
            enabled = nextEnabled;
            target = nextTarget;
            preventClipping = nextPreventClipping;
        } catch (RuntimeException error) {
            // Do not retain failed changes. Restore the last accepted config where possible.
            releaseEffect();
            reapply();
            throw error;
        }
    }

    private void apply(boolean active, int value, boolean protect) {
        // setTargetGain returns void; only AudioEffect.setEnabled returns a status.
        effect.setTargetGain(coordinator.loudnessGain(value, protect));
        check(effect.setEnabled(active));
    }

    private static void check(int status) {
        if (status != AudioEffect.SUCCESS) throw new IllegalStateException("LoudnessEnhancer operation failed: " + status);
    }

    private void reapply() {
        if (!enabled || player == null || player.getAudioSessionId() <= 0) return;
        try {
            bind(player.getAudioSessionId());
            apply(enabled, target, preventClipping);
        } catch (RuntimeException error) {
            releaseEffect();
            Log.w(Utils.LOG, "LoudnessEnhancer session rebind failed", error);
        }
    }

    @Override
    public void onAudioSessionIdChanged(AnalyticsListener.EventTime eventTime, int audioSessionId) {
        // Ignore queued events for an older session; use the current player session.
        if (player == null) return;
        if (sessionId != player.getAudioSessionId()) releaseEffect();
        reapply();
    }
}
