/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md. */
package cn.lux.music.mobile.download;

import android.content.Context;
import android.util.AtomicFile;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HashMap;

/** Native state is authoritative; JS keeps no second persisted queue. All writes are atomic. */
final class DownloadStore {
    private static final HashMap<String, Object> LOCKS = new HashMap<>();
    static synchronized Object lock(String id) {
        Object lock = LOCKS.get(id);
        if (lock == null) { lock = new Object(); LOCKS.put(id, lock); }
        return lock;
    }
    static File directory(Context context) {
        File dir = new File(context.getFilesDir(), "downloads-v1");
        if (!dir.isDirectory() && !dir.mkdirs()) throw new IllegalStateException("DOWNLOAD_DIRECTORY");
        return dir;
    }
    static String id(String space, String key) throws Exception {
        byte[] bytes = MessageDigest.getInstance("SHA-256").digest((space + "\n" + key).getBytes(StandardCharsets.UTF_8));
        StringBuilder value = new StringBuilder();
        for (byte b : bytes) value.append(String.format(java.util.Locale.ROOT, "%02x", b & 255));
        return value.toString();
    }
    static File file(Context context, String id, String suffix) {
        if (!id.matches("[a-f0-9]{64}")) throw new IllegalArgumentException("DOWNLOAD_ID");
        return new File(directory(context), id + suffix);
    }
    static synchronized JSONObject read(Context context, String id) throws Exception {
        AtomicFile file = new AtomicFile(file(context, id, ".json"));
        if (!file.getBaseFile().exists() && !new File(file.getBaseFile() + ".bak").exists()) return null;
        return new JSONObject(new String(file.readFully(), StandardCharsets.UTF_8));
    }
    static synchronized void write(Context context, JSONObject item) throws Exception {
        AtomicFile file = new AtomicFile(file(context, item.getString("id"), ".json"));
        FileOutputStream stream = file.startWrite();
        try {
            stream.write(item.toString().getBytes(StandardCharsets.UTF_8));
            file.finishWrite(stream);
        } catch (Exception error) { file.failWrite(stream); throw error; }
        DownloadModule.emit();
    }
    static synchronized JSONArray list(Context context, String space) throws Exception {
        JSONArray items = new JSONArray();
        File[] files = directory(context).listFiles((dir, name) -> name.endsWith(".json") || name.endsWith(".json.bak"));
        java.util.HashSet<String> seen = new java.util.HashSet<>();
        if (files != null) for (File file : files) {
            String id = file.getName().substring(0, 64);
            if (!seen.add(id)) continue;
            JSONObject item = read(context, id);
            if (item != null && space.equals(item.optString("space"))) {
                item.put("bytes", file(context, id, ".part").length());
                if ("done".equals(item.optString("state"))) {
                    File audio = file(context, id, ".audio");
                    item.put("bytes", audio.length());
                    if (!audio.isFile() || audio.length() != item.optLong("total") || audio.length() == 0) {
                        item.put("state", "failed").put("error", audio.isFile() ? "SIZE_MISMATCH" : "FILE_MISSING");
                        write(context, item);
                    }
                }
                items.put(item);
            }
        }
        return items;
    }
}
