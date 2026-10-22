/* Lux Third-Party Patch Notice: repository-maintained patch file for a third-party dependency. Rights remain subject to the upstream dependency license. See LICENSE-NOTICE.md. */

package com.guichaguri.trackplayer.service.player;

import android.content.Context;
import android.media.AudioManager;
import android.media.audiofx.AudioEffect;
import android.media.audiofx.Equalizer;
import android.util.Log;

import androidx.media3.common.util.UnstableApi;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.analytics.AnalyticsListener;

import com.guichaguri.trackplayer.service.Utils;

/** Service-owned configuration; all methods and analytics callbacks run on the player looper. */
@UnstableApi
public final class SessionEqualizer implements AnalyticsListener {
    private static final double[] FREQUENCIES = {31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000};
    private ExoPlayer player;
    private Equalizer effect;
    private int sessionId;
    private boolean enabled;
    private double[] gains = new double[10];

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
                Log.w(Utils.LOG, "Equalizer release failed", error);
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
        effect = new Equalizer(0, id);
        sessionId = id;
        if (effect.getNumberOfBands() <= 0) throw new IllegalStateException("No equalizer bands available");
    }

    public void set(Context context, boolean nextEnabled, double[] nextGains) {
        try {
            ensureBound(context);
            apply(nextEnabled, nextGains);
            enabled = nextEnabled;
            gains = nextGains.clone();
        } catch (RuntimeException error) {
            // Do not retain failed changes. Restore the last accepted config where possible.
            releaseEffect();
            reapply();
            throw error;
        }
    }

    private void apply(boolean active, double[] values) {
        int count = effect.getNumberOfBands();
        double[] centers = new double[count];
        for (short band = 0; band < count; band++) {
            centers[band] = effect.getCenterFreq(band) / 1000.0;
            if (centers[band] <= 0) throw new IllegalStateException("Invalid equalizer frequency");
        }
        short[] range = effect.getBandLevelRange();
        if (range.length < 2 || range[0] > range[1]) throw new IllegalStateException("Invalid equalizer level range");
        for (short band = 0; band < count; band++) {
            check(effect.setBandLevel(band, mapLevel(band, centers, values, range[0], range[1])));
        }
        check(effect.setEnabled(active));
    }

    /** Assign UI bands to the nearest device center in octave space and average each bucket.
     * Device bands with no assigned UI band use their nearest UI frequency. Output is millibels.
     */
    static short mapLevel(int band, double[] centers, double[] values, short min, short max) {
        double total = 0;
        int count = 0;
        int nearestUi = 0;
        double nearestDistance = Double.POSITIVE_INFINITY;
        for (int ui = 0; ui < FREQUENCIES.length; ui++) {
            double distance = Math.abs(Math.log(FREQUENCIES[ui] / centers[band]));
            if (distance < nearestDistance) {
                nearestDistance = distance;
                nearestUi = ui;
            }
            int nearestBand = 0;
            double best = Double.POSITIVE_INFINITY;
            for (int device = 0; device < centers.length; device++) {
                double candidate = Math.abs(Math.log(FREQUENCIES[ui] / centers[device]));
                if (candidate < best) {
                    best = candidate;
                    nearestBand = device;
                }
            }
            if (nearestBand == band) {
                total += values[ui];
                count++;
            }
        }
        double db = count == 0 ? values[nearestUi] : total / count;
        return (short) Math.max(min, Math.min(max, Math.round(db * 100)));
    }

    private static void check(int status) {
        if (status != AudioEffect.SUCCESS) throw new IllegalStateException("Equalizer operation failed: " + status);
    }

    private void reapply() {
        if (!enabled || player == null || player.getAudioSessionId() <= 0) return;
        try {
            bind(player.getAudioSessionId());
            apply(enabled, gains);
        } catch (RuntimeException error) {
            releaseEffect();
            Log.w(Utils.LOG, "Equalizer session rebind failed", error);
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
