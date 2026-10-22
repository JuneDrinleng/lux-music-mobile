/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md. */
package cn.lux.music.mobile.download;

import android.app.*;
import android.content.Context;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.StatFs;
import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.work.*;
import org.json.JSONObject;
import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.regex.*;
import cn.lux.music.mobile.R;

/** One idempotent transfer per immutable id. Partial files are never visible to playback. */
public class DownloadWorker extends Worker {
    private volatile HttpURLConnection connection;
    private static final String CHANNEL = "lux-downloads";
    private String id;
    public DownloadWorker(@NonNull Context context, @NonNull WorkerParameters params) { super(context, params); }
    private boolean current(JSONObject item) {
        return item != null && getId().toString().equals(item.optString("workId"))
            && !"paused".equals(item.optString("state")) && !"done".equals(item.optString("state")) && !isStopped();
    }
    private boolean update(String state, String error) throws Exception {
        synchronized (DownloadStore.class) {
            JSONObject item = DownloadStore.read(getApplicationContext(), id);
            if (!current(item)) return false;
            item.put("state", state).put("error", error);
            DownloadStore.write(getApplicationContext(), item);
            return true;
        }
    }
    private ForegroundInfo foreground(long bytes, long total) {
        Context context = getApplicationContext();
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            manager.createNotificationChannel(new NotificationChannel(CHANNEL, context.getString(R.string.download_channel), NotificationManager.IMPORTANCE_LOW));
        }
        Notification notification = new NotificationCompat.Builder(context, CHANNEL)
            .setSmallIcon(android.R.drawable.stat_sys_download)
            .setContentTitle(context.getString(R.string.download_active))
            .setContentText(bytes + " / " + (total > 0 ? Long.toString(total) : "…"))
            .setOnlyAlertOnce(true).setOngoing(true).setPriority(NotificationCompat.PRIORITY_LOW)
            .setProgress(100, total > 0 ? (int) Math.min(100, bytes * 100.0 / total) : 0, total <= 0).build();
        int notificationId = 0x40000000 | (id.hashCode() & 0x3fffffff);
        return Build.VERSION.SDK_INT >= 29
            ? new ForegroundInfo(notificationId, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
            : new ForegroundInfo(notificationId, notification);
    }
    @NonNull @Override public Result doWork() {
        id = getInputData().getString("id");
        if (id == null) return Result.failure();
        synchronized (DownloadStore.lock(id)) {
            try { return transfer(); }
            catch (Exception error) {
                try {
                    if (isStopped()) return Result.retry();
                    if (error instanceof DownloadFailure) { update("failed", error.getMessage()); return Result.failure(); }
                    if (getRunAttemptCount() >= 5) { update("failed", "NETWORK_RETRY_EXHAUSTED"); return Result.failure(); }
                    update("queued", "NETWORK_RETRY");
                } catch (Exception ignored) { /* Retry if a state write failed. */ }
                return Result.retry();
            } finally { if (connection != null) connection.disconnect(); }
        }
    }
    private Result transfer() throws Exception {
        Context context = getApplicationContext();
        JSONObject item = DownloadStore.read(context, id);
        if (!current(item)) return Result.success();
        File part = DownloadStore.file(context, id, ".part");
        File audio = DownloadStore.file(context, id, ".audio");
        // Recover a kill after rename but before publishing done.
        if (audio.exists() && item.optLong("total") > 0 && audio.length() == item.optLong("total")) {
            update("done", ""); return Result.success();
        }
        setForegroundAsync(foreground(part.length(), item.optLong("total"))).get();
        if (!update("running", "")) return Result.success();
        long offset = part.length();
        String validator = item.optString("validator");
        if (offset > 0 && validator.isEmpty()) { truncate(part); offset = 0; }
        checkSpace(Math.max(0, item.optLong("estimatedSize") - offset));
        connection = (HttpURLConnection) new URL(item.getString("url")).openConnection();
        connection.setConnectTimeout(20000); connection.setReadTimeout(20000);
        connection.setRequestProperty("Accept-Encoding", "identity");
        if (offset > 0) {
            connection.setRequestProperty("Range", "bytes=" + offset + "-");
            connection.setRequestProperty("If-Range", validator);
        }
        int status = connection.getResponseCode();
        if (status == 403 || status == 410 || status == 401) {
            update("failed", "URL_EXPIRED"); return Result.failure();
        }
        if (status >= 400) {
            // Some signed providers return an explicit expiry response with HTTP 400.
            if (status == 400) {
                InputStream error = connection.getErrorStream();
                if (error != null) try (InputStream input = error) {
                    byte[] buffer = new byte[4096]; int count = input.read(buffer);
                    String message = count > 0 ? new String(buffer, 0, count, java.nio.charset.StandardCharsets.UTF_8).toLowerCase(java.util.Locale.ROOT) : "";
                    if (message.contains("expired") || message.contains("expiration")) { update("failed", "URL_EXPIRED"); return Result.failure(); }
                }
            }
            if (status == 416) { truncate(part); throw new IOException("RANGE_RESET"); }
            if (status == 429 || status >= 500) throw new IOException("HTTP_RETRY");
            throw new DownloadFailure("HTTP_" + status);
        }
        long total;
        if (status == 206) {
            Matcher range = Pattern.compile("bytes (\\d+)-(\\d+)/(\\d+)").matcher(String.valueOf(connection.getHeaderField("Content-Range")));
            if (!range.matches() || Long.parseLong(range.group(1)) != offset) throw new DownloadFailure("INVALID_RANGE");
            String responseValidator = connection.getHeaderField(validator.startsWith("\"") ? "ETag" : "Last-Modified");
            if (offset > 0 && responseValidator != null && !validator.equals(responseValidator)) { truncate(part); throw new IOException("RANGE_VALIDATOR_CHANGED"); }
            total = Long.parseLong(range.group(3));
            if (Long.parseLong(range.group(2)) != total - 1 || total <= offset) throw new DownloadFailure("INVALID_RANGE");
        } else if (status == 200) {
            if (offset > 0) truncate(part);
            offset = 0;
            String length = connection.getHeaderField("Content-Length");
            total = length == null ? item.optLong("expectedSize") : Long.parseLong(length);
        } else throw new DownloadFailure("HTTP_" + status);
        if (total <= 0) throw new DownloadFailure("UNKNOWN_SIZE");
        long expected = item.optLong("expectedSize");
        if (expected > 0 && expected != total) throw new DownloadFailure("SIZE_MISMATCH");
        checkSpace(total - offset);
        String etag = connection.getHeaderField("ETag");
        String nextValidator = etag != null && !etag.startsWith("W/") ? etag : connection.getHeaderField("Last-Modified");
        synchronized (DownloadStore.class) {
            JSONObject live = DownloadStore.read(context, id);
            if (!current(live)) return Result.success();
            live.put("total", total).put("validator", nextValidator == null ? "" : nextValidator);
            DownloadStore.write(context, live);
        }
        long bytes = offset;
        long lastProgress = 0;
        try (InputStream input = connection.getInputStream(); FileOutputStream output = new FileOutputStream(part, offset > 0)) {
            byte[] buffer = new byte[64 * 1024]; int count;
            while ((count = input.read(buffer)) != -1) {
                if (isStopped() || !current(DownloadStore.read(context, id))) return Result.success();
                checkSpace(count);
                output.write(buffer, 0, count); bytes += count;
                if (bytes > total) { truncateOnFailure = true; throw new DownloadFailure("SIZE_MISMATCH"); }
                if (System.currentTimeMillis() - lastProgress > 1000) {
                    lastProgress = System.currentTimeMillis();
                    setForegroundAsync(foreground(bytes, total));
                    DownloadModule.emit();
                }
            }
            output.getFD().sync();
        } finally { if (truncateOnFailure) truncate(part); }
        if (bytes != total) throw new IOException("INCOMPLETE_BODY");
        synchronized (DownloadStore.class) {
            if (!current(DownloadStore.read(context, id))) return Result.success();
            if (!part.renameTo(audio)) throw new DownloadFailure("ATOMIC_RENAME_FAILED");
            update("done", "");
        }
        return Result.success();
    }
    private boolean truncateOnFailure;
    private void checkSpace(long remaining) throws DownloadFailure {
        if (remaining < 0 || remaining > new StatFs(DownloadStore.directory(getApplicationContext()).getPath()).getAvailableBytes() - 8L * 1024 * 1024) throw new DownloadFailure("INSUFFICIENT_STORAGE");
    }
    private static void truncate(File file) throws IOException { try (FileOutputStream output = new FileOutputStream(file)) { output.getFD().sync(); } }
    @Override public void onStopped() { if (connection != null) connection.disconnect(); }
    private static final class DownloadFailure extends IOException { DownloadFailure(String message) { super(message); } }
}
