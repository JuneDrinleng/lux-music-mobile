/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md. */
package cn.lux.music.mobile.download;

import android.content.*;
import android.net.Uri;
import android.os.*;
import android.provider.Settings;
import com.facebook.react.bridge.*;
import com.facebook.react.modules.core.DeviceEventManagerModule;
import androidx.work.*;
import org.json.*;
import java.lang.ref.WeakReference;
import java.util.UUID;
import java.util.concurrent.*;

public class DownloadModule extends ReactContextBaseJavaModule {
    private static WeakReference<ReactApplicationContext> events = new WeakReference<>(null);
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    DownloadModule(ReactApplicationContext context) { super(context); events = new WeakReference<>(context); }
    @Override public String getName() { return "DownloadModule"; }
    static void emit() {
        ReactApplicationContext context = events.get();
        if (context != null && context.hasActiveReactInstance()) context.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class).emit("luxDownloadChanged", null);
    }
    @ReactMethod public void addListener(String name) {}
    @ReactMethod public void removeListeners(double count) {}
    private interface Operation { Object run() throws Exception; }
    private void run(Promise promise, Operation operation) {
        executor.execute(() -> { try { promise.resolve(operation.run()); } catch (Exception error) { promise.reject("DOWNLOAD_ERROR", error); } });
    }
    private Context context() { return getReactApplicationContext(); }
    @ReactMethod public void enqueue(String space, String payload, Promise promise) {
        run(promise, () -> {
            JSONArray batch = new JSONArray(payload);
            // Validate the whole batch before mutating disk; URL and size fields are never work Data.
            for (int i = 0; i < batch.length(); i++) {
                JSONObject item = batch.getJSONObject(i);
                Uri url = Uri.parse(item.getString("url"));
                if (!("https".equals(url.getScheme()) || "http".equals(url.getScheme())) || url.getHost() == null) throw new IllegalArgumentException("DOWNLOAD_URL");
                if (space.isEmpty() || item.getString("key").isEmpty() || item.optLong("estimatedSize") < 0 || item.optLong("expectedSize") < 0) throw new IllegalArgumentException("DOWNLOAD_INPUT");
            }
            long available = new StatFs(DownloadStore.directory(context()).getPath()).getAvailableBytes() - 8L * 1024 * 1024;
            for (int i = 0; i < batch.length(); i++) {
                JSONObject incoming = batch.getJSONObject(i);
                String id = DownloadStore.id(space, incoming.getString("key"));
                synchronized (DownloadStore.class) {
                    JSONObject item = DownloadStore.read(context(), id);
                    // A URL refresh must not resurrect a paused/deleted/replaced job.
                    if (incoming.has("refreshWorkId") && (item == null || !"failed".equals(item.optString("state")) || !"URL_EXPIRED".equals(item.optString("error")) || !incoming.getString("refreshWorkId").equals(item.optString("workId")))) continue;
                    if (item != null && "done".equals(item.optString("state"))) {
                        java.io.File audio = DownloadStore.file(context(), id, ".audio");
                        if (!audio.isFile() || audio.length() != item.optLong("total") || audio.length() == 0) item.put("state", "failed").put("error", audio.isFile() ? "SIZE_MISMATCH" : "FILE_MISSING");
                    }
                    if (item != null && ("done".equals(item.optString("state")) || "running".equals(item.optString("state")) || "queued".equals(item.optString("state")))) continue;
                    if (item == null) item = new JSONObject();
                    item.put("id", id).put("space", space).put("key", incoming.getString("key"))
                        .put("url", incoming.getString("url")).put("musicInfo", incoming.getJSONObject("musicInfo"))
                        .put("quality", incoming.getString("quality")).put("wifiOnly", incoming.optBoolean("wifiOnly", true))
                        .put("estimatedSize", incoming.optLong("estimatedSize")).put("expectedSize", incoming.optLong("expectedSize"));
                    long needed = Math.max(0, Math.max(item.optLong("expectedSize"), item.optLong("estimatedSize")) - DownloadStore.file(context(), id, ".part").length());
                    if (needed > available) { item.put("state", "failed").put("error", "INSUFFICIENT_STORAGE"); DownloadStore.write(context(), item); }
                    else { available -= needed; DownloadScheduler.schedule(context(), item); }
                }
            }
            return DownloadStore.list(context(), space).toString();
        });
    }
    @ReactMethod public void snapshot(String space, Promise promise) { run(promise, () -> DownloadStore.list(context(), space).toString()); }
    @ReactMethod public void reconcile(String space, Promise promise) {
        run(promise, () -> {
            JSONArray items = DownloadStore.list(context(), space);
            for (int i = 0; i < items.length(); i++) {
                JSONObject item = items.getJSONObject(i);
                String state = item.optString("state");
                if (!"running".equals(state) && !"queued".equals(state)) continue;
                synchronized (DownloadStore.class) {
                    JSONObject live = DownloadStore.read(context(), item.getString("id"));
                    // Re-read: completion, pause, or URL failure may have landed since the list was taken.
                    if (live != null && ("running".equals(live.optString("state")) || "queued".equals(live.optString("state")))) DownloadScheduler.ensure(context(), live);
                }
            }
            return DownloadStore.list(context(), space).toString();
        });
    }
    @ReactMethod public void command(String space, String key, String action, Promise promise) {
        run(promise, () -> {
            String id = DownloadStore.id(space, key);
            synchronized (DownloadStore.class) {
                JSONObject item = DownloadStore.read(context(), id);
                if (item == null) return null;
                String state = item.optString("state");
                if ("pause".equals(action) && ("queued".equals(state) || "running".equals(state) || "failed".equals(state))) {
                    item.put("state", "paused"); DownloadStore.write(context(), item);
                    WorkManager.getInstance(context()).cancelUniqueWork(DownloadScheduler.name(id)).getResult().get();
                } else if (("resume".equals(action) && "paused".equals(state)) || ("retry".equals(action) && "failed".equals(state))) {
                    DownloadScheduler.schedule(context(), item);
                }
            }
            return DownloadStore.list(context(), space).toString();
        });
    }
    @ReactMethod public void attachPlaylist(String space, String keysJson, String playlistId, String name, Promise promise) {
        run(promise, () -> {
            JSONArray keys = new JSONArray(keysJson);
            synchronized (DownloadStore.class) {
                for (int i = 0; i < keys.length(); i++) {
                    JSONObject item = DownloadStore.read(context(), DownloadStore.id(space, keys.getString(i)));
                    if (item == null) continue;
                    JSONObject playlists = item.optJSONObject("playlists");
                    if (playlists == null) playlists = new JSONObject();
                    playlists.put(playlistId, name);
                    item.put("playlists", playlists);
                    DownloadStore.write(context(), item);
                }
            }
            return DownloadStore.list(context(), space).toString();
        });
    }
    @ReactMethod public void removePlaylist(String space, String playlistId, Promise promise) {
        run(promise, () -> {
            JSONArray items = DownloadStore.list(context(), space);
            for (int i = 0; i < items.length(); i++) {
                String id = items.getJSONObject(i).getString("id");
                synchronized (DownloadStore.class) {
                    JSONObject item = DownloadStore.read(context(), id);
                    if (item == null) continue;
                    JSONObject playlists = item.optJSONObject("playlists");
                    if (playlistId.isEmpty()) {
                        if (playlists != null && playlists.length() > 0) continue;
                    } else {
                        if (playlists == null || !playlists.has(playlistId)) continue;
                        playlists.remove(playlistId);
                        if (playlists.length() > 0) { DownloadStore.write(context(), item); continue; }
                    }
                    item.put("state", "paused"); DownloadStore.write(context(), item);
                }
                WorkManager.getInstance(context()).cancelUniqueWork(DownloadScheduler.name(id)).getResult().get();
                synchronized (DownloadStore.lock(id)) {
                    for (String suffix : new String[]{".part", ".audio", ".json", ".json.bak", ".json.new"}) {
                        java.io.File file = DownloadStore.file(context(), id, suffix);
                        if (file.exists() && !file.delete()) throw new java.io.IOException("DOWNLOAD_DELETE_FAILED");
                    }
                }
            }
            emit(); return DownloadStore.list(context(), space).toString();
        });
    }
    @ReactMethod public void removeSpace(String space, Promise promise) {
        run(promise, () -> {
            JSONArray items = DownloadStore.list(context(), space);
            for (int i = 0; i < items.length(); i++) {
                String id = items.getJSONObject(i).getString("id");
                synchronized (DownloadStore.class) {
                    JSONObject item = DownloadStore.read(context(), id);
                    item.put("state", "paused"); DownloadStore.write(context(), item);
                }
                WorkManager.getInstance(context()).cancelUniqueWork(DownloadScheduler.name(id)).getResult().get();
                synchronized (DownloadStore.lock(id)) {
                    for (String suffix : new String[]{".part", ".audio", ".json", ".json.bak", ".json.new"}) {
                        java.io.File file = DownloadStore.file(context(), id, suffix);
                        if (file.exists() && !file.delete()) throw new java.io.IOException("DOWNLOAD_DELETE_FAILED");
                    }
                }
            }
            emit(); return null;
        });
    }
    @ReactMethod public void offlinePath(String space, String key, Promise promise) {
        run(promise, () -> {
            String id = DownloadStore.id(space, key);
            JSONObject item = DownloadStore.read(context(), id);
            java.io.File audio = DownloadStore.file(context(), id, ".audio");
            return item != null && "done".equals(item.optString("state")) && audio.isFile() && audio.length() == item.optLong("total") && audio.length() > 0 ? Uri.fromFile(audio).toString() : null;
        });
    }
    @ReactMethod public void availableBytes(Promise promise) {
        run(promise, () -> (double) new StatFs(DownloadStore.directory(context()).getPath()).getAvailableBytes());
    }
    @ReactMethod public void batteryStatus(Promise promise) {
        PowerManager manager = (PowerManager) context().getSystemService(Context.POWER_SERVICE);
        promise.resolve(Build.VERSION.SDK_INT < 23 || (manager != null && manager.isIgnoringBatteryOptimizations(context().getPackageName())));
    }
    @ReactMethod public void openBatterySettings(Promise promise) {
        try {
            context().startActivity(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            promise.resolve(true);
        } catch (Exception error) { promise.resolve(false); }
    }
}
