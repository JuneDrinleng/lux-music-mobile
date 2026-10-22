/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md. */
package cn.lux.music.mobile.download;

import android.content.Context;
import androidx.work.*;
import org.json.JSONObject;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

final class DownloadScheduler {
    static String name(String id) { return "lux-download-" + id; }
    // Persist before scheduling. Startup reconciliation repairs a kill between these steps.
    private static OneTimeWorkRequest.Builder builder(JSONObject item) throws Exception {
        return new OneTimeWorkRequest.Builder(DownloadWorker.class)
            .setInputData(new Data.Builder().putString("id", item.getString("id")).build())
            .setConstraints(new Constraints.Builder().setRequiredNetworkType(item.optBoolean("wifiOnly") ? NetworkType.UNMETERED : NetworkType.CONNECTED).build())
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS);
    }

    /** Startup repair from disk state only (no WorkManager status query): re-enqueue with the persisted work id
     *  under KEEP. Live work with the same unique name is left untouched; lost work (process kill, reboot,
     *  ROM cleanup) is recreated with the same id, so the worker's workId ownership check still passes. */
    static void ensure(Context context, JSONObject item) throws Exception {
        String workId = item.optString("workId");
        if (workId.isEmpty()) { schedule(context, item); return; }
        OneTimeWorkRequest request = builder(item).setId(UUID.fromString(workId)).build();
        WorkManager.getInstance(context).enqueueUniqueWork(name(item.getString("id")), ExistingWorkPolicy.KEEP, request);
    }

    static void schedule(Context context, JSONObject item) throws Exception {
        OneTimeWorkRequest request = builder(item).build();
        item.put("state", "queued").put("error", "").put("workId", request.getId().toString());
        DownloadStore.write(context, item);
        WorkManager.getInstance(context).enqueueUniqueWork(name(item.getString("id")), ExistingWorkPolicy.REPLACE, request).getResult().get();
    }
}
